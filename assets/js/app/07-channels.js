/* CatChat · Quyền admin theo kênh: danh sách kênh, chuyển/tạo kênh, listener tin nhắn.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function channelNameFor(channelId) {
  if (channelId === 'general') return channels.general?.name || 'phòng-chung';
  const entry = channels[channelId];
  return typeof entry?.name === 'string' && entry.name.trim() ? entry.name : channelId;
}

function channelDescriptionFor(channelId) {
  if (channelId === 'general') return channels.general?.description || 'Nơi mọi người cùng trò chuyện';
  const entry = channels[channelId];
  return typeof entry?.description === 'string' && entry.description.trim() ? entry.description : 'Kênh cộng đồng';
}

function renderChannelList() {
  if (!channels.general) channels.general = { name: 'phòng-chung', description: 'Nơi mọi người cùng trò chuyện', system: true };
  const entries = Object.entries(channels)
    .filter(([id, value]) => id === 'general' || (value && typeof value === 'object'))
    .sort(([idA], [idB]) => idA === 'general' ? -1 : idB === 'general' ? 1 : channelNameFor(idA).localeCompare(channelNameFor(idB), 'vi'));
  const channelFragment = document.createDocumentFragment();
  const selectFragment = document.createDocumentFragment();
  entries.forEach(([id]) => {
    const name = channelNameFor(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `channel-link${id === activeChannelId ? ' active' : ''}`;
    button.dataset.channelId = id;
    button.setAttribute('aria-current', String(id === activeChannelId));
    button.title = `#${name}`;
    button.append(textElement('span', 'channel-mark', '#'), textElement('span', 'channel-name', name));
    channelFragment.appendChild(button);
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `# ${name}`;
    selectFragment.appendChild(option);
  });
  const announcementsOption = document.createElement('option');
  announcementsOption.value = '__announcements';
  announcementsOption.textContent = 'Thông báo';
  selectFragment.appendChild(announcementsOption);
  els.channelList.replaceChildren(channelFragment);
  els.mobileChannelSelect.replaceChildren(selectFragment);
  els.mobileChannelSelect.value = activeChannelId;
}

function updateActiveChannelUI() {
  if (announcementMode) {
    els.channelSymbol.textContent = '📣';
    els.channelTitle.textContent = 'thông-báo';
    els.channelMemberSummary.textContent = isAdmin
      ? 'Đăng thông báo tới toàn bộ tổ mèo'
      : 'Chỉ quản trị viên được đăng thông báo';
    els.mobileChannelSelect.value = activeChannelId;
    syncChannelChrome();
    return;
  }
  const name = channelNameFor(activeChannelId);
  els.channelTitle.textContent = name;
  els.channelSymbol.textContent = '#';
  els.channelMemberSummary.textContent = channelDescriptionFor(activeChannelId);
  els.chatMessages.setAttribute('aria-label', `Tin nhắn trong kênh ${name}`);
  els.messageInput.placeholder = `Nhắn tin trong #${name}...`;
  els.chatEmptyState.querySelector('h3').textContent = `Bắt đầu trò chuyện tại #${name}`;
  els.chatEmptyState.querySelector('p').textContent = channelDescriptionFor(activeChannelId);
  els.mobileChannelSelect.value = activeChannelId;
  $$('.channel-link[data-channel-id]', els.channelList).forEach((button) => {
    const active = button.dataset.channelId === activeChannelId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', String(active));
  });
  els.clearChannelButton.title = `Xóa toàn bộ tin nhắn trong #${name}`;
  els.clearChannelButton.setAttribute('aria-label', `Xóa toàn bộ tin nhắn trong #${name}`);
  syncChannelChrome();
}

function openChannelDialog() {
  if (!isAdmin || !currentUser) {
    toast('Chỉ quản trị viên được cấp quyền trên Firebase mới có thể tạo kênh.', 'error');
    return;
  }
  els.channelNameInput.value = '';
  els.channelDialog.hidden = false;
  els.channelDialog.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => els.channelDialog.classList.add('open'));
  document.body.classList.add('body-locked');
  window.setTimeout(() => els.channelNameInput.focus(), 30);
}

function closeChannelDialog() {
  els.channelDialog.classList.remove('open');
  els.channelDialog.setAttribute('aria-hidden', 'true');
  els.channelDialog.hidden = true;
  if (!els.confirmLayer.classList.contains('open') && !els.adminOverlay.classList.contains('open')) document.body.classList.remove('body-locked');
}

function normalizeChannelId(value) {
  return String(value || '').trim().toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32).replace(/-+$/g, '');
}

async function createChannel(event) {
  event.preventDefault();
  if (!isAdmin || !currentUser || !channelsRef) {
    toast('Bạn không có quyền tạo kênh.', 'error');
    return;
  }
  const channelId = normalizeChannelId(els.channelNameInput.value);
  if (!channelId) {
    toast('Nhập tên kênh gồm chữ, số hoặc dấu gạch ngang.', 'error');
    els.channelNameInput.focus();
    return;
  }
  if (['general', 'thong-bao', 'constructor', 'prototype'].includes(channelId)) {
    toast('Tên này đã được dành riêng cho kênh hệ thống.', 'error');
    return;
  }
  if (Object.keys(channels).length >= 50) {
    toast('Không gian đã đạt giới hạn 50 kênh.', 'error');
    return;
  }
  const user = currentUser;
  const channel = { name: channelId, description: 'Kênh cộng đồng', createdBy: user.uid, createdAt: currentTimestamp() };
  els.createChannelSubmit.disabled = true;
  try {
    const result = await channelsRef.child(channelId).transaction((existing) => existing === null ? channel : undefined);
    if (!result.committed) {
      toast('Tên kênh này đã tồn tại. Hãy chọn tên khác.', 'error');
      els.channelNameInput.focus();
      return;
    }
    if (currentUser?.uid !== user.uid) return;
    channels[channelId] = result.snapshot.val() || channel;
    renderChannelList();
    closeChannelDialog();
    toast(`Đã tạo #${channelId}.`, 'success');
    void logAdminAction('channel', `Tạo kênh #${channelId}`);
    if (currentUser?.uid === user.uid) await switchChannel(channelId);
  } catch (error) {
    showDatabaseError(error, 'Không thể tạo kênh. Hãy kiểm tra quyền ghi /channels trong Firebase Rules.');
  } finally {
    els.createChannelSubmit.disabled = false;
  }
}

async function switchChannel(channelId, { skipConfirm = false, force = false } = {}) {
  if (!currentUser || !database) return false;
  if (channelId !== 'general' && (!Object.prototype.hasOwnProperty.call(channels, channelId) || !channels[channelId] || typeof channels[channelId] !== 'object')) return false;
  if (!force && activeChannelId === channelId) return true;
  const requestedUser = currentUser;
  const requestedGeneration = authGeneration;
  if (isSendingMessage) {
    toast('Đợi tin nhắn đang gửi xong rồi mới đổi kênh nhé.', 'info');
    return false;
  }
  const hasDraft = Boolean(els.messageInput.value.trim() || pendingImageFile || replyTarget);
  if (!skipConfirm && hasDraft) {
    const result = await openConfirm({
      title: 'Bỏ bản nháp và đổi kênh?',
      description: 'Nội dung, ảnh đính kèm hoặc trả lời đang soạn sẽ bị xóa khi chuyển sang kênh khác.',
      acceptLabel: 'Đổi kênh', tone: 'primary', iconName: 'hash'
    });
    if (!result) return false;
  }
  if (currentUser?.uid !== requestedUser.uid || authGeneration !== requestedGeneration) return false;
  const user = requestedUser;
  const generation = requestedGeneration;
  const ref = channelId === 'general' ? generalMessagesRef : database.ref(`channelMessages/${channelId}`);
  if (!ref) return false;
  if (announcementMode) {
    announcementMode = false;
    $('#announcementModeBar').hidden = true;
    els.channelAnnouncements.classList.remove('active');
    els.appView.classList.remove('announcement-focus');
  }
  stopChannelRealtime();
  const channelRun = ++channelGeneration;
  activeChannelId = channelId;
  messagesRef = ref;
  messages.clear();
  messageReactions = {};
  clearReplyTarget();
  clearPendingImage();
  editingMessageId = null;
  editingDraft = '';
  els.messageInput.value = '';
  messageSearchQuery = '';
  els.messageSearchInput.value = '';
  els.messageSearchBar.hidden = true;
  $('#searchMessagesButton').setAttribute('aria-expanded', 'false');
  announcementDismissedId = null;
  renderChannelList();
  updateActiveChannelUI();
  syncChannelChrome();
  renderAllMessages(false);
  updateAnnouncementBanner();
  await startChannelMessageListeners(user, generation, channelId, channelRun, ref);
  return true;
}

async function startChannelMessageListeners(user, generation, channelId, channelRun, channelRef) {
  const messageQuery = channelRef.orderByChild('timestamp').limitToLast(100);
  const isCurrent = () => generation === authGeneration && channelRun === channelGeneration && activeChannelId === channelId && currentUser?.uid === user.uid;
  els.chatMessages.replaceChildren(els.chatEmptyState);
  try {
    const snapshot = await messageQuery.once('value');
    if (!isCurrent()) return;
    messages.clear();
    snapshot.forEach((child) => messages.set(child.key, child.val() || {}));
    renderAllMessages(true);
    updateAnnouncementBanner();
    renderAdminPanel();
    syncReactionListeners(generation, channelRun);
    subscribe(messageQuery, 'child_added', (child) => {
      if (!isCurrent()) return;
      const isNew = !messages.has(child.key);
      messages.set(child.key, child.val() || {});
      if (isNew) {
        renderAllMessages(false, true);
        syncReactionListeners(generation, channelRun);
      }
      updateAnnouncementBanner();
      renderAdminPanel();
    }, (error) => showDatabaseError(error, `Không thể tải tin nhắn trong #${channelNameFor(channelId)}.`), channelCleanupFns);
    subscribe(messageQuery, 'child_changed', (child) => {
      if (!isCurrent()) return;
      messages.set(child.key, child.val() || {});
      renderAllMessages(false);
      updateAnnouncementBanner();
      renderAdminPanel();
    }, (error) => showDatabaseError(error, 'Không thể cập nhật tin nhắn.'), channelCleanupFns);
    subscribe(messageQuery, 'child_removed', (child) => {
      if (!isCurrent()) return;
      messages.delete(child.key);
      syncReactionListeners(generation, channelRun);
      renderAllMessages(false);
      updateAnnouncementBanner();
      renderAdminPanel();
    }, (error) => showDatabaseError(error, 'Không thể đồng bộ thao tác xóa tin nhắn.'), channelCleanupFns);
  } catch (error) {
    if (!isCurrent()) return;
    showDatabaseError(error, 'Không thể tải tin nhắn. Kiểm tra quyền đọc kênh trong Firebase.');
    renderAllMessages(true);
  }
}

function startAnnouncementListeners(user, generation) {
  const announcementQuery = generalMessagesRef.orderByChild('timestamp').limitToLast(100);
  const isCurrent = () => generation === authGeneration && currentUser?.uid === user.uid;
  announcementQuery.once('value').then((snapshot) => {
    if (!isCurrent()) return;
    announcementMessages.clear();
    snapshot.forEach((child) => {
      const data = child.val() || {};
      if (data.kind === 'announcement') announcementMessages.set(child.key, data);
    });
    updateAnnouncementBanner();
    renderAdminPanel();
    subscribe(announcementQuery, 'child_added', (child) => {
      if (!isCurrent()) return;
      const data = child.val() || {};
      if (data.kind !== 'announcement') return;
      announcementMessages.set(child.key, data);
      updateAnnouncementBanner();
      renderAdminPanel();
    }, (error) => showDatabaseError(error, 'Không thể đồng bộ thông báo máy chủ.'));
    subscribe(announcementQuery, 'child_changed', (child) => {
      if (!isCurrent()) return;
      const wasAnnouncement = announcementMessages.has(child.key);
      const data = child.val() || {};
      if (data.kind === 'announcement') announcementMessages.set(child.key, data);
      else announcementMessages.delete(child.key);
      if (wasAnnouncement || data.kind === 'announcement') {
        updateAnnouncementBanner();
        renderAdminPanel();
      }
    }, (error) => showDatabaseError(error, 'Không thể cập nhật thông báo máy chủ.'));
    subscribe(announcementQuery, 'child_removed', (child) => {
      if (!isCurrent() || !announcementMessages.delete(child.key)) return;
      updateAnnouncementBanner();
      renderAdminPanel();
    }, (error) => showDatabaseError(error, 'Không thể đồng bộ thao tác xóa thông báo.'));
  }).catch((error) => {
    if (isCurrent()) showDatabaseError(error, 'Không thể tải thông báo trong /messages.');
  });
}

async function enterWorkspace(user, generation) {
  setConnectionState('connecting');
  currentUser = user;
  updateCurrentUserUI();
  try {
    const banSnapshot = await bansRef.child(user.uid).once('value');
    if (generation !== authGeneration) return;
    if (banSnapshot.exists()) {
      const reason = banSnapshot.child('reason').val();
      signedOutNotice = reason ? `Tài khoản của bạn đang bị chặn truy cập ứng dụng. Lý do: ${reason}` : 'Tài khoản của bạn đang bị chặn truy cập ứng dụng. Hãy liên hệ quản trị viên.';
      await auth.signOut();
      return;
    }
  } catch (error) {
    // Nếu Security Rules chưa cho đọc bans/<uid>, các listener bảo vệ vẫn cần được cấu hình ở Firebase.
    console.warn('Không kiểm tra được trạng thái ban:', error);
  }
  if (generation !== authGeneration) return;
  els.authView.hidden = true;
  els.appView.hidden = false;
  try { await syncMemberProfile(user); }
  catch (error) { showDatabaseError(error, 'Không thể lưu hồ sơ thành viên. Hãy kiểm tra Security Rules.'); }
  if (generation !== authGeneration) return;
  startRealtimeListeners(user, generation);
  setupPresence(user, generation);
}
