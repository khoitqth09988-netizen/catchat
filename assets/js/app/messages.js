/* CatChat · Reaction, thông báo, trả lời, render danh sách tin nhắn và refresh reaction.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function makeReactionStrip(messageId) {
  const strip = textElement('div', 'reaction-strip');
  const data = messageReactions[messageId] || {};
  const totalReactions = Object.values(data).reduce((total, users) => total + Object.values(users || {}).filter(Boolean).length, 0);
  if (totalReactions) strip.classList.add('has-reactions');
  REACTIONS.forEach(({ key, glyph, label }) => {
    const users = data[key] || {};
    const count = Object.values(users).filter(Boolean).length;
    const active = Boolean(currentUser && users[currentUser.uid]);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `reaction-button${active ? ' active' : ''}`;
    button.dataset.reactMessage = messageId;
    button.dataset.reaction = key;
    button.title = `${label}${count ? ` · ${count}` : ''}`;
    button.setAttribute('aria-label', `${label}, ${count} lượt`);
    button.setAttribute('aria-pressed', String(active));
    button.appendChild(textElement('span', 'reaction-emoji', glyph));
    if (count) button.appendChild(textElement('span', 'reaction-count', String(count)));
    strip.appendChild(button);
  });
  return strip;
}

function setAnnouncementMode(active) {
  const next = Boolean(active) && Boolean(currentUser);
  announcementMode = next;
  const bar = $('#announcementModeBar');
  if (bar) bar.hidden = !next;
  els.channelAnnouncements.classList.toggle('active', next);
  els.appView.classList.toggle('announcement-focus', next);
  if (next) {
    els.channelSymbol.textContent = '📣';
    els.channelTitle.textContent = 'thông-báo';
    els.channelMemberSummary.textContent = isAdmin
      ? 'Đăng thông báo tới toàn bộ tổ mèo'
      : 'Chỉ quản trị viên được đăng thông báo';
    els.chatMessages.setAttribute('aria-label', 'Thông báo toàn máy chủ');
    const hint = $('#announcementModeHint');
    if (hint) hint.textContent = isAdmin
      ? 'Chỉ quản trị viên được đăng · mọi thành viên đều đọc được'
      : 'Bạn đang xem thông báo · chỉ quản trị viên được đăng';
  } else {
    updateActiveChannelUI();
  }
  updateMessageComposer();
  renderAllMessages(next);
  if (next) {
    requestAnimationFrame(() => {
      els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    });
  }
}

function exitAnnouncementMode() {
  setAnnouncementMode(false);
  els.messageInput.focus({ preventScroll: true });
}

function setReplyTarget(messageId) {
  const data = messages.get(messageId);
  if (!data) {
    toast('Tin nhắn gốc không còn trong danh sách gần đây.', 'info');
    return;
  }
  replyTarget = { id: messageId, name: data.name || 'Thành viên', text: String(data.text || (data.imageURL ? '[Ảnh đính kèm]' : 'Thông báo')).slice(0, 180) };
  els.replyPreviewName.textContent = `Đang trả lời ${replyTarget.name}`;
  els.replyPreviewText.textContent = replyTarget.text || 'Thông báo';
  els.replyPreview.hidden = false;
  els.messageInput.focus();
}

function clearReplyTarget() {
  replyTarget = null;
  els.replyPreview.hidden = true;
  els.replyPreviewName.textContent = '';
  els.replyPreviewText.textContent = '';
}

async function toggleMessageReaction(messageId, reactionKey) {
  if (!currentUser || !messageReactionsRef || !messages.has(messageId) || !REACTIONS.some((item) => item.key === reactionKey)) return;
  if (CatChat.features.run('guardWrite', { type: 'reaction', id: messageId }) === true) return;
  const reactionRef = messageReactionsRef.child(messageId).child(reactionKey).child(currentUser.uid);
  try {
    if (messageReactions[messageId]?.[reactionKey]?.[currentUser.uid]) await reactionRef.remove();
    else await reactionRef.set(true);
  } catch (error) {
    showDatabaseError(error, 'Không thể lưu reaction. Hãy cấp quyền ghi vào /messageReactions.');
  }
}

function makeDeleteButton(messageId, label = 'Xóa tin nhắn') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'message-delete';
  button.dataset.deleteMessage = messageId;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.appendChild(icon('trash'));
  return button;
}

function makeReplyQuote(data) {
  if (!data.replyTo || !data.replyText) return null;
  const quote = document.createElement('button');
  quote.type = 'button';
  quote.className = 'message-quote';
  quote.dataset.jumpMessage = data.replyTo;
  quote.setAttribute('aria-label', `Đi tới tin nhắn của ${data.replyName || 'thành viên'}`);
  quote.appendChild(icon('reply'));
  const copy = textElement('span', 'message-quote-copy');
  copy.append(textElement('strong', '', data.replyName || 'Thành viên'));
  copy.append(textElement('span', '', data.replyText));
  quote.appendChild(copy);
  return quote;
}

function makeEditControls(id, data) {
  const wrap = textElement('div', 'message-edit');
  const input = document.createElement('textarea');
  input.className = 'message-edit-input';
  input.maxLength = data.kind === 'announcement' ? 500 : 800;
  input.value = editingDraft;
  input.setAttribute('aria-label', 'Sửa nội dung tin nhắn');
  input.addEventListener('input', () => { editingDraft = input.value; });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelMessageEdit();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void saveMessageEdit(id);
    }
  });
  const footer = textElement('div', 'message-edit-footer');
  footer.appendChild(textElement('span', 'message-edit-hint', 'Esc để huỷ · Ctrl/⌘ + Enter để lưu'));
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.editCancel = id;
  cancel.textContent = 'Huỷ';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save';
  save.dataset.editSave = id;
  save.textContent = 'Lưu';
  footer.append(cancel, save);
  wrap.append(input, footer);
  return wrap;
}

/* ── Trạng thái đọc & nhịp danh sách tin nhắn ────────────────────────────
   Gộp tin liên tiếp của cùng một người, đánh dấu mốc “Tin nhắn mới” và
   hiện nút nổi khi người dùng đang xem lại tin cũ. */
const MESSAGE_GROUP_WINDOW = 5 * 60 * 1000;

function sameMessageGroup(previous, current) {
  if (!previous || !current) return false;
  if (previous.kind === 'announcement' || current.kind === 'announcement') return false;
  if (previous.uid !== current.uid) return false;
  // Tin trả lời luôn mở nhóm mới để phần trích dẫn không bị dính vào tin trước.
  if (previous.replyTo) return false;
  const previousAt = timestampOf(previous);
  const currentAt = timestampOf(current);
  if (dateGroupKey(previousAt) !== dateGroupKey(currentAt)) return false;
  const delta = currentAt - previousAt;
  return delta >= 0 && delta < MESSAGE_GROUP_WINDOW;
}

function messagesNearBottom(slack = 120) {
  const area = els.chatMessages;
  if (!area) return true;
  return area.scrollHeight - area.scrollTop - area.clientHeight <= slack;
}

function syncUnreadPill() {
  const pill = $('#newMessagePill');
  if (!pill) return;
  const show = unreadMessageCount > 0 && Boolean(currentUser) && !announcementMode && !messagesNearBottom();
  pill.hidden = !show;
  if (!show) return;
  const label = $('#newMessagePillText');
  if (label) label.textContent = unreadMessageCount === 1 ? '1 tin nhắn mới' : `${unreadMessageCount} tin nhắn mới`;
}

/** Đưa người dùng về cuối danh sách và đánh dấu đã đọc. */
function jumpToLatestMessages(smooth = true) {
  unreadMessageCount = 0;
  lastReadTimestamp = Date.now();
  syncUnreadPill();
  if (!els.chatMessages) return;
  const preference = window.CatChat?.motion;
  const reduceMotion = preference && typeof preference.isReduced === 'function'
    ? preference.isReduced()
    : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  els.chatMessages.scrollTo({ top: els.chatMessages.scrollHeight, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
}

/** Gọi khi người dùng cuộn: ở gần cuối thì coi như đã đọc hết. */
function markFeedRead() {
  if (!messagesNearBottom()) {
    syncUnreadPill();
    return;
  }
  unreadMessageCount = 0;
  lastReadTimestamp = Date.now();
  syncUnreadPill();
}

function buildSkeletonRow(index = 0) {
  const row = textElement('div', 'message-skeleton');
  row.setAttribute('aria-hidden', 'true');
  const body = textElement('div', 'sk-body');
  body.append(
    textElement('span', 'sk-line sk-name'),
    textElement('span', 'sk-line'),
    textElement('span', 'sk-line')
  );
  row.append(textElement('span', 'sk-avatar'), body);
  row.style.animationDelay = `${Math.min(index * 55, 330)}ms`;
  return row;
}

/** Khung xương trong lúc chờ 100 tin gần nhất thay cho màn hình trống. */
function renderMessageSkeleton(rows = 6) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < rows; index += 1) fragment.appendChild(buildSkeletonRow(index));
  els.chatMessages.replaceChildren(fragment);
  els.chatMessages.setAttribute('aria-busy', 'true');
}

/* ── Tải thêm lịch sử ─────────────────────────────────────────────────
   Kênh chỉ nghe 100 tin gần nhất; người dùng có thể lật thêm từng đợt 50 tin
   cũ hơn mà vẫn giữ nguyên vị trí đang đọc. */
function oldestLoadedTimestamp() {
  let oldest = Number.POSITIVE_INFINITY;
  messages.forEach((data) => {
    const at = timestampOf(data || {});
    if (at < oldest) oldest = at;
  });
  return Number.isFinite(oldest) ? oldest : 0;
}

function syncOlderButton() {
  const button = els.loadOlderButton;
  if (!button) return;
  const browsing = !messageSearchQuery.trim() && !announcementMode;
  const show = hasOlderMessages && browsing && Boolean(currentUser);
  button.hidden = !show;
  button.disabled = isLoadingOlderMessages;
  button.classList.toggle('is-loading', isLoadingOlderMessages);
  const label = $('#loadOlderLabel');
  if (label) label.textContent = isLoadingOlderMessages ? 'Đang tải tin cũ…' : 'Tin nhắn cũ hơn';
}

async function loadOlderMessages() {
  if (isLoadingOlderMessages || !hasOlderMessages || !messagesRef || !currentUser) return;
  const oldest = oldestLoadedTimestamp();
  if (!oldest) return;
  isLoadingOlderMessages = true;
  syncOlderButton();
  const area = els.chatMessages;
  const previousHeight = area.scrollHeight;
  const previousTop = area.scrollTop;
  try {
    const snapshot = await messagesRef.orderByChild('timestamp').endAt(oldest - 1).limitToLast(50).once('value');
    let added = 0;
    snapshot.forEach((child) => {
      if (messages.has(child.key)) return;
      messages.set(child.key, child.val() || {});
      added += 1;
    });
    if (added < 50) hasOlderMessages = false;
    renderAllMessages(false);
    requestAnimationFrame(() => {
      area.scrollTop = area.scrollHeight - previousHeight + previousTop;
    });
  } catch (error) {
    showDatabaseError(error, 'Không tải được tin nhắn cũ hơn.');
  } finally {
    isLoadingOlderMessages = false;
    syncOlderButton();
  }
}

function buildMessageNode(id, data, grouped = false) {
  const isAnnouncement = data.kind === 'announcement';
  const isMine = data.uid === currentUser?.uid;
  const name = data.name || 'Thành viên';
  const time = timestampOf(data);
  const isPinned = Boolean(pins[activeChannelId] && pins[activeChannelId].messageId === id);
  const editing = editingMessageId === id;
  const row = textElement('article', `message-row${isMine ? ' mine' : ''}${isAnnouncement ? ' announcement-row' : ''}${isPinned ? ' is-pinned' : ''}${grouped ? ' is-grouped' : ''}`);
  row.dataset.messageId = id;
  row.dataset.timestamp = String(time);
  row.setAttribute('aria-label', isAnnouncement ? 'Thông báo toàn máy chủ' : `Tin nhắn từ ${name}`);

  const editedLabel = editWindowLabel(data);
  const canEditNow = canEditMessage(data);
  const canDeleteNow = canDeleteMessage(data);

  if (isAnnouncement) {
    const announcement = textElement('div', 'server-announcement');
    const head = textElement('div', 'server-announcement-head');
    head.append(icon('megaphone'));
    head.append(textElement('span', '', 'Thông báo toàn máy chủ'));
    if (isPinned) {
      const pinnedBadge = textElement('span', 'message-edited');
      pinnedBadge.textContent = '· đã ghim';
      head.appendChild(pinnedBadge);
    }
    const quote = makeReplyQuote(data);
    if (quote) announcement.appendChild(quote);
    if (editing) announcement.appendChild(makeEditControls(id, data));
    else announcement.appendChild(makeMessageText(data.text || '', { tag: 'p', className: '', id, data }));
    const meta = textElement('div', 'server-announcement-meta');
    meta.append(textElement('span', '', `Gửi bởi ${name}`));
    const stamp = textElement('span');
    stamp.append(textElement('time', '', formatDateTime(time)));
    if (editedLabel) stamp.appendChild(textElement('span', 'message-edited', ` · ${editedLabel}`));
    meta.appendChild(stamp);
    meta.appendChild(makeReplyButton(id));
    meta.appendChild(makeSaveButton(id));
    CatChat.features.run('messageTools', meta, { id, data });
    if (canEditNow) meta.appendChild(makeMessageTool('edit', 'Sửa thông báo', { editMessage: id }));
    if (isAdmin) meta.appendChild(makeMessageTool('pin', isPinned ? 'Bỏ ghim thông báo' : 'Ghim thông báo', { pinMessage: id }));
    announcement.append(head, meta, makeReactionStrip(id));
    row.appendChild(announcement);
  } else {
    const avatar = makeAvatar(name, data.uid, 'avatar message-avatar', members[data.uid]?.photoURL || '');
    const content = textElement('div', 'message-content');
    const meta = textElement('div', 'message-meta');
    meta.append(textElement('span', 'message-name', name));
    meta.append(textElement('time', 'message-time', formatTime(time)));
    if (editedLabel) meta.appendChild(textElement('span', 'message-edited', editedLabel));
    if (isPinned) meta.appendChild(textElement('span', 'message-edited', '· đã ghim'));
    meta.appendChild(makeReplyButton(id));
    meta.appendChild(makeSaveButton(id));
    CatChat.features.run('messageTools', meta, { id, data });
    if (canEditNow) meta.appendChild(makeMessageTool('edit', 'Sửa tin nhắn', { editMessage: id }));
    if (isAdmin) meta.appendChild(makeMessageTool('pin', isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn', { pinMessage: id }));
    const quote = makeReplyQuote(data);
    if (quote) content.appendChild(quote);
    content.appendChild(meta);
    const imageURL = safeImageUrl(data.imageURL || '');
    if (imageURL) {
      const link = document.createElement('a');
      link.className = 'message-image-link';
      link.href = imageURL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Mở ảnh ${data.imageName || 'đính kèm'}`);
      const image = document.createElement('img');
      image.className = 'message-image';
      image.src = imageURL;
      image.alt = data.imageName || `Ảnh được gửi bởi ${name}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      // Ảnh hiện dần khi tải xong để danh sách không bị “nhảy” và không có khung trống.
      const revealImage = () => image.classList.add('is-loaded');
      if (image.complete && image.naturalWidth) revealImage();
      else image.addEventListener('load', revealImage, { once: true });
      image.addEventListener('error', () => image.classList.add('is-loaded', 'is-broken'), { once: true });
      link.classList.add('is-loading-image');
      image.addEventListener('load', () => link.classList.remove('is-loading-image'), { once: true });
      link.appendChild(image);
      content.appendChild(link);
    }
    if (editing) content.appendChild(makeEditControls(id, data));
    else if (data.text) content.appendChild(makeMessageText(data.text, { id, data }));
    content.appendChild(makeReactionStrip(id));
    row.append(avatar, content);
  }
  if (canDeleteNow) {
    row.appendChild(makeDeleteButton(id, isAnnouncement ? 'Xoá thông báo' : isMine && !isAdmin ? 'Xoá tin nhắn của bạn' : 'Xoá tin nhắn'));
  }
  return row;
}

function renderAllMessages(scrollToEnd = false, newArrival = false) {
  if (editingMessageId && !messageDataById(editingMessageId)) {
    editingMessageId = null;
    editingDraft = '';
  }
  const wasNearBottom = els.chatMessages.scrollHeight - els.chatMessages.scrollTop - els.chatMessages.clientHeight < 130;
  const sortedMessages = Array.from(messages.entries()).sort((a, b) => timestampOf(a[1]) - timestampOf(b[1]));
  const allMessages = announcementMode
    ? sortedMessages.filter(([, data]) => data && data.kind === 'announcement')
    : sortedMessages;
  const query = messageSearchQuery.trim().toLocaleLowerCase('vi');
  const visibleMessages = query
    ? allMessages.filter(([, data]) => `${data.name || ''} ${data.text || ''} ${data.imageName || ''}`.toLocaleLowerCase('vi').includes(query))
    : allMessages;
  els.messageSearchCount.textContent = query
    ? `${visibleMessages.length} kết quả`
    : announcementMode ? `${allMessages.length} thông báo` : `${allMessages.length} tin nhắn`;
  const fragment = document.createDocumentFragment();
  if (els.loadOlderButton && !query && !announcementMode) {
    fragment.appendChild(els.loadOlderButton);
    syncOlderButton();
  }
  let previousDate = '';
  let previousData = null;
  let unreadDividerPlaced = false;
  const treatAsRead = wasNearBottom || !currentUser;
  if (treatAsRead && !query) {
    unreadMessageCount = 0;
    lastReadTimestamp = Date.now();
  }
  for (const [id, data] of visibleMessages) {
    const timestamp = timestampOf(data || {});
    const groupKey = dateGroupKey(timestamp);
    if (groupKey !== previousDate) {
      const divider = textElement('div', 'date-divider');
      divider.appendChild(textElement('span', '', dateGroupLabel(timestamp)));
      fragment.appendChild(divider);
      previousDate = groupKey;
      previousData = null;
    }
    if (!unreadDividerPlaced && !treatAsRead && !query && !announcementMode && lastReadTimestamp && timestamp > lastReadTimestamp) {
      const unreadDivider = textElement('div', 'new-messages-divider');
      unreadDivider.appendChild(textElement('span', '', 'Tin nhắn mới'));
      fragment.appendChild(unreadDivider);
      unreadDividerPlaced = true;
    }
    const grouped = sameMessageGroup(previousData, data || {});
    fragment.appendChild(buildMessageNode(id, data || {}, grouped));
    previousData = data || {};
  }
  if (newArrival && !wasNearBottom && !query && !announcementMode && currentUser) unreadMessageCount += 1;
  if (!visibleMessages.length && !query && announcementMode) {
    const empty = textElement('div', 'chat-empty');
    const illustration = textElement('div', 'empty-illustration');
    illustration.appendChild(icon('bell'));
    empty.append(
      illustration,
      textElement('h3', '', 'Chưa có thông báo nào'),
      textElement('p', '', isAdmin
        ? 'Viết nội dung bên dưới và gửi — thông báo sẽ hiện cho toàn bộ thành viên trong phòng chung.'
        : 'Khi quản trị viên đăng thông báo, nội dung sẽ xuất hiện tại đây.')
    );
    fragment.appendChild(empty);
  } else if (!visibleMessages.length && !query) {
    fragment.appendChild(els.chatEmptyState);
  } else if (!visibleMessages.length) {
    const empty = textElement('div', 'chat-empty');
    const illustration = textElement('div', 'empty-illustration');
    illustration.appendChild(icon('search'));
    empty.append(illustration, textElement('h3', '', 'Không tìm thấy tin nhắn'), textElement('p', '', 'Thử một từ khóa khác trong 100 tin nhắn gần nhất.'));
    fragment.appendChild(empty);
  }
  els.chatMessages.replaceChildren(fragment);
  els.chatMessages.setAttribute('aria-busy', 'false');
  syncOlderButton();
  syncUnreadPill();
  if (scrollToEnd || (newArrival && wasNearBottom)) requestAnimationFrame(() => {
    els.chatMessages.scrollTop = query ? 0 : els.chatMessages.scrollHeight;
    if (!query) {
      unreadMessageCount = 0;
      lastReadTimestamp = Date.now();
      syncUnreadPill();
    }
  });
}

function setMessageSearchOpen(open) {
  els.messageSearchBar.hidden = !open;
  $('#searchMessagesButton').setAttribute('aria-expanded', String(open));
  if (open) {
    window.setTimeout(() => els.messageSearchInput.focus(), 30);
  } else {
    els.messageSearchInput.value = '';
    messageSearchQuery = '';
    renderAllMessages(true);
  }
}

function updateAnnouncementBanner() {
  const latest = Array.from(announcementMessages.entries())
    .sort((a, b) => timestampOf(b[1]) - timestampOf(a[1]))[0];
  if (!latest) {
    els.announcementBanner.hidden = true;
    $('#announcementUnread').hidden = true;
    return;
  }
  const [id, data] = latest;
  if (announcementDismissedId === id) {
    els.announcementBanner.hidden = true;
  } else {
    els.announcementBanner.hidden = false;
    els.announcementBannerText.textContent = data.text || '';
    els.announcementBannerTime.textContent = `${data.name || 'Quản trị viên'} · ${formatDateTime(timestampOf(data))}`;
  }
  $('#announcementUnread').hidden = false;
}

function refreshReactionStrip(messageId, reactedKey = '') {
  const row = Array.from(els.chatMessages.querySelectorAll('[data-message-id]'))
    .find((item) => item.dataset.messageId === messageId);
  if (!row) return;
  const strip = makeReactionStrip(messageId);
  const previous = row.querySelector('.reaction-strip');
  if (previous) previous.replaceWith(strip);
  else row.appendChild(strip);
  if (reactedKey) {
    const button = strip.querySelector(`[data-reaction="${reactedKey}"]`);
    if (button) button.classList.add('just-reacted');
  }
}
