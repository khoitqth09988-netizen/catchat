/* CatChat · Sửa/xoá tin nhắn, ghim, khoá kênh, mute, nhật ký, tổng quan và export.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

let editingMessageId = null;
let editingDraft = '';
let pinnedJumpId = null;

function messageTargetRef(data) {
  if (!data) return messagesRef;
  if (data.kind === 'announcement') return generalMessagesRef || messagesRef;
  return messagesRef;
}

function isMessageOwner(data) {
  return Boolean(currentUser && data && data.uid && data.uid === currentUser.uid);
}

function canEditMessage(data) {
  if (!currentUser || !data) return false;
  if (isAdmin) return true;
  if (data.kind === 'announcement') return false;
  if (currentUser.uid && isMuted(currentUser.uid)) return false;
  return isMessageOwner(data);
}

function canDeleteMessage(data) {
  if (!currentUser || !data) return false;
  if (data.kind === 'announcement') return isAdmin;
  return isAdmin || isMessageOwner(data);
}

function editWindowLabel(data) {
  if (!data?.editedAt) return '';
  return `đã chỉnh sửa · ${formatDateTime(timestampOf({ timestamp: data.editedAt }))}`;
}

function makeMessageTool(iconName, label, dataset) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'message-tool';
  button.setAttribute('aria-label', label);
  button.title = label;
  Object.entries(dataset || {}).forEach(([key, value]) => { button.dataset[key] = value; });
  button.appendChild(icon(iconName));
  return button;
}

function messageDataById(messageId) {
  return messages.get(messageId) || announcementMessages.get(messageId) || null;
}

function beginMessageEdit(messageId) {
  const data = messageDataById(messageId);
  if (!data) {
    toast('Tin nhắn này không còn trong danh sách gần đây.', 'info');
    return;
  }
  if (!canEditMessage(data)) {
    toast(isMuted(currentUser?.uid) ? 'Bạn đang bị cấm chat nên không sửa được tin nhắn.' : 'Bạn chỉ sửa được tin nhắn của chính mình.', 'error');
    return;
  }
  editingMessageId = messageId;
  editingDraft = String(data.text || '');
  setEmojiPickerOpen(false);
  renderAllMessages(false);
  const input = els.chatMessages.querySelector('.message-edit textarea');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function cancelMessageEdit() {
  if (!editingMessageId) return;
  editingMessageId = null;
  editingDraft = '';
  renderAllMessages(false);
}

async function saveMessageEdit(messageId = editingMessageId) {
  if (!messageId) return;
  const data = messageDataById(messageId);
  if (!data || !canEditMessage(data)) {
    cancelMessageEdit();
    return;
  }
  const text = editingDraft.trim();
  if (!text) {
    toast('Nội dung tin nhắn không được để trống.', 'error');
    return;
  }
  if (text === String(data.text || '').trim()) {
    cancelMessageEdit();
    return;
  }
  const targetRef = messageTargetRef(data);
  if (!targetRef) return;
  const nextText = text.slice(0, 800);
  try {
    await targetRef.child(messageId).update({ text: nextText, editedAt: currentTimestamp() });
    // Cập nhật ngay trên máy (optimistic): trước đây chỉ chờ listener child_changed,
    // nên nếu sự kiện đó không tới thì giao diện vẫn hiện nội dung cũ cho tới khi tải lại.
    applyLocalMessageEdit(messageId, nextText);
    editingMessageId = null;
    editingDraft = '';
    renderAllMessages(false);
    updateAnnouncementBanner();
    toast('Đã cập nhật tin nhắn.', 'success');
    if (isAdmin && !isMessageOwner(data)) {
      void logAdminAction('edit', `Sửa tin nhắn của ${data.name || 'thành viên'}: ${nextText.slice(0, 80)}`, data.uid || '');
    }
  } catch (error) {
    showDatabaseError(error, 'Không sửa được tin nhắn. Kiểm tra quyền ghi /messages trong Firebase Rules.');
  }
}

/**
 * Ghi nội dung mới vào state cục bộ sau khi server đã xác nhận.
 * Sửa cả `messages` và `announcementMessages` vì cùng một tin có thể nằm ở cả hai.
 * `editedAt` dùng giờ máy để nhãn “đã chỉnh sửa” hiện ngay; khi listener trả về
 * giá trị server thì nó sẽ ghi đè bằng số chính xác.
 */
function applyLocalMessageEdit(messageId, nextText) {
  const patch = (store) => {
    const current = store.get(messageId);
    if (!current) return;
    store.set(messageId, { ...current, text: nextText, editedAt: Date.now() });
  };
  patch(messages);
  patch(announcementMessages);
  // Giữ nguyên bản ghi đang mở trong hộp sửa (nếu có) để không mất nội dung vừa lưu.
  if (pins[activeChannelId] && pins[activeChannelId].messageId === messageId) {
    pins[activeChannelId] = { ...pins[activeChannelId], text: nextText.slice(0, 180) };
    renderPinnedBanner();
  }
}

async function togglePinMessage(messageId) {
  if (!isAdmin || !pinsRef) {
    toast('Chỉ quản trị viên được ghim tin nhắn.', 'error');
    return;
  }
  const data = messageDataById(messageId);
  if (!data) return;
  const current = pins[activeChannelId];
  try {
    if (current && current.messageId === messageId) {
      await pinsRef.child(activeChannelId).remove();
      toast('Đã bỏ ghim tin nhắn.', 'success');
      void logAdminAction('unpin', `Bỏ ghim tin nhắn của ${data.name || 'thành viên'}`);
      return;
    }
    await pinsRef.child(activeChannelId).set({
      messageId,
      name: data.name || 'Thành viên',
      text: String(data.text || (data.imageURL ? '[Ảnh đính kèm]' : '')).slice(0, 180),
      by: currentUser.uid,
      at: currentTimestamp()
    });
    toast('Đã ghim tin nhắn vào đầu kênh.', 'success');
    void logAdminAction('pin', `Ghim tin nhắn của ${data.name || 'thành viên'}: ${String(data.text || '').slice(0, 80)}`, data.uid || '');
  } catch (error) {
    showDatabaseError(error, 'Không ghim được tin nhắn. Kiểm tra quyền /pins trong Firebase Rules.');
  }
}

function isChannelLocked(channelId = activeChannelId) {
  return Boolean(locks[channelId] && locks[channelId].locked === true);
}

async function toggleChannelLock() {
  if (!isAdmin || !locksRef) {
    toast('Chỉ quản trị viên được khoá kênh.', 'error');
    return;
  }
  const channelId = activeChannelId;
  const locked = isChannelLocked(channelId);
  const name = channelNameFor(channelId);
  const confirm = await openConfirm({
    title: locked ? `Mở khoá #${name}?` : `Khoá #${name}?`,
    description: locked
      ? 'Mọi thành viên có thể gửi tin nhắn trở lại trong kênh này.'
      : 'Thành viên sẽ không gửi được tin nhắn mới trong kênh này. Quản trị viên vẫn đăng được.',
    acceptLabel: locked ? 'Mở khoá' : 'Khoá kênh',
    tone: locked ? 'primary' : 'danger',
    iconName: locked ? 'unlock' : 'lock'
  });
  if (!confirm) return;
  try {
    if (locked) {
      await locksRef.child(channelId).remove();
      toast(`Đã mở khoá #${name}.`, 'success');
      void logAdminAction('unlock', `Mở khoá kênh #${name}`);
    } else {
      await locksRef.child(channelId).set({ locked: true, by: currentUser.uid, at: currentTimestamp(), name: displayNameFor(currentUser).slice(0, 32) });
      toast(`Đã khoá #${name}.`, 'success');
      void logAdminAction('lock', `Khoá kênh #${name}`);
    }
  } catch (error) {
    showDatabaseError(error, 'Không đổi được trạng thái khoá kênh. Kiểm tra quyền /locks.');
  }
}

function renderPinnedBanner() {
  const banner = $('#pinnedBanner');
  if (!banner) return;
  const pin = pins[activeChannelId];
  if (!pin || !pin.messageId) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  $('#pinnedAuthor').textContent = `Đã ghim · ${pin.name || 'Thành viên'}`;
  $('#pinnedText').textContent = pin.text || '[Ảnh đính kèm]';
  pinnedJumpId = pin.messageId;
  $('#unpinButton').hidden = !isAdmin;
}

function syncChannelChrome() {
  const locked = isChannelLocked(activeChannelId);
  const lockChip = $('#lockChip');
  const lockButton = $('#channelLockButton');
  if (lockChip) lockChip.hidden = !locked;
  if (lockButton) {
    lockButton.hidden = !isAdmin;
    lockButton.classList.toggle('is-locked', locked);
    lockButton.title = locked ? 'Mở khoá kênh' : 'Khoá kênh (chỉ admin gửi được)';
    lockButton.setAttribute('aria-label', lockButton.title);
    const use = lockButton.querySelector('use');
    if (use) use.setAttribute('href', locked ? '#i-unlock' : '#i-lock');
  }
  els.appView.classList.toggle('channel-locked', locked);
  renderPinnedBanner();
}

async function purgeUserMessages(uid) {
  if (!isAdmin || !currentUser || !uid || !messagesRef) return;
  if (uid === currentUser.uid) {
    toast('Dùng nút dọn kênh để xoá toàn bộ tin nhắn.', 'info');
    return;
  }
  const name = memberDisplayName(uid, members[uid]);
  const targets = Array.from(messages.entries()).filter(([, data]) => data && data.uid === uid).map(([id]) => id);
  if (!targets.length) {
    toast(`${name} chưa có tin nhắn nào trong kênh này.`, 'info');
    return;
  }
  const confirm = await openConfirm({
    title: `Xoá ${targets.length} tin nhắn của ${name}?`,
    description: 'Chỉ xoá tin nhắn của người này trong kênh đang mở. Hành động không thể hoàn tác.',
    acceptLabel: `Xoá ${targets.length} tin nhắn`,
    tone: 'danger',
    iconName: 'trash'
  });
  if (!confirm) return;
  try {
    await Promise.all(targets.map((id) => messagesRef.child(id).remove()));
    await Promise.all(targets.map((id) => messageReactionsRef.child(id).remove().catch(() => {})));
    toast(`Đã xoá ${targets.length} tin nhắn của ${name}.`, 'success');
    void logAdminAction('purge', `Xoá ${targets.length} tin nhắn của ${name} trong #${channelNameFor(activeChannelId)}`, uid);
  } catch (error) {
    showDatabaseError(error, 'Không xoá được tin nhắn của thành viên này. Kiểm tra Rules.');
  }
}

const ADMIN_LOG_ICONS = {
  ban: 'ban', unban: 'unban', mute: 'mute', unmute: 'smile',
  delete: 'trash', clear: 'trash', announcement: 'megaphone', export: 'download', channel: 'hash',
  edit: 'edit', pin: 'pin', unpin: 'pin', lock: 'lock', unlock: 'unlock', purge: 'trash',
  deleteAccount: 'user-x'
};

function renderMuteBanner() {
  const banner = $('#muteBanner');
  if (!banner) return;
  const uid = currentUser?.uid;
  const entry = uid ? mutes[uid] : null;
  const active = uid ? isMuted(uid) : false;
  if (!active) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const label = muteRemainingLabel(entry);
  const reason = String(entry?.reason || '').trim();
  $('#muteBannerText').innerHTML = '';
  const text = document.createElement('span');
  text.append(document.createTextNode('Bạn đang bị cấm chat '));
  const strong = document.createElement('strong');
  strong.textContent = label;
  text.append(strong, document.createTextNode(reason ? ` · Lý do: ${reason}` : '.'));
  $('#muteBannerText').appendChild(text);
}

function openMuteDialog(uid, name) {
  if (!isAdmin) return;
  const dialog = $('#muteDialog');
  if (!dialog) return;
  muteDurationMinutes = 1440;
  $('#muteReason').value = '';
  $('#muteDialogDescription').textContent = `${name || 'Thành viên'} sẽ không gửi được tin nhắn cho tới khi hết thời hạn hoặc được bỏ cấm.`;
  $$('[data-mute-duration]').forEach((button) => {
    const active = button.dataset.muteDuration === '1440';
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  dialog.hidden = false;
  dialog.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => dialog.classList.add('open'));
  document.body.classList.add('body-locked');
  window.setTimeout(() => $('#muteReason').focus(), 40);
  return new Promise((resolve) => { muteResolver = resolve; });
}

function closeMuteDialog(result) {
  const dialog = $('#muteDialog');
  if (!dialog || dialog.hidden) return;
  dialog.classList.remove('open');
  dialog.setAttribute('aria-hidden', 'true');
  dialog.hidden = true;
  if (!els.confirmLayer.classList.contains('open') && !els.adminOverlay.classList.contains('open') && els.channelDialog.hidden) {
    document.body.classList.remove('body-locked');
  }
  if (muteResolver) {
    const resolve = muteResolver;
    muteResolver = null;
    resolve(result || null);
  }
}

async function logAdminAction(type, detail, targetUid = '') {
  if (!isAdmin || !adminLogRef || !currentUser) return;
  try {
    await adminLogRef.push({
      type,
      detail: String(detail || '').slice(0, 220),
      targetUid: targetUid || '',
      adminUid: currentUser.uid,
      adminName: displayNameFor(currentUser).slice(0, 32),
      timestamp: currentTimestamp()
    });
  } catch (error) {
    console.warn('Không ghi được nhật ký quản trị:', error);
  }
}

async function manageMute(uid, shouldMute) {
  if (!isAdmin || !currentUser || !uid || !mutesRef) {
    toast('Không thể thay đổi quyền chat lúc này.', 'error');
    return;
  }
  if (uid === currentUser.uid) {
    toast('Bạn không thể tự cấm chat chính mình.', 'error');
    return;
  }
  const member = members[uid] || {};
  const name = memberDisplayName(uid, member);
  if (shouldMute) {
    const result = await openMuteDialog(uid, name);
    if (!result) return;
    const until = result.minutes > 0 ? Date.now() + result.minutes * 60000 : 0;
    try {
      await mutesRef.child(uid).set({
        reason: result.reason || '',
        mutedBy: currentUser.uid,
        mutedByName: displayNameFor(currentUser).slice(0, 32),
        mutedAt: currentTimestamp(),
        until
      });
      mutes[uid] = { reason: result.reason || '', until };
      toast(`Đã cấm chat ${name}${result.minutes ? ` trong ${result.minutes < 60 ? `${result.minutes} phút` : result.minutes < 1440 ? `${Math.round(result.minutes / 60)} giờ` : `${Math.round(result.minutes / 1440)} ngày`}` : ' vĩnh viễn'}.`, 'success');
      void logAdminAction('mute', `Cấm chat ${name}${result.minutes ? '' : ' (vĩnh viễn)'}${result.reason ? ` · ${result.reason}` : ''}`, uid);
      renderMembers();
      renderAdminPanel();
    } catch (error) {
      showDatabaseError(error, 'Không cấm chat được. Hãy kiểm tra quyền /mutes trong Firebase Rules.');
    }
  } else {
    const result = await openConfirm({
      title: `Bỏ cấm chat ${name}?`,
      description: 'Thành viên có thể gửi tin nhắn trở lại ngay sau khi bạn xác nhận.',
      acceptLabel: 'Bỏ cấm chat',
      tone: 'primary',
      iconName: 'smile'
    });
    if (!result) return;
    try {
      await mutesRef.child(uid).remove();
      delete mutes[uid];
      toast(`Đã bỏ cấm chat ${name}.`, 'success');
      void logAdminAction('unmute', `Bỏ cấm chat ${name}`, uid);
      renderMembers();
      renderAdminPanel();
    } catch (error) {
      showDatabaseError(error, 'Không bỏ cấm chat được. Hãy kiểm tra quyền /mutes trong Firebase Rules.');
    }
  }
  renderMuteBanner();
  updateMessageComposer();
}

function renderAdminLog() {
  const list = $('#adminLogList');
  if (!list) return;
  if (!adminLogEntries.length) {
    list.replaceChildren(textElement('div', 'admin-log-empty', 'Chưa có hoạt động quản trị nào.'));
    return;
  }
  const fragment = document.createDocumentFragment();
  adminLogEntries.slice(0, 24).forEach((entry) => {
    const item = textElement('div', 'admin-log-item');
    const badge = textElement('span', 'admin-log-icon');
    badge.appendChild(icon(ADMIN_LOG_ICONS[entry.type] || 'shield'));
    const copy = textElement('div', 'admin-log-copy');
    copy.appendChild(textElement('strong', '', entry.detail || 'Thao tác quản trị'));
    copy.appendChild(textElement('span', '', `${entry.adminName || 'Quản trị viên'} · ${formatDateTime(Number(entry.timestamp) || Date.now())}`));
    item.append(badge, copy);
    fragment.appendChild(item);
  });
  list.replaceChildren(fragment);
}

function renderAdminOverview() {
  const entries = memberEntries();
  const mutedCount = activeMutes().length;
  const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = String(value); };
  setText('#overviewMembers', entries.length);
  setText('#overviewOnline', Object.keys(presence).length);
  setText('#overviewMuted', mutedCount);
  setText('#overviewBanned', Object.keys(bans).length);
  setText('#overviewMessages', messages.size);
  setText('#overviewChannels', Math.max(1, Object.keys(channels).length));
  const navAdminCount = $('#navAdminCount');
  if (navAdminCount && isAdmin) {
    const pending = Object.keys(bans).length + mutedCount;
    navAdminCount.textContent = pending ? String(pending) : '';
    navAdminCount.hidden = !pending;
  }

  const mutedList = $('#adminMutedList');
  if (mutedList) {
    const active = activeMutes();
    setText('#adminMutedCountLabel', `${active.length} người`);
    if (!active.length) {
      mutedList.replaceChildren(textElement('div', 'admin-empty', 'Chưa có ai bị cấm chat.'));
    } else {
      const fragment = document.createDocumentFragment();
      active
        .sort((a, b) => (Number(a[1].until) || 0) - (Number(b[1].until) || 0))
        .forEach(([uid, entry]) => {
          const name = memberDisplayName(uid, members[uid]);
          const row = textElement('div', 'admin-muted-row');
          row.appendChild(makeAvatar(name, uid, 'avatar', members[uid]?.photoURL || ''));
          const copy = textElement('div', 'admin-muted-copy');
          copy.appendChild(textElement('strong', '', name));
          copy.appendChild(textElement('span', '', `${muteRemainingLabel(entry)}${entry.reason ? ` · ${entry.reason}` : ''}`));
          row.appendChild(copy);
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.muteAction = 'unmute';
          button.dataset.uid = uid;
          button.textContent = 'Bỏ cấm';
          row.appendChild(button);
          fragment.appendChild(row);
        });
      mutedList.replaceChildren(fragment);
    }
  }
  renderAdminLog();
}

function exportChannelData() {
  if (!isAdmin) return;
  const channelId = activeChannelId;
  const payload = {
    channel: channelId,
    channelName: channelNameFor(channelId),
    exportedAt: new Date().toISOString(),
    exportedBy: displayNameFor(currentUser),
    count: messages.size,
    messages: Array.from(messages.entries())
      .sort((a, b) => timestampOf(a[1]) - timestampOf(b[1]))
      .map(([id, data]) => ({
        id,
        uid: data.uid || '',
        name: data.name || '',
        text: data.text || '',
        kind: data.kind || 'message',
        timestamp: timestampOf(data),
        imageURL: data.imageURL || '',
        replyTo: data.replyTo || '',
        replyText: data.replyText || ''
      }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `catchat-${channelId}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(`Đã xuất ${payload.count} tin nhắn của #${payload.channelName}.`, 'success');
  void logAdminAction('export', `Xuất dữ liệu #${payload.channelName} (${payload.count} tin nhắn)`);
}
