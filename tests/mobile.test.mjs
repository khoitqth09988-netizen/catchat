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
      <aside class="sidebar"></aside>
      <div class="main-layout">
        <header class="topbar"></header>
        <main class="content-grid">
          <section class="chat-panel">
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

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi cascade mobile:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  dom.window.close();
  process.exit(1);
}
console.log(`✓ Cascade mobile đạt (${cssFiles.length} tệp CSS, 3 khổ màn hình).`);
dom.window.close();
