/* CatChat · Khung dựng app trong bộ nhớ để kiểm thử (dùng chung cho smoke + flows).
   - Thay mọi <script src> và <link rel="stylesheet"> nội bộ bằng nội dung thật.
   - Cắm một Firebase giả (RTDB trong bộ nhớ, có listener đơn giản) và **không có Storage**
     để kiểm luôn chế độ "gói miễn phí".
   - Bỏ CSP và font Google (không có mạng trong CI).
   Trả về { dom, window, doc, errors, db } để test bấm/gõ như người dùng thật. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIREBASE_STUB = `<script>
  window.__errors = [];
  window.__writes = [];
  window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
  const DB = window.__db = { data: { '.info': { connected: true } }, listeners: [] };
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
      if (listener.active === false) return;
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
      // RTDB thật gọi listener ngay sau khi đăng ký với giá trị hiện có. Thiếu bước
      // này thì các luồng đọc dữ liệu có sẵn (danh sách kênh, thành viên, ghim…)
      // không bao giờ chạy trong test ⇒ test "xanh" mà thực tế chưa kiểm gì.
      window.setTimeout(() => { if (record.active !== false) record.fire(); }, 0);
      return cb;
    }
    off() {
      // Firebase: off() gỡ mọi listener của đúng đường dẫn này.
      DB.listeners.forEach((listener) => { if (listener.path === this.path) listener.active = false; });
    }
    onDisconnect() {
      // Firebase thật trả về một “OnDisconnect” có remove/set/cancel đều trả Promise.
      return { remove: () => Promise.resolve(), set: () => Promise.resolve(), cancel: () => Promise.resolve() };
    }
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
  const authListeners = [];
  window.__authListeners = authListeners;
  const authStub = {
    currentUser: null,
    onAuthStateChanged(cb) { if (typeof cb === 'function') authListeners.push(cb); return () => {}; },
    onIdTokenChanged() { return () => {}; },
    signInWithEmailAndPassword(email) {
      // displayName lấy từ phần trước @ giống tài khoản thật (admin@com.vn → “admin”).
      const user = { uid: 'u1', email, displayName: String(email || '').split('@')[0] || 'admin' };
      authStub.currentUser = user;
      authListeners.forEach((cb) => setTimeout(() => cb(user), 0));
      return Promise.resolve({ user });
    },
    createUserWithEmailAndPassword(email, password) {
      // Giống Firebase: tạo tài khoản mới, đặt làm currentUser, có delete/updateProfile.
      const user = {
        uid: 'new-' + String(email || 'user').split('@')[0],
        email: String(email || ''),
        displayName: '',
        photoURL: '',
        updateProfile: (patch) => { Object.assign(user, patch || {}); return Promise.resolve(); },
        delete: () => {
          authStub.currentUser = null;
          authListeners.forEach((cb) => setTimeout(() => cb(null), 0));
          return Promise.resolve();
        }
      };
      authStub.currentUser = user;
      window.__lastPassword = password;
      return Promise.resolve({ user });
    },
    signOut() {
      authStub.currentUser = null;
      authListeners.forEach((cb) => setTimeout(() => cb(null), 0));
      return Promise.resolve();
    },
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
  // Inline cả script không defer (ui-mode.js chạy ngay trong <head>) để kiểm tra
  // đúng đường tải trang thật.
  html = html.replace(/<script(?: defer)? src="(assets\/js\/[^"]+)"><\/script>/g, (_, src) => {
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

export function createApp({ url = 'https://example.test/', mobile = false } = {}) {
  let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/i, '');
  html = html.replace(/<link[^>]*fonts\.googleapis[^>]*>/gi, '');
  html = html.replace(
    /<script defer src="assets\/js\/app\/config\.js"><\/script>/,
    `${FIREBASE_STUB}\n  <script defer src="assets/js/app/config.js"></script>`
  );
  // Inline cả script không defer (ui-mode.js chạy ngay trong <head>).
  html = html.replace(/<script(?: defer)? src="(assets\/js\/[^"]+)"><\/script>/g, (_, src) => {
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
    url,
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = (query) => ({
        matches: mobile ? /hover: none|pointer: coarse|max-width/.test(query) : /hover: hover/.test(query),
        media: query,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
      });
      window.scrollTo = () => {};
      window.Element.prototype.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      window.prompt = () => window.__promptAnswer ?? null;
    }
  });
  const window_ = dom.window;
  // Phát sự kiện đăng nhập/đăng xuất đúng như Firebase thật để chạy trọn luồng khởi động.
  window_.__emitAuth = (user) => {
    window_.firebase.auth().currentUser = user;
    window_.eval('void 0');
    const listeners = window_.__authListeners || [];
    listeners.forEach((cb) => cb(user));
  };
  return { dom, window: window_, doc: window_.document, errors: consoleErrors, db: window_.__db };
}
