#!/usr/bin/env node
/* CatChat · Kiểm tra hành vi giao diện app mobile (assets/js/app/mobile-ui.js).
   Chạy: node tests/mobile-ui.test.mjs

   Dựng DOM tối thiểu đúng như index.html (tabbar, scrim, bảng cài đặt, sidebar,
   các nút cũ) rồi bấm thử từng tab để chắc rằng:
     · thanh tab chỉ hiện khi đã đăng nhập và đang ở chế độ mobile;
     · ngăn kéo kênh / bảng cài đặt mở–đóng đúng, có aria-expanded;
     · các mục trong bảng cài đặt gọi đúng nút cũ (không nhân bản logic);
     · máy tính (data-ui="desktop") không bị đụng tới. */
import process from 'node:process';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(ROOT, 'assets/js/app/mobile-ui.js'), 'utf8');

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: nhận “${actual}”, mong đợi “${expected}”`);
};

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => errors.push(String(error.message || error)));

const dom = new JSDOM(`<!doctype html><html lang="vi"><head></head><body>
  <main class="auth-screen" id="authView"></main>
  <div class="app-view" id="appView">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-drawer-head">
        <div class="drawer-head-copy"><strong>Kênh &amp; trò chuyện</strong></div>
        <button class="drawer-close" id="mobileDrawerClose" type="button"></button>
      </div>
      <label class="drawer-filter" for="mobileChannelFilter">
        <input id="mobileChannelFilter" type="search" placeholder="Tìm kênh…">
      </label>
      <nav class="side-nav">
        <button class="nav-link" id="navChat" type="button"></button>
        <button class="nav-link" id="navMembers" type="button"></button>
        <button class="nav-link" id="savedMessagesButton" type="button"></button>
        <button class="nav-link" id="navAdmin" type="button" hidden></button>
      </nav>
      <div class="channel-list" id="channelList">
        <button class="channel-link" type="button" data-channel-id="general"><span class="channel-name">phòng-chung</span></button>
        <button class="channel-link" type="button" data-channel-id="meo"><span class="channel-name">mèo-con</span></button>
        <button class="channel-link" type="button" data-channel-id="an"><span class="channel-name">ăn-trưa</span></button>
      </div>
      <p class="drawer-empty" id="mobileChannelEmpty" hidden>Không tìm thấy kênh nào khớp.</p>
      <button class="channel-link announcements-link" id="channelAnnouncements" type="button"></button>
      <div class="profile-chip"><button id="logoutButton" type="button"></button></div>
    </aside>
    <div class="topbar">
      <button id="openThemeSettingsButton" type="button"></button>
      <button id="openAdminButton" type="button" hidden></button>
      <button id="catCompanionButton" type="button"></button>
      <div class="connection-pill" id="connectionPill"><span class="connection-dot"></span><span id="connectionLabel">Đang kết nối</span></div>
    </div>
    <div id="savedMessagesCount" hidden>0</div>
  </div>
  <div id="mobileScrim" hidden></div>
  <nav id="mobileTabbar" hidden>
    <button type="button" data-mobile-tab="channels" aria-expanded="false">Kênh</button>
    <button type="button" data-mobile-tab="chat" aria-current="page">Trò chuyện</button>
    <button type="button" data-mobile-tab="members">Thành viên</button>
    <button type="button" data-mobile-tab="settings" aria-expanded="false">Cài đặt</button>
  </nav>
  <section id="mobileSettingsSheet" hidden>
    <button type="button" data-mobile-action="theme">Giao diện</button>
    <button type="button" data-mobile-action="admin" hidden>Quản trị</button>
    <button type="button" data-mobile-action="saved">Đã lưu</button>
    <button type="button" data-mobile-action="announcements">Thông báo</button>
    <button type="button" data-mobile-action="miu">Miu</button>
    <span class="connection-dot" id="mobileConnectionDot"></span>
    <span id="mobileConnectionLabel">Đang kết nối</span>
    <button type="button" data-mobile-action="logout">Đăng xuất</button>
    <span id="mobileSavedCount"></span>
  </section>
</body></html>`, {
  url: 'https://catchat.test/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
  virtualConsole
});

const { window } = dom;
const { document } = window;
const q = (selector) => document.querySelector(selector);
const clicked = [];
for (const id of ['navChat', 'navMembers', 'openThemeSettingsButton', 'openAdminButton', 'catCompanionButton', 'logoutButton', 'savedMessagesButton', 'channelAnnouncements']) {
  document.getElementById(id).addEventListener('click', () => clicked.push(id));
}

document.documentElement.dataset.ui = 'mobile';
window.eval(source);
// jsdom dựng DOM bằng chuỗi nên sự kiện DOMContentLoaded chưa chắc đã bắn;
// trong trình duyệt thật script defer luôn chạy trước DOMContentLoaded.
if (document.readyState === 'loading') document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise((resolve) => window.setTimeout(resolve, 10));

const tabbar = q('#mobileTabbar');
const scrim = q('#mobileScrim');
const sheet = q('#mobileSettingsSheet');
const channelTab = q('[data-mobile-tab="channels"]');
const settingsTab = q('[data-mobile-tab="settings"]');

/* ── Trạng thái ban đầu ── */
check('thanh tab hiện khi đã đăng nhập', tabbar.hidden, false);
check('bảng cài đặt ẩn lúc đầu', sheet.hidden, true);
check('lớp mờ ẩn lúc đầu', scrim.hidden, true);

/* ── Ngăn kéo kênh ── */
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('bấm Kênh mở ngăn kéo', document.documentElement.dataset.mobileSheet, 'channels');
check('aria-expanded của tab Kênh', channelTab.getAttribute('aria-expanded'), 'true');
check('lớp mờ hiện khi mở ngăn kéo', scrim.hidden, false);
scrim.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('bấm lớp mờ đóng ngăn kéo', document.documentElement.dataset.mobileSheet, undefined);
check('aria-expanded trả về false', channelTab.getAttribute('aria-expanded'), 'false');

/* ── Ngăn kéo tự đóng khi chọn kênh ── */
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
q('.channel-list .channel-link').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('chọn kênh xong thì đóng ngăn kéo', document.documentElement.dataset.mobileSheet, undefined);

/* ── Nút đóng trong ngăn kéo ── */
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
q('#mobileDrawerClose').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('nút ✕ đóng ngăn kéo', document.documentElement.dataset.mobileSheet, undefined);
check('nút ✕ trả aria-expanded về false', channelTab.getAttribute('aria-expanded'), 'false');

/* ── Lọc kênh trong ngăn kéo ── */
const filter = q('#mobileChannelFilter');
const channelButtons = () => [...q('#channelList').querySelectorAll('.channel-link')];
const visibleChannels = () => channelButtons().filter((button) => !button.hidden).map((button) => button.dataset.channelId);
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('mở ngăn kéo hiện đủ 3 kênh', visibleChannels().join(','), 'general,meo,an');
filter.value = 'mèo';
filter.dispatchEvent(new window.Event('input', { bubbles: true }));
check('lọc theo tên kênh', visibleChannels().join(','), 'meo');
filter.value = 'meo';
filter.dispatchEvent(new window.Event('input', { bubbles: true }));
check('gõ không dấu vẫn tìm ra kênh có dấu', visibleChannels().join(','), 'meo');
check('lọc còn kết quả thì không hiện thông báo trống', q('#mobileChannelEmpty').hidden, true);
filter.value = 'zzz';
filter.dispatchEvent(new window.Event('input', { bubbles: true }));
check('lọc không khớp thì ẩn hết kênh', visibleChannels().join(','), '');
check('lọc không khớp thì hiện thông báo trống', q('#mobileChannelEmpty').hidden, false);
q('#mobileDrawerClose').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('đóng ngăn kéo thì xoá bộ lọc', filter.value, '');
check('đóng ngăn kéo thì hiện lại đủ kênh', visibleChannels().length, 3);

/* Danh sách kênh được vẽ lại (có kênh mới) trong lúc đang lọc */
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
filter.value = 'ăn';
filter.dispatchEvent(new window.Event('input', { bubbles: true }));
const rebuilt = document.createElement('div');
rebuilt.innerHTML = '<button class="channel-link" type="button" data-channel-id="general"><span class="channel-name">phòng-chung</span></button>'
  + '<button class="channel-link" type="button" data-channel-id="an"><span class="channel-name">ăn-trưa</span></button>';
q('#channelList').replaceChildren(...rebuilt.children);
await new Promise((resolve) => window.setTimeout(resolve, 20));
check('vẽ lại danh sách kênh vẫn giữ bộ lọc', visibleChannels().join(','), 'an');
q('#mobileDrawerClose').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

/* ── Bảng cài đặt + các mục gọi đúng nút cũ ── */
settingsTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('bấm Cài đặt mở bảng', sheet.hidden, false);
check('Cài đặt đặt aria-expanded', settingsTab.getAttribute('aria-expanded'), 'true');
q('[data-mobile-action="theme"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('mục Giao diện mở hộp thoại cũ', clicked.includes('openThemeSettingsButton'), true);
check('mở hộp thoại xong thì đóng bảng', sheet.hidden, true);

const openAndClick = (action) => {
  settingsTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  q(`[data-mobile-action="${action}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
};
openAndClick('saved');
openAndClick('miu');
openAndClick('announcements');
openAndClick('logout');
check('mục Đã lưu gọi nút cũ', clicked.includes('savedMessagesButton'), true);
check('mục Miu gọi nút cũ', clicked.includes('catCompanionButton'), true);
check('mục Thông báo gọi nút cũ', clicked.includes('channelAnnouncements'), true);
check('mục Đăng xuất gọi nút cũ', clicked.includes('logoutButton'), true);
check('mục Quản trị ẩn với thành viên thường', q('[data-mobile-action="admin"]').hidden, true);

/* ── Vuốt sang trái để đóng ngăn kéo ── */
const pointer = (type, x, y = 300) => new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const drawer = q('#sidebar');
drawer.dispatchEvent(pointer('pointerdown', 300, 300));
drawer.dispatchEvent(pointer('pointermove', 280, 302));
check('kéo ngang thì ngăn kéo bám theo tay', drawer.style.transform, 'translateX(-20px)');
drawer.dispatchEvent(pointer('pointermove', 290, 420));
check('cuộn dọc không kéo ngăn kéo', drawer.style.transform, 'translateX(-20px)');
drawer.dispatchEvent(pointer('pointerup', 200, 300));
check('vuốt trái đủ xa thì đóng ngăn kéo', document.documentElement.dataset.mobileSheet, undefined);

channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const drawer2 = q('#sidebar');
drawer2.dispatchEvent(pointer('pointerdown', 300, 300));
drawer2.dispatchEvent(pointer('pointermove', 270, 300));
drawer2.dispatchEvent(pointer('pointerup', 285, 300));
check('vuốt chưa đủ xa thì giữ ngăn kéo', document.documentElement.dataset.mobileSheet, 'channels');
check('vuốt xong phải trả lại transform', drawer2.style.transform, '');

/* Nhấc tay ra ngoài ngăn kéo (sự kiện rơi vào body) vẫn phải kết thúc thao tác kéo,
   nếu không ngăn kéo sẽ kẹt ở vị trí dở dang và không đóng được. */
const drawer3 = q('#sidebar');
drawer3.dispatchEvent(pointer('pointerdown', 300, 300));
drawer3.dispatchEvent(pointer('pointermove', 240, 300));
check('kéo thì ngăn kéo bám theo tay', drawer3.style.transform, 'translateX(-60px)');
document.body.dispatchEvent(pointer('pointerup', 120, 300));
check('nhấc tay ngoài ngăn kéo vẫn đóng được', document.documentElement.dataset.mobileSheet, undefined);
check('nhấc tay ngoài ngăn kéo phải trả lại transform', drawer3.style.transform, '');

/* ── Esc chỉ đóng lớp đang mở, không chạy tiếp handler toàn cục phía sau ──
   events.js cũng nghe keydown trên document; nếu Esc của ngăn kéo không chặn lan
   truyền thì nó sẽ đóng nhầm menu ⋯ / bảng thành viên / hộp xác nhận. */
// Mở lại ngăn kéo kênh để kiểm tra Esc (mục ngay trên đã đóng nó).
channelTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('mở lại ngăn kéo trước khi kiểm tra Esc', document.documentElement.dataset.mobileSheet, 'channels');
let globalEscapeRan = 0;
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') globalEscapeRan += 1;
});
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('Esc đóng ngăn kéo kênh', document.documentElement.dataset.mobileSheet, undefined);
check('Esc của ngăn kéo không chạy tiếp handler toàn cục', globalEscapeRan, 0);
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('khi không mở lớp nào thì Esc vẫn tới handler toàn cục', globalEscapeRan, 1);

/* ── Phím Esc đóng bảng ── */
settingsTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('Esc đóng bảng cài đặt', sheet.hidden, true);

/* ── Tab Trò chuyện / Thành viên ── */
q('[data-mobile-tab="members"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('tab Thành viên gọi #navMembers', clicked.includes('navMembers'), true);
check('aria-current chuyển sang Thành viên', q('[data-mobile-tab="members"]').getAttribute('aria-current'), 'page');
q('[data-mobile-tab="chat"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('tab Trò chuyện gọi #navChat', clicked.includes('navChat'), true);
check('aria-current về lại Trò chuyện', q('[data-mobile-tab="chat"]').getAttribute('aria-current'), 'page');

/* ── Phản chiếu trạng thái kết nối ── */
q('#connectionPill').classList.add('offline');
q('#connectionLabel').textContent = 'Mất kết nối';
window.CatChatMobileUI.refresh();
check('chấm kết nối đổi màu', q('#mobileConnectionDot').classList.contains('offline'), true);
check('nhãn kết nối được phản chiếu', q('#mobileConnectionLabel').textContent, 'Mất kết nối');

/* ── Ẩn khi đăng xuất (appView.hidden) ── */
q('#appView').hidden = true;
await new Promise((resolve) => window.setTimeout(resolve, 20));
check('đăng xuất thì ẩn thanh tab', tabbar.hidden, true);
q('#appView').hidden = false;
await new Promise((resolve) => window.setTimeout(resolve, 20));
check('đăng nhập lại thì hiện thanh tab', tabbar.hidden, false);

/* ── Chuyển sang giao diện máy tính ── */
document.documentElement.dataset.ui = 'desktop';
window.CatChatMobileUI.refresh();
check('máy tính ẩn thanh tab', tabbar.hidden, true);
check('máy tính không còn ngăn kéo', document.documentElement.dataset.mobileSheet, undefined);
check('lỗi jsdom khi chạy mobile-ui.js', errors.length, 0);

dom.window.close();
if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi giao diện mobile:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Giao diện mobile đạt (4 tab, ngăn kéo, bảng cài đặt, phản chiếu kết nối).');
