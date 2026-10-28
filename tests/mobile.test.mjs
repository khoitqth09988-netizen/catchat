#!/usr/bin/env node
/* CatChat · kiểm tra "cascade" cho giao diện mobile mà không cần trình duyệt.
   Chạy: node tests/mobile.test.mjs

   jsdom không có layout và cũng không tự áp media query, nhưng nó giữ nguyên
   stylesheet + hỗ trợ element.matches(). Ở đây ta tự:
     1. duyệt toàn bộ CSS theo đúng thứ tự nạp trong index.html,
     2. tự đánh giá @media theo khổ màn hình giả lập (390px / 820px / 1280px),
     3. tự tính specificity để tìm khai báo thắng cuộc.
   Nhờ vậy bắt được lỗi kiểu "đã thêm rule mobile nhưng specificity thấp nên bị
   rule cũ đè" — thứ mà kiểm tra chuỗi (regex) không phát hiện được. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: nhận “${actual}”, mong đợi “${expected}”`);
};

/* ── Dựng DOM tối thiểu: <style> theo đúng thứ tự nạp của index.html ── */
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssFiles = [...html.matchAll(/<link rel="stylesheet" href="(assets\/css\/[^"]+)">/g)].map((match) => match[1]);
const styles = cssFiles.map((file) => `<style data-src="${file}">${readFileSync(path.join(ROOT, file), 'utf8')}</style>`).join('\n');

const dom = new JSDOM(`<!doctype html><html><head>${styles}</head><body></body></html>`, {
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole()
});
const { document } = dom.window;

/* ── Đánh giá media query cho khổ màn hình giả lập ── */
function mediaMatches(text, { width, touch }) {
  if (!text) return true;
  return text.split(',').some((part) => {
    const features = [...part.matchAll(/\(([^)]+)\)/g)].map((match) => match[1].trim());
    return features.every((feature) => {
      const max = feature.match(/^max-width:\s*(\d+)px$/);
      if (max) return width <= Number(max[1]);
      const min = feature.match(/^min-width:\s*(\d+)px$/);
      if (min) return width >= Number(min[1]);
      const maxHeight = feature.match(/^max-height:\s*(\d+)px$/);
      if (maxHeight) return 820 <= Number(maxHeight[1]);
      if (feature === 'hover: none' || feature === 'pointer: coarse') return touch;
      if (feature === 'hover: hover' || feature === 'pointer: fine') return !touch;
      if (feature.startsWith('prefers-reduced-motion')) return false;
      return true;
    });
  });
}

function specificity(selector) {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!not\b)[a-z-]+/g) || []).length;
  const stem = selector.replace(/:[a-z-]+(\([^)]*\))?/g, ' ').replace(/[#.[\]="'>+~]/g, ' ');
  const elements = (stem.match(/(?:^|\s)([a-z][\w-]*)/g) || []).length;
  return ids * 10000 + classes * 100 + elements;
}

const compare = (a, b) => (a.specificity - b.specificity) || (a.order - b.order);

function collectRules(rules, viewport, out, order = { value: 0 }) {
  for (const rule of rules) {
    if (rule.type === 4 /* CSSMediaRule */) {
      if (mediaMatches(rule.media?.mediaText || '', viewport)) collectRules(rule.cssRules, viewport, out, order);
      continue;
    }
    if (rule.type === 12 /* CSSSupportsRule */) {
      collectRules(rule.cssRules, viewport, out, order);
      continue;
    }
    if (rule.type !== 1 /* CSSStyleRule */) continue;
    out.push({ selectorText: rule.selectorText, style: rule.style, order: order.value += 1 });
  }
  return out;
}

const sheets = [...document.styleSheets];
function winner(element, property, viewport) {
  let best = null;
  let order = { value: 0 };
  for (const sheet of sheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (_) { continue; }
    for (const rule of collectRules(rules, viewport, [], order)) {
      if (!rule.style.getPropertyValue(property)) continue;
      for (const selector of rule.selectorText.split(',').map((part) => part.trim())) {
        let matches = false;
        try { matches = element.matches(selector); } catch (_) { matches = false; }
        if (!matches) continue;
        const candidate = {
          value: rule.style.getPropertyValue(property).trim(),
          specificity: specificity(selector),
          order: rule.order,
          selector
        };
        if (!best || compare(candidate, best) > 0) best = candidate;
      }
    }
  }
  return best ?? { value: '', selector: '(không có)' };
}

/* ── Dựng cây phần tử giống cấu trúc thật ── */
document.body.innerHTML = `
  <div class="app-view" id="appView">
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-drawer-head">
          <div class="drawer-head-copy"><span class="drawer-eyebrow">Điều hướng</span><strong>Kênh &amp; trò chuyện</strong></div>
          <button class="drawer-close" id="mobileDrawerClose" type="button"></button>
        </div>
        <label class="drawer-filter" for="mobileChannelFilter">
          <input id="mobileChannelFilter" type="search" placeholder="Tìm kênh…">
        </label>
        <div class="brand-lockup"><div class="brand-mark"></div><div><span class="brand-name">CatChat</span></div></div>
        <nav class="side-nav">
          <button class="nav-link" type="button"><span>Trò chuyện</span></button>
          <button class="nav-link" type="button"><span>Thành viên</span></button>
        </nav>
        <div class="sidebar-channel-block">
          <div class="channel-list" id="channelList">
            <button class="channel-link" type="button" data-channel-id="general"><span class="channel-mark">#</span><span class="channel-name">phòng-chung</span></button>
            <button class="channel-link" type="button" data-channel-id="meo"><span class="channel-mark">#</span><span class="channel-name">mèo-con</span></button>
          </div>
          <p class="drawer-empty" id="mobileChannelEmpty" hidden>Không tìm thấy kênh nào khớp.</p>
        </div>
        <div class="sidebar-spacer"></div>
        <div class="profile-chip"><button class="avatar" type="button">M</button><div class="profile-text"><strong>Mèo</strong><span>meo@com.vn</span></div></div>
      </aside>
      <div class="main-layout">
        <header class="topbar"></header>
        <main class="content-grid">
          <section class="chat-panel">
            <div class="channel-toolbar">
              <div class="channel-title-group">
                <div class="channel-symbol">#</div>
                <div class="channel-title-copy"><h2>phòng-chung</h2><p>Nơi mọi người trò chuyện</p></div>
              </div>
              <div class="channel-tools"><button class="icon-button" type="button"></button></div>
            </div>
            <div class="messages-area">
              <article class="message-row">
                <div class="message-content">
                  <div class="message-meta">
                    <span class="message-name">Mèo</span>
                    <time class="message-time">12:00</time>
                    <div class="message-actions">
                      <button class="message-more" type="button"></button>
                      <div class="message-menu" hidden>
                        <button class="message-menu-item" type="button"></button>
                      </div>
                    </div>
                  </div>
                  <div class="message-bubble">Xin chào</div>
                </div>
              </article>
            </div>
            <div class="composer-wrap">
              <div class="composer-box">
                <textarea id="messageInput"></textarea>
                <button class="attach-button" type="button"></button>
                <button class="send-button" type="button"></button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  </div>`;

const q = (selector) => document.querySelector(selector);
const phone = { width: 390, touch: true };
const tablet = { width: 820, touch: true };
const desktop = { width: 1280, touch: false };

/* ── Điện thoại 390px ── */
check('390px · cỡ chữ tin nhắn', winner(q('.message-bubble'), 'font-size', phone).value, '15px');
check('390px · cỡ chữ tên', winner(q('.message-name'), 'font-size', phone).value, '13.5px');
check('390px · cỡ chữ ô soạn tin', winner(q('#messageInput'), 'font-size', phone).value, '16px');
check('390px · chiều cao mục menu', winner(q('.message-menu-item'), 'min-height', phone).value, '44px');
check('390px · nút ⋯ hiện', winner(q('.message-more'), 'opacity', phone).value, '1');
check('390px · nút gửi', winner(q('.send-button'), 'width', phone).value, '44px');
check('390px · chiều cao an toàn trên', winner(q('.main-layout'), 'padding-top', phone).value, 'var(--safe-top)');

/* ── iPad 820px (hover: none): ⋯ phải hiện, mục menu 44px ── */
check('820px · nút ⋯ hiện', winner(q('.message-more'), 'opacity', tablet).value, '1');
check('820px · chiều cao mục menu', winner(q('.message-menu-item'), 'min-height', tablet).value, '44px');

/* ── Desktop 1280px: không đổi so với thiết kế cũ ── */
check('1280px · cỡ chữ tin nhắn', winner(q('.message-bubble'), 'font-size', desktop).value, '13.5px');
check('1280px · nút ⋯ ẩn tới khi hover', winner(q('.message-more'), 'opacity', desktop).value, '0');
check('1280px · mục menu gọn', winner(q('.message-menu-item'), 'min-height', desktop).value, '32px');

/* ── Giao diện app riêng cho điện thoại (mobile-app.css) ── */
check('mobile-app.css phải nạp cuối cùng', cssFiles.at(-1), 'assets/css/mobile-app.css');

const mobileAppCss = readFileSync(path.join(ROOT, 'assets/css/mobile-app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const mobileSelectors = [];
const preludes = [];
let buffer = '';
for (const char of mobileAppCss) {
  if (char === '{') {
    preludes.push(buffer.trim());
    buffer = '';
  } else if (char === '}') {
    const prelude = preludes.pop();
    const insideKeyframes = preludes.some((item) => item.startsWith('@keyframes'));
    if (prelude && !prelude.startsWith('@') && !insideKeyframes) mobileSelectors.push(prelude);
    buffer = '';
  } else if (char === ';') {
    if (!preludes.length) buffer = '';
  } else {
    buffer += char;
  }
}
// Chỉ chấp nhận hai phạm vi: riêng giao diện mobile, hoặc riêng phần KHÔNG phải mobile
// (dùng để ẩn khung mới trên máy tính).
const MOBILE_SCOPES = ['html[data-ui="mobile"]', 'html:not([data-ui="mobile"])'];
const unscoped = mobileSelectors
  .flatMap((selector) => selector.split(',').map((part) => part.trim()))
  .filter((selector) => selector && !MOBILE_SCOPES.some((scope) => selector.startsWith(scope)));
check('mobile-app.css có luật không phải html[data-ui="mobile"]', unscoped.slice(0, 5).join(' | '), '');
check('mobile-app.css quá ngắn (thiếu bố cục mobile)', mobileSelectors.length > 40, true);

/* Dựng thêm khung mobile lấy nguyên từ index.html rồi kiểm ở chế độ mobile. */
const shellStart = html.indexOf('<div class="mobile-scrim"');
const shellEnd = html.indexOf('<div class="toast-region"');
check('index.html thiếu khung #mobileScrim/#mobileTabbar', shellStart > 0 && shellEnd > shellStart, true);
if (shellStart > 0 && shellEnd > shellStart) {
  document.body.insertAdjacentHTML('beforeend', html.slice(shellStart, shellEnd));
  document.documentElement.dataset.ui = 'mobile';

  check('mobile · thanh tab hiện', winner(q('#mobileTabbar'), 'display', phone).value, 'grid');
  check('mobile · thanh trên kiểu máy tính ẩn', winner(q('.topbar'), 'display', phone).value, 'none');
  check('mobile · thanh tab cao 58px', winner(q('#mobileTabbar'), 'height', phone).value, 'var(--tabbar-total)');
  check('mobile · chat chừa chỗ cho thanh tab', winner(q('.chat-panel'), 'padding-bottom', phone).value, 'var(--tabbar-total)');
  check('mobile · thanh kênh dính đỉnh', winner(q('.channel-toolbar'), 'position', phone).value, 'sticky');
  check('mobile · ngăn kéo kênh cố định', winner(q('.sidebar'), 'position', phone).value, 'fixed');
  check('mobile · ngăn kéo trượt khỏi màn hình', winner(q('.sidebar'), 'transform', phone).value, 'translateX(-102%)');
  check('mobile · chữ tin nhắn vẫn 15px', winner(q('.message-bubble'), 'font-size', phone).value, '15px');
  check('mobile · ô soạn tin vẫn 16px', winner(q('#messageInput'), 'font-size', phone).value, '16px');
  check('mobile · bảng cài đặt có nút Giao diện', Boolean(html.includes('data-mobile-action="theme"')), true);

  /* ── Ngăn kéo kênh: phải nhìn thấy, bấm được và nằm TRÊN lớp mờ ── */
  check('mobile · chiều rộng ngăn kéo', winner(q('.sidebar'), 'width', phone).value, 'min(330px, 86vw)');
  check('mobile · ngăn kéo ẩn khi chưa mở', winner(q('.sidebar'), 'visibility', phone).value, 'hidden');
  check('mobile · ngăn kéo đóng thì trượt ra ngoài', winner(q('.sidebar'), 'transform', phone).value, 'translateX(-102%)');
  check('mobile · danh sách điều hướng dạng cột', winner(q('.side-nav'), 'display', phone).value, 'grid');
  check('mobile · logo hiện lại trong ngăn kéo', winner(q('.brand-lockup'), 'display', phone).value, 'flex');
  check('mobile · đầu ngăn kéo hiện', winner(q('.sidebar-drawer-head'), 'display', phone).value, 'flex');
  check('mobile · ô tìm kênh 16px (iOS không tự phóng to)', winner(q('#mobileChannelFilter'), 'font-size', phone).value, '16px');
  check('mobile · đầu ngăn kéo dính đỉnh', winner(q('.sidebar-drawer-head'), 'position', phone).value, 'sticky');
  check('mobile · hồ sơ bám đáy', winner(q('.profile-chip'), 'position', phone).value, 'sticky');
  check('mobile · app-view không còn animation (tránh stacking context)', winner(q('.app-view'), 'animation', phone).value, 'none');

  /* Xếp lớp: lớp mờ phải nằm trên thanh tab nhưng DƯỚI ngăn kéo. */
  const zIndexOf = (selector) => winner(q(selector), 'z-index', phone).value;
  const scrimZ = Number(zIndexOf('#mobileScrim'));
  const drawerZ = Number(zIndexOf('.sidebar'));
  const tabbarZ = Number(zIndexOf('#mobileTabbar'));
  const sheetZ = Number(zIndexOf('#mobileSettingsSheet'));
  check('lớp mờ phải trên thanh tab', scrimZ > tabbarZ, true);
  check('ngăn kéo phải trên lớp mờ (lỗi "bấm Kênh bị mờ")', drawerZ > scrimZ, true);
  check('bảng cài đặt phải trên lớp mờ', sheetZ > scrimZ, true);
  check('lớp mờ không được blur nội dung', /\.mobile-scrim\s*\{[^}]*backdrop-filter/.test(mobileAppCss), false);

  /* Mở ngăn kéo: hiện ra và trượt vào trong khung hình. */
  document.documentElement.dataset.mobileSheet = 'channels';
  check('mobile · mở ngăn kéo thì hiện', winner(q('.sidebar'), 'visibility', phone).value, 'visible');
  check('mobile · mở ngăn kéo thì trượt vào', winner(q('.sidebar'), 'transform', phone).value, 'translateX(0)');
  check('mobile · mở ngăn kéo có transition', winner(q('.sidebar'), 'transition-delay', phone).value, '0s, 0s');

  /* Bàn phím ảo mở (mobile.css ẩn thanh dưới đáy) không được làm ngăn kéo biến mất,
     nếu không người dùng đang gõ ô tìm kênh sẽ thấy ngăn kéo “bốc hơi”. */
  document.documentElement.classList.add('is-keyboard-open');
  check('mobile · bàn phím mở vẫn thấy ngăn kéo', winner(q('.sidebar'), 'opacity', phone).value, '1');
  check('mobile · bàn phím mở vẫn bấm được ngăn kéo', winner(q('.sidebar'), 'pointer-events', phone).value, 'auto');
  check('mobile · ngăn kéo cao theo vùng nhìn thấy', winner(q('.sidebar'), 'height', phone).value, 'var(--app-vh, 100dvh)');
  document.documentElement.classList.remove('is-keyboard-open');

  document.documentElement.removeAttribute('data-mobile-sheet');

  document.documentElement.removeAttribute('data-ui');
  check('desktop · ẩn đầu ngăn kéo', winner(q('.sidebar-drawer-head'), 'display', desktop).value, 'none');
  check('desktop · ẩn ô tìm kênh', winner(q('.drawer-filter'), 'display', desktop).value, 'none');
  const desktopTab = winner(q('#mobileTabbar'), 'display', desktop);
  check('desktop · thanh tab dính luật mobile', desktopTab.selector.startsWith('html[data-ui="mobile"]'), false);
  const desktopAppBar = winner(q('.channel-toolbar'), 'position', desktop);
  check('desktop · thanh kênh dính luật mobile', desktopAppBar.selector.startsWith('html[data-ui="mobile"]'), false);
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi cascade mobile:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  dom.window.close();
  process.exit(1);
}
console.log(`✓ Cascade mobile đạt (${cssFiles.length} tệp CSS, 3 khổ màn hình).`);
dom.window.close();
