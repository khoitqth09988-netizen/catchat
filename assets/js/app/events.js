/* CatChat · Toàn bộ event listener và khởi tạo Firebase.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function attachEvents() {
  savedMessages = loadSavedMessages();
  renderCursorOptions();
  renderEmojiPicker();
  setWorkspaceView('chat');
  updateSavedBadge();
  renderSavedPanel();
  updateWorkspaceGreeting();
  enablePawTrail();
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
  $('#stickerBar')?.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-sticker]') : null;
    if (button) insertSticker(button.dataset.sticker);
  });
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
  els.attachImageButton.addEventListener('click', () => els.chatImageInput.click());
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
  $('#jumpLatestButton').addEventListener('click', () => els.chatMessages.scrollTo({ top: els.chatMessages.scrollHeight, behavior: 'smooth' }));
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
  $('#adminClearLogButton').addEventListener('click', async () => {
    const confirm = await openConfirm({
      title: 'Xoá nhật ký quản trị?',
      description: 'Toàn bộ nhật ký thao tác quản trị sẽ bị xoá khỏi Firebase. Hành động này không thể hoàn tác.',
      acceptLabel: 'Xoá nhật ký',
      tone: 'danger',
      iconName: 'trash'
    });
    if (!confirm || !adminLogRef) return;
    try {
      await adminLogRef.remove();
      adminLogEntries = [];
      renderAdminLog();
      toast('Đã xoá nhật ký quản trị.', 'success');
    } catch (error) {
      showDatabaseError(error, 'Không xoá được nhật ký. Kiểm tra quyền /adminLog.');
    }
  });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && currentUser && !els.adminOverlay.classList.contains('open') && !els.confirmLayer.classList.contains('open') && els.channelDialog.hidden && els.themeDialog.hidden) {
      event.preventDefault();
      setMessageSearchOpen(true);
    }
    if (event.key === 'Escape') {
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

async function initializeFirebase() {
  // App Check (nếu được cấu hình) phải xong trước khi mở kết nối tới Firebase.
  try {
    await window.appCheckReady;
  } catch (error) {
    console.warn('App Check chưa sẵn sàng, tiếp tục không có lớp xác thực thiết bị:', error);
  }
  if (!window.firebase || !window.firebase.auth || !window.firebase.database) {
    setAuthNotice('Không tải được Firebase SDK. Hãy kiểm tra kết nối Internet rồi tải lại trang.', 'error');
    els.authSubmit.disabled = true;
    return;
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
    messageReactionsRef = database.ref('messageReactions');
    storage = firebase.storage ? firebase.storage() : null;
    firebaseReady = true;
    auth.onAuthStateChanged(handleAuthState, (error) => {
      setAuthError(friendlyAuthError(error));
    });
  } catch (error) {
    console.error('Firebase init error:', error);
    setAuthNotice('Không thể khởi tạo Firebase. Hãy kiểm tra cấu hình trong index.html.', 'error');
    els.authSubmit.disabled = true;
  }
}
