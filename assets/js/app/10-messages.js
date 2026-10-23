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

function buildMessageNode(id, data) {
  const isAnnouncement = data.kind === 'announcement';
  const isMine = data.uid === currentUser?.uid;
  const name = data.name || 'Thành viên';
  const time = timestampOf(data);
  const isPinned = Boolean(pins[activeChannelId] && pins[activeChannelId].messageId === id);
  const editing = editingMessageId === id;
  const row = textElement('article', `message-row${isMine ? ' mine' : ''}${isAnnouncement ? ' announcement-row' : ''}${isPinned ? ' is-pinned' : ''}`);
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
    else announcement.appendChild(textElement('p', '', data.text || ''));
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
      link.appendChild(image);
      content.appendChild(link);
    }
    if (editing) content.appendChild(makeEditControls(id, data));
    else if (data.text) content.appendChild(textElement('div', 'message-bubble', data.text));
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
  let previousDate = '';
  for (const [id, data] of visibleMessages) {
    const timestamp = timestampOf(data || {});
    const groupKey = dateGroupKey(timestamp);
    if (groupKey !== previousDate) {
      const divider = textElement('div', 'date-divider');
      divider.appendChild(textElement('span', '', dateGroupLabel(timestamp)));
      fragment.appendChild(divider);
      previousDate = groupKey;
    }
    fragment.appendChild(buildMessageNode(id, data || {}));
  }
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
  if (scrollToEnd || (newArrival && wasNearBottom)) requestAnimationFrame(() => {
    els.chatMessages.scrollTop = query ? 0 : els.chatMessages.scrollHeight;
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
