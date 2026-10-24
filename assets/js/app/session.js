/* CatChat · setAdminState, đăng nhập/đăng xuất, listener realtime, presence và avatar.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function setAdminState(value) {
  const next = value === true;
  if (isAdmin === next) return;
  isAdmin = next;
  els.openAdminButton.hidden = !isAdmin;
  els.rolePill.hidden = !isAdmin;
  els.channelAddButton.hidden = !isAdmin;
  $('#mobileCreateChannelButton').hidden = !isAdmin;
  els.clearChannelButton.hidden = !isAdmin;
  $('#deleteChannelButton').hidden = !isAdmin;
  els.announcementInput.disabled = !isAdmin;
  els.publishAnnouncementButton.disabled = !isAdmin;
  const navAdmin = $('#navAdmin');
  if (navAdmin) navAdmin.hidden = !isAdmin;
  if (isAdmin) {
    const navAdminCount = $('#navAdminCount');
    if (navAdminCount) {
      navAdminCount.textContent = String(Object.keys(bans).length || '');
      navAdminCount.hidden = !Object.keys(bans).length;
    }
  }
  if (!isAdmin && announcementMode) setAnnouncementMode(false);
  syncChannelChrome();
  updateMessageComposer();
  if (!isAdmin && !els.channelDialog.hidden) closeChannelDialog();
  if (isAdmin && bansRef && !stopAdminBanListener) {
    stopAdminBanListener = subscribe(bansRef, 'value', (snapshot) => {
      bans = snapshot.val() || {};
      const navAdminCount = $('#navAdminCount');
      if (navAdminCount) {
        navAdminCount.textContent = String(Object.keys(bans).length);
        navAdminCount.hidden = !Object.keys(bans).length;
      }
      renderMembers();
      renderAdminPanel();
    }, (error) => {
      if (hasAdminEmail && !hasAdminMarker && !hasAdminClaim) console.warn('Chưa đọc được /bans (cần thêm email admin vào Rules):', error);
      else showDatabaseError(error, 'Không thể tải danh sách lệnh cấm.');
    });
  } else if (!isAdmin && stopAdminBanListener) {
    stopAdminBanListener();
    stopAdminBanListener = null;
    bans = {};
  }
  if (isAdmin && mutesRef && !stopMuteListener) {
    stopMuteListener = subscribe(mutesRef, 'value', (snapshot) => {
      mutes = snapshot.val() || {};
      renderMembers();
      renderAdminPanel();
      renderMuteBanner();
    }, (error) => {
      if (hasAdminEmail && !hasAdminMarker && !hasAdminClaim) console.warn('Chưa đọc được /mutes (cần thêm email admin vào Rules):', error);
      else showDatabaseError(error, 'Không thể tải danh sách cấm chat.');
    });
  } else if (!isAdmin && stopMuteListener) {
    stopMuteListener();
    stopMuteListener = null;
  }
  if (isAdmin && adminLogRef && !stopAdminLogListener) {
    stopAdminLogListener = subscribe(adminLogRef, 'value', (snapshot) => {
      const raw = snapshot.val() || {};
      adminLogEntries = Object.entries(raw)
        .map(([id, entry]) => ({ id, ...(entry || {}) }))
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
        .slice(0, 60);
      renderAdminLog();
    }, (error) => {
      if (hasAdminEmail && !hasAdminMarker && !hasAdminClaim) console.warn('Chưa đọc được /adminLog (cần thêm email admin vào Rules):', error);
      else showDatabaseError(error, 'Không thể tải nhật ký quản trị.');
    });
  } else if (!isAdmin && stopAdminLogListener) {
    stopAdminLogListener();
    stopAdminLogListener = null;
    adminLogEntries = [];
  }
  if (!isAdmin) mutes = {};
  renderMuteBanner();
  if (isAdmin && memberEmailsRef && !stopAdminEmailListener) {
    stopAdminEmailListener = subscribe(memberEmailsRef, 'value', (snapshot) => {
      memberEmails = snapshot.val() || {};
      renderAdminPanel();
      refreshMemberProfile();
    }, (error) => {
      if (hasAdminEmail && !hasAdminMarker && !hasAdminClaim) console.warn('Chưa đọc được /memberEmails (cần thêm email admin vào Rules):', error);
      else showDatabaseError(error, 'Không thể tải email thành viên.');
    });
  } else if (!isAdmin && stopAdminEmailListener) {
    stopAdminEmailListener();
    stopAdminEmailListener = null;
    memberEmails = {};
  }
  renderMembers();
  renderAdminPanel();
  renderAllMessages(false);
  if (isAdmin) playAdminWelcome();
}

let signedOutNotice = '';
function handleAuthState(user) {
  const generation = ++authGeneration;
  const previousUid = currentUser?.uid || null;
  cleanupRealtime();
  // Ngừng theo dõi chặn thiết bị/IP của phiên trước.
  try { window.CatChat?.identity?.unwatch?.(); } catch (_) { /* feature chưa nạp */ }
  closeChannelDialog();
  closeThemeDialog();
  currentUser = user || null;
  if (previousUid !== (currentUser?.uid || null)) els.messageInput.value = '';
  updateMessageComposer();
  setAdminState(false);
  setConnectionState('connecting');
  announcementDismissedId = null;
  messageSearchQuery = '';
  els.messageSearchInput.value = '';
  els.messageSearchBar.hidden = true;
  $('#searchMessagesButton').setAttribute('aria-expanded', 'false');
  if (!user) {
    closeSavedPanel();
    closeMemberProfile();
    setAnnouncementMode(false);
    setWorkspaceView('chat');
    const miuBubble = $('#miuBubble');
    if (miuBubble) miuBubble.hidden = true;
    els.appView.hidden = true;
    els.authView.hidden = false;
    els.sidebarName.textContent = 'Thành viên';
    els.sidebarEmail.textContent = 'Đang đăng nhập';
    els.sidebarAvatar.textContent = '?';
    els.chatMessages.replaceChildren(els.chatEmptyState);
    els.announcementBanner.hidden = true;
    unreadMessageCount = 0;
    lastReadTimestamp = 0;
    if (signedOutNotice) {
      setAuthNotice(signedOutNotice, 'error');
      signedOutNotice = '';
    }
    CatChat.bootScreen?.step('Sẵn sàng đăng nhập', 100);
    CatChat.bootScreen?.finish();
    return;
  }
  setAuthNotice('');
  setAuthError('');
  CatChat.bootScreen?.step('Đang xác thực phiên đăng nhập…', 72);
  void enterWorkspace(user, generation).catch((error) => {
    console.error('Không thể khởi tạo phiên trò chuyện:', error);
    toast('Không thể mở không gian trò chuyện. Hãy tải lại trang và thử lại.', 'error');
    // Không để người dùng kẹt ở màn hình chờ nếu một bước khởi tạo thất bại.
    CatChat.bootScreen?.finish();
  });
}

function startRealtimeListeners(user, generation) {
  channels = Object.create(null);
  channels.general = { name: 'phòng-chung', description: 'Nơi mọi người cùng trò chuyện', system: true };
  renderChannelList();
  void switchChannel('general', { skipConfirm: true, force: true });
  startAnnouncementListeners(user, generation);
  subscribe(channelsRef, 'value', (snapshot) => {
    if (generation !== authGeneration || currentUser?.uid !== user.uid) return;
    const savedChannels = snapshot.val() || {};
    channels = Object.assign(Object.create(null), savedChannels);
    if (!channels.general) channels.general = { name: 'phòng-chung', description: 'Nơi mọi người cùng trò chuyện', system: true };
    renderChannelList();
    if (activeChannelId !== 'general' && !Object.prototype.hasOwnProperty.call(channels, activeChannelId)) {
      void switchChannel('general', { skipConfirm: true, force: true });
    } else updateActiveChannelUI();
  }, (error) => showDatabaseError(error, 'Không thể tải danh sách kênh trong /channels.'));

  subscribe(pinsRef, 'value', (snapshot) => {
    if (generation !== authGeneration) return;
    pins = snapshot.val() || {};
    renderPinnedBanner();
  }, (error) => console.warn('Không tải được ghim tin nhắn:', error));
  subscribe(locksRef, 'value', (snapshot) => {
    if (generation !== authGeneration) return;
    locks = snapshot.val() || {};
    syncChannelChrome();
    updateMessageComposer();
  }, (error) => console.warn('Không tải được trạng thái khoá kênh:', error));

  subscribe(membersRef, 'value', (snapshot) => {
    if (generation !== authGeneration) return;
    members = snapshot.val() || {};
    if (currentUser) updateCurrentUserUI();
    renderMembers();
    renderAdminPanel();
  }, (error) => showDatabaseError(error, 'Không thể tải danh sách thành viên.'));
  subscribe(presenceRef, 'value', (snapshot) => {
    if (generation !== authGeneration) return;
    presence = snapshot.val() || {};
    renderMembers();
    renderAdminPanel();
  }, (error) => showDatabaseError(error, 'Không thể tải trạng thái trực tuyến.'));
  subscribe(bansRef.child(user.uid), 'value', (snapshot) => {
    if (generation !== authGeneration || !snapshot.exists()) return;
    const reason = snapshot.child('reason').val();
    signedOutNotice = reason ? `Tài khoản của bạn đang bị chặn truy cập ứng dụng. Lý do: ${reason}` : 'Tài khoản của bạn đang bị chặn truy cập ứng dụng. Hãy liên hệ quản trị viên.';
    toast('Tài khoản của bạn đã bị chặn truy cập ứng dụng.', 'error');
    void auth.signOut();
  }, (error) => showDatabaseError(error, 'Không thể theo dõi trạng thái tài khoản.'));
  if (mutesRef) {
    stopOwnMuteListener = subscribe(mutesRef.child(user.uid), 'value', (snapshot) => {
      if (generation !== authGeneration) return;
      mutes[user.uid] = snapshot.val() || null;
      if (!snapshot.exists()) delete mutes[user.uid];
      renderMuteBanner();
      updateMessageComposer();
    }, (error) => console.warn('Không đọc được trạng thái cấm chat:', error));
  }
  hasAdminMarker = false;
  hasAdminClaim = false;
  hasAdminEmail = isAdminEmail(user);
  setAdminState(computeIsAdmin());
  subscribe(adminsRef.child(user.uid), 'value', (snapshot) => {
    if (generation !== authGeneration) return;
    hasAdminMarker = snapshot.val() === true;
    setAdminState(computeIsAdmin());
  }, (error) => {
    hasAdminMarker = false;
    setAdminState(computeIsAdmin());
    showDatabaseError(error, 'Không thể đọc quyền admin từ /admins. Hãy kiểm tra Firebase Rules.');
  });
  if (typeof user.getIdTokenResult === 'function') {
    user.getIdTokenResult(true).then((token) => {
      if (generation !== authGeneration) return;
      hasAdminClaim = token.claims?.admin === true;
      setAdminState(computeIsAdmin());
    }).catch((error) => {
      console.warn('Không tải được Firebase custom claims:', error);
      if (generation === authGeneration) setAdminState(computeIsAdmin());
    });
  }
}

function setupPresence(user, generation) {
  const connectedRef = database.ref('.info/connected');
  const handler = (snapshot) => {
    if (generation !== authGeneration || currentUser?.uid !== user.uid) return;
    const connected = snapshot.val() === true;
    if (!connected) {
      // Mất mạng: giữ node nhưng ngừng nhịp tim. Người khác thấy “ngoại tuyến”
      // sau TTL (3 phút) thay vì thấy online mãi như trước.
      setConnectionState('offline');
      stopPresenceHeartbeat();
      return;
    }
    setConnectionState('online');
    const myPresence = presenceRef.child(user.uid);
    myPresence.onDisconnect().remove().then(() => {
      if (generation !== authGeneration || currentUser?.uid !== user.uid) return;
      return myPresence.set({ state: 'online', lastChanged: currentTimestamp() });
    }).then(() => {
      if (generation !== authGeneration) return;
      // Ghi mốc hoạt động + bật nhịp tim 60 giây: tab nền bị trình duyệt bóp timer
      // vẫn được coi là đang trực tuyến, còn tab bị đóng đột ngột sẽ hết hạn.
      recordLastSeen(user.uid, true);
      startPresenceHeartbeat(user.uid);
      refreshMemberProfile();
    }).catch((error) => console.warn('Presence setup:', error));
  };
  connectedRef.on('value', handler, (error) => showDatabaseError(error, 'Không thể xác định trạng thái kết nối.'));
  cleanupFns.push(() => connectedRef.off('value', handler));
  cleanupFns.push(() => stopPresenceHeartbeat());
}

function updateCurrentUserUI() {
  const name = displayNameFor(currentUser);
  els.sidebarName.textContent = name;
  els.sidebarEmail.textContent = currentUser?.email || 'Thành viên';
  setAvatarContent(els.sidebarAvatar, name, currentUser?.photoURL || members[currentUser?.uid]?.photoURL || '');
  els.sidebarAvatar.title = 'Đổi ảnh đại diện';
  els.sidebarAvatar.setAttribute('aria-label', `Đổi ảnh đại diện cho ${name}`);
  updateWorkspaceGreeting();
  greetingWithMiu();
}

function greetingWithMiu() {
  try {
    if (sessionStorage.getItem('catchat-miu-greeted') === '1') return;
    sessionStorage.setItem('catchat-miu-greeted', '1');
  } catch (_) { /* bỏ qua khi trình duyệt chặn sessionStorage */ }
  window.setTimeout(miuSayHello, 1400);
}

async function prepareAvatarImage(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'));
      element.src = objectUrl;
    });
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - cropSize) / 2;
    const sourceY = (image.naturalHeight - cropSize) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .86));
    return blob || file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadAvatar(event) {
  const file = event.target.files?.[0];
  const user = currentUser;
  const storageService = storage;
  event.target.value = '';
  if (!file) return;
  if (!user || !storageService) {
    toast('Tải ảnh đại diện chưa sẵn sàng. Hãy bật Firebase Storage và đăng nhập lại.', 'error');
    return;
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    toast('Chọn ảnh JPG, PNG hoặc WebP.', 'error');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast('Ảnh gốc tối đa 8 MB. Ảnh sẽ được cắt vuông và nén trước khi tải lên.', 'error');
    return;
  }
  els.avatarFileInput.disabled = true;
  els.sidebarAvatar.disabled = true;
  try {
    const imageBlob = await prepareAvatarImage(file);
    const avatarRef = storageService.ref(`avatars/${user.uid}/profile-avatar`);
    const uploaded = await avatarRef.put(imageBlob, { contentType: imageBlob.type || 'image/webp' });
    const baseURL = await uploaded.ref.getDownloadURL();
    const downloadURL = `${baseURL}${baseURL.includes('?') ? '&' : '?'}v=${Date.now()}`;
    await user.updateProfile({ photoURL: downloadURL });
    let memberProfileSaved = true;
    try {
      await membersRef.child(user.uid).update({ photoURL: downloadURL, updatedAt: currentTimestamp() });
    } catch (error) {
      memberProfileSaved = false;
      console.warn('Ảnh đã cập nhật trong Auth nhưng chưa lưu được /members:', error);
    }
    if (currentUser?.uid === user.uid) {
      updateCurrentUserUI();
      renderMembers();
      renderAllMessages(false);
    }
    toast(memberProfileSaved ? 'Đã cập nhật ảnh đại diện.' : 'Ảnh đã lưu trong tài khoản. Hãy cấp quyền cập nhật /members để mọi người nhìn thấy ảnh mới.', memberProfileSaved ? 'success' : 'error');
  } catch (error) {
    const denied = error?.code === 'storage/unauthorized' || error?.code === 'PERMISSION_DENIED';
    toast(denied ? 'Firebase Storage Rules chưa cho phép tải ảnh lên.' : 'Không thể tải ảnh lên. Hãy thử ảnh khác hoặc kiểm tra Firebase Storage.', 'error');
    console.warn('Avatar upload:', error);
  } finally {
    els.avatarFileInput.disabled = false;
    els.sidebarAvatar.disabled = false;
  }
}
