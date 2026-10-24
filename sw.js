/* CatChat · Service Worker (PWA)
   Mục tiêu: mở app nhanh, xem được khung chat khi mạng chập chờn, và luôn nhận
   bản mới sau khi deploy. Không cache dữ liệu Firebase — dữ liệu thật do SDK lo.

   - Trang (navigation): network-first ⇒ bản mới lên ngay, offline mới dùng cache.
   - JS/CSS: network-first (tên tệp không có hash ⇒ phải luôn lấy bản mới), offline dùng cache.
   - Ảnh/icon/font cùng tên miền: stale-while-revalidate.
   - Mọi tên miền khác (Firebase RTDB/Auth/Storage, Google Fonts): đi thẳng ra mạng.

   Khi deploy thay đổi lớn, tăng VERSION để xoá cache cũ. */
'use strict';

const VERSION = 'catchat-v4';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

/* Danh sách tĩnh tối thiểu; các tệp CSS/JS còn lại được lấy từ index.html
   ngay khi cài đặt nên không cần sửa tay mỗi lần thêm tệp. */
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

async function precache() {
  const cache = await caches.open(SHELL);
  await cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })));
  try {
    const response = await fetch('./index.html', { cache: 'reload' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put('./index.html', response);
    const assets = new Set();
    html.replace(/<link[^>]+href="(assets\/css\/[^"]+)"/g, (_, href) => assets.add(href));
    html.replace(/<script[^>]+src="(assets\/js\/[^"]+)"/g, (_, src) => assets.add(src));
    await Promise.all(Array.from(assets).map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (_) { /* một tệp lỗi không chặn cài đặt */ }
    }));
  } catch (_) { /* Offline lần đầu: bỏ qua, sẽ bổ sung ở lần tải sau */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put('./index.html', response.clone());
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (_) {
    const cached = (await cache.match(request, { ignoreSearch: true }))
      || (await cache.match('./index.html'))
      || (await cache.match('./'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>CatChat · ngoại tuyến</title><body style="font-family:system-ui;padding:32px;background:#161219;color:#f6f1ea">'
      + '<h1>Đang ngoại tuyến 🐾</h1><p>CatChat cần mạng để đồng bộ tin nhắn. Kết nối lại rồi mở lại trang nhé.</p></body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function isCodeRequest(url) {
  return url.pathname.includes('/assets/') && /\.(?:js|css)$/.test(url.pathname);
}

async function networkFirstAsset(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw _;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  return cached || network || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (isCodeRequest(url)) {
    event.respondWith(networkFirstAsset(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
