#!/usr/bin/env node
/* CatChat · Kiểm thử luồng người dùng thật (jsdom, không cần Firebase).
   Chạy: node tests/flows.test.mjs

   Khác với smoke test (kiểm cấu trúc + phân quyền menu), tệp này bấm/gõ như người
   dùng: gửi tin, trả lời, sửa, xoá, reaction, tìm kiếm, đổi theme, danh bạ thành viên,
   tin đã lưu, bảng quản trị và giao diện mobile. Sau mỗi bước đều kiểm:
     · DOM phản ánh đúng thao tác,
     · dữ liệu ghi xuống RTDB đúng đường dẫn,
     · KHÔNG có lỗi runtime nào bị nuốt. */
import process from 'node:process';
import { createApp } from './harness.mjs';

const failures = [];
/* So sánh bằng: check('mô tả', giá trị thật, giá trị mong đợi) */
const check = (name, actual, expected) => {
  const same = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
  if (!same) failures.push(`${name}: nhận ${JSON.stringify(actual)}, mong đợi ${JSON.stringify(expected)}`);
};

const { dom, window, doc, errors } = createApp();
const $ = (selector) => doc.querySelector(selector);
const $$ = (selector) => [...doc.querySelectorAll(selector)];
const sleep = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (element) => {
  if (!element) throw new Error('Không tìm thấy phần tử để bấm');
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const writesTo = (path) => window.__writes.filter((entry) => entry.path.startsWith(path));

await sleep(700);

/* ── Đăng nhập qua đúng luồng của app ─────────────────────── */
// Dữ liệu có sẵn trước khi đăng nhập (giống dữ liệu đã có trên Firebase).
window.eval(`
  database.ref('admins/u1').set(true);
  database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
  database.ref('members/u2').set({ uid: 'u2', name: 'Mèo', email: 'meo@com.vn' });
  database.ref('presence/u2').set({ state: 'online', lastChanged: Date.now() });
`);
await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'matkhau');
await sleep(900);

check('đăng nhập xong phải thấy khung app', $('#appView').hidden, false);
check('đăng nhập xong phải ẩn màn hình đăng nhập', $('#authView').hidden, true);
check('sidebar hiện tên người dùng', $('#sidebarName').textContent.trim(), 'admin');
check('đăng nhập bằng email admin@com.vn phải có quyền quản trị', window.eval('isAdmin'), true);
check('danh sách kênh được dựng', $$('#channelList .channel-link').length >= 1, true);

/* ── 1. Gửi tin nhắn ──────────────────────────────────────── */
const input = $('#messageInput');
const form = $('#messageForm');
type(input, 'Xin chào cả nhà');
check('nút gửi bật khi có nội dung', $('#sendButton').disabled, false);
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(120);

const sent = writesTo('messages');
check('gửi tin phải ghi vào /messages', sent.length > 0, true);
check('tin gửi có nội dung đúng', sent.at(-1)?.value?.text, 'Xin chào cả nhà');
check('tin gửi gắn đúng uid', sent.at(-1)?.value?.uid, 'u1');
check('gửi xong phải xoá ô soạn tin', input.value, '');
check('gửi xong nút gửi tắt lại', $('#sendButton').disabled, true);

/* ── 2. Trả lời tin nhắn ──────────────────────────────────── */
window.eval(`
  messages.set('m1', { uid: 'u2', name: 'Mèo', text: 'ai đó ơi', kind: 'message', timestamp: Date.now() - 5000 });
  renderAllMessages(true);
`);
await sleep(20);
const replyButton = $('.message-row .message-menu-item[data-reply-message]');
check('có nút Trả lời trong menu ⋯', Boolean(replyButton), true);
if (replyButton) {
  click(replyButton);
  await sleep(20);
  check('bấm Trả lời thì hiện khung xem trước', $('#replyPreview').hidden, false);
  check('khung xem trước ghi tên người được trả lời', /Mèo/.test($('#replyPreviewName').textContent), true);
  click($('#cancelReplyButton'));
  check('bấm huỷ thì ẩn khung xem trước', $('#replyPreview').hidden, true);
}

/* ── 3. Menu ⋯ mở/đóng và Esc ─────────────────────────────── */
const moreButton = $('.message-row .message-more');
click(moreButton);
await sleep(20);
const menu = doc.querySelector('#messageMenuLayer .message-menu:not([hidden])');
check('bấm ⋯ phải mở menu', Boolean(menu), true);
if (menu) {
  check('menu nằm ngoài hàng tin nhắn (portal)', menu.closest('.message-row'), null);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(20);
  check('Esc đóng menu ⋯', Boolean(doc.querySelector('#messageMenuLayer .message-menu:not([hidden])')), false);
}

/* ── 4. Reaction ──────────────────────────────────────────── */
const reactionButton = $('.message-row .reaction-button');
check('tin nhắn có nút reaction', Boolean(reactionButton), true);
if (reactionButton) {
  reactionButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(60);
  const reactionWrite = window.__writes.filter((entry) => entry.path.includes('messageReactions') || entry.path.includes('reactions'));
  check('bấm reaction phải ghi dữ liệu', reactionWrite.length > 0, true);
}

/* ── 5. Tìm kiếm tin nhắn ─────────────────────────────────── */
window.eval('setMessageSearchOpen(true)');
check('mở tìm kiếm thì hiện thanh tìm', $('#messageSearchBar').hidden, false);
type($('#messageSearchInput'), 'ai đó');
await sleep(40);
check('tìm kiếm đếm đúng số kết quả', $('#messageSearchCount').textContent.trim(), '1 kết quả');
type($('#messageSearchInput'), 'không có gì khớp');
await sleep(40);
check('không khớp thì đếm về 0', $('#messageSearchCount').textContent.trim(), '0 kết quả');
window.eval('setMessageSearchOpen(false)');
check('đóng tìm kiếm thì ẩn thanh tìm', $('#messageSearchBar').hidden, true);

/* ── 6. Đổi giao diện (theme) ─────────────────────────────── */
window.eval('openThemeDialog()');
await sleep(20);
check('mở hộp thoại giao diện', $('#themeDialog').hidden, false);
const themeOption = $('[data-theme-choice]:not([data-theme-choice="light"])') || $('[data-theme-choice]');
check('có lựa chọn giao diện', Boolean(themeOption), true);
if (themeOption) {
  const themeId = themeOption.dataset.themeChoice;
  click(themeOption);
  await sleep(20);
  check(`chọn giao diện "${themeId}" phải áp lên body`, doc.body.dataset.theme, themeId);
  check('giao diện phải được lưu lại (khoá mới)', window.localStorage.getItem('catchat-theme-v1'), themeId);
  check('vẫn ghi khoá cũ để không mất lựa chọn', window.localStorage.getItem('cham-chat-theme'), themeId);
}
window.eval('closeThemeDialog()');
check('đóng hộp thoại giao diện', $('#themeDialog').hidden, true);

/* ── 7. Danh bạ thành viên ────────────────────────────────── */
window.eval('setWorkspaceView("members")');
await sleep(30);
check('mở danh bạ thì ẩn khung chat', $('#chatPanel').hidden, true);
check('mở danh bạ thì hiện danh sách', $('#directoryPanel').hidden, false);
check('danh bạ liệt kê thành viên', $$('#directoryGrid .directory-card').length >= 2, true);
type($('#directorySearchInput'), 'mèo');
await sleep(40);
check('tìm trong danh bạ lọc đúng', $$('#directoryGrid .directory-card').length, 1);
type($('#directorySearchInput'), '');
await sleep(40);
window.eval('setWorkspaceView("chat")');
check('quay lại trò chuyện', $('#chatPanel').hidden, false);

/* ── 8. Tin nhắn đã lưu ───────────────────────────────────── */
window.eval(`
  savedMessages = [{ id: 'm1', uid: 'u2', name: 'Mèo', text: 'ai đó ơi', kind: 'message', timestamp: Date.now() - 5000 }];
  openSavedPanel();
`);
await sleep(30);
check('mở ngăn kéo tin đã lưu', $('#savedLayer').hidden, false);
check('ngăn kéo đã lưu có nội dung', $$('#savedBody .saved-card').length >= 1, true);
window.eval('closeSavedPanel()');
check('đóng ngăn kéo đã lưu', $('#savedLayer').hidden, true);

/* ── 9. Bảng quản trị ─────────────────────────────────────── */
window.eval('openAdmin()');
await sleep(40);
check('mở bảng quản trị', $('#adminOverlay').classList.contains('open'), true);
window.eval('closeAdmin()');
await sleep(20);
check('đóng bảng quản trị', $('#adminOverlay').classList.contains('open'), false);

/* ── 10. Giao diện mobile: ngăn kéo + chọn kênh ───────────── */
window.eval(`
  document.documentElement.dataset.ui = 'mobile';
  CatChatMobileUI.refresh();
  CatChatMobileUI.openSheet('channels');
`);
await sleep(20);
check('mở ngăn kéo kênh trên mobile', doc.documentElement.dataset.mobileSheet, 'channels');
check('ngăn kéo kênh có ít nhất một kênh', $$('#channelList .channel-link').length > 0, true);
// index.html phải có đúng #sidebar: mobile-ui.js tìm ngăn kéo bằng id này. Thiếu id thì
// vuốt-để-đóng và "chọn kênh tự đóng" chết lặng mà test fixture vẫn xanh (đã từng như vậy).
const realDrawer = $('#sidebar');
check('ngăn kéo thật trong index.html có id="sidebar"', Boolean(realDrawer && realDrawer.classList.contains('sidebar')), true);
if (realDrawer) {
  const otherChannel = $('#channelList .channel-link:not(.active)') || $('#channelList .channel-link');
  click(otherChannel);
  await sleep(250);
  check('chọn kênh xong ngăn kéo tự đóng', doc.documentElement.dataset.mobileSheet, undefined);
  // Vuốt ngang để đóng (dùng đúng phần tử thật, không phải fixture tự dựng).
  window.eval("CatChatMobileUI.openSheet('channels')");
  await sleep(30);
  const pointer = (type, x, y = 300) => new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  realDrawer.dispatchEvent(pointer('pointerdown', 300, 300));
  realDrawer.dispatchEvent(pointer('pointermove', 220, 300));
  check('kéo ngang thì ngăn kéo bám theo tay', realDrawer.style.transform, 'translateX(-80px)');
  realDrawer.dispatchEvent(pointer('pointerup', 120, 300));
  check('vuốt trái để đóng ngăn kéo thật', doc.documentElement.dataset.mobileSheet, undefined);
  check('vuốt xong phải trả lại transform', realDrawer.style.transform, '');
} else {
  window.eval('CatChatMobileUI.closeSheet()');
}
window.eval("document.documentElement.dataset.ui = 'desktop'; CatChatMobileUI.refresh();");

/* ── 11. Lệnh gạch chéo (/shrug) ──────────────────────────── */
type(input, '/shrug chào cả nhà');
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(200);
check('lệnh /shrug đổi nội dung trước khi gửi', writesTo('messages').at(-1)?.value?.text, 'chào cả nhà ¯\\_(ツ)_/¯');
check('gửi lệnh xong phải xoá ô soạn tin', input.value, '');

/* ── 12. Sửa tin nhắn và ghim (qua menu ⋯) ────────────────── */
window.eval(`
  messages.set('m9', { uid: 'u1', name: 'admin', text: 'tin để sửa', kind: 'message', timestamp: Date.now() - 2000 });
  renderAllMessages(true);
`);
await sleep(40);
// Chọn đúng hàng của m9 (danh sách còn tin từ các mục trước).
const m9More = $('#chatMessages .message-row[data-message-id="m9"] .message-more') || $('.message-row .message-more');
click(m9More);
await sleep(40);
click($('#messageMenuLayer [data-edit-message]'));
await sleep(40);
const editBox = $('.message-edit textarea');
check('mở được ô sửa tin', Boolean(editBox), true);
if (editBox) {
  editBox.value = 'tin đã sửa';
  editBox.dispatchEvent(new window.Event('input', { bubbles: true }));
  click($('[data-edit-save]'));
  await sleep(200);
  check('lưu sửa tin ghi đúng nội dung mới', writesTo('messages/m9').at(-1)?.value?.text, 'tin đã sửa');
  check('tin đã sửa có mốc editedAt', typeof writesTo('messages/m9').at(-1)?.value?.editedAt, 'number');
}
click($('#chatMessages .message-row[data-message-id="m9"] .message-more') || $('.message-row .message-more'));
await sleep(40);
click($('#messageMenuLayer [data-pin-message]'));
await sleep(200);
check('admin ghim được tin nhắn', writesTo('pins/general').at(-1)?.value?.messageId, 'm9');

/* ── 13. Bật rồi thoát chế độ thông báo ───────────────────── */
click($('#channelAnnouncements'));
await sleep(150);
check('mở được chế độ thông báo', window.eval('announcementMode'), true);
check('thanh thông báo hiện ra', $('#announcementModeBar').hidden, false);
click($('#exitAnnouncementModeButton'));
await sleep(100);
check('thoát chế độ thông báo', window.eval('announcementMode'), false);
check('thanh thông báo ẩn lại', $('#announcementModeBar').hidden, true);

/* ── 14. Tạo kênh + nháp theo kênh ────────────────────────── */
click($('#channelAddButton'));
await sleep(40);
type($('#channelNameInput'), 'meo-con');
$('#channelCreateForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(300);
check('tạo kênh mới ghi vào /channels', writesTo('channels/meo-con').length > 0, true);
await window.eval("switchChannel('general', { skipConfirm: true })");
await sleep(300);
type(input, 'nháp phòng chung');
await sleep(650); // chờ bộ đếm lưu nháp (500ms)
check('nháp được lưu trên thiết bị', JSON.parse(window.localStorage.getItem('catchat-drafts-v1') || '{}')['u1::general'], 'nháp phòng chung');
await window.eval("switchChannel('meo-con')");
await sleep(350);
check('có nháp thì chuyển kênh không hỏi lại', $('#confirmLayer').classList.contains('open'), false);
check('đã chuyển sang kênh mới', window.eval('activeChannelId'), 'meo-con');
check('kênh mới không mang nháp của kênh cũ', input.value, '');
await window.eval("switchChannel('general')");
await sleep(350);
check('quay lại kênh cũ thì khôi phục nháp', input.value, 'nháp phòng chung');

/* ── 15. Không có lỗi runtime ─────────────────────────────── */
const runtimeErrors = window.__errors || [];
check('có lỗi runtime khi thao tác', runtimeErrors.slice(0, 3).join(' | '), '');
check('jsdom báo lỗi', errors.slice(0, 3).join(' | '), '');
const featureFailures = JSON.parse(window.eval('JSON.stringify(CatChat.features.failures())'));
check('tính năng nào đó lỗi hook', JSON.stringify(featureFailures.slice(0, 2)), '[]');

dom.window.close();
if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi luồng người dùng:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Luồng người dùng đạt (gửi tin, trả lời, reaction, tìm kiếm, theme, danh bạ, đã lưu, quản trị, mobile, lệnh /shrug, sửa + ghim, thông báo, nháp theo kênh).');
