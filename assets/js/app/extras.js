/* CatChat · Tin nhắn đã lưu, sticker, Miu, vết chân mèo và con trỏ mèo.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

const SAVED_MESSAGES_KEY = 'catchat-saved-messages-v1';
const SAVED_LIMIT = 80;
const MIU_TIPS = [
  'Một câu hỏi thăm nhỏ có thể làm ai đó vui cả ngày đó nha.',
  'Bạn đã uống nước chưa? Mèo nào cũng nhắc chuyện này.',
  'Tin nhắn dài quá thì chia nhỏ ra, dễ đọc hơn nhiều.',
  'Bấm vào biểu tượng con trỏ để lưu lại khoảnh khắc bạn thích.',
  'Hôm nay có gì vui, kể cho tổ mèo nghe với!',
  'Gửi một sticker 🐾 thay cho lời chào cũng rất dễ thương.',
  'Đừng quên đổi bộ lông cho CatChat trong mục Giao diện nhé.',
  'Mèo ngoan là mèo biết nhường lời khi người khác đang nói.',
  'Một chiếc ảnh đẹp đôi khi nói nhiều hơn cả một đoạn văn.',
  'Nếu thấy mất kết nối, chỉ cần đợi vài giây, tổ mèo sẽ tự nối lại.'
];
let savedMessages = [];

function loadSavedMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MESSAGES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.text === 'string').slice(0, SAVED_LIMIT);
  } catch (error) {
    console.warn('Không đọc được tin nhắn đã lưu:', error);
    return [];
  }
}

function persistSavedMessages() {
  try {
    localStorage.setItem(SAVED_MESSAGES_KEY, JSON.stringify(savedMessages));
  } catch (error) {
    console.warn('Không lưu được danh sách tin nhắn đã lưu:', error);
  }
  updateSavedBadge();
}

function updateSavedBadge() {
  const badge = $('#savedMessagesCount');
  if (!badge) return;
  badge.textContent = String(savedMessages.length);
  badge.hidden = savedMessages.length === 0;
}

function isMessageSaved(messageId) {
  return savedMessages.some((entry) => entry.id === messageId);
}

function channelLabelFor(channelId) {
  if (!channelId) return 'phòng-chung';
  if (channelId === 'general') return 'phòng-chung';
  return channels[channelId]?.name || channelId;
}

function snapshotForMessage(messageId) {
  const data = messages.get(messageId);
  if (!data) return null;
  const text = String(data.text || (data.imageURL ? '[Ảnh đính kèm]' : ''));
  return {
    id: messageId,
    name: data.name || 'Thành viên',
    uid: data.uid || '',
    text: text.slice(0, 400),
    photoURL: members[data.uid]?.photoURL || '',
    timestamp: timestampOf(data) || Date.now(),
    channelId: activeChannelId,
    kind: data.kind || 'message'
  };
}

function makeSaveButton(messageId) {
  const saved = isMessageSaved(messageId);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `message-save${saved ? ' is-saved' : ''}`;
  button.dataset.saveMessage = messageId;
  button.title = saved ? 'Bỏ lưu tin nhắn' : 'Lưu tin nhắn vào bộ sưu tập';
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-pressed', String(saved));
  button.appendChild(icon('bookmark'));
  return button;
}

function toggleSaveMessage(messageId) {
  if (!currentUser) return;
  const index = savedMessages.findIndex((entry) => entry.id === messageId);
  if (index >= 0) {
    savedMessages.splice(index, 1);
    toast('Đã bỏ khỏi bộ sưu tập của bạn.', 'info');
  } else {
    const snapshot = snapshotForMessage(messageId);
    if (!snapshot) {
      toast('Tin nhắn này không còn trong 100 tin gần nhất.', 'info');
      return;
    }
    savedMessages.unshift(snapshot);
    if (savedMessages.length > SAVED_LIMIT) savedMessages.length = SAVED_LIMIT;
    toast('Đã lưu khoảnh khắc này 🐾', 'success');
  }
  persistSavedMessages();
  renderSavedPanel();
  renderAllMessages(false);
}

function renderSavedPanel() {
  const body = $('#savedBody');
  if (!body) return;
  updateSavedBadge();
  const subtitle = $('#savedSubtitle');
  if (subtitle) subtitle.textContent = savedMessages.length
    ? `${savedMessages.length} khoảnh khắc được giữ lại trên thiết bị này`
    : 'Những khoảnh khắc bạn muốn giữ lại';
  if (!savedMessages.length) {
    const empty = textElement('div', 'saved-empty');
    empty.appendChild(icon('bookmark'));
    empty.appendChild(textElement('strong', '', 'Bộ sưu tập đang trống'));
    empty.appendChild(textElement('p', '', 'Rê chuột lên một tin nhắn và bấm biểu tượng dấu trang để cất nó vào tổ của bạn.'));
    body.replaceChildren(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  savedMessages.forEach((entry) => {
    const card = textElement('article', 'saved-card');
    const top = textElement('div', 'saved-card-top');
    top.appendChild(makeAvatar(entry.name, entry.uid, 'avatar', entry.photoURL || ''));
    top.appendChild(textElement('strong', '', entry.name));
    top.appendChild(textElement('time', '', formatDateTime(entry.timestamp)));
    card.appendChild(top);
    card.appendChild(textElement('p', '', entry.text || 'Khoảnh khắc không có nội dung chữ.'));
    card.appendChild(textElement('small', '', `#${channelLabelFor(entry.channelId)}`));
    const actions = textElement('div', 'saved-card-actions');
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.dataset.savedJump = entry.id;
    jump.textContent = 'Mở trong kênh';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.dataset.savedRemove = entry.id;
    remove.textContent = 'Bỏ lưu';
    actions.append(jump, remove);
    card.appendChild(actions);
    fragment.appendChild(card);
  });
  body.replaceChildren(fragment);
}

function openSavedPanel() {
  if (!currentUser) return;
  renderSavedPanel();
  const layer = $('#savedLayer');
  layer.hidden = false;
  document.body.classList.add('body-locked');
  window.setTimeout(() => $('#closeSavedButton')?.focus(), 40);
}

function closeSavedPanel() {
  const layer = $('#savedLayer');
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  if (!els.confirmLayer.classList.contains('open') && !els.adminOverlay.classList.contains('open') && els.themeDialog.hidden && els.channelDialog.hidden) {
    document.body.classList.remove('body-locked');
  }
}

async function jumpToSavedMessage(messageId) {
  const entry = savedMessages.find((item) => item.id === messageId);
  if (!entry) return;
  closeSavedPanel();
  if (entry.channelId && entry.channelId !== activeChannelId) {
    await switchChannel(entry.channelId, { skipConfirm: true, force: true });
    await new Promise((resolve) => window.setTimeout(resolve, 650));
  }
  const row = Array.from(document.querySelectorAll('.message-row')).find((item) => item.dataset.messageId === messageId);
  if (!row) {
    toast('Khoảnh khắc này đã trôi khỏi 100 tin gần nhất của kênh.', 'info');
    return;
  }
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.add('message-flash');
  window.setTimeout(() => row.classList.remove('message-flash'), 1400);
}

function showMiuBubble(message) {
  const bubble = $('#miuBubble');
  const text = $('#miuText');
  if (!bubble || !text) return;
  text.textContent = message;
  bubble.hidden = false;
  bubble.style.animation = 'none';
  void bubble.offsetWidth;
  bubble.style.animation = '';
  window.clearTimeout(showMiuBubble.timer);
  showMiuBubble.timer = window.setTimeout(() => { bubble.hidden = true; }, 11000);
}

function miuSayHello() {
  const hour = new Date().getHours();
  const moment = hour < 5 ? 'Trời còn tối'
    : hour < 11 ? 'Chào buổi sáng'
    : hour < 14 ? 'Đúng giờ ăn trưa rồi'
    : hour < 18 ? 'Buổi chiều thật dễ chịu'
    : hour < 22 ? 'Buổi tối ấm áp'
    : 'Đêm đã khuya';
  const firstName = String(displayNameFor(currentUser) || 'bạn').split(/\s+/)[0];
  const tip = MIU_TIPS[Math.floor(Math.random() * MIU_TIPS.length)];
  showMiuBubble(`${moment}, ${firstName}! ${tip}`);
}

function updateWorkspaceGreeting() {
  const heading = $('#workspaceGreeting');
  if (!heading) return;
  const hour = new Date().getHours();
  const name = currentUser ? String(displayNameFor(currentUser) || '').split(/\s+/)[0] : '';
  const base = hour < 5 ? 'Tổ mèo vẫn sáng đèn'
    : hour < 11 ? 'Chào buổi sáng, tổ mèo'
    : hour < 14 ? 'Giờ nghỉ trưa của tổ mèo'
    : hour < 18 ? 'Một buổi chiều thật êm'
    : hour < 22 ? 'Tối nay tổ mèo có gì vui?'
    : 'Khuya rồi, nhớ nghỉ sớm nhé';
  heading.textContent = name ? `${base} · ${name}` : base;
}

function insertSticker(glyph) {
  const input = els.messageInput;
  if (!input) return;
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
  input.value = `${input.value.slice(0, start)}${glyph}${input.value.slice(end)}`;
  const caret = start + glyph.length;
  input.focus();
  input.setSelectionRange(caret, caret);
  updateMessageComposer();
}

/* ───────────────────────────────────────────────────────────────
   CatChat UI: chuyển tab Trò chuyện / Thành viên, hồ sơ thành viên,
   bộ con trỏ mèo, emote picker, kiểm duyệt tin nhắn và hiệu ứng admin.
   ─────────────────────────────────────────────────────────────── */
const CURSOR_STORAGE_KEY = 'catchat-cursor';
const DIRECTORY_FILTERS = ['all', 'online', 'banned'];
const EMOJI_GROUPS = [
  { label: 'Mèo', list: ['🐱','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🐈','🐈‍⬛','🐾','🐟','🧶','🐭'] },
  { label: 'Cảm xúc', list: ['😀','😄','😁','😆','🥰','😍','🤩','😘','😊','😌','😉','😂','🤣','🥹','😢','😭','😮','😱','🤔','😴'] },
  { label: 'Cử chỉ', list: ['👍','👏','🙌','🤝','✌️','🤗','💪','👀','🫶','🙏','💅','🤙','👉','🫡','🎉','🎊'] },
  { label: 'Yêu thương', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💕','💖','💘','💝','✨','⭐','🌙','🔥'] },
  { label: 'Halloween', list: ['🎃','👻','🕷️','🕸️','🦇','💀','🧙','🍬','🍭','🕯️','🌕','⚰️','🧟','🪄','🌚','🦴'] }
];

const CURSOR_OPTIONS = (() => {
  const build = ({ fur, stroke, eye, blush, extra = '' }) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'>
<path d='M7 12 8 4.5 14.6 8a13 13 0 0 1 4.8 0L26 4.5 27 12a12 12 0 0 1 3 7c0 6.6-5.5 10.5-12.5 10.5S4 25.6 4 19a12 12 0 0 1 3-7Z' fill='${fur}' stroke='${stroke}' stroke-width='1.8' stroke-linejoin='round'/>
${extra}
<circle cx='12.4' cy='18.2' r='1.6' fill='${eye}'/><circle cx='21.6' cy='18.2' r='1.6' fill='${eye}'/>
<path d='M15 22.4q2 1.8 4 0' fill='none' stroke='${stroke}' stroke-width='1.5' stroke-linecap='round'/>
<circle cx='9' cy='21.4' r='1.5' fill='${blush}' opacity='.75'/><circle cx='25' cy='21.4' r='1.5' fill='${blush}' opacity='.75'/>
</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ''))}") 4 3, auto`;
  };
  return [
    { id: 'orange', name: 'Mèo cam', color: '#f8b072', cursor: build({ fur: '#f8b072', stroke: '#3d3128', eye: '#3d3128', blush: '#ef8e6b' }) },
    { id: 'black', name: 'Mèo đen', color: '#312b36', cursor: build({ fur: '#312b36', stroke: '#100d14', eye: '#ffd36e', blush: '#4a4052', extra: "<path d='M12 11.4h3M19 11.4h3' stroke='#100d14' stroke-width='1.4' stroke-linecap='round'/>" }) },
    { id: 'white', name: 'Mèo trắng', color: '#fdf3e7', cursor: build({ fur: '#fdf3e7', stroke: '#7a6353', eye: '#5d4b3d', blush: '#ffc9cf' }) },
    { id: 'pumpkin', name: 'Bí ngô', color: '#ff8a3d', cursor: build({ fur: '#ff8a3d', stroke: '#40210c', eye: '#a6ee4f', blush: '#d95f2a', extra: "<path d='M15.4 7.4c.6-1.6 2.2-2.2 3.6-1.4l-.9 1.9' fill='#4b8f2f' stroke='#2f5c1c' stroke-width='1.2' stroke-linejoin='round'/><path d='M10.5 15.2 13 17M23.5 15.2 21 17' stroke='#40210c' stroke-width='1.3' stroke-linecap='round'/>" }) },
    { id: 'ghost', name: 'Mèo ma', color: '#eae4f7', cursor: build({ fur: '#eae4f7', stroke: '#604a86', eye: '#8a5cd6', blush: '#c9b4f0', extra: "<path d='M6 27q3 2.6 6 0t6 0 6 0 4-1.4' fill='none' stroke='#b9a2e6' stroke-width='1.3' stroke-linecap='round'/>" }) }
  ];
})();

function applyCursor(cursorId, persist = true) {
  const option = CURSOR_OPTIONS.find((item) => item.id === cursorId) || CURSOR_OPTIONS[0];
  document.documentElement.style.setProperty('--cat-cursor', option.cursor);
  $$('[data-cursor-choice]').forEach((button) => {
    const active = button.dataset.cursorChoice === option.id;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (persist) {
    try { localStorage.setItem(CURSOR_STORAGE_KEY, option.id); }
    catch (error) { console.warn('Không lưu được lựa chọn con trỏ:', error); }
  }
}

function loadSavedCursor() {
  try {
    const saved = localStorage.getItem(CURSOR_STORAGE_KEY);
    return CURSOR_OPTIONS.some((item) => item.id === saved) ? saved : CURSOR_OPTIONS[0].id;
  } catch (_) { return CURSOR_OPTIONS[0].id; }
}

function renderCursorOptions() {
  const wrap = $('#cursorOptions');
  if (!wrap) return;
  const fragment = document.createDocumentFragment();
  CURSOR_OPTIONS.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cursor-option';
    button.dataset.cursorChoice = option.id;
    button.setAttribute('aria-pressed', 'false');
    button.title = `Dùng ${option.name} làm con trỏ`;
    const image = textElement('span', 'cursor-option-image');
    image.innerHTML = `<svg viewBox="0 0 34 34" aria-hidden="true"><path d="M7 12 8 4.5 14.6 8a13 13 0 0 1 4.8 0L26 4.5 27 12a12 12 0 0 1 3 7c0 6.6-5.5 10.5-12.5 10.5S4 25.6 4 19a12 12 0 0 1 3-7Z" fill="${option.color}" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12.4" cy="18.2" r="1.6" fill="rgba(0,0,0,.72)"/><circle cx="21.6" cy="18.2" r="1.6" fill="rgba(0,0,0,.72)"/><path d="M15 22.4q2 1.8 4 0" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    const check = textElement('span', 'cursor-check');
    check.appendChild(icon('check'));
    button.append(image, textElement('span', '', option.name), check);
    fragment.appendChild(button);
  });
  wrap.replaceChildren(fragment);
  applyCursor(loadSavedCursor(), false);
}
