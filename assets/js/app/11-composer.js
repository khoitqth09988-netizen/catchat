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
  els.sendButton.disabled = isSendingMessage || !currentUser || blocked || muted || (!els.messageInput.value.trim() && !pendingImageFile) || length > limit;
  els.messageInput.disabled = isSendingMessage || blocked;
  els.attachImageButton.disabled = isSendingMessage || (postingAnnouncement && !isAdmin);
  els.chatImageInput.disabled = isSendingMessage;
  els.messageInput.style.height = 'auto';
  els.messageInput.style.height = `${Math.min(els.messageInput.scrollHeight, 118)}px`;
}

function clearPendingImage() {
  pendingImageFile = null;
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
  if (!storage) {
    toast('Chưa bật Firebase Storage. Hãy cấu hình Storage trước khi gửi ảnh.', 'error');
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
    if (imageFile) {
      toast('Thông báo chỉ chứa nội dung chữ, không kèm ảnh.', 'info');
      return;
    }
  } else {
    if (!text && !imageFile) return;
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
      name: displayNameFor(user).slice(0, 32),
      text,
      kind: postingAnnouncement ? 'announcement' : 'message',
      timestamp: currentTimestamp()
    };
    if (imageFile) {
      const extension = imageFile.type === 'image/png' ? 'png' : imageFile.type === 'image/gif' ? 'gif' : imageFile.type === 'image/webp' ? 'webp' : 'jpg';
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      if (!storage) throw new Error('Firebase Storage chưa sẵn sàng.');
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
      name: displayNameFor(currentUser).slice(0, 32),
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
