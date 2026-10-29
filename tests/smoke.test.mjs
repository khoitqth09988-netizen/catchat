#!/usr/bin/env node
/* CatChat · smoke test giao diện bằng jsdom (không cần trình duyệt, không cần Firebase thật).
   Chạy: node tests/smoke.test.mjs

   Dựng lại index.html trong bộ nhớ: bỏ CSP/font Google, thay mọi <script src> và
   <link rel="stylesheet"> bằng nội dung thật, cắm một Firebase giả (không có Storage
   để kiểm luôn chế độ "gói miễn phí"). Sau đó kiểm:
   - menu ⋯: đúng thứ tự meta, đủ mục, mở/đóng, Esc, phân quyền admin/thường;
   - chế độ không Storage: nút đính kèm chuyển sang dán liên kết, gửi tin kèm imageURL;
   - không có lỗi runtime. */
import process from 'node:process';
import { createApp } from './harness.mjs';
const failures = [];
const check = (name, condition, extra = '') => {
  if (!condition) failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
};

const { dom, window, doc, errors } = createApp();
const doc_ = doc;
await new Promise((resolve) => setTimeout(resolve, 700));

window.eval(`
  currentUser = { uid: 'u1', displayName: 'admin', email: 'admin@com.vn' };
  members = { u1: { uid: 'u1', name: 'admin' }, u2: { uid: 'u2', name: 'Mèo' } };
  isAdmin = true; pins = {}; messageReactions = {};
  messages = new Map([
    ['m1', { uid: 'u1', name: 'admin', text: '?', kind: 'message', timestamp: Date.now() }],
    ['m2', { uid: 'u2', name: 'Mèo', text: 'chào', kind: 'message', timestamp: Date.now() + 1, replyTo: 'm1', replyName: 'admin', replyText: '?' }],
    ['a1', { uid: 'u1', name: 'admin', text: 'Thông báo', kind: 'announcement', timestamp: Date.now() + 2 }]
  ]);
  renderAllMessages(true);
`);

/* ── 1. Cấu trúc menu ⋯ ─────────────────────────────────────── */
const row = doc.querySelector('#chatMessages .message-row');
const meta = row.querySelector('.message-meta');
const metaKids = [...meta.children].map((el) => el.className);
// Nhãn quyền hạn (.name-tag) là tuỳ chọn và luôn đứng NGAY SAU tên (chỉ hiện với tên
// kiểu “admin”), nên thứ tự hợp lệ là: tên → [nhãn] → giờ → nút ⋯.
const metaOrder = metaKids.join(',').replace('message-name,name-tag is-admin,', 'message-name,name-tag,')
  .replace('message-name,name-tag is-member,', 'message-name,name-tag,');
check('hàng meta sai thứ tự',
  metaOrder === 'message-name,message-time,message-actions' || metaOrder === 'message-name,name-tag,message-time,message-actions',
  metaKids.join(','));
check('thiếu nút ⋯', Boolean(meta.querySelector('.message-more')));
check('còn nút rời trên hàng meta', meta.querySelectorAll(':scope > button').length === 0);
check('menu phải đóng lúc đầu', meta.querySelector('.message-menu').hidden === true);

const labels = [...meta.querySelectorAll('.message-menu-label')].map((el) => el.textContent.trim());
for (const expected of ['Trả lời', 'Lưu tin nhắn', 'Sao chép nội dung', 'Sửa tin nhắn', 'Ghim tin nhắn', 'Xoá tin nhắn']) {
  check(`thiếu mục “${expected}”`, labels.includes(expected), labels.join(' | '));
}

/* ── 2. Mở/đóng menu ────────────────────────────────────────── */
const toggle = meta.querySelector('.message-more');
const menu = meta.querySelector('.message-menu');
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('bấm ⋯ không mở menu', menu.hidden === false && toggle.getAttribute('aria-expanded') === 'true');
check('menu chưa được đặt toạ độ', /px$/.test(menu.style.top) && /px$/.test(menu.style.left), `${menu.style.top}/${menu.style.left}`);
check('menu không được portal ra body', menu.parentElement?.id === 'messageMenuLayer', menu.parentElement?.className);
check('lớp portal không nằm trong body', doc.getElementById('messageMenuLayer')?.parentElement?.tagName === 'BODY');
check('menu phải position: fixed', window.getComputedStyle(menu).position === 'fixed', window.getComputedStyle(menu).position);
check('lớp portal phải position: fixed', window.getComputedStyle(doc.getElementById('messageMenuLayer')).position === 'fixed');
menu.querySelector('[data-reply-message]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('chọn mục xong menu chưa đóng', menu.hidden === true);
check('đóng menu chưa trả về hàng tin nhắn', menu.parentElement?.classList.contains('message-actions'), menu.parentElement?.className);
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('Esc không đóng menu', menu.hidden === true);

/* ── 2a. Vị trí menu: ưu tiên cạnh tin nhắn, luôn nằm trong khung nhìn ── */
const pos = (anchorBox, box, rowBox, viewport) => window.eval(
  `messageMenuPosition(${JSON.stringify(anchorBox)}, ${JSON.stringify(box)}, ${JSON.stringify(rowBox)}, ${JSON.stringify(viewport)})`
);
const box = { width: 196, height: 180 };
const viewport = { width: 900, height: 700 };

const besideRight = pos({ left: 600, right: 624, top: 100, bottom: 118 }, box, { left: 300, right: 640, top: 96, bottom: 200 }, viewport);
check('không mở bên phải hàng tin', besideRight.side === 'right' && besideRight.left === 648, JSON.stringify(besideRight));
check('menu bên phải lệch dọc so với hàng tin', Math.abs(besideRight.top - 94) <= 2, String(besideRight.top));

const besideLeft = pos({ left: 700, right: 724, top: 100, bottom: 118 }, box, { left: 400, right: 760, top: 96, bottom: 200 }, { width: 800, height: 700 });
check('không lật sang trái khi hết chỗ bên phải', besideLeft.side === 'left' && besideLeft.left === 196, JSON.stringify(besideLeft));

const clipped = window.eval(`messageMenuPosition(
  ${JSON.stringify({ left: 860, right: 884, top: 100, bottom: 118 })},
  ${JSON.stringify(box)},
  ${JSON.stringify({ left: 300, right: 880, top: 96, bottom: 200 })},
  ${JSON.stringify({ width: 1200, height: 700 })},
  { bounds: { left: 0, top: 0, right: 900, bottom: 700 } }
)`);
check('menu tràn sang cột thành viên', clipped.side === 'left' && clipped.left === 96, JSON.stringify(clipped));

const narrow = pos({ left: 300, right: 324, top: 300, bottom: 318 }, box, { left: 12, right: 380, top: 296, bottom: 420 }, { width: 400, height: 700 });
check('màn hình hẹp không rơi xuống dưới nút', narrow.side === 'below' && narrow.top === 326, JSON.stringify(narrow));

const nearBottom = pos({ left: 300, right: 324, top: 640, bottom: 658 }, box, { left: 12, right: 380, top: 636, bottom: 680 }, { width: 400, height: 700 });
check('sát đáy không lật lên trên', nearBottom.side === 'above' && nearBottom.top + box.height <= 700, JSON.stringify(nearBottom));

for (const result of [besideRight, besideLeft, narrow, nearBottom]) {
  check('menu lọt ra ngoài khung nhìn', result.left >= 0 && result.top >= 0
    && result.left + box.width <= viewport.width + 100 && result.top + box.height <= 700, JSON.stringify(result));
}

/* ── 2b. Render lại khi menu đang mở: không để menu mồ côi ──── */
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('không mở lại được menu để test render', menu.hidden === false);
window.eval('renderAllMessages(false)');
check('menu cũ còn sót trong lớp portal', doc.querySelector('#messageMenuLayer .message-menu') === null);
check('menu sót lại vẫn đang mở', [...doc.querySelectorAll('.message-menu')].every((el) => el.hidden === true));

/* ── 3. Thông báo toàn máy chủ ──────────────────────────────── */
const announcementMeta = doc.querySelector('.announcement-row .server-announcement-meta');
check('thông báo thiếu nút ⋯', Boolean(announcementMeta?.querySelector('.message-more')));
check('menu thông báo không ở cuối hàng', announcementMeta?.lastElementChild?.classList.contains('message-actions'));
const annLabels = [...announcementMeta.querySelectorAll('.message-menu-label')].map((el) => el.textContent.trim());
check('thông báo thiếu mục Sửa', annLabels.includes('Sửa thông báo'), annLabels.join(' | '));

/* ── 4. Chế độ không có Storage ─────────────────────────────── */
check('storageReady() phải false khi không có Storage', window.eval('storageReady()') === false);
window.eval('refreshMediaUi()');
const attachTitle = doc.querySelector('#attachImageButton')?.title || '';
check('nút đính kèm chưa đổi nhãn', attachTitle.includes('liên kết'), attachTitle);
check('nút đính kèm chưa có lớp is-link-only', doc.querySelector('#attachImageButton')?.classList.contains('is-link-only'));

window.__promptAnswer = 'https://example.com/meo.png';
window.eval('chooseAttachment()');
check('dán liên kết ảnh không lưu pendingImageUrl', window.eval('pendingImageUrl') === 'https://example.com/meo.png', String(window.eval('pendingImageUrl')));
check('không hiện khung xem trước ảnh', doc.querySelector('#pendingImagePreview').hidden === false);
check('nút Gửi vẫn bị khoá khi chỉ có ảnh', doc.querySelector('#sendButton').disabled === false);

window.eval('clearPendingImage()');
window.__promptAnswer = 'javascript:alert(1)';
window.eval('chooseAttachment()');
check('nhận liên kết không phải https', window.eval('pendingImageUrl') === '', String(window.eval('pendingImageUrl')));

/* ── 5. Gửi tin kèm ảnh liên kết (không upload) ─────────────── */
window.eval(`
  window.__promptAnswer = 'https://example.com/meo.png';
  chooseAttachment();
  messagesRef = database.ref('messages');
  activeChannelId = 'general';
  announcementMode = false;
`);
await window.eval('sendMessage({ preventDefault() {} })');
await new Promise((resolve) => setTimeout(resolve, 200));
const sent = Object.values(window.__db.data.messages || {}).find((entry) => entry && entry.imageURL);
check('không gửi được tin kèm ảnh liên kết', Boolean(sent), JSON.stringify(window.__db.data.messages || {}));
check('tin gửi thiếu imageURL', sent?.imageURL === 'https://example.com/meo.png', sent?.imageURL);
check('tin gửi sai tên tác giả', sent?.name === 'admin', sent?.name);
check('pendImageUrl chưa được xoá sau khi gửi', window.eval('pendingImageUrl') === '');

/* ── 6. Phân quyền thành viên thường ────────────────────────── */
window.eval(`
  currentUser = { uid: 'u2', displayName: 'Mèo', email: 'meo@x.vn' };
  isAdmin = false;
  renderAllMessages(true);
`);
const rows = [...doc.querySelectorAll('#chatMessages .message-row')];
const ownRow = rows.find((r) => r.classList.contains('mine'));
const otherRow = rows.find((r) => !r.classList.contains('mine') && r.querySelector('.message-meta'));
const labelsOf = (el) => [...el.querySelectorAll('.message-menu-label')].map((node) => node.textContent.trim());
const ownLabels = labelsOf(ownRow);
const otherLabels = labelsOf(otherRow);
check('thành viên thường thấy mục Ghim', !ownLabels.some((label) => label.includes('Ghim')), ownLabels.join(' | '));
check('chủ tin không có mục Sửa', ownLabels.includes('Sửa tin nhắn'), ownLabels.join(' | '));
check('chủ tin không có mục Xoá', ownLabels.some((label) => label.startsWith('Xoá')), ownLabels.join(' | '));
check('người khác thấy mục Sửa', !otherLabels.includes('Sửa tin nhắn'), otherLabels.join(' | '));
check('người khác thấy mục Xoá', !otherLabels.some((label) => label.startsWith('Xoá')), otherLabels.join(' | '));

/* ── 6b. Thuộc tính bàn phím mobile ─────────────────────────── */
const composerInput = doc.querySelector('#messageInput');
check('ô soạn tin thiếu enterkeyhint="send"', composerInput.getAttribute('enterkeyhint') === 'send', String(composerInput.getAttribute('enterkeyhint')));
check('ô soạn tin thiếu autocapitalize', composerInput.getAttribute('autocapitalize') === 'sentences');
for (const id of ['messageSearchInput', 'directorySearchInput', 'adminMemberSearch', 'adminMessageSearch']) {
  check(`#${id} thiếu enterkeyhint="search"`, doc.getElementById(id)?.getAttribute('enterkeyhint') === 'search');
}

/* ── 6c. Chọn giao diện theo thiết bị ──────────────────────── */
check('ui-mode chưa gắn data-ui lên <html>', ['desktop', 'mobile'].includes(doc.documentElement.dataset.ui), String(doc.documentElement.dataset.ui));
check('trình duyệt 1024px không cảm ứng phải là desktop', doc.documentElement.dataset.ui, 'desktop');
check('máy tính không được hiện thanh tab mobile', doc.getElementById('mobileTabbar').hidden, true);
check('máy tính không được dựng lớp mờ mobile', doc.getElementById('mobileScrim').hidden, true);
check('thiếu nút tab mobile', doc.querySelectorAll('#mobileTabbar [data-mobile-tab]').length, 4);
check('bảng cài đặt mobile thiếu nút Giao diện', Boolean(doc.querySelector('[data-mobile-action="theme"]')));

/* ── 6d. Chuyển sang chế độ mobile ngay trong trang thật ───── */
const mobile = window.eval(`(() => {
  const root = document.documentElement;
  root.dataset.ui = 'mobile';
  document.getElementById('appView').hidden = false;
  CatChatMobileUI.refresh();
  const tabbar = document.getElementById('mobileTabbar');
  const scrim = document.getElementById('mobileScrim');
  const shown = !tabbar.hidden && getComputedStyle(tabbar).display === 'grid';
  tabbar.querySelector('[data-mobile-tab="channels"]').click();
  const opened = root.dataset.mobileSheet === 'channels' && !scrim.hidden;
  const computed = getComputedStyle(document.querySelector('.sidebar')).position;
  scrim.click();
  const closed = !root.dataset.mobileSheet && scrim.hidden;
  root.dataset.ui = 'desktop';
  CatChatMobileUI.refresh();
  return { shown, opened, closed, computed, hiddenOnDesktop: tabbar.hidden };
})()`);
check('chế độ mobile không hiện thanh tab', mobile.shown, true);
check('bấm tab Kênh không mở ngăn kéo', mobile.opened, true);
check('ngăn kéo kênh không phải position fixed', mobile.computed, 'fixed');
check('bấm lớp mờ không đóng ngăn kéo', mobile.closed, true);
check('quay lại desktop không ẩn thanh tab', mobile.hiddenOnDesktop, true);

/* ── 6e. Lỗi gốc: keydown không kèm event.key ───────────────── */
window.eval("document.dispatchEvent(new Event('keydown'))");
const featureFailures = window.eval('JSON.stringify(CatChat.features.failures())');
check('keydown thiếu event.key làm hỏng tính năng', !featureFailures.includes('keydown'), featureFailures.slice(0, 300));

/* ── 7. Không lỗi runtime ───────────────────────────────────── */
check('lỗi runtime trong app', (window.__errors || []).length === 0, JSON.stringify((window.__errors || []).slice(0, 2)));
check('lỗi jsdom', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`meta: ${metaKids.join(' → ')}`);
console.log(`mục menu (admin): ${labels.join(' | ')}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  dom.window.close();
  process.exit(1);
}
console.log(`\n✓ Smoke test đạt (${doc_ ? 'index.html' : 'index.html'}).`);
dom.window.close();
