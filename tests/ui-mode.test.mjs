#!/usr/bin/env node
/* CatChat · Kiểm tra bộ nhận diện thiết bị (assets/js/app/ui-mode.js).
   Chạy: node tests/ui-mode.test.mjs

   Mục tiêu: điện thoại / máy tính bảng cảm ứng phải nhận data-ui="mobile" (giao
   diện app riêng), máy tính để bàn phải giữ data-ui="desktop" (giao diện cũ).
   Không cần trình duyệt: tệp ui-mode.js chỉ dùng window.innerWidth, matchMedia,
   navigator.maxTouchPoints và document.documentElement. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(ROOT, 'assets/js/app/ui-mode.js'), 'utf8');

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: nhận “${actual}”, mong đợi “${expected}”`);
};

/** Dựng một window giả rồi chạy ui-mode.js bên trong. */
function boot({ width, coarse = false, touchPoints = 0, search = '' }) {
  const root = {
    dataset: {},
    classList: {
      values: new Set(),
      toggle(name, on) { if (on) this.values.add(name); else this.values.delete(name); }
    }
  };
  const document = { documentElement: root };
  const window = {
    innerWidth: width,
    location: { search },
    navigator: { maxTouchPoints: touchPoints },
    matchMedia(query) {
      const matches =
        (query === '(pointer: coarse)' && coarse) ||
        (query === '(pointer: fine)' && !coarse) ||
        (query.startsWith('(max-width:') && width <= Number(query.match(/\d+/)?.[0] ?? 0));
      return { matches, media: query };
    },
    document
  };
  const run = new Function('window', 'document', source);
  run(window, document);
  return { api: window.CatChatUIMode, root };
}

const phone = { width: 390, coarse: true, touchPoints: 5 };
const smallPhone = { width: 360, coarse: true, touchPoints: 5 };
const tablet = { width: 1024, coarse: true, touchPoints: 5 };
const desktop = { width: 1280, coarse: false, touchPoints: 0 };
const laptopTouch = { width: 1100, coarse: false, touchPoints: 10 };
const narrowWindow = { width: 620, coarse: false, touchPoints: 0 };

check('điện thoại 390px', boot(phone).api.detect(windowless(phone)), 'mobile');
check('điện thoại nhỏ 360px', boot(smallPhone).root.dataset.ui, 'mobile');
check('iPad 1024px cảm ứng', boot(tablet).root.dataset.ui, 'mobile');
check('máy tính 1280px', boot(desktop).root.dataset.ui, 'desktop');
check('laptop cảm ứng 1100px', boot(laptopTouch).root.dataset.ui, 'desktop');
check('cửa sổ hẹp 620px', boot(narrowWindow).root.dataset.ui, 'mobile');
check('ép ?ui=desktop trên điện thoại', boot({ ...phone, search: '?ui=desktop' }).root.dataset.ui, 'desktop');
check('ép ?ui=mobile trên máy tính', boot({ ...desktop, search: '?ui=mobile' }).root.dataset.ui, 'mobile');
check('class ui-mobile được gắn', boot(phone).root.classList.values.has('ui-mobile'), true);
check('class ui-desktop được gắn', boot(desktop).root.classList.values.has('ui-desktop'), true);

/* detect() phải dùng được với một window khác (không chỉ window hiện tại). */
function windowless(env) {
  const { api } = boot(env);
  return {
    innerWidth: env.width,
    navigator: { maxTouchPoints: env.touchPoints },
    location: { search: '' },
    matchMedia: (query) =>
      ({ matches: query === '(pointer: coarse)' ? Boolean(env.coarse) : env.width <= Number(query.match(/\d+/)?.[0] ?? 0) })
  };
}
check('detect() nhận window truyền vào', boot(phone).api.detect(windowless(phone)), 'mobile');

if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi nhận diện thiết bị:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('✓ Nhận diện thiết bị đạt (điện thoại → mobile, máy tính → desktop).');
