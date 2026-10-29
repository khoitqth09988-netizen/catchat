#!/usr/bin/env node
/* CatChat · Chịu lỗi: mạng yếu và lớp mờ của ngăn kéo mobile.
   Chạy: node tests/resilience.test.mjs

   Hai lỗi người dùng báo (điện thoại, Chrome):
     1. "Mạng yếu thì load không vào" — Firebase SDK tải từ www.gstatic.com bằng
        <script defer>, mọi script phía sau phải xếp hàng ⇒ một tệp SDK treo là splash
        đứng im mãi, người dùng không biết đường nào.
        Nay: early-guard.js nạp trong <head> (trước cả SDK) và hiện lỗi + nút "Thử lại";
        sw.js trả bản cache sau ~3,2 giây thay vì chờ mạng vô hạn.
     2. "Bấm vào kênh vẫn còn một lớp mờ, không nhìn thấy gì" — ngăn kéo không đóng
        được vì JS tìm #sidebar, hoặc HTML cũ trong cache ⇒ lớp mờ 76 phủ kín màn hình.
        Nay: nghe chọn kênh ở pha capture trên document, tự đồng bộ lại lớp mờ mỗi khi
        data-mobile-sheet đổi, và lớp mờ không nhận chạm khi không có ngăn kéo nào mở.
*/
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ROOT, createApp } from './harness.mjs';

const failures = [];
const check = (name, actual, expected) => {
  if (actual !== expected) failures.push(`${name}: nhận ${JSON.stringify(actual)}, mong đợi ${JSON.stringify(expected)}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── 1. Thứ tự nạp: early-guard phải chạy TRƯỚC Firebase SDK ─────────────── */
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const guardAt = html.indexOf('assets/js/app/early-guard.js');
const sdkAt = html.indexOf('firebase-app-compat.js');
check('index.html có nạp early-guard.js', guardAt > 0, true);
check('early-guard.js nạp trước Firebase SDK', guardAt < sdkAt && sdkAt > 0, true);
check('early-guard.js không dùng defer (phải chạy ngay)', /<script src="assets\/js\/app\/early-guard\.js"><\/script>/.test(html), true);
check('splash có nút Thử lại', /id="bootRetry"/.test(html), true);

/* ── 2. Service Worker: chờ mạng có giới hạn rồi dùng cache ─────────────── */
const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check('sw.js có hạn chờ mạng', /const NETWORK_TIMEOUT = \d+;/.test(sw), true);
check('sw.js dùng withTimeout cho trang', /const fresh = await withTimeout\(network, NETWORK_TIMEOUT\);\s*\n\s*if \(fresh\) return fresh;/.test(sw), true);
check('sw.js vẫn cache trang chủ khi cài', /CORE\.map/.test(sw) && /'\.\/index\.html'/.test(sw), true);
const version = (sw.match(/const VERSION = 'catchat-v(\d+)';/) || [])[1];
check('sw.js có VERSION để buộc cập nhật cache', Boolean(version), true);

/* ── 3. Splash báo lỗi + nút Thử lại khi thiếu Firebase (mạng yếu) ──────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/' });
  await sleep(500);
  const screen = doc.getElementById('bootScreen');
  // Trước khi app mở xong: gác cổng phải hiện được lỗi ngay cả khi boot-screen.js chưa chạy
  const revealed = window.eval("CatChatEarlyGuard.revealError('Mạng quá chậm', 'Kết nối quá chậm')");
  check('gác cổng hiện được lỗi trên splash', revealed, true);
  check('hộp lỗi splash mở ra', doc.getElementById('bootError').hidden, false);
  check('nút Thử lại hiện ra', doc.getElementById('bootRetry').hidden, false);
  check('nhãn lỗi được ghi', doc.getElementById('bootErrorText').textContent.includes('Mạng quá chậm'), true);
  check('bước hiện tại đổi theo lỗi', doc.getElementById('bootStep').textContent, 'Kết nối quá chậm');
  // Khi app đã mở xong thì không được làm phiền người dùng nữa.
  doc.body.classList.add('booted');
  check('app mở rồi thì gác cổng im lặng', window.eval("CatChatEarlyGuard.revealError('x')"), false);
  if (screen) screen.remove();
  dom.window.close();
}

/* ── 4. Ngăn kéo mobile: bấm kênh luôn đóng, lớp mờ không đứng một mình ── */
{
  const { dom, window, doc, errors } = createApp({ url: 'https://example.test/', mobile: true });
  const $ = (selector) => doc.querySelector(selector);
  await sleep(600);
  window.eval(`
    database.ref('members/u1').set({ uid: 'u1', name: 'admin', email: 'admin@com.vn' });
    database.ref('channels/general').set({ name: 'general', createdBy: 'u1' });
    database.ref('channels/meo').set({ name: 'meo', createdBy: 'u1' });
  `);
  await window.firebase.auth().signInWithEmailAndPassword('admin@com.vn', 'x');
  await sleep(1200);
  const root = doc.documentElement;
  const scrim = doc.getElementById('mobileScrim');
  const openDrawer = () => window.eval("CatChatMobileUI.openSheet('channels')");

  openDrawer();
  await sleep(40);
  check('ngăn kéo mở được', root.dataset.mobileSheet, 'channels');
  check('lớp mờ hiện khi ngăn kéo mở', scrim.hidden, false);

  // Bấm kênh bằng sự kiện nổi bọt từ chính phần tử kênh (giống ngón tay thật).
  const link = $('#channelList .channel-link[data-channel-id="meo"]');
  link.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(300);
  check('bấm kênh thì ngăn kéo đóng', root.dataset.mobileSheet, undefined);
  check('bấm kênh thì lớp mờ biến mất', scrim.hidden, true);
  check('bấm kênh thì đổi sang kênh đó', window.eval('activeChannelId'), 'meo');

  // Tự chữa: ai đó xoá data-mobile-sheet (hoặc JS cũ bỏ sót) ⇒ lớp mờ phải tự ẩn.
  openDrawer();
  await sleep(40);
  check('mở lại ngăn kéo vẫn đúng', root.dataset.mobileSheet, 'channels');
  root.removeAttribute('data-mobile-sheet');
  await sleep(40);
  check('mất ngăn kéo thì lớp mờ tự ẩn', scrim.hidden, true);

  // Không có ngăn kéo nào mở ⇒ lớp mờ không được chặn chạm (CSS có luật riêng).
  const css = readFileSync(path.join(ROOT, 'assets/css/mobile-app.css'), 'utf8');
  check('CSS: lớp mờ ẩn hẳn khi có [hidden]',
    /html\[data-ui="mobile"\] #mobileScrim\[hidden\] \{ display: none !important; \}/.test(css), true);
  check('CSS: lớp mờ không nhận chạm khi không có ngăn kéo',
    /html\[data-ui="mobile"\]:not\(\[data-mobile-sheet\]\) #mobileScrim \{ pointer-events: none; \}/.test(css), true);

  const runtime = (window.__errors || []).concat(errors);
  check('không có lỗi runtime', runtime.slice(0, 3).join(' | '), '');
  dom.window.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi chịu lỗi (mạng yếu / lớp mờ ngăn kéo):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Chịu lỗi đạt (splash báo mạng yếu, SW dùng cache sau 3,2s, bấm kênh luôn đóng ngăn kéo).');
