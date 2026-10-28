#!/usr/bin/env node
/* CatChat · Kiểm thử lối tắt PWA (?view=…).
   Chạy: node tests/deep-link.test.mjs

   Lối tắt trong manifest.webmanifest mở "./?view=members"… Trước đây tham số này
   không ai đọc nên bấm vào chỉ mở trang như thường. Tệp này chắc rằng:
     · tham số được đọc đúng, chỉ nhận 3 giá trị hợp lệ;
     · chỉ áp dụng SAU khi đăng nhập (lúc #appView còn ẩn thì chưa chuyển màn hình);
     · áp xong thì xoá tham số khỏi địa chỉ để tải lại không nhảy màn hình nữa;
     · manifest trỏ tới đúng các giá trị đó. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ROOT, createApp } from './harness.mjs';

const failures = [];
const check = (name, actual, expected) => {
  if (actual !== expected) failures.push(`${name}: nhận ${JSON.stringify(actual)}, mong đợi ${JSON.stringify(expected)}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/* Máy CI chậm hơn máy thật: chờ theo điều kiện thay vì ngủ cố định để test không
   lúc xanh lúc đỏ. Trả về true/false để phần kiểm tra vẫn báo đúng số liệu. */
const waitFor = async (predicate, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(25);
  }
  return Boolean(predicate());
};

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const shortcutViews = (manifest.shortcuts || []).map((item) => new URL(item.url, 'https://x.test/').searchParams.get('view'));
check('manifest phải có lối tắt Thành viên', shortcutViews.includes('members'), true);
check('manifest phải có lối tắt Thông báo', shortcutViews.includes('announcements'), true);
for (const shortcut of manifest.shortcuts || []) {
  check(`lối tắt "${shortcut.name}" phải có icon`, Array.isArray(shortcut.icons) && shortcut.icons.length > 0, true);
}

/* ── ?view=members trên máy tính ─────────────────────────── */
{
  const { dom, window, doc, errors } = createApp({ url: 'https://example.test/?view=members' });
  await sleep(600);
  check('chưa đăng nhập thì chưa chuyển màn hình', doc.getElementById('directoryPanel').hidden, true);
  await window.firebase.auth().signInWithEmailAndPassword('meo@com.vn', 'x');
  await waitFor(() => doc.getElementById('directoryPanel').hidden === false);
  check('đăng nhập xong mở danh bạ thành viên', doc.getElementById('directoryPanel').hidden, false);
  check('khung chat phải ẩn khi mở danh bạ', doc.getElementById('chatPanel').hidden, true);
  await waitFor(() => !window.location.search.includes('view='));
  check('xoá ?view khỏi địa chỉ sau khi dùng', window.location.search.includes('view='), false);
  check('không có lỗi runtime', (window.__errors || []).length, 0);
  check('jsdom không báo lỗi', errors.length, 0);
  dom.window.close();
}

/* ── ?view=announcements trên điện thoại ─────────────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/?view=announcements', mobile: true });
  await sleep(600);
  await window.firebase.auth().signInWithEmailAndPassword('meo@com.vn', 'x');
  await waitFor(() => window.eval('announcementMode') === true);
  check('lối tắt Thông báo bật chế độ thông báo', window.eval('announcementMode'), true);
  check('thanh thông báo hiện ra', doc.getElementById('announcementModeBar').hidden, false);
  check('tab mobile vẫn ở chế độ trò chuyện', doc.querySelector('[data-mobile-tab="chat"]').getAttribute('aria-current'), 'page');
  dom.window.close();
}

/* ── ?view=không-hợp-lệ thì bỏ qua, không lỗi ─────────────── */
{
  const { dom, window, doc } = createApp({ url: 'https://example.test/?view=xyz' });
  await sleep(600);
  await window.firebase.auth().signInWithEmailAndPassword('meo@com.vn', 'x');
  await sleep(900);
  check('giá trị lạ thì giữ khung chat', doc.getElementById('chatPanel').hidden, false);
  check('giá trị lạ thì không đụng tới danh bạ', doc.getElementById('directoryPanel').hidden, true);
  dom.window.close();
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi lối tắt PWA:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Lối tắt PWA đạt (members, announcements, giá trị lạ, xoá query).');
