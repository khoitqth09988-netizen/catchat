/* CatChat · Kiểm duyệt tin nhắn trong admin và hiệu ứng chào admin.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function renderAdminMessages() {
  const list = $('#adminMessageList');
  if (!list) return;
  const entries = Array.from(messages.entries()).sort((a, b) => timestampOf(b[1]) - timestampOf(a[1]));
  $('#adminTabMessageCount').textContent = String(entries.length);
  $('#adminMessageChannel').textContent = `Kênh hiện tại: #${channelLabelFor(activeChannelId)}`;
  const query = ($('#adminMessageSearch')?.value || '').trim().toLocaleLowerCase('vi');
  const filtered = entries.filter(([, message]) => {
    if (!query) return true;
    return `${message.name || ''} ${message.text || ''} ${message.uid || ''}`.toLocaleLowerCase('vi').includes(query);
  });
  if (!filtered.length) {
    list.replaceChildren(textElement('div', 'admin-empty', query ? 'Không tìm thấy tin nhắn phù hợp.' : 'Kênh này chưa có tin nhắn nào.'));
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered.slice(0, 60).forEach(([id, message]) => {
    const row = textElement('div', 'admin-message-row');
    row.appendChild(makeAvatar(message.name || 'Thành viên', message.uid || '', 'avatar', members[message.uid]?.photoURL || ''));
    const copy = textElement('div', 'admin-message-copy');
    const head = textElement('strong');
    head.append(document.createTextNode(message.name || 'Thành viên'));
    head.appendChild(textElement('time', '', formatDateTime(timestampOf(message))));
    copy.appendChild(head);
    if (message.kind === 'announcement') {
      const flag = textElement('span', 'admin-message-media');
      flag.appendChild(icon('megaphone'));
      flag.append(document.createTextNode('Thông báo'));
      copy.appendChild(flag);
    }
    copy.appendChild(textElement('p', '', message.text || (message.imageURL ? '[Ảnh đính kèm]' : 'Tin nhắn trống')));
    if (message.imageURL) {
      const media = textElement('span', 'admin-message-media');
      media.appendChild(icon('eye'));
      media.append(document.createTextNode(message.imageName || 'Có ảnh đính kèm'));
      copy.appendChild(media);
    }
    row.appendChild(copy);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-action';
    remove.dataset.deleteMessage = id;
    remove.title = 'Xoá tin nhắn này';
    remove.setAttribute('aria-label', 'Xoá tin nhắn này');
    remove.appendChild(icon('trash'));
    row.appendChild(remove);
    fragment.appendChild(row);
  });
  list.replaceChildren(fragment);
}

/* ── Hiệu ứng khi tài khoản được cấp quyền admin ── */
function playAdminWelcome() {
  if (document.querySelector('.admin-welcome')) return;
  const preference = window.CatChat?.motion;
  const reduceMotion = preference && typeof preference.isReduced === 'function'
    ? preference.isReduced()
    : Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduceMotion) return;
  const layer = textElement('div', 'admin-welcome');
  const card = textElement('div', 'admin-welcome-card');
  const crown = textElement('div', 'admin-welcome-crown');
  crown.appendChild(icon('crown'));
  card.append(crown, textElement('strong', '', 'Chào quản trị viên!'), textElement('span', '', 'Toàn bộ quyền kiểm duyệt đã được bật'));
  layer.appendChild(card);
  const glyphs = ['🐾', '✨', '👑', '🎃', '🐱', '💛'];
  for (let index = 0; index < 18; index += 1) {
    const piece = textElement('span', 'admin-confetti', glyphs[index % glyphs.length]);
    piece.style.setProperty('--drift', `${Math.round(Math.random() * 320 - 160)}px`);
    piece.style.setProperty('--rise', `${Math.round(-150 - Math.random() * 170)}px`);
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 320 - 160)}deg`);
    piece.style.animationDelay = `${Math.random() * 0.22}s`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  const rect = crown.getBoundingClientRect();
  for (let index = 0; index < 10; index += 1) {
    const paw = textElement('span', 'admin-paw-burst', '🐾');
    paw.style.left = `${rect.left + rect.width / 2}px`;
    paw.style.top = `${rect.top + rect.height / 2}px`;
    paw.style.setProperty('--dx', `${Math.round(Math.random() * 240 - 120)}px`);
    paw.style.setProperty('--dy', `${Math.round(-60 - Math.random() * 120)}px`);
    paw.style.setProperty('--rot', `${Math.round(Math.random() * 140 - 70)}deg`);
    paw.style.animationDelay = `${Math.random() * 0.18}s`;
    document.body.appendChild(paw);
    window.setTimeout(() => paw.remove(), 1500);
  }
  $('#rolePill')?.classList.add('is-admin');
  $('#navMembers')?.classList.add('admin-hint');
  window.setTimeout(() => $('#navMembers')?.classList.remove('admin-hint'), 3400);
  window.setTimeout(() => layer.remove(), 1700);
}
