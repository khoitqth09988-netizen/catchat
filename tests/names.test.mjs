#!/usr/bin/env node
/* CatChat · Tên hiển thị: dùng chung cho tên kiểu “admin”, duy nhất với tên thường,
   nhãn quyền hạn dưới tên, và trả lại tên khi xoá tài khoản.
   Chạy: node tests/names.test.mjs

   Quy tắc đang áp dụng (theo yêu cầu của chủ dự án):
     • ai cũng đặt được tên “admin”, “root”, “quản trị”… — những tên này KHÔNG chiếm khoá
       duy nhất trong /displayNames nên nhiều người cùng dùng được, và tài khoản quản trị
       thật không bị mất tên;
     • không còn chuyện tự đổi tên thành “admin (a1b2)” khi trùng tên (lỗi người dùng báo);
     • tên thường vẫn là duy nhất — báo ngay tại ô tên nếu đã có người dùng;
     • để không nhầm lẫn, tên kiểu admin được gắn nhãn “Quản trị” (uid có trong
       /adminBadges) hoặc “Thành viên” (chỉ là tên hiển thị);
     • xoá tài khoản thì giải phóng khoá tên để người khác dùng lại.
*/
import process from 'node:process';
import { createApp } from './harness.mjs';

const failures = [];
const check = (name, actual, expected) => {
  if (actual !== expected) failures.push(`${name}: nhận ${JSON.stringify(actual)}, mong đợi ${JSON.stringify(expected)}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── 1. Đăng ký: tên kiểu admin dùng chung, tên thường vẫn duy nhất ─────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  const $ = (selector) => doc.querySelector(selector);
  const type = (el, value) => { el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const submit = () => $('#authForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const errorText = () => doc.getElementById('authErrorText')?.textContent || doc.getElementById('authError')?.textContent || '';

  await sleep(600);
  window.eval(`
    database.ref('admins/u1').set(true);
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('displayNames/admin').set('u1');
    database.ref('displayNames/meo-con').set('u2');
  `);

  click($('#toggleAuthMode'));
  await sleep(60);
  check('màn hình đăng ký hiện ô tên', $('#displayNameField').hidden, false);
  type($('#email'), 'meo2@com.vn');
  type($('#password'), 'matkhau');
  type($('#confirmPassword'), 'matkhau');

  // Tên “admin” đã có quản trị thật giữ khoá — vẫn phải cho đăng ký.
  const membersBefore = window.__writes.filter((w) => w.path.startsWith('members/')).length;
  type($('#displayName'), 'admin');
  submit();
  await sleep(800);
  const created = window.eval('firebase.auth().currentUser && firebase.auth().currentUser.uid');
  check('đặt tên “admin” thì tạo được tài khoản', Boolean(created), true);
  check('không báo lỗi tên dành riêng', errorText().includes('dành riêng'), false);
  const member = window.__writes.filter((w) => w.path.startsWith(`members/${created}`)).at(-1);
  check('tên hiển thị giữ đúng “admin” (không bị đổi thành “admin (xxxx)”)', member?.value?.name, 'admin');
  check('tên dùng chung không chiếm khoá /displayNames', window.__writes.some((w) => w.path === 'displayNames/admin' && w.value === created), false);
  check('có ghi hồ sơ thành viên', window.__writes.filter((w) => w.path.startsWith('members/')).length > membersBefore, true);

  dom.window.close();
}

/* ── 2. Tên thường: vẫn duy nhất, báo ngay tại ô tên ──────────────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  const $ = (selector) => doc.querySelector(selector);
  const type = (el, value) => { el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const errorText = () => doc.getElementById('authErrorText')?.textContent || '';

  await sleep(600);
  window.eval("database.ref('displayNames/meo-con').set('u2');");
  click($('#toggleAuthMode'));
  await sleep(60);
  type($('#email'), 'meo3@com.vn');
  type($('#password'), 'matkhau');
  type($('#confirmPassword'), 'matkhau');
  type($('#displayName'), 'Mèo Con');
  $('#authForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(500);
  check('tên thường bị trùng thì báo lỗi rõ', errorText().includes('đã có người dùng'), true);
  check('tên trùng: chưa tạo tài khoản', window.eval('Boolean(firebase.auth().currentUser)'), false);
  check('gợi ý tên thay thế được điền sẵn', $('#displayName').value.includes('2'), true);
  dom.window.close();
}

/* ── 3. Đăng nhập: trùng tên cũng KHÔNG tự đổi tên ─────────────────────── */
{
  const { dom, window } = createApp({ url: 'https://example.test/' });
  await sleep(600);
  // Tên tài khoản (meo) đã bị uid khác giữ chỗ; hồ sơ cũ đang là “Mèo Con”.
  window.eval(`
    database.ref('members/u1').set({ uid: 'u1', name: 'Mèo Con', email: 'meo@com.vn' });
    database.ref('displayNames/meo').set('u9');
  `);
  await window.firebase.auth().signInWithEmailAndPassword('meo@com.vn', 'x');
  await sleep(1200);
  const writes = window.__writes.filter((w) => w.path === 'members/u1' && w.value && typeof w.value === 'object');
  const last = writes.at(-1)?.value?.name;
  check('không tự thêm hậu tố “(xxxx)” vào tên', /\(\w{4}\)/.test(String(last)), false);
  check('giữ đúng tên người dùng đã có', last, 'Mèo Con');
  dom.window.close();
}

/* ── 4. Nhãn quyền hạn: dựa trên uid thật, không dựa vào chữ trong tên ─── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(600);
  window.eval(`
    database.ref('admins/u1').set(true);
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('members/u2').set({ uid: 'u2', name: 'admin', email: 'ke@com.vn' });
    database.ref('members/u3').set({ uid: 'u3', name: 'Mèo Con', email: 'meo@com.vn' });
  `);
  await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'x');
  await sleep(1500);
  // Quản trị thật ghi cờ của mình vào /adminBadges.
  check('admin tự ghi cờ /adminBadges', window.__writes.some((w) => w.path === 'adminBadges/u1' && w.value === true), true);
  check('uid quản trị được nhận là admin', window.eval("CatChat.adminBadges.isAdminUid('u1')"), true);
  check('người chỉ đặt tên admin KHÔNG phải admin', window.eval("CatChat.adminBadges.isAdminUid('u2')"), false);
  check('nhãn cho tên admin của quản trị thật', window.eval("CatChat.adminBadges.tagFor('u1', 'admin')"), 'admin');
  check('nhãn cho tên admin của thành viên thường', window.eval("CatChat.adminBadges.tagFor('u2', 'admin')"), 'member');
  check('tên thường không cần nhãn', window.eval("CatChat.adminBadges.tagFor('u3', 'Mèo Con')"), '');
  check('chữ nhãn: quản trị', window.eval("CatChat.adminBadges.tagLabel('admin')"), 'Quản trị');
  check('chữ nhãn: thành viên', window.eval("CatChat.adminBadges.tagLabel('member')"), 'Thành viên');

  // Nhãn phải THẬT SỰ hiện dưới tên trong danh sách tin nhắn và danh bạ.
  window.eval(`
    messages.set('nb1', { uid: 'u1', name: 'admin', text: 'tin của quản trị', kind: 'message', timestamp: Date.now() - 9000 });
    messages.set('nb2', { uid: 'u2', name: 'admin', text: 'tin của thành viên', kind: 'message', timestamp: Date.now() - 8000 });
    messages.set('nb3', { uid: 'u3', name: 'Mèo Con', text: 'tin thường', kind: 'message', timestamp: Date.now() - 7000 });
    renderAllMessages(true);
    setWorkspaceView('members');
  `);
  await sleep(80);
  const rowOf = (id) => doc.querySelector(`.message-row[data-message-id="${id}"]`);
  check('tin của quản trị thật có nhãn “Quản trị”', rowOf('nb1')?.querySelector('.message-name + .name-tag')?.textContent.trim(), 'Quản trị');
  check('tin của người chỉ đặt tên admin có nhãn “Thành viên”', rowOf('nb2')?.querySelector('.message-name + .name-tag')?.textContent.trim(), 'Thành viên');
  check('tin của tên thường không có nhãn', Boolean(rowOf('nb3')?.querySelector('.name-tag')), false);
  check('nhãn nằm ngay sau tên', rowOf('nb1')?.querySelector('.message-meta')?.children[0]?.className, 'message-name');
  const cardTags = [...doc.querySelectorAll('#directoryGrid .directory-card')]
    .map((card) => `${card.dataset.memberUid}:${card.querySelector('.name-tag')?.textContent.trim() || ''}`);
  check('danh bạ gắn nhãn cho người tên admin', cardTags.includes('u2:Chỉ là tên hiển thị'), true);
  dom.window.close();
}

/* ── 5. Xoá tài khoản phải giải phóng khoá tên ─────────────────────────── */
{
  const { dom, window } = createApp({ url: 'https://example.test/' });
  await sleep(600);
  window.eval(`
    database.ref('admins/u1').set(true);
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('members/u2').set({ uid: 'u2', name: 'Mèo Con', email: 'meo@com.vn' });
    database.ref('displayNames/meo-con').set('u2');
  `);
  await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'x');
  await sleep(1200);
  await window.eval("CatChat.accountDeletion.purge('u2', { log: false })");
  await sleep(300);
  check('khoá tên được giải phóng', window.__writes.some((w) => w.path === 'displayNames/meo-con' && (w.value === null || w.value === undefined)), true);
  check('hồ sơ thành viên bị xoá', window.__writes.some((w) => w.path === 'members/u2' && (w.value === null || w.value === undefined)), true);
  dom.window.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi tên hiển thị:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Tên hiển thị đạt (admin dùng chung, tên thường duy nhất, không tự đổi tên, nhãn quyền hạn, giải phóng khi xoá).');
