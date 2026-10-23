/* CatChat · Xoá tin nhắn và dọn kênh.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

async function deleteMessage(messageId) {
  const data = messages.get(messageId) || announcementMessages.get(messageId);
  if (!data || !canDeleteMessage(data)) {
    toast('Bạn chỉ xoá được tin nhắn của chính mình.', 'error');
    return;
  }
  const isAnnouncement = data.kind === 'announcement';
  const targetRef = messageTargetRef(data);
  if (!targetRef) return;
  const confirm = await openConfirm({
    title: isAnnouncement ? 'Xóa thông báo này?' : 'Xóa tin nhắn này?',
    description: isAdmin && !isMessageOwner(data)
      ? 'Bạn đang xoá tin nhắn của thành viên khác. Nội dung sẽ biến mất với mọi người và không thể khôi phục.'
      : 'Tin nhắn sẽ biến mất với tất cả mọi người và không thể khôi phục.',
    acceptLabel: 'Xóa nội dung',
    tone: 'danger',
    iconName: 'trash'
  });
  if (!confirm) return;
  try {
    await targetRef.child(messageId).remove();
    await messageReactionsRef.child(messageId).remove().catch((error) => console.warn('Không dọn được reactions cũ:', error));
    if (isAdmin && pinsRef && pins[activeChannelId]?.messageId === messageId) {
      await pinsRef.child(activeChannelId).remove().catch((error) => console.warn('Không bỏ ghim được tin nhắn đã xoá:', error));
    }
    if (editingMessageId === messageId) { editingMessageId = null; editingDraft = ''; }
    toast(isAnnouncement ? 'Đã xóa thông báo.' : 'Đã xóa tin nhắn.', 'success');
    if (isAdmin) void logAdminAction('delete', `${isAnnouncement ? 'Xoá thông báo' : 'Xoá tin nhắn'} của ${data.name || 'thành viên'}: ${String(data.text || '[ảnh]').slice(0, 80)}`, data.uid || '');
  } catch (error) {
    showDatabaseError(error, 'Không thể xóa nội dung. Firebase Rules phải cho phép chủ tin nhắn hoặc admin xoá.');
  }
}

async function clearCurrentChannel() {
  if (isSendingMessage) {
    toast('Đợi tin nhắn đang gửi xong rồi mới dọn kênh nhé.', 'info');
    return;
  }
  if (!isAdmin || !messagesRef) {
    toast('Bạn không có quyền dọn toàn bộ tin nhắn.', 'error');
    return;
  }
  const name = channelNameFor(activeChannelId);
  const confirm = await openConfirm({
    title: `Xóa toàn bộ #${name}?`,
    description: 'Toàn bộ lịch sử trong kênh này sẽ bị xóa với mọi thành viên. Thao tác này không thể hoàn tác.',
    acceptLabel: 'Xóa toàn bộ', tone: 'danger', iconName: 'trash'
  });
  if (!confirm) return;
  try {
    const snapshot = await messagesRef.once('value');
    const ids = [];
    snapshot.forEach((child) => ids.push(child.key));
    await messagesRef.remove();
    let failedReactionCleanups = 0;
    for (let index = 0; index < ids.length; index += 100) {
      const chunk = ids.slice(index, index + 100);
      const results = await Promise.allSettled(chunk.map((id) => messageReactionsRef.child(id).remove()));
      failedReactionCleanups += results.filter((result) => result.status === 'rejected').length;
    }
    messages.clear();
    messageReactions = {};
    renderAllMessages(true);
    if (activeChannelId === 'general') {
      announcementMessages.clear();
      updateAnnouncementBanner();
    }
    renderAdminPanel();
    void logAdminAction('clear', `Dọn toàn bộ #${name} (${ids.length} tin nhắn)`);
    toast(failedReactionCleanups
      ? `Đã xóa ${ids.length} tin nhắn. Một số reaction cũ chưa được dọn; kiểm tra Rules.`
      : `Đã xóa ${ids.length} tin nhắn trong #${name}.`, failedReactionCleanups ? 'error' : 'success');
  } catch (error) {
    showDatabaseError(error, 'Không thể xóa toàn bộ kênh. Kiểm tra quyền ghi của admin trong Firebase Rules.');
  }
}
