/* CatChat · Hộp thoại xác nhận, cấm thành viên, mở/đóng admin, chuyển tab và toast.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function openConfirm({ title, description, acceptLabel = 'Xác nhận', tone = 'danger', reason = false, iconName = 'ban' }) {
  if (confirmResolver) confirmResolver(null);
  els.confirmTitle.textContent = title;
  els.confirmDescription.textContent = description;
  els.confirmAccept.textContent = acceptLabel;
  els.confirmAccept.className = `dialog-button ${tone}`;
  els.confirmReasonWrap.hidden = !reason;
  els.confirmReason.value = '';
  const use = $('#confirmIcon use');
  use.setAttribute('href', `#i-${iconName}`);
  els.confirmLayer.classList.add('open');
  els.confirmLayer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('body-locked');
  window.setTimeout(() => (reason ? els.confirmReason : els.confirmCancel).focus(), 30);
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function closeConfirm(result) {
  els.confirmLayer.classList.remove('open');
  els.confirmLayer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('body-locked');
  if (confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(result);
  }
}

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

async function manageBan(uid, shouldBan) {
  if (!isAdmin || !currentUser || !uid) return;
  if (uid === currentUser.uid) {
    toast('Bạn không thể tự cấm tài khoản quản trị đang sử dụng.', 'error');
    return;
  }
  const member = members[uid] || {};
  const name = member.name || member.email?.split('@')[0] || 'thành viên này';
  if (shouldBan) {
    const result = await openConfirm({
      title: `Cấm vĩnh viễn ${name}?`,
      description: 'Tài khoản bị cấm vĩnh viễn: bị đăng xuất ngay và không thể truy cập lại cho tới khi quản trị viên gỡ. Muốn chặn luôn thiết bị/IP, dùng nút “Cấm vĩnh viễn (tài khoản + thiết bị + IP)” trong hồ sơ.',
      acceptLabel: 'Cấm vĩnh viễn', tone: 'danger', reason: true, iconName: 'ban'
    });
    if (!result) return;
    try {
      await bansRef.child(uid).set({
        reason: result.reason || '',
        bannedBy: currentUser.uid,
        bannedAt: currentTimestamp(),
        permanent: true
      });
      toast(`Đã cấm vĩnh viễn ${name}.`, 'success');
      void logAdminAction('ban', `Cấm truy cập ${name}${result.reason ? ` · ${result.reason}` : ''}`, uid);
    } catch (error) {
      showDatabaseError(error, 'Không thể cấm thành viên. Hãy kiểm tra Firebase Security Rules.');
    }
  } else {
    const result = await openConfirm({
      title: `Bỏ cấm ${name}?`,
      description: 'Thành viên có thể đăng nhập và sử dụng ứng dụng trở lại sau khi lệnh cấm được gỡ.',
      acceptLabel: 'Bỏ cấm', tone: 'primary', iconName: 'unban'
    });
    if (!result) return;
    try {
      await bansRef.child(uid).remove();
      toast(`Đã bỏ cấm ${name}.`, 'success');
      void logAdminAction('unban', `Bỏ cấm truy cập ${name}`, uid);
    } catch (error) {
      showDatabaseError(error, 'Không thể bỏ cấm thành viên. Hãy kiểm tra Firebase Security Rules.');
    }
  }
}

function openAdmin() {
  if (!isAdmin) {
    toast('Tài khoản hiện tại chưa được cấp quyền quản trị.', 'error');
    return;
  }
  els.adminOverlay.classList.add('open');
  els.adminOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('body-locked');
  renderAdminPanel();
  renderAdminMessages();
  renderAdminOverview();
  switchAdminTab('overview');
  window.setTimeout(() => $('#closeAdminButton').focus(), 60);
}

function closeAdmin() {
  els.adminOverlay.classList.remove('open');
  els.adminOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('body-locked');
  els.openAdminButton.focus();
}

function switchAdminTab(name) {
  const tab = ['overview', 'members', 'messages', 'announcements', 'blocks'].includes(name) ? name : 'overview';
  const panels = { overview: 'adminOverviewTab', members: 'adminMembersTab', messages: 'adminMessagesTab', announcements: 'adminAnnouncementsTab', blocks: 'adminBlocksTab' };
  const buttons = { overview: 'adminOverviewTabButton', members: 'adminMembersTabButton', messages: 'adminMessagesTabButton', announcements: 'adminAnnouncementsTabButton', blocks: 'adminBlocksTabButton' };
  Object.entries(panels).forEach(([key, panelId]) => {
    const active = key === tab;
    const button = $(`#${buttons[key]}`);
    const panel = $(`#${panelId}`);
    if (button) {
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    if (panel) panel.hidden = !active;
  });
  if (tab === 'overview') renderAdminOverview();
  if (tab === 'messages') renderAdminMessages();
  if (tab === 'announcements') els.announcementInput.focus();
  // Tab chặn vĩnh viễn do feature identity-blocks dựng nội dung (không có trong app lõi).
  if (tab === 'blocks') void window.CatChat?.identityBlocks?.render?.();
}


function toast(message, type = 'info') {
  const item = textElement('div', `toast ${type}`);
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'info' : 'sparkles';
  item.appendChild(icon(iconName));
  item.appendChild(textElement('span', 'toast-message', message));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Đóng thông báo');
  close.appendChild(icon('close'));
  close.addEventListener('click', () => item.remove());
  item.appendChild(close);
  els.toastRegion.appendChild(item);
  window.setTimeout(() => {
    if (item.isConnected) {
      item.style.opacity = '0';
      item.style.transform = 'translateY(6px)';
      window.setTimeout(() => item.remove(), 220);
    }
  }, 4800);
}
