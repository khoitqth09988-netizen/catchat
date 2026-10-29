/* CatChat · Toàn bộ event listener và khởi tạo Firebase.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

/* ── Menu hành động của tin nhắn (nút ⋯) ───────────────────────
   Một nút duy nhất chứa: Trả lời / Lưu / Sao chép / Sửa / Ghim / Xoá.
   Menu đóng khi chọn một mục, bấm ra ngoài, nhấn Esc hoặc cuộn danh sách.

   Vì sao phải "portal" menu ra body: `.message-row` có `animation ... both`, nên sau khi
   chạy xong nó vẫn giữ `transform` ⇒ trở thành containing block của mọi phần tử
   `position: fixed` bên trong. Khi đó toạ độ theo khung nhìn bị cộng thêm vị trí hàng tin
   và menu nhảy ra góc phải trang. Đưa menu vào một lớp cố định ở body thì toạ độ luôn đúng. */
let openMessageMenuState = null;

function messageMenuLayer() {
  let layer = document.getElementById('messageMenuLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'messageMenuLayer';
    layer.className = 'message-menu-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function closeMessageMenus() {
  const state = openMessageMenuState;
  if (!state) return;
  openMessageMenuState = null;
  const { menu, home, toggle } = state;
  menu.hidden = true;
  menu.style.removeProperty('top');
  menu.style.removeProperty('left');
  // Trả menu về đúng hàng tin nhắn để lần render sau không bị mồ côi.
  if (home && home.isConnected) home.appendChild(menu);
  else menu.remove();
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('is-open');
  }
}

/** Tính vị trí menu hành động. Ưu tiên đặt **cạnh tin nhắn** (bên phải hàng tin,
    nếu không đủ chỗ thì bên trái), chỉ khi màn hình quá hẹp mới mở dưới/trên nút ⋯.
    Hàm thuần (không đụng DOM) để test được bằng số liệu giả lập.

    anchor : rect của nút ⋯   box : kích thước menu
    row    : rect của hàng tin nhắn (có thể null)
    viewport: { width, height } */
function messageMenuPosition(anchor, box, row, viewport, options = {}) {
  const margin = options.margin ?? 10;
  const gap = options.gap ?? 8;
  // Khung cho phép: mặc định là cả khung nhìn; placeMessageMenu() truyền vào khung
  // của danh sách tin nhắn để menu không tràn sang cột thành viên / mép trang.
  const bounds = options.bounds || { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  const minLeft = Math.max(margin, bounds.left + 4);
  const minTop = Math.max(margin, bounds.top + 4);
  const maxLeft = Math.min(viewport.width - box.width - margin, bounds.right - box.width - 4);
  const maxTop = Math.min(viewport.height - box.height - margin, bounds.bottom - box.height - 4);
  const topBeside = clamp((row ? row.top : anchor.top) - 2, minTop, maxTop);

  // 1) Bên phải hàng tin nhắn (ngay cạnh tin).
  if (row && row.right + gap <= maxLeft) {
    return { left: Math.round(row.right + gap), top: Math.round(topBeside), side: 'right' };
  }
  // 2) Bên trái hàng tin nhắn.
  if (row && row.left - gap - box.width >= minLeft) {
    return { left: Math.round(row.left - gap - box.width), top: Math.round(topBeside), side: 'left' };
  }
  // 3) Màn hình hẹp: mở ngay dưới nút.
  const left = clamp(anchor.left, minLeft, maxLeft);
  if (anchor.bottom + gap + box.height <= maxTop + box.height) {
    return { left: Math.round(left), top: Math.round(clamp(anchor.bottom + gap, minTop, maxTop)), side: 'below' };
  }
  // 4) Không còn chỗ dưới: mở lên trên nút.
  return { left: Math.round(left), top: Math.round(clamp(anchor.top - box.height - gap, minTop, maxTop)), side: 'above' };
}

/** Đặt menu đã portal vào đúng vị trí tính được. */
function placeMessageMenu(menu, toggle) {
  const row = toggle.closest('.message-row');
  const list = toggle.closest('.messages-area');
  const listBox = list ? list.getBoundingClientRect() : null;
  const position = messageMenuPosition(
    toggle.getBoundingClientRect(),
    menu.getBoundingClientRect(),
    row ? row.getBoundingClientRect() : null,
    { width: window.innerWidth, height: window.innerHeight },
    listBox ? { bounds: listBox } : {}
  );
  menu.dataset.side = position.side;
  menu.style.top = `${position.top}px`;
  menu.style.left = `${position.left}px`;
}

function openMessageMenu(toggle) {
  const home = toggle.parentElement;
  const menu = home?.querySelector('.message-menu');
  if (!menu) return;
  // Bấm lại đúng nút đang mở ⇒ đóng.
  if (openMessageMenuState?.menu === menu) {
    closeMessageMenus();
    return;
  }
  closeMessageMenus();
  menu.hidden = false;
  messageMenuLayer().appendChild(menu);
  openMessageMenuState = { menu, home, toggle };
  toggle.setAttribute('aria-expanded', 'true');
  toggle.classList.add('is-open');
  placeMessageMenu(menu, toggle);
  menu.querySelector('.message-menu-item')?.focus({ preventScroll: true });
}

function attachEvents() {
  savedMessages = loadSavedMessages();
  // Liên kết “bỏ qua điều hướng”: đưa focus tới đúng vùng đang dùng được.
  document.querySelector('.ds-skip-link')?.addEventListener('click', (event) => {
    const target = els.appView.hidden ? els.email : els.messageInput;
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
  });
  renderCursorOptions();
  renderEmojiPicker();
  setWorkspaceView('chat');
  updateSavedBadge();
  renderSavedPanel();
  updateWorkspaceGreeting();
  $('#savedMessagesButton')?.addEventListener('click', openSavedPanel);
  $('#closeSavedButton')?.addEventListener('click', closeSavedPanel);
  $('#savedLayer')?.addEventListener('click', (event) => { if (event.target === $('#savedLayer')) closeSavedPanel(); });
  $('#clearSavedButton')?.addEventListener('click', () => {
    if (!savedMessages.length) { toast('Bộ sưu tập đang trống.', 'info'); return; }
    savedMessages = [];
    persistSavedMessages();
    renderSavedPanel();
    renderAllMessages(false);
    toast('Đã dọn sạch bộ sưu tập trên thiết bị này.', 'success');
  });
  $('#savedBody')?.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const jump = target.closest('[data-saved-jump]');
    if (jump) { void jumpToSavedMessage(jump.dataset.savedJump); return; }
    const remove = target.closest('[data-saved-remove]');
    if (remove) {
      savedMessages = savedMessages.filter((entry) => entry.id !== remove.dataset.savedRemove);
      persistSavedMessages();
      renderSavedPanel();
      renderAllMessages(false);
      toast('Đã bỏ khỏi bộ sưu tập.', 'info');
    }
  });
  $('#miuFace')?.addEventListener('click', miuSayHello);
  $('#catCompanionButton')?.addEventListener('click', miuSayHello);
  $('#closeMiuBubble')?.addEventListener('click', () => { $('#miuBubble').hidden = true; });
  els.authForm.addEventListener('submit', submitAuth);
  els.openThemeSettingsButton.addEventListener('click', openThemeDialog);
  els.closeThemeDialogButton.addEventListener('click', closeThemeDialog);
  els.themeDialog.addEventListener('click', (event) => { if (event.target === els.themeDialog) closeThemeDialog(); });
  els.themeOptions.addEventListener('click', (event) => {
    const option = event.target instanceof Element ? event.target.closest('[data-theme-choice]') : null;
    if (option) applyTheme(option.dataset.themeChoice);
  });
  $('#cursorOptions').addEventListener('click', (event) => {
    const option = event.target instanceof Element ? event.target.closest('[data-cursor-choice]') : null;
    if (!option) return;
    applyCursor(option.dataset.cursorChoice);
    const cursorName = CURSOR_OPTIONS.find((item) => item.id === option.dataset.cursorChoice)?.name || 'mèo';
    toast(`Đã đổi con trỏ thành ${cursorName}.`, 'success');
  });
  els.toggleAuthMode.addEventListener('click', switchAuthMode);
  els.forgotPassword.addEventListener('click', sendPasswordReset);
  els.email.addEventListener('input', () => { setAuthError(''); if (els.authNotice.classList.contains('success')) setAuthNotice(''); });
  [els.password, els.confirmPassword, els.displayName].forEach((input) => input.addEventListener('input', () => setAuthError('')));
  els.togglePassword.addEventListener('click', () => {
    const show = els.password.type === 'password';
    els.password.type = show ? 'text' : 'password';
    $('#togglePassword use').setAttribute('href', show ? '#i-eye-off' : '#i-eye');
    els.togglePassword.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    els.togglePassword.title = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
  });
  els.sidebarAvatar.addEventListener('click', () => {
    if (!currentUser) return;
    if (!storageReady()) {
      showStorageHint();
      return;
    }
    els.avatarFileInput.click();
  });
  els.avatarFileInput.addEventListener('change', uploadAvatar);
  $('#logoutButton').addEventListener('click', async () => {
    if (!auth) return;
    try {
      if (currentUser && database) {
        await presenceRef.child(currentUser.uid).remove().catch(() => {});
        await membersRef.child(currentUser.uid).update({ lastSeen: currentTimestamp() }).catch(() => {});
      }
      await auth.signOut();
    } catch (error) { toast(friendlyAuthError(error), 'error'); }
  });
  $('#mobileLogoutButton').addEventListener('click', () => $('#logoutButton').click());
  $('#messageForm').addEventListener('submit', sendMessage);
  els.attachImageButton.addEventListener('click', chooseAttachment);
  els.chatImageInput.addEventListener('change', selectChatImage);
  $('#clearPendingImageButton').addEventListener('click', clearPendingImage);
  els.messageInput.addEventListener('input', updateMessageComposer);
  $('#cancelReplyButton').addEventListener('click', clearReplyTarget);
  els.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  });
  $('#navChat').addEventListener('click', () => {
    setWorkspaceView('chat');
    if (announcementMode) setAnnouncementMode(false);
  });
  $('#navMembers').addEventListener('click', () => setWorkspaceView('members'));
  $('#mobileMembersButton').addEventListener('click', () => setWorkspaceView(workspaceView === 'members' ? 'chat' : 'members'));
  $('#navAdmin').addEventListener('click', () => openAdmin());
  els.memberList.addEventListener('click', (event) => {
    const row = event.target instanceof Element ? event.target.closest('.member-row') : null;
    if (!row) return;
    const uid = row.dataset.memberUid;
    if (uid) openMemberProfile(uid);
  });
  $('#directorySearchInput').addEventListener('input', (event) => {
    directoryQuery = event.target.value || '';
    renderDirectory();
  });
  $('#directoryFilters').addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-directory-filter]') : null;
    if (!button) return;
    directoryFilter = DIRECTORY_FILTERS.includes(button.dataset.directoryFilter) ? button.dataset.directoryFilter : 'all';
    renderDirectory();
  });
  $('#directoryGrid').addEventListener('click', (event) => {
    const card = event.target instanceof Element ? event.target.closest('[data-member-uid]') : null;
    if (card) openMemberProfile(card.dataset.memberUid);
  });
  $('#closeMemberProfile').addEventListener('click', closeMemberProfile);
  $('.profile-text').addEventListener('click', () => { if (currentUser) openMemberProfile(currentUser.uid); });
  $('.profile-text').style.cursor = 'pointer';
  $('.profile-text').title = 'Xem hồ sơ của bạn';
  els.memberList.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target instanceof Element ? event.target.closest('.member-row') : null;
    if (!row) return;
    event.preventDefault();
    if (row.dataset.memberUid) openMemberProfile(row.dataset.memberUid);
  });
  $('#memberProfileLayer').addEventListener('click', (event) => { if (event.target === $('#memberProfileLayer')) closeMemberProfile(); });
  $('#emojiPickerButton').addEventListener('click', () => setEmojiPickerOpen($('#emojiPopover').hidden));
  $('#closeEmojiPicker').addEventListener('click', () => setEmojiPickerOpen(false));
  $('#emojiGroups').addEventListener('click', (event) => {
    const cell = event.target instanceof Element ? event.target.closest('[data-emoji]') : null;
    if (cell) insertEmoji(cell.dataset.emoji);
  });
  document.addEventListener('click', (event) => {
    if ($('#emojiPopover').hidden) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#emojiPopover') || target.closest('#emojiPickerButton')) return;
    setEmojiPickerOpen(false);
  });
  els.channelList.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-channel-id]') : null;
    if (!target) return;
    setWorkspaceView('chat');
    void switchChannel(target.dataset.channelId);
  });
  els.mobileChannelSelect.addEventListener('change', () => {
    if (els.mobileChannelSelect.value === '__announcements') {
      els.mobileChannelSelect.value = activeChannelId;
      $('#channelAnnouncements').click();
      return;
    }
    void switchChannel(els.mobileChannelSelect.value);
  });
  els.channelAddButton.addEventListener('click', openChannelDialog);
  $('#mobileCreateChannelButton').addEventListener('click', openChannelDialog);
  els.channelCreateForm.addEventListener('submit', createChannel);
  els.cancelCreateChannelButton.addEventListener('click', closeChannelDialog);
  els.channelDialog.addEventListener('click', (event) => { if (event.target === els.channelDialog) closeChannelDialog(); });
  els.clearChannelButton.addEventListener('click', () => { void clearCurrentChannel(); });
  $('#deleteChannelButton')?.addEventListener('click', () => { void deleteActiveChannel(); });
  $('#channelAnnouncements').addEventListener('click', async () => {
    setWorkspaceView('chat');
    if (activeChannelId !== 'general') {
      const switched = await switchChannel('general');
      if (!switched) return;
    }
    setAnnouncementMode(true);
    toast(isAdmin ? 'Bạn đang ở phòng thông báo — gõ nội dung và gửi để đăng.' : 'Bạn đang xem thông báo toàn máy chủ.', 'info');
  });
  $('#exitAnnouncementModeButton').addEventListener('click', exitAnnouncementMode);
  $('#searchMessagesButton').addEventListener('click', () => setMessageSearchOpen(els.messageSearchBar.hidden));
  els.messageSearchInput.addEventListener('input', () => {
    messageSearchQuery = els.messageSearchInput.value.trim();
    renderAllMessages(true);
  });
  els.messageSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMessageSearchOpen(false);
  });
  $('#clearMessageSearchButton').addEventListener('click', () => {
    if (els.messageSearchInput.value) {
      els.messageSearchInput.value = '';
      messageSearchQuery = '';
      renderAllMessages(true);
      els.messageSearchInput.focus();
    } else setMessageSearchOpen(false);
  });
  $('#jumpLatestButton').addEventListener('click', () => jumpToLatestMessages(true));
  $('#newMessagePill')?.addEventListener('click', () => {
    jumpToLatestMessages(true);
    els.messageInput.focus({ preventScroll: true });
  });
  els.chatMessages.addEventListener('scroll', markFeedRead, { passive: true });
  els.chatMessages.addEventListener('scroll', () => closeMessageMenus(), { passive: true });
  window.addEventListener('resize', () => closeMessageMenus(), { passive: true });
  $('#loadOlderButton')?.addEventListener('click', () => { void loadOlderMessages(); });
  $('#channelLockButton').addEventListener('click', () => { void toggleChannelLock(); });
  $('#unpinButton').addEventListener('click', () => {
    if (pins[activeChannelId]?.messageId) void togglePinMessage(pins[activeChannelId].messageId);
  });
  $('#pinnedJumpButton').addEventListener('click', () => {
    if (!pinnedJumpId) return;
    const row = Array.from(els.chatMessages.querySelectorAll('.message-row')).find((item) => item.dataset.messageId === pinnedJumpId);
    if (!row) {
      toast('Tin nhắn đã ghim không còn trong 100 tin gần nhất của kênh.', 'info');
      return;
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('message-flash');
    window.setTimeout(() => row.classList.remove('message-flash'), 1400);
  });
  $('#closeAnnouncementBanner').addEventListener('click', () => {
    const latest = Array.from(announcementMessages.entries()).sort((a, b) => timestampOf(b[1]) - timestampOf(a[1]))[0];
    announcementDismissedId = latest?.[0] || null;
    els.announcementBanner.hidden = true;
  });
  els.openAdminButton.addEventListener('click', openAdmin);
  $('#closeAdminButton').addEventListener('click', closeAdmin);
  $('#adminBackdrop').addEventListener('click', closeAdmin);
  $('#adminMembersTabButton').addEventListener('click', () => switchAdminTab('members'));
  $('#adminMessagesTabButton').addEventListener('click', () => switchAdminTab('messages'));
  $('#adminAnnouncementsTabButton').addEventListener('click', () => switchAdminTab('announcements'));
  $('#adminBlocksTabButton').addEventListener('click', () => switchAdminTab('blocks'));
  $('#adminMessageSearch').addEventListener('input', renderAdminMessages);
  $('#adminClearChannelButton').addEventListener('click', () => { void clearCurrentChannel(); });
  els.adminMemberSearch.addEventListener('input', renderAdminPanel);
  $('#announcementCharCount').textContent = '0 / 500';
  els.announcementInput.addEventListener('input', () => { $('#announcementCharCount').textContent = `${els.announcementInput.value.length} / 500`; });
  els.publishAnnouncementButton.addEventListener('click', sendAnnouncement);
  els.adminMemberList.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-member-action]') : null;
    if (!button) return;
    const action = button.dataset.memberAction;
    if (action === 'mute') void manageMute(button.dataset.uid, true);
    else if (action === 'unmute') void manageMute(button.dataset.uid, false);
    else if (action === 'delete-account') void CatChat.accountDeletion?.deleteMember(button.dataset.uid);
    else void manageBan(button.dataset.uid, action === 'ban');
  });
  $('#adminOverviewTabButton').addEventListener('click', () => switchAdminTab('overview'));
  $('#muteDurations').addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-mute-duration]') : null;
    if (!button) return;
    muteDurationMinutes = Number(button.dataset.muteDuration) || 0;
    $$('[data-mute-duration]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
  });
  $('#muteConfirm').addEventListener('click', () => {
    closeMuteDialog({ minutes: muteDurationMinutes, reason: $('#muteReason').value.trim() });
  });
  $('#muteCancel').addEventListener('click', () => closeMuteDialog(null));
  $('#muteDialog').addEventListener('click', (event) => { if (event.target === $('#muteDialog')) closeMuteDialog(null); });
  $('#adminMutedList').addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-mute-action="unmute"]') : null;
    if (button) void manageMute(button.dataset.uid, false);
  });
  $('#adminQuickAnnouncement').addEventListener('click', () => { closeAdmin(); $('#channelAnnouncements').click(); });
  $('#adminQuickMessages').addEventListener('click', () => switchAdminTab('messages'));
  $('#adminQuickExport').addEventListener('click', exportChannelData);
  $('#adminQuickMuted').addEventListener('click', () => switchAdminTab('overview'));
  $('#adminQuickBlocks').addEventListener('click', () => switchAdminTab('blocks'));
  $('#adminClearLogButton').addEventListener('click', async () => {
    const confirm = await openConfirm({
      title: 'Dọn nhật ký quản trị?',
      description: 'Nhật ký cũ sẽ được đánh dấu đã dọn và ẩn khỏi bảng điều khiển. Bản ghi gốc vẫn được giữ lại trong Firebase để kiểm toán (không thể xoá).',
      acceptLabel: 'Dọn nhật ký',
      tone: 'danger',
      iconName: 'trash'
    });
    if (!confirm || !adminLogRef || !currentUser) return;
    try {
      await adminLogRef.push({
        type: 'log-purge',
        detail: 'Đánh dấu dọn nhật ký quản trị',
        targetUid: '',
        adminUid: currentUser.uid,
        adminName: displayNameFor(currentUser).slice(0, 32),
        timestamp: currentTimestamp()
      });
      toast('Đã đánh dấu dọn nhật ký. Bản ghi cũ vẫn được lưu để kiểm toán.', 'success');
    } catch (error) {
      showDatabaseError(error, 'Không ghi được dấu dọn nhật ký. Kiểm tra quyền /adminLog.');
    }
  });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;
    const menuToggle = target.closest('[data-message-menu]');
    if (menuToggle) {
      event.preventDefault();
      openMessageMenu(menuToggle);
      return;
    }
    // Chọn một mục trong menu ⇒ đóng menu rồi để handler bên dưới chạy tiếp.
    closeMessageMenus();
    const reaction = target.closest('[data-react-message]');
    if (reaction) {
      void toggleMessageReaction(reaction.dataset.reactMessage, reaction.dataset.reaction);
      return;
    }
    const reply = target.closest('[data-reply-message]');
    if (reply) {
      setReplyTarget(reply.dataset.replyMessage);
      return;
    }
    const jump = target.closest('[data-jump-message]');
    if (jump) {
      const messageId = jump.dataset.jumpMessage;
      if (messageSearchQuery) setMessageSearchOpen(false);
      window.setTimeout(() => {
        const original = Array.from(document.querySelectorAll('.message-row')).find((row) => row.dataset.messageId === messageId);
        original?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 25);
      return;
    }
    const save = target.closest('[data-save-message]');
    if (save) {
      toggleSaveMessage(save.dataset.saveMessage);
      return;
    }
    const editButton = target.closest('[data-edit-message]');
    if (editButton) {
      beginMessageEdit(editButton.dataset.editMessage);
      return;
    }
    const pinButton = target.closest('[data-pin-message]');
    if (pinButton) {
      void togglePinMessage(pinButton.dataset.pinMessage);
      return;
    }
    const editSave = target.closest('[data-edit-save]');
    if (editSave) {
      void saveMessageEdit(editSave.dataset.editSave);
      return;
    }
    const editCancel = target.closest('[data-edit-cancel]');
    if (editCancel) {
      cancelMessageEdit();
      return;
    }
    const remove = target.closest('[data-delete-message]');
    if (remove) void deleteMessage(remove.dataset.deleteMessage);
  });
  els.confirmCancel.addEventListener('click', () => closeConfirm(null));
  els.confirmAccept.addEventListener('click', () => closeConfirm({ confirmed: true, reason: els.confirmReason.value.trim() }));
  els.confirmLayer.addEventListener('click', (event) => { if (event.target === els.confirmLayer) closeConfirm(null); });
  els.adminOverlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAdmin(); });
  document.addEventListener('keydown', (event) => {
    if (CatChat.features.run('keydown', event) === true) return;
    const hotkey = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if ((event.ctrlKey || event.metaKey) && hotkey === 'k' && currentUser && !els.adminOverlay.classList.contains('open') && !els.confirmLayer.classList.contains('open') && els.channelDialog.hidden && els.themeDialog.hidden) {
      event.preventDefault();
      setMessageSearchOpen(true);
    }
    if (event.key === 'Escape') {
      if (document.querySelector('.message-menu:not([hidden])')) { closeMessageMenus(); return; }
      if (editingMessageId) { cancelMessageEdit(); return; }
      if (!$('#muteDialog').hidden) closeMuteDialog(null);
      else if (!$('#emojiPopover').hidden) setEmojiPickerOpen(false);
      else if (!$('#memberProfileLayer').hidden) closeMemberProfile();
      else if (!$('#savedLayer').hidden) closeSavedPanel();
      else if (!els.themeDialog.hidden) closeThemeDialog();
      else if (!els.channelDialog.hidden) closeChannelDialog();
      else if (els.confirmLayer.classList.contains('open')) closeConfirm(null);
      else if (els.adminOverlay.classList.contains('open')) closeAdmin();
      else if (!els.messageSearchBar.hidden) setMessageSearchOpen(false);
      else if (announcementMode) exitAnnouncementMode();
      else els.membersPanel.classList.remove('open');
    }
  });
  document.addEventListener('click', (event) => {
    if (!els.membersPanel.classList.contains('open')) return;
    if (window.matchMedia('(max-width: 1080px)').matches && !els.membersPanel.contains(event.target) && !$('#mobileMembersButton').contains(event.target) && !$('#navMembers').contains(event.target)) {
      els.membersPanel.classList.remove('open');
      $('#mobileMembersButton').setAttribute('aria-expanded', 'false');
    }
  });
}

/* Nạp lại Firebase SDK (compat) khi lần tải đầu thất bại — mạng chập chờn, đổi Wi-Fi,
   hoặc tab ngủ quên lúc đang tải. Trả về true nếu cuối cùng có đủ SDK. */
function loadScriptOnce(src, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => { script.remove(); reject(new Error(`Hết thời gian tải ${src}`)); }, timeout);
    script.src = src;
    script.async = false;
    script.onload = () => { window.clearTimeout(timer); resolve(true); };
    script.onerror = () => { window.clearTimeout(timer); script.remove(); reject(new Error(`Không tải được ${src}`)); };
    document.head.appendChild(script);
  });
}

async function retryFirebaseSdk() {
  const base = 'https://www.gstatic.com/firebasejs/9.23.0/';
  const files = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-database-compat.js'];
  if (!window.firebase) {
    CatChat.bootScreen?.step('Mạng chậm — đang thử tải lại thư viện…', 48);
    for (const file of files) {
      try { await loadScriptOnce(`${base}${file}?retry=${Date.now()}`); }
      catch (error) { console.warn('Thử lại Firebase SDK thất bại:', error?.message || error); }
    }
  }
  return Boolean(window.firebase && window.firebase.auth && window.firebase.database);
}

async function initializeFirebase() {
  CatChat.bootScreen?.step('Đang xác thực thiết bị…', 44);
  // App Check (nếu được cấu hình) phải xong trước khi mở kết nối tới Firebase.
  try {
    await window.appCheckReady;
  } catch (error) {
    console.warn('App Check chưa sẵn sàng, tiếp tục không có lớp xác thực thiết bị:', error);
  }
  // Mạng yếu / mất mạng tạm thời: thử nạp lại đúng thư viện Firebase một lần trước khi
  // báo lỗi, thay vì bắt người dùng tự tải lại cả trang.
  if (!window.firebase || !window.firebase.auth || !window.firebase.database) {
    const recovered = await retryFirebaseSdk();
    if (!recovered) {
      setAuthNotice('Không tải được Firebase SDK. Hãy kiểm tra kết nối Internet rồi tải lại trang.', 'error');
      els.authSubmit.disabled = true;
      CatChat.bootScreen?.fail('Không tải được Firebase SDK. Hãy kiểm tra kết nối Internet rồi thử lại.');
      return;
    }
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    generalMessagesRef = database.ref('messages');
    messagesRef = generalMessagesRef;
    channelsRef = database.ref('channels');
    membersRef = database.ref('members');
    memberEmailsRef = database.ref('memberEmails');
    presenceRef = database.ref('presence');
    adminsRef = database.ref('admins');
    bansRef = database.ref('bans');
    mutesRef = database.ref('mutes');
    adminLogRef = database.ref('adminLog');
    pinsRef = database.ref('pins');
    locksRef = database.ref('locks');
    deletedUsersRef = database.ref('deletedUsers');
    typingRef = database.ref('typing');
    messageReactionsRef = database.ref('messageReactions');
    storage = firebase.storage ? firebase.storage() : null;
    refreshMediaUi();
    firebaseReady = true;
    CatChat.bootScreen?.step('Đã kết nối · đang kiểm tra phiên…', 60);
    auth.onAuthStateChanged(handleAuthState, (error) => {
      setAuthError(friendlyAuthError(error));
    });
  } catch (error) {
    console.error('Firebase init error:', error);
    setAuthNotice('Không thể khởi tạo Firebase. Hãy kiểm tra cấu hình trong index.html.', 'error');
    els.authSubmit.disabled = true;
    CatChat.bootScreen?.fail('Không thể khởi tạo Firebase. Hãy kiểm tra cấu hình rồi thử lại.');
  }
}
