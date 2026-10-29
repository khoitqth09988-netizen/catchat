#!/usr/bin/env node
/* CatChat · Cổng truy cập & màn hình chờ cho mạng yếu.
   Chạy: node tests/access.test.mjs

   Người dùng báo hai chuyện liên quan nhau:
     A. “Làm loading đi cho máy mạng yếu” — splash phải cho thấy app vẫn đang chạy
        (thanh tiến trình nhích, biết đang chờ gì, chờ bao lâu) và phải luôn có đường ra:
        hộp lỗi + nút Thử lại, không bao giờ đứng im mãi.
     B. “Mạng khoẻ mà vẫn không load được, chắc xung đột với tạo nhiều acc trên một
        IP/thiết bị, tôi bị ban” — đúng: cổng định danh cũ tự cấm vĩnh viễn MỌI tài
        khoản trên máy (kể cả tài khoản quản trị) ngay khi có tài khoản thứ 3, đồng thời
        tự xoá dữ liệu của chính người đang đăng nhập. Chủ dự án tạo vài tài khoản để
        thử là tự ban mình ⇒ lần sau đăng nhập chỉ thấy “Tài khoản đang bị chặn”.

   Những gì tệp này khoá lại:
     1. Splash: có dòng gợi ý #bootHint, tiến trình tự nhích, sau hạn chót hiện lỗi +
        nút Thử lại mà vẫn tiếp tục chờ (mạng chậm mà cuối cùng vào được thì vẫn vào).
     2. Cổng định danh KHÔNG BAO GIỜ treo cửa: đọc/ghi có hạn chót, quá hạn thì cho vào.
     3. Quản trị viên không bị cổng hạn mức chặn; tài khoản đã bị “cấm tự động” do cổng
        cũ ghi thì được tự dọn khi chính admin đăng nhập.
     4. Vượt hạn mức: chỉ khoá đăng nhập, KHÔNG tự ghi /bans, KHÔNG tự xoá dữ liệu.
     5. Chỉ đếm tài khoản còn tồn tại trong /members (tạo rồi xoá không bị tính mãi).
*/
import process from 'node:process';
import { createApp } from './harness.mjs';

const failures = [];
const check = (name, actual, expected) => {
  if (actual !== expected) failures.push(`${name}: nhận ${JSON.stringify(actual)}, mong đợi ${JSON.stringify(expected)}`);
};
const contains = (name, haystack, needle) => {
  if (!String(haystack || '').includes(needle)) failures.push(`${name}: “${haystack}” không chứa “${needle}”`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── 1. Splash cho mạng yếu: gợi ý, tiến trình tự nhích, hạn chót ─────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(400);
  const hint = doc.getElementById('bootHint');
  check('splash có dòng gợi ý #bootHint', Boolean(hint), true);
  check('gợi ý mặc định ẩn', hint.hidden, true);

  // Tắt hẹn giờ thật của app để tự điều khiển mốc thời gian.
  window.eval('window.__catchatBootLimits = { hint: 3, warn: 6, creep: 40 };');
  const startPercent = window.eval('CatChat.bootScreen.percent');
  await sleep(400);
  const laterPercent = window.eval('CatChat.bootScreen.percent');
  check('thanh tiến trình tự nhích khi đang chờ (không đứng im)', laterPercent > startPercent, true);

  // Giả lập “đã chờ lâu”: gọi lại mốc thời gian bằng cách chỉnh startedAt qua hint.
  window.eval('CatChat.bootScreen.hint("Mạng hơi chậm — vẫn đang kết nối (7 giây).")');
  check('hiện được dòng gợi ý mạng chậm', hint.hidden, false);
  contains('gợi ý có số giây', hint.textContent, 'giây');

  // diagnose(): ngoại tuyến
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
  contains('diagnose: ngoại tuyến', window.eval('CatChat.bootScreen.diagnose()'), 'ngoại tuyến');
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
  contains('diagnose: bình thường thì nói máy chủ chậm', window.eval('CatChat.bootScreen.diagnose()'), 'Máy chủ');

  // Hộp lỗi + nút Thử lại: hiện ra nhưng KHÔNG đóng splash (vẫn chờ tiếp).
  window.eval('CatChat.bootScreen.fail("Vẫn chưa mở được sau 20 giây.")');
  check('hộp lỗi hiện ra', doc.getElementById('bootError').hidden, false);
  check('nút Thử lại hiện ra', doc.getElementById('bootRetry').hidden, false);
  check('splash vẫn còn (vẫn tiếp tục chờ)', Boolean(doc.getElementById('bootScreen')), true);

  // Mạng hồi phục: app mở xong thì splash phải đóng và hộp lỗi biến mất.
  window.eval('CatChat.bootScreen.finish()');
  await sleep(900);
  check('mạng hồi phục thì app vẫn mở được', doc.body.classList.contains('booted'), true);
  check('splash được gỡ khỏi DOM', Boolean(doc.getElementById('bootScreen')), false);
  dom.window.close();
}

/* ── 2. Cổng định danh không được làm treo màn hình chờ ───────────────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  // Cổng định danh “treo” (mạng chết giữa chừng) — app vẫn phải mở.
  window.eval('window.__catchatGateTimeout = 900;');
  window.eval('CatChat.identity.enforce = () => new Promise(() => {});');
  window.eval(`
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('admins/u1').set(true);
  `);
  await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'x');
  await sleep(2600);
  check('cổng định danh treo mà app vẫn mở', doc.body.classList.contains('booted'), true);
  check('vào được không gian trò chuyện', doc.getElementById('appView').hidden, false);
  dom.window.close();
}

/* ── 3. Vượt hạn mức: người thường bị khoá nhưng KHÔNG bị xoá dữ liệu ─────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  window.eval(`
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('admins/u1').set(true);
    database.ref('members/u2').set({ uid: 'u2', name: 'hai', email: 'hai@com.vn' });
    database.ref('members/u3').set({ uid: 'u3', name: 'ba', email: 'ba@com.vn' });
  `);
  const device = window.eval('CatChat.identity.deviceHash()');
  window.eval(`
    database.ref('identityLedger/${device}/u1').set({ at: 1 });
    database.ref('identityLedger/${device}/u2').set({ at: 2 });
    database.ref('identityLedger/${device}/u3').set({ at: 3 });
  `);
  const gate = await window.eval(`(async () => await CatChat.identity.enforce('u3'))()`);
  check('người thường vượt hạn mức thì bị khoá', gate?.blocked, true);
  contains('lý do nói rõ số tài khoản', gate?.reason, 'quá mức');
  contains('có chỉ đường cho quản trị viên', gate?.help, 'Cài đặt quản trị');
  check('KHÔNG tự ghi /bans nữa', JSON.stringify(window.__db.data.bans || {}), '{}');
  check('dữ liệu thành viên còn nguyên (không tự xoá)', window.eval("Boolean(database) && Boolean(window.__db.data.members.u3)"), true);
  check('có khoá định danh để chặn đăng nhập', Boolean(window.__db.data.identityLocks?.[device]), true);
  check('khoá được đánh dấu là do máy tạo', window.__db.data.identityLocks[device].auto, true);

  // Mở khoá: gỡ khoá + dọn luôn /bans kiểu cũ (nếu có) để không ai bị kẹt.
  window.eval(`
    database.ref('bans/u3').set({ reason: 'cũ', bannedBy: 'system', identityLock: '${device}' });
  `);
  await window.eval(`(async () => { await CatChat.identity.unlockIdentity('${device}'); })()`);
  check('mở khoá thì khoá biến mất', Boolean(window.__db.data.identityLocks?.[device]), false);
  check('mở khoá thì dọn luôn bản ghi cấm tự động cũ', Boolean(window.__db.data.bans?.u3), false);
  dom.window.close();
}

/* ── 4. Tài khoản đã xoá không còn bị tính vào hạn mức ────────────────────── */
{
  const { dom, window } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  window.eval(`
    database.ref('members/u1').set({ uid: 'u1', name: 'meo', email: 'meo@com.vn' });
  `);
  const device = window.eval('CatChat.identity.deviceHash()');
  // Sổ định danh còn dấu của 5 tài khoản đã tạo rồi xoá, nhưng /members chỉ còn 1 người.
  window.eval(`
    ['u1', 'u2', 'u3', 'u4', 'u5'].forEach((uid, index) => {
      database.ref('identityLedger/${device}/' + uid).set({ at: index });
    });
  `);
  const gate = await window.eval(`(async () => await CatChat.identity.enforce('u1'))()`);
  check('chỉ đếm tài khoản còn tồn tại', gate?.accounts, 1);
  check('không khoá oan vì tài khoản đã xoá', gate?.blocked, false);
  dom.window.close();
}

/* ── 5. Quản trị viên: không bị chặn, và tự dọn “cấm tự động” cũ ──────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  window.eval(`
    database.ref('admins/u1').set(true);
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('members/u2').set({ uid: 'u2', name: 'hai', email: 'hai@com.vn' });
    database.ref('members/u3').set({ uid: 'u3', name: 'ba', email: 'ba@com.vn' });
    database.ref('members/u4').set({ uid: 'u4', name: 'bon', email: 'bon@com.vn' });
  `);
  const device = window.eval('CatChat.identity.deviceHash()');
  window.eval(`
    ['u1','u2','u3','u4'].forEach((uid, index) => database.ref('identityLedger/${device}/' + uid).set({ at: index }));
    database.ref('identityLocks/${device}').set({ kind: 'device', auto: true, reason: 'Tự khoá cũ', at: 1, uids: { u1: true, u2: true, u3: true, u4: true } });
    database.ref('bans/u1').set({ reason: 'Tự khoá: thiết bị này đã tạo quá 2 tài khoản.', bannedBy: 'system', bannedAt: 1, permanent: true, identityLock: '${device}' });
  `);
  const gate = await window.eval(`(async () => await CatChat.identity.enforce('u1'))()`);
  check('admin vượt hạn mức vẫn được cho vào', gate?.blocked, false);
  check('khoá tự động của máy được gỡ luôn khi admin vào', Boolean(window.__db.data.identityLocks?.[device]), false);

  await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'x');
  await sleep(2400);
  check('admin đăng nhập được dù có bản ghi cấm tự động cũ', doc.getElementById('appView').hidden, false);
  check('bản ghi cấm tự động cũ được dọn', Boolean(window.__db.data.bans?.u1), false);
  dom.window.close();
}

/* ── 6. Chặn tay (do người thật) thì vẫn có hiệu lực, kể cả với admin ─────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  window.eval(`
    database.ref('admins/u1').set(true);
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('bans/u1').set({ reason: 'Spam liên tục', bannedBy: 'u9', bannedAt: 1, permanent: true });
  `);
  await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'x');
  await sleep(2400);
  check('chặn tay vẫn giữ nguyên hiệu lực', doc.getElementById('appView').hidden, true);
  check('splash vẫn đóng để thấy lý do', doc.body.classList.contains('booted'), true);
  contains('màn đăng nhập nêu lý do', doc.getElementById('authNotice')?.textContent, 'Spam liên tục');
  check('không tự dọn bản ghi do người thật tạo', Boolean(window.__db.data.bans?.u1), true);
  dom.window.close();
}

/* ── 7. Người thường bị “cấm tự động” cũ: thấy lý do + cách xử lý ─────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  window.eval(`
    database.ref('members/u1').set({ uid: 'u1', name: 'meo', email: 'meo@com.vn' });
    database.ref('bans/u1').set({ reason: 'Tự khoá: thiết bị này đã tạo quá 2 tài khoản.', bannedBy: 'system', bannedAt: 1, permanent: true, identityLock: 'abc' });
  `);
  await window.firebase.auth().signInWithEmailAndPassword('meo@com.vn', 'x');
  await sleep(2400);
  check('người thường vẫn bị chặn', doc.getElementById('appView').hidden, true);
  contains('nói rõ đây là khoá tự động', doc.getElementById('authNotice')?.textContent, 'khoá tự động');
  contains('chỉ đường cho quản trị viên', doc.getElementById('authNotice')?.textContent, 'Cài đặt quản trị');
  dom.window.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi cổng truy cập / màn hình chờ:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Cổng truy cập đạt (loading mạng yếu, hạn chót cổng định danh, khoá theo máy không tự ban/xoá, admin không bị khoá).');
