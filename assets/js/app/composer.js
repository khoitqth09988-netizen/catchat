/* CatChat · Khung soạn tin, gửi tin nhắn, gửi thông báo và đính kèm ảnh.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function updateMessageComposer() {
  const length = els.messageInput.value.length;
  const postingAnnouncement = announcementMode && activeChannelId === 'general';
  const limit = postingAnnouncement ? 500 : 800;
  els.messageInput.maxLength = limit;
  els.messageCharCount.textContent = `${length} / ${limit}`;
  const blockedByPermission = postingAnnouncement && !isAdmin;
  const muted = Boolean(currentUser && isMuted(currentUser.uid));
  const locked = !isAdmin && isChannelLocked(activeChannelId);
  els.messageInput.placeholder = muted
    ? `Bạn đang bị cấm chat ${muteRemainingLabel(mutes[currentUser?.uid])}`
    : locked
      ? `#${channelNameFor(activeChannelId)} đang bị quản trị viên khoá`
      : postingAnnouncement
        ? (isAdmin ? 'Viết thông báo gửi tới toàn bộ tổ mèo...' : 'Chỉ quản trị viên được đăng thông báo')
        : `Nhắn tin trong #${channelNameFor(activeChannelId)}...`;
  const blocked = blockedByPermission || locked;
  els.sendButton.disabled = isSendingMessage || !currentUser || blocked || muted || (!els.messageInput.value.trim() && !pendingImageFile && !pendingImageUrl) || length > limit;
  els.messageInput.disabled = isSendingMessage || blocked;
  els.attachImageButton.disabled = isSendingMessage || (postingAnnouncement && !isAdmin);
  els.chatImageInput.disabled = isSendingMessage;
  els.messageInput.style.height = 'auto';
  els.messageInput.style.height = `${Math.min(els.messageInput.scrollHeight, 118)}px`;
}

function clearPendingImage() {
  pendingImageFile = null;
  pendingImageUrl = '';
  if (pendingImageObjectUrl) URL.revokeObjectURL(pendingImageObjectUrl);
  pendingImageObjectUrl = null;
  els.pendingImageThumb.removeAttribute('src');
  els.pendingImageName.textContent = '';
  els.pendingImagePreview.hidden = true;
  updateMessageComposer();
}

function selectChatImage(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!storageReady()) {
    markStorageUnavailable();
    return;
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    toast('Ảnh đính kèm cần ở định dạng JPG, PNG, WebP hoặc GIF.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('Ảnh đính kèm tối đa 5 MB.', 'error');
    return;
  }
  if (pendingImageObjectUrl) URL.revokeObjectURL(pendingImageObjectUrl);
  pendingImageFile = file;
  pendingImageObjectUrl = URL.createObjectURL(file);
  els.pendingImageThumb.src = pendingImageObjectUrl;
  els.pendingImageName.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
  els.pendingImagePreview.hidden = false;
  updateMessageComposer();
  els.messageInput.focus();
}

/** Chế độ không có Storage: đính kèm ảnh bằng liên kết https:// công khai.
    Không tải tệp lên đâu cả — chỉ lưu URL vào tin nhắn (Rules cho phép imageURL ≤ 4096 ký tự). */
function attachImageFromLink() {
  const input = window.prompt('Dán liên kết ảnh (https://…). Ảnh sẽ hiển thị trực tiếp, không tải lên Firebase Storage.', pendingImageUrl || '');
  if (input === null) return;
  const url = String(input).trim();
  if (!url) {
    clearPendingImage();
    return;
  }
  if (!/^https:\/\/[^\s]+$/i.test(url)) {
    toast('Liên kết ảnh phải bắt đầu bằng https:// và không chứa khoảng trắng.', 'error');
    return;
  }
  if (url.length > 2000) {
    toast('Liên kết ảnh quá dài (tối đa 2000 ký tự).', 'error');
    return;
  }
  if (pendingImageObjectUrl) URL.revokeObjectURL(pendingImageObjectUrl);
  pendingImageObjectUrl = null;
  pendingImageFile = null;
  pendingImageUrl = url;
  els.pendingImageThumb.src = url;
  els.pendingImageName.textContent = 'Ảnh từ liên kết';
  els.pendingImagePreview.hidden = false;
  updateMessageComposer();
  els.messageInput.focus();
}

/** Một cửa duy nhất cho nút đính kèm: có Storage thì chọn tệp, không thì dán liên kết. */
function chooseAttachment() {
  if (storageReady()) {
    els.chatImageInput.click();
    return;
  }
  showStorageHint();
  attachImageFromLink();
}

async function sendMessage(event) {
  event?.preventDefault();
  const user = currentUser;
  const postingAnnouncement = announcementMode && activeChannelId === 'general';
  const targetRef = postingAnnouncement ? (generalMessagesRef || messagesRef) : messagesRef;
  if (!user || isSendingMessage) return;
  if (!targetRef) {
    toast('Chưa kết nối được phòng chat. Hãy tải lại trang rồi thử lại.', 'error');
    return;
  }
  let text = els.messageInput.value.trim();
  const imageFile = pendingImageFile;
  const imageLink = pendingImageUrl;
  // Hook tính năng: lệnh gạch chéo, chuyển hoá nội dung hoặc chặn gửi.
  const outgoing = CatChat.features.run('outgoingText', {
    text,
    announcement: postingAnnouncement,
    channelId: activeChannelId,
    imageFile: Boolean(imageFile)
  });
  if (outgoing.cancel) {
    updateMessageComposer();
    return;
  }
  text = String(outgoing.text ?? text).trim();
  const reply = replyTarget ? { ...replyTarget } : null;
  if (isMuted(user.uid)) {
    toast(`Bạn đang bị cấm chat ${muteRemainingLabel(mutes[user.uid])}.`, 'error');
    return;
  }
  if (!isAdmin && isChannelLocked(activeChannelId)) {
    toast(`Kênh #${channelNameFor(activeChannelId)} đang bị khoá. Chỉ quản trị viên gửi được.`, 'error');
    return;
  }
  if (postingAnnouncement) {
    if (!isAdmin) {
      toast('Chỉ quản trị viên được đăng thông báo.', 'error');
      return;
    }
    if (!text) return;
    if (text.length > 500) {
      toast('Thông báo tối đa 500 ký tự.', 'error');
      return;
    }
    if (imageFile || imageLink) {
      toast('Thông báo chỉ chứa nội dung chữ, không kèm ảnh.', 'info');
      return;
    }
  } else {
    if (!text && !imageFile && !imageLink) return;
    if (text.length > 800) {
      toast('Tin nhắn tối đa 800 ký tự.', 'error');
      return;
    }
  }
  isSendingMessage = true;
  updateMessageComposer();
  let uploadedImageRef = null;
  try {
    const message = {
      uid: user.uid,
      name: await authorNameFor(user),
      text,
      kind: postingAnnouncement ? 'announcement' : 'message',
      timestamp: currentTimestamp()
    };
    if (imageLink) {
      message.imageURL = imageLink;
      message.imageName = 'Ảnh từ liên kết';
    } else if (imageFile) {
      const extension = imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/gif' ? 'gif' : imageFile.type === 'image/webp' ? 'webp' : 'jpg';
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      if (!storageReady()) throw new Error('Firebase Storage chưa sẵn sàng.');
      uploadedImageRef = storage.ref(`chatImages/${user.uid}/${Date.now()}-${randomSuffix}.${extension}`);
      const uploaded = await uploadedImageRef.put(imageFile, { contentType: imageFile.type });
      message.imageURL = await uploaded.ref.getDownloadURL();
      message.imageName = String(imageFile.name || 'Ảnh đính kèm').slice(0, 120);
    }
    if (reply) {
      message.replyTo = reply.id;
      message.replyName = reply.name;
      message.replyText = reply.text;
    }
    if (currentUser?.uid !== user.uid) throw new Error('Phiên đăng nhập đã thay đổi.');
    await targetRef.push(message);
    if (currentUser?.uid === user.uid) {
      els.messageInput.value = '';
      clearReplyTarget();
      clearPendingImage();
      if (postingAnnouncement) {
        toast('Đã đăng thông báo tới toàn bộ tổ mèo.', 'success');
        void logAdminAction('announcement', `Đăng thông báo: ${text.slice(0, 120)}`);
      }
    }
  } catch (error) {
    if (uploadedImageRef) await uploadedImageRef.delete().catch(() => {});
    const denied = error?.code === 'PERMISSION_DENIED' || /permission_denied/i.test(error?.message || '');
    if (denied && postingAnnouncement) {
      toast('Firebase Rules đang chặn đăng thông báo. Thêm email admin vào Rules của /messages (mình đã gửi JSON kèm).', 'error');
    } else if (error?.code?.startsWith('storage/')) {
      showDatabaseError(error, 'Không gửi được ảnh. Hãy kiểm tra Firebase Storage Rules.');
    } else {
      showDatabaseError(error, 'Không gửi được tin nhắn. Hãy thử lại sau.');
    }
  } finally {
    isSendingMessage = false;
    updateMessageComposer();
    if (currentUser?.uid === user.uid) els.messageInput.focus();
  }
}

async function sendAnnouncement() {
  if (!currentUser || !isAdmin) {
    toast('Bạn không có quyền gửi thông báo toàn máy chủ.', 'error');
    return;
  }
  if (!generalMessagesRef) {
    toast('Chưa kết nối được máy chủ. Hãy thử lại sau.', 'error');
    return;
  }
  const text = els.announcementInput.value.trim();
  if (!text) {
    toast('Hãy nhập nội dung thông báo trước khi gửi.', 'error');
    els.announcementInput.focus();
    return;
  }
  els.announcementInput.disabled = true;
  els.publishAnnouncementButton.disabled = true;
  try {
    await generalMessagesRef.push({
      uid: currentUser.uid,
      name: await authorNameFor(currentUser),
      text,
      kind: 'announcement',
      timestamp: currentTimestamp()
    });
    els.announcementInput.value = '';
    $('#announcementCharCount').textContent = '0 / 500';
    toast('Thông báo đã được gửi tới toàn bộ máy chủ.', 'success');
    void logAdminAction('announcement', `Đăng thông báo: ${text.slice(0, 120)}`);
  } catch (error) {
    showDatabaseError(error, 'Không gửi được thông báo. Hãy kiểm tra quyền quản trị trong Firebase.');
  } finally {
    els.announcementInput.disabled = !isAdmin;
    els.publishAnnouncementButton.disabled = !isAdmin;
  }
}
