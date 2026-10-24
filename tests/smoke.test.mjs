#!/usr/bin/env node
/* CatChat · smoke test giao diện bằng jsdom (không cần trình duyệt, không cần Firebase thật).
   Chạy: node tests/smoke.test.mjs

   Dựng lại index.html trong bộ nhớ: bỏ CSP/font Google, thay mọi <script src> và
   <link rel="stylesheet"> bằng nội dung thật, cắm một Firebase giả (không có Storage
   để kiểm luôn chế độ "gói miễn phí"). Sau đó kiểm:
   - menu ⋯: đúng thứ tự meta, đủ mục, mở/đóng, Esc, phân quyền admin/thường;
   - chế độ không Storage: nút đính kèm chuyển sang dán liên kết, gửi tin kèm imageURL;
   - không có lỗi runtime. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (name, condition, extra = '') => {
  if (!condition) failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
};

const FIREBASE_STUB = `<script>
  window.__errors = [];
  window.__writes = [];
  window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
  const DB = window.__db = { data: {}, listeners: [] };
  const clone = (value) => (value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)));
  const getAt = (p) => String(p).split('/').filter(Boolean).reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), DB.data);
  function setAt(p, value) {
    const parts = String(p).split('/').filter(Boolean);
    let node = DB.data;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    if (value === null || value === undefined) delete node[parts[parts.length - 1]];
    else node[parts[parts.length - 1]] = clone(value);
    window.__writes.push({ path: String(p), value: clone(value) });
    DB.listeners.forEach((listener) => {
      if (String(p) === listener.path || String(p).startsWith(listener.path + '/')) listener.fire();
    });
  }
  class Snapshot {
    constructor(value) { this._value = value === undefined ? null : clone(value); }
    val() { return this._value; }
    exists() { return this._value !== null && this._value !== undefined; }
    numChildren() { return this._value && typeof this._value === 'object' ? Object.keys(this._value).length : 0; }
    forEach(cb) {
      if (!this._value || typeof this._value !== 'object') return false;
      for (const key of Object.keys(this._value)) {
        if (cb({ key, val: () => new Snapshot(this._value[key]).val() }) === true) return true;
      }
      return false;
    }
    child(key) { return new Snapshot(this._value ? this._value[key] : null); }
  }
  class Ref {
    constructor(p) { this.path = String(p).replace(/^\\/+|\\/+$/g, ''); }
    child(key) { return new Ref(this.path ? this.path + '/' + key : String(key)); }
    orderByChild() { return this; }
    limitToLast() { return this; }
    endAt() { return this; }
    once() { return Promise.resolve(new Snapshot(getAt(this.path))); }
    on(event, cb) {
      const record = { path: this.path, fire: () => { try { cb(new Snapshot(getAt(this.path))); } catch (error) { window.__errors.push(error.message); } } };
      DB.listeners.push(record);
      return cb;
    }
    off() {}
    set(value) { setAt(this.path, value); return Promise.resolve(); }
    update(value) { setAt(this.path, Object.assign({}, getAt(this.path) || {}, value)); return Promise.resolve(); }
    remove() { setAt(this.path, null); return Promise.resolve(); }
    push(value) {
      const key = 'k' + Math.random().toString(36).slice(2, 8);
      setAt((this.path ? this.path + '/' : '') + key, value);
      return { key, then: (fn) => Promise.resolve().then(fn) };
    }
    transaction(fn) {
      const current = getAt(this.path);
      const next = fn(current === undefined ? null : clone(current));
      if (next === undefined) return Promise.resolve({ committed: false, snapshot: new Snapshot(current) });
      setAt(this.path, next);
      return Promise.resolve({ committed: true, snapshot: new Snapshot(next) });
    }
  }
  const authStub = {
    currentUser: null,
    onAuthStateChanged() { return () => {}; },
    onIdTokenChanged() { return () => {}; },
    signInWithEmailAndPassword() { return Promise.reject(new Error('stub')); },
    createUserWithEmailAndPassword() { return Promise.resolve({ user: { uid: 'new' } }); },
    signOut() { return Promise.resolve(); },
    sendPasswordResetEmail() { return Promise.resolve(); },
    setPersistence() { return Promise.resolve(); }
  };
  // KHÔNG có storage: mô phỏng đúng tình huống gói miễn phí chưa bật Firebase Storage.
  window.firebase = {
    apps: [{}],
    app: () => ({ functions: () => ({ httpsCallable: () => () => Promise.reject(new Error('stub')) }) }),
    initializeApp() {},
    auth: Object.assign(() => authStub, { Auth: { Persistence: { LOCAL: 'local' } } }),
    database: Object.assign(() => ({ ref: (p) => new Ref(p) }), { ServerValue: { TIMESTAMP: 1 } }),
    analytics: null
  };
</script>`;

function buildDom() {
  let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/i, '');
  html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/gi, '');
  html = html.replace(
    /<script defer src="assets\/js\/app\/config\.js"><\/script>/,
    `${FIREBASE_STUB}\n  <script defer src="assets/js/app/config.js"></script>`
  );
  html = html.replace(/<script defer src="(assets\/js\/[^"]+)"><\/script>/g, (_, src) => {
    const code = readFileSync(path.join(ROOT, src), 'utf8').replace(/<\/script>/g, '<\\/script>');
    return `<script>/* ${src} */\n${code}\n</script>`;
  });
  html = html.replace(/<script[^>]*src="https?:[^"]*"[^>]*><\/script>/g, '');
  html = html.replace(/<link rel="stylesheet" href="(assets\/css\/[^"]+)">/g, (_, href) => {
    const css = readFileSync(path.join(ROOT, href), 'utf8');
    return `<style>/* ${href} */\n${css}</style>`;
  });

  const virtualConsole = new VirtualConsole();
  const consoleErrors = [];
  virtualConsole.on('jsdomError', (error) => consoleErrors.push(String(error.message || error)));
  virtualConsole.on('error', (...args) => consoleErrors.push(args.join(' ')));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/',
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = (query) => ({
        matches: /hover: hover/.test(query), media: query,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
      });
      window.scrollTo = () => {};
      window.Element.prototype.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      window.prompt = () => window.__promptAnswer ?? null;
    }
  });
  return { dom, window: dom.window, doc: dom.window.document, errors: consoleErrors };
}

const { dom, window, doc, errors } = buildDom();
const doc_ = doc;
await new Promise((resolve) => setTimeout(resolve, 700));

window.eval(`
  currentUser = { uid: 'u1', displayName: 'admin', email: 'admin@com.vn' };
  members = { u1: { uid: 'u1', name: 'admin' }, u2: { uid: 'u2', name: 'Mèo' } };
  isAdmin = true; pins = {}; messageReactions = {};
  messages = new Map([
    ['m1', { uid: 'u1', name: 'admin', text: '?', kind: 'message', timestamp: Date.now() }],
    ['m2', { uid: 'u2', name: 'Mèo', text: 'chào', kind: 'message', timestamp: Date.now() + 1, replyTo: 'm1', replyName: 'admin', replyText: '?' }],
    ['a1', { uid: 'u1', name: 'admin', text: 'Thông báo', kind: 'announcement', timestamp: Date.now() + 2 }]
  ]);
  renderAllMessages(true);
`);

/* ── 1. Cấu trúc menu ⋯ ─────────────────────────────────────── */
const row = doc.querySelector('#chatMessages .message-row');
const meta = row.querySelector('.message-meta');
const metaKids = [...meta.children].map((el) => el.className);
check('hàng meta sai thứ tự', metaKids.join(',') === 'message-name,message-time,message-actions', metaKids.join(','));
check('thiếu nút ⋯', Boolean(meta.querySelector('.message-more')));
check('còn nút rời trên hàng meta', meta.querySelectorAll(':scope > button').length === 0);
check('menu phải đóng lúc đầu', meta.querySelector('.message-menu').hidden === true);

const labels = [...meta.querySelectorAll('.message-menu-label')].map((el) => el.textContent.trim());
for (const expected of ['Trả lời', 'Lưu tin nhắn', 'Sao chép nội dung', 'Sửa tin nhắn', 'Ghim tin nhắn', 'Xoá tin nhắn']) {
  check(`thiếu mục “${expected}”`, labels.includes(expected), labels.join(' | '));
}

/* ── 2. Mở/đóng menu ────────────────────────────────────────── */
const toggle = meta.querySelector('.message-more');
const menu = meta.querySelector('.message-menu');
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('bấm ⋯ không mở menu', menu.hidden === false && toggle.getAttribute('aria-expanded') === 'true');
check('menu chưa được đặt toạ độ', /px$/.test(menu.style.top) && /px$/.test(menu.style.left), `${menu.style.top}/${menu.style.left}`);
menu.querySelector('[data-reply-message]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('chọn mục xong menu chưa đóng', menu.hidden === true);
toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
check('Esc không đóng menu', menu.hidden === true);

/* ── 3. Thông báo toàn máy chủ ──────────────────────────────── */
const announcementMeta = doc.querySelector('.announcement-row .server-announcement-meta');
check('thông báo thiếu nút ⋯', Boolean(announcementMeta?.querySelector('.message-more')));
check('menu thông báo không ở cuối hàng', announcementMeta?.lastElementChild?.classList.contains('message-actions'));
const annLabels = [...announcementMeta.querySelectorAll('.message-menu-label')].map((el) => el.textContent.trim());
check('thông báo thiếu mục Sửa', annLabels.includes('Sửa thông báo'), annLabels.join(' | '));

/* ── 4. Chế độ không có Storage ─────────────────────────────── */
check('storageReady() phải false khi không có Storage', window.eval('storageReady()') === false);
window.eval('refreshMediaUi()');
const attachTitle = doc.querySelector('#attachImageButton')?.title || '';
check('nút đính kèm chưa đổi nhãn', attachTitle.includes('liên kết'), attachTitle);
check('nút đính kèm chưa có lớp is-link-only', doc.querySelector('#attachImageButton')?.classList.contains('is-link-only'));

window.__promptAnswer = 'https://example.com/meo.png';
window.eval('chooseAttachment()');
check('dán liên kết ảnh không lưu pendingImageUrl', window.eval('pendingImageUrl') === 'https://example.com/meo.png', String(window.eval('pendingImageUrl')));
check('không hiện khung xem trước ảnh', doc.querySelector('#pendingImagePreview').hidden === false);
check('nút Gửi vẫn bị khoá khi chỉ có ảnh', doc.querySelector('#sendButton').disabled === false);

window.eval('clearPendingImage()');
window.__promptAnswer = 'javascript:alert(1)';
window.eval('chooseAttachment()');
check('nhận liên kết không phải https', window.eval('pendingImageUrl') === '', String(window.eval('pendingImageUrl')));

/* ── 5. Gửi tin kèm ảnh liên kết (không upload) ─────────────── */
window.eval(`
  window.__promptAnswer = 'https://example.com/meo.png';
  chooseAttachment();
  messagesRef = database.ref('messages');
  activeChannelId = 'general';
  announcementMode = false;
`);
await window.eval('sendMessage({ preventDefault() {} })');
await new Promise((resolve) => setTimeout(resolve, 200));
const sent = Object.values(window.__db.data.messages || {}).find((entry) => entry && entry.imageURL);
check('không gửi được tin kèm ảnh liên kết', Boolean(sent), JSON.stringify(window.__db.data.messages || {}));
check('tin gửi thiếu imageURL', sent?.imageURL === 'https://example.com/meo.png', sent?.imageURL);
check('tin gửi sai tên tác giả', sent?.name === 'admin', sent?.name);
check('pendImageUrl chưa được xoá sau khi gửi', window.eval('pendingImageUrl') === '');

/* ── 6. Phân quyền thành viên thường ────────────────────────── */
window.eval(`
  currentUser = { uid: 'u2', displayName: 'Mèo', email: 'meo@x.vn' };
  isAdmin = false;
  renderAllMessages(true);
`);
const rows = [...doc.querySelectorAll('#chatMessages .message-row')];
const ownRow = rows.find((r) => r.classList.contains('mine'));
const otherRow = rows.find((r) => !r.classList.contains('mine') && r.querySelector('.message-meta'));
const labelsOf = (el) => [...el.querySelectorAll('.message-menu-label')].map((node) => node.textContent.trim());
const ownLabels = labelsOf(ownRow);
const otherLabels = labelsOf(otherRow);
check('thành viên thường thấy mục Ghim', !ownLabels.some((label) => label.includes('Ghim')), ownLabels.join(' | '));
check('chủ tin không có mục Sửa', ownLabels.includes('Sửa tin nhắn'), ownLabels.join(' | '));
check('chủ tin không có mục Xoá', ownLabels.some((label) => label.startsWith('Xoá')), ownLabels.join(' | '));
check('người khác thấy mục Sửa', !otherLabels.includes('Sửa tin nhắn'), otherLabels.join(' | '));
check('người khác thấy mục Xoá', !otherLabels.some((label) => label.startsWith('Xoá')), otherLabels.join(' | '));

/* ── 7. Không lỗi runtime ───────────────────────────────────── */
check('lỗi runtime trong app', (window.__errors || []).length === 0, JSON.stringify((window.__errors || []).slice(0, 2)));
check('lỗi jsdom', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`meta: ${metaKids.join(' → ')}`);
console.log(`mục menu (admin): ${labels.join(' | ')}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  dom.window.close();
  process.exit(1);
}
console.log(`\n✓ Smoke test đạt (${doc_ ? 'index.html' : 'index.html'}).`);
dom.window.close();
