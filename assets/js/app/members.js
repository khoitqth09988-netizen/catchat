/* CatChat · Tab thành viên, danh bạ, hồ sơ thành viên và emoji picker.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function makeMemberRow(uid, member, adminRow = false) {
  const safeMember = member || {};
  const name = safeMember.name || safeMember.displayName || safeMember.email?.split('@')[0] || 'Thành viên';
  const isOnline = Boolean(presence[uid]);
  const isBanned = Boolean(bans[uid]);
  if (adminRow) {
    const row = textElement('div', 'admin-member-row');
    row.appendChild(makeAvatar(name, uid, 'avatar', safeMember.photoURL || ''));
    const meta = textElement('div', 'admin-member-meta');
    meta.append(textElement('strong', '', name));
    meta.append(textElement('span', '', memberEmails[uid]?.email || safeMember.email || uid));
    row.appendChild(meta);
    const actions = textElement('div', 'admin-member-actions');
    const muted = isMuted(uid);
    const status = textElement('span', `status-tag${isBanned ? ' banned' : ''}`);
    status.appendChild(textElement('span', 'tag-dot'));
    status.append(document.createTextNode(isBanned ? 'Bị cấm' : isOnline ? 'Trực tuyến' : 'Ngoại tuyến'));
    actions.appendChild(status);
    if (muted) {
      const mutedTag = textElement('span', 'tag-muted');
      mutedTag.appendChild(icon('mute'));
      mutedTag.append(document.createTextNode(`Cấm chat · ${muteRemainingLabel(mutes[uid])}`));
      actions.appendChild(mutedTag);
    }
    if (uid !== currentUser?.uid) {
      const muteButton = document.createElement('button');
      muteButton.type = 'button';
      muteButton.className = `admin-action${muted ? ' unban' : ''}`;
      muteButton.dataset.memberAction = muted ? 'unmute' : 'mute';
      muteButton.dataset.uid = uid;
      muteButton.title = muted ? 'Bỏ cấm chat' : 'Cấm chat thành viên';
      muteButton.setAttribute('aria-label', muteButton.title);
      muteButton.appendChild(icon(muted ? 'smile' : 'mute'));
      actions.appendChild(muteButton);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `admin-action${isBanned ? ' unban' : ''}`;
      button.dataset.memberAction = isBanned ? 'unban' : 'ban';
      button.dataset.uid = uid;
      button.title = isBanned ? 'Bỏ cấm thành viên' : 'Cấm thành viên';
      button.setAttribute('aria-label', button.title);
      button.appendChild(icon(isBanned ? 'unban' : 'ban'));
      actions.appendChild(button);
      if (bans[uid]?.deleted) {
        const removedTag = textElement('span', 'tag-deleted');
        removedTag.appendChild(icon('user-x'));
        removedTag.append(document.createTextNode('Đã xoá'));
        actions.appendChild(removedTag);
      } else {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'admin-action danger';
        deleteButton.dataset.memberAction = 'delete-account';
        deleteButton.dataset.uid = uid;
        deleteButton.title = `Xoá tài khoản của ${name} khỏi hệ thống`;
        deleteButton.setAttribute('aria-label', deleteButton.title);
        deleteButton.appendChild(icon('user-x'));
        actions.appendChild(deleteButton);
      }
    }
    row.appendChild(actions);
    return row;
  }

  const row = textElement('div', 'member-row');
  row.dataset.memberUid = uid;
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.title = `Xem hồ sơ của ${name}`;
  const avatarWrap = textElement('div', 'member-avatar-wrap');
  avatarWrap.appendChild(makeAvatar(name, uid, 'avatar', safeMember.photoURL || ''));
  const status = textElement('span', `presence-indicator${isOnline ? ' is-online' : ''}`);
  status.setAttribute('aria-label', isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến');
  avatarWrap.appendChild(status);
  const copy = textElement('div', 'member-copy');
  copy.appendChild(textElement('strong', '', name));
  if (isMuted(uid)) {
    const mutedBadge = textElement('span', 'tag-muted');
    mutedBadge.appendChild(icon('mute'));
    mutedBadge.append(document.createTextNode('Cấm chat'));
    copy.appendChild(mutedBadge);
  }
  if (currentUser?.uid === uid && isAdmin) {
    const badge = textElement('span', 'member-badge');
    badge.appendChild(icon('crown'));
    badge.append(document.createTextNode('Quản trị viên'));
    copy.appendChild(badge);
  } else {
    copy.appendChild(textElement('span', '', isOnline ? 'Đang hoạt động' : 'Đã tham gia'));
  }
  row.append(avatarWrap, copy);
  return row;
}

function memberEntries() {
  return Object.entries(members).map(([uid, member]) => [uid, member || {}]).sort((a, b) => {
    const onlineDiff = Number(Boolean(presence[b[0]])) - Number(Boolean(presence[a[0]]));
    if (onlineDiff) return onlineDiff;
    return String(a[1].name || a[1].email || '').localeCompare(String(b[1].name || b[1].email || ''), 'vi');
  });
}

function renderMembers() {
  const entries = memberEntries();
  const onlineCount = Object.keys(presence).length;
  $('#totalMemberCount').textContent = String(entries.length);
  $('#onlineMemberCount').textContent = String(onlineCount);
  $('#memberPanelCount').textContent = `${entries.length} người`;
  $('#navMemberCount').textContent = String(entries.length);
  $('#headerMemberCount').textContent = `${entries.length} thành viên`;
  $('#channelMemberSummary').textContent = `${onlineCount} người đang trò chuyện`;
  $('#adminTabMemberCount').textContent = String(entries.length);
  const memberFragment = document.createDocumentFragment();
  if (!entries.length) {
    memberFragment.appendChild(textElement('div', 'member-empty', 'Chưa có thành viên nào. Hãy là người đầu tiên bắt đầu trò chuyện!'));
  } else {
    entries.slice(0, 100).forEach(([uid, member]) => memberFragment.appendChild(makeMemberRow(uid, member)));
  }
  els.memberList.replaceChildren(memberFragment);
  els.memberList.setAttribute('aria-busy', 'false');
  const avatarFragment = document.createDocumentFragment();
  entries.filter(([uid]) => presence[uid]).slice(0, 3).forEach(([uid, member]) => {
    const name = member.name || member.email?.split('@')[0] || 'Thành viên';
    avatarFragment.appendChild(makeAvatar(name, uid, 'avatar', member.photoURL || ''));
  });
  if (onlineCount > 3) avatarFragment.appendChild(textElement('div', 'avatar more', `+${onlineCount - 3}`));
  $('#headerAvatars').replaceChildren(avatarFragment);
  if (workspaceView === 'members') renderDirectory();
  renderAdminPanel();
}

function renderAdminPanel() {
  if (!isAdmin) return;
  const entries = memberEntries();
  const onlineCount = Object.keys(presence).length;
  const bannedCount = Object.keys(bans).length;
  $('#adminTotalCount').textContent = String(entries.length);
  $('#adminOnlineCount').textContent = String(onlineCount);
  $('#adminBannedCount').textContent = String(bannedCount);
  $('#adminTabMemberCount').textContent = String(entries.length);
  const query = (els.adminMemberSearch.value || '').trim().toLocaleLowerCase('vi');
  const filtered = entries.filter(([uid, member]) => {
    const text = `${member.name || ''} ${memberEmails[uid]?.email || member.email || ''} ${uid}`.toLocaleLowerCase('vi');
    return !query || text.includes(query);
  });
  const list = document.createDocumentFragment();
  if (!filtered.length) list.appendChild(textElement('div', 'admin-empty', query ? 'Không tìm thấy thành viên phù hợp.' : 'Chưa có thành viên nào.'));
  else filtered.forEach(([uid, member]) => list.appendChild(makeMemberRow(uid, member, true)));
  els.adminMemberList.replaceChildren(list);

  const announcementEntries = Array.from(announcementMessages.entries())
    .sort((a, b) => timestampOf(b[1]) - timestampOf(a[1]));
  const announcementList = document.createDocumentFragment();
  if (!announcementEntries.length) {
    announcementList.appendChild(textElement('div', 'admin-empty', 'Chưa có thông báo nào trong 100 tin nhắn gần nhất.'));
  } else {
    announcementEntries.slice(0, 30).forEach(([id, message]) => {
      const item = textElement('div', 'admin-announcement-item');
      item.appendChild(icon('megaphone'));
      const copy = textElement('div', 'admin-announcement-copy');
      copy.appendChild(textElement('p', '', message.text || ''));
      copy.appendChild(textElement('span', '', `${message.name || 'Quản trị viên'} · ${formatDateTime(timestampOf(message))}`));
      item.appendChild(copy);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.deleteMessage = id;
      remove.setAttribute('aria-label', 'Xóa thông báo');
      remove.title = 'Xóa thông báo';
      remove.appendChild(icon('trash'));
      item.appendChild(remove);
      announcementList.appendChild(item);
    });
  }
  els.adminAnnouncementList.replaceChildren(announcementList);
  renderAdminMessages();
  renderAdminOverview();
}

let workspaceView = 'chat';
let directoryFilter = 'all';
let directoryQuery = '';

function setWorkspaceView(view) {
  workspaceView = view === 'members' ? 'members' : 'chat';
  els.appView.dataset.view = workspaceView;
  $('#navChat').classList.toggle('active', workspaceView === 'chat');
  $('#navMembers').classList.toggle('active', workspaceView === 'members');
  $('#chatPanel').hidden = workspaceView === 'members';
  $('#directoryPanel').hidden = workspaceView !== 'members';
  els.membersPanel.classList.remove('open');
  $('#mobileMembersButton').setAttribute('aria-expanded', String(workspaceView === 'members'));
  if (workspaceView === 'members') {
    renderDirectory();
    window.setTimeout(() => $('#directorySearchInput')?.focus({ preventScroll: true }), 60);
  } else {
    if (window.matchMedia('(max-width: 760px)').matches) els.messageInput.focus({ preventScroll: true });
  }
}

function memberDisplayName(uid, member = members[uid] || {}) {
  return member.name || member.displayName || memberEmails[uid]?.email?.split('@')[0] || member.email?.split('@')[0] || 'Thành viên';
}

function renderDirectory() {
  const grid = $('#directoryGrid');
  if (!grid) return;
  const entries = memberEntries();
  const onlineCount = entries.filter(([uid]) => presence[uid]).length;
  const bannedCount = entries.filter(([uid]) => bans[uid]).length;
  $('#directorySummary').textContent = `${entries.length} thành viên · ${onlineCount} đang trực tuyến`;
  $('#directoryAllCount').textContent = String(entries.length);
  $('#directoryOnlineCount').textContent = String(onlineCount);
  $('#directoryBannedCount').textContent = String(bannedCount);
  $$('[data-directory-filter]').forEach((button) => {
    const active = button.dataset.directoryFilter === directoryFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const query = directoryQuery.trim().toLocaleLowerCase('vi');
  const filtered = entries.filter(([uid, member]) => {
    if (directoryFilter === 'online' && !presence[uid]) return false;
    if (directoryFilter === 'banned' && !bans[uid]) return false;
    if (!query) return true;
    const haystack = `${memberDisplayName(uid, member)} ${memberEmails[uid]?.email || member.email || ''} ${uid}`.toLocaleLowerCase('vi');
    return haystack.includes(query);
  });
  if (!filtered.length) {
    const empty = textElement('div', 'directory-empty');
    if (directoryFilter === 'banned') empty.textContent = 'Chưa có thành viên nào bị cấm.';
    else if (query) empty.textContent = 'Không tìm thấy thành viên phù hợp với từ khoá này.';
    else empty.textContent = entries.length ? 'Không có ai trong nhóm này.' : 'Chưa có thành viên nào. Hãy là người đầu tiên gửi lời chào!';
    grid.replaceChildren(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered.forEach(([uid, member], index) => {
    const name = memberDisplayName(uid, member);
    const online = Boolean(presence[uid]);
    const banned = Boolean(bans[uid]);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'directory-card';
    card.dataset.memberUid = uid;
    card.style.animationDelay = `${Math.min(index * 18, 220)}ms`;
    card.setAttribute('aria-label', `Xem hồ sơ của ${name}`);
    const avatarWrap = textElement('span', 'directory-avatar');
    avatarWrap.appendChild(makeAvatar(name, uid, 'avatar', member.photoURL || ''));
    const dot = textElement('span', `presence-indicator${online ? ' is-online' : ''}`);
    avatarWrap.appendChild(dot);
    const copy = textElement('span', 'directory-copy');
    copy.appendChild(textElement('strong', '', name));
    copy.appendChild(textElement('small', '', online ? 'Đang hoạt động' : banned ? 'Bị cấm bởi quản trị viên' : 'Thành viên tổ mèo'));
    if (isMuted(uid)) {
      const mutedBadge = textElement('span', 'directory-badge muted');
      mutedBadge.appendChild(icon('mute'));
      mutedBadge.append(document.createTextNode(`Cấm chat · ${muteRemainingLabel(mutes[uid])}`));
      copy.appendChild(mutedBadge);
    }
    if (uid === currentUser?.uid && isAdmin) {
      const badge = textElement('span', 'directory-badge');
      badge.appendChild(icon('crown'));
      badge.append(document.createTextNode('Quản trị viên'));
      copy.appendChild(badge);
    } else if (banned) {
      const badge = textElement('span', 'directory-badge banned');
      badge.appendChild(icon('ban'));
      badge.append(document.createTextNode('Bị cấm'));
      copy.appendChild(badge);
    }
    card.append(avatarWrap, copy);
    fragment.appendChild(card);
  });
  grid.replaceChildren(fragment);
}

function openMemberProfile(uid) {
  const member = members[uid] || {};
  const name = memberDisplayName(uid, member);
  const online = Boolean(presence[uid]);
  const banned = Boolean(bans[uid]);
  const isSelf = uid === currentUser?.uid;
  const layer = $('#memberProfileLayer');
  if (!layer) return;
  const slot = $('#profileAvatarSlot');
  slot.replaceChildren(makeAvatar(name, uid, 'avatar', member.photoURL || ''));
  $('#profileName').textContent = name;
  $('#profileStatus').textContent = isSelf ? 'Đây là hồ sơ của bạn' : online ? 'Đang hoạt động trong tổ mèo' : 'Thành viên của tổ mèo';
  const tags = $('#profileTags');
  tags.replaceChildren();
  const addTag = (label, className, iconName) => {
    const tag = textElement('span', `profile-tag${className ? ` ${className}` : ''}`);
    if (iconName) tag.appendChild(icon(iconName));
    tag.append(document.createTextNode(label));
    tags.appendChild(tag);
  };
  addTag(online ? 'Trực tuyến' : 'Ngoại tuyến', online ? 'online' : '', 'wifi');
  if (isSelf && isAdmin) addTag('Quản trị viên', 'admin', 'crown');
  if (banned) addTag('Đang bị cấm', 'banned', 'ban');
  if (isMuted(uid)) addTag(`Cấm chat · ${muteRemainingLabel(mutes[uid])}`, 'banned', 'mute');
  if (isSelf) addTag('Bạn', '', 'user');

  const facts = $('#profileFacts');
  facts.replaceChildren();
  const addFact = (label, value, iconName) => {
    const row = document.createElement('div');
    row.className = 'profile-fact';
    const dt = document.createElement('dt');
    if (iconName) dt.appendChild(icon(iconName));
    dt.append(document.createTextNode(label));
    const dd = document.createElement('dd');
    dd.textContent = value;
    dd.title = value;
    row.append(dt, dd);
    facts.appendChild(row);
  };
  const email = memberEmails[uid]?.email || (isSelf ? currentUser?.email : '') || member.email || '';
  addFact('Tên hiển thị', name, 'user');
  if (email) addFact('Email', email, 'mail');
  addFact('UID', uid, 'hash');
  if (member.createdAt) addFact('Tham gia', formatDateTime(timestampOf(member.createdAt)), 'clock');
  if (member.lastSeen) addFact('Hoạt động gần nhất', formatDateTime(timestampOf(member.lastSeen)), 'clock');
  if (banned && bans[uid]?.reason) addFact('Lý do cấm', bans[uid].reason, 'info');
  if (isMuted(uid)) {
    addFact('Cấm chat', muteRemainingLabel(mutes[uid]), 'mute');
    if (mutes[uid]?.reason) addFact('Lý do cấm chat', mutes[uid].reason, 'info');
  }

  const actions = $('#profileActions');
  actions.replaceChildren();
  const addAction = (label, className, iconName, onClick) => {
    const button = document.createElement('button');
    button.type = 'button';
    if (className) button.className = className;
    if (iconName) button.appendChild(icon(iconName));
    button.append(document.createTextNode(label));
    button.addEventListener('click', onClick);
    actions.appendChild(button);
  };
  addAction('Sao chép UID', '', 'hash', async () => {
    try {
      await navigator.clipboard.writeText(uid);
      toast('Đã sao chép UID thành viên.', 'success');
    } catch (_) {
      toast('Trình duyệt không cho phép sao chép tự động.', 'error');
    }
  });
  if (safeImageUrl(member.photoURL || '')) {
    addAction('Mở ảnh đại diện', '', 'eye', () => window.open(safeImageUrl(member.photoURL), '_blank', 'noopener,noreferrer'));
  }
  if (isAdmin && !isSelf) {
    const mutedNow = isMuted(uid);
    addAction(mutedNow ? 'Bỏ cấm chat' : 'Cấm chat', '', mutedNow ? 'smile' : 'mute', () => {
      closeMemberProfile();
      void manageMute(uid, !mutedNow);
    });
    addAction(banned ? 'Bỏ cấm' : 'Cấm thành viên', banned ? '' : 'danger', banned ? 'unban' : 'ban', () => {
      closeMemberProfile();
      void manageBan(uid, !banned);
    });
    addAction(`Xoá tin nhắn trong #${channelNameFor(activeChannelId)}`, 'danger', 'trash', () => {
      closeMemberProfile();
      void purgeUserMessages(uid);
    });
  }
  if (!isSelf) {
    addAction('Nhắn trong phòng chung', 'primary', 'chat', () => {
      closeMemberProfile();
      setWorkspaceView('chat');
      window.setTimeout(() => els.messageInput.focus({ preventScroll: true }), 80);
    });
  }
  CatChat.features.run('memberActions', { uid, name, isSelf, actions, addAction });
  layer.hidden = false;
  document.body.classList.add('body-locked');
  window.setTimeout(() => $('#closeMemberProfile')?.focus(), 40);
}

function closeMemberProfile() {
  const layer = $('#memberProfileLayer');
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  if (!els.confirmLayer.classList.contains('open') && !els.adminOverlay.classList.contains('open') && els.channelDialog.hidden && els.themeDialog.hidden && $('#savedLayer').hidden) {
    document.body.classList.remove('body-locked');
  }
}

/* ── Emote picker ── */
function renderEmojiPicker() {
  const wrap = $('#emojiGroups');
  if (!wrap) return;
  const fragment = document.createDocumentFragment();
  EMOJI_GROUPS.forEach((group) => {
    const section = textElement('div', 'emoji-group');
    section.appendChild(textElement('span', 'emoji-group-label', group.label));
    const grid = textElement('div', 'emoji-grid');
    group.list.forEach((glyph) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'emoji-cell';
      cell.dataset.emoji = glyph;
      cell.setAttribute('aria-label', `Chèn ${glyph}`);
      cell.textContent = glyph;
      grid.appendChild(cell);
    });
    section.appendChild(grid);
    fragment.appendChild(section);
  });
  wrap.replaceChildren(fragment);
}

function setEmojiPickerOpen(open) {
  const popover = $('#emojiPopover');
  if (!popover) return;
  popover.hidden = !open;
  $('#emojiPickerButton').setAttribute('aria-expanded', String(open));
  if (open) window.setTimeout(() => popover.querySelector('.emoji-cell')?.focus({ preventScroll: true }), 30);
}

function insertEmoji(glyph) {
  const input = els.messageInput;
  if (!input) return;
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
  input.value = `${input.value.slice(0, start)}${glyph}${input.value.slice(end)}`;
  const caret = start + glyph.length;
  input.focus({ preventScroll: true });
  input.setSelectionRange(caret, caret);
  updateMessageComposer();
}
