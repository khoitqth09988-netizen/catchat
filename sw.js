/* CatChat · Service Worker (PWA)
   Mục tiêu: mở app nhanh, xem được khung chat khi mạng chập chờn, và luôn nhận
   bản mới sau khi deploy. Không cache dữ liệu Firebase — dữ liệu thật do SDK lo.

   - Trang (navigation): network-first CÓ GIỚI HẠN THỜI GIAN ⇒ bản mới lên ngay khi mạng
     tốt; mạng yếu (3G chập chờn) mà quá NETWORK_TIMEOUT thì trả bản trong cache để app
     mở được, đồng thời vẫn cập nhật cache khi mạng về.
   - JS/CSS: network-first (tên tệp không có hash ⇒ phải luôn lấy bản mới), quá hạn thì
     dùng cache; offline hoàn toàn cũng dùng cache.
   - Ảnh/icon/font cùng tên miền: stale-while-revalidate.
   - Google Fonts (fonts.googleapis.com + fonts.gstatic.com): cache lại để lần mở sau
     không phải chờ mạng và vẫn giữ đúng kiểu chữ khi ngoại tuyến.
   - Mọi tên miền khác (Firebase RTDB/Auth/Storage): đi thẳng ra mạng.

   Khi deploy thay đổi lớn, tăng VERSION để xoá cache cũ. */
'use strict';

const VERSION = 'catchat-v9';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
/* Mạng yếu: chờ mạng tối đa chừng này rồi dùng bản trong cache cho kịp mở app.
   Mạng tốt thì luôn thắng vì phản hồi về trước timeout. */
const NETWORK_TIMEOUT = 3200;

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

/* Chờ một promise tối đa `ms`; hết giờ thì trả null (không ném lỗi). */
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); }
    );
  });
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

const OFFLINE_HTML = '<!doctype html><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<title>CatChat · ngoại tuyến</title>'
  + '<body style="font-family:system-ui;padding:32px;background:#161219;color:#f6f1ea">'
  + '<h1>Đang ngoại tuyến 🐾</h1>'
  + '<p>CatChat cần mạng để đồng bộ tin nhắn. Kết nối lại rồi mở lại trang nhé.</p>'
  // Không dùng onclick: CSP của CatChat chặn script/handler nội tuyến.
  + '<p><a href="./" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#d5763c;color:#1a1b1f;text-decoration:none;font-weight:700">Thử lại</a></p>'
  + '</body>';

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  const network = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put('./index.html', response.clone()).catch(() => {});
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);
  const cached = (await cache.match(request, { ignoreSearch: true }))
    || (await cache.match('./index.html'))
    || (await cache.match('./'));
  const fresh = await withTimeout(network, NETWORK_TIMEOUT);
  if (fresh) return fresh;
  if (cached) {
    // Mạng còn đang chờ: cứ trả cache, khi mạng về thì cache đã được cập nhật.
    network.catch(() => {});
    return cached;
  }
  const late = await network;
  if (late) return late;
  return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function isCodeRequest(url) {
  return url.pathname.includes('/assets/') && /\.(?:js|css)$/.test(url.pathname);
}

async function networkFirstAsset(request) {
  const cache = await caches.open(RUNTIME);
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  const cached = await cache.match(request);
  const fresh = await withTimeout(network, NETWORK_TIMEOUT);
  if (fresh) return fresh;
  if (cached) return cached;
  const late = await network;
  if (late) return late;
  return Response.error();
}

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const MAX_FONT_ENTRIES = 24;

/* Google Fonts: trả cache ngay (mở app nhanh, dùng được offline) và cập nhật ngầm.
   Chỉ giữ tối đa MAX_FONT_ENTRIES mục để cache không phình theo thời gian. */
async function fontFirst(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone()).catch(() => {});
      const keys = await cache.keys();
      const fonts = keys.filter((key) => FONT_HOSTS.has(new URL(key.url).hostname));
      if (fonts.length > MAX_FONT_ENTRIES) {
        await Promise.all(fonts.slice(0, fonts.length - MAX_FONT_ENTRIES).map((key) => cache.delete(key)));
      }
    }
    return response;
  }).catch(() => null);
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const fresh = await network;
  return fresh || Response.error();
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
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(fontFirst(request));
    return;
  }
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
