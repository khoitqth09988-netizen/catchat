/* CatChat · Nhãn quyền hạn dưới tên hiển thị.
   Vì sao có: ai cũng có thể đặt tên hiển thị là “admin” (xem features/name-guard.js),
   nên chỉ nhìn chữ trong tên thì không biết ai thật sự có quyền quản trị. Tệp này giữ
   danh sách uid CÓ QUYỀN THẬT và cung cấp nhãn cho danh sách thành viên / tin nhắn:
     · “Quản trị” — uid có trong /adminBadges (hoặc chính người đang đăng nhập là admin);
     · “Thành viên” — người dùng tên kiểu admin nhưng không có quyền quản trị.

   Vì sao dùng node riêng /adminBadges thay vì đọc /admins: Rules của /admins chỉ cho
   quản trị đọc, nên thành viên thường không biết ai là admin. /adminBadges cho MỌI người
   đã đăng nhập đọc (chỉ đúng một cờ boolean), còn quyền ghi thì Rules giới hạn: mỗi
   người chỉ ghi được cờ của chính mình, và chỉ khi thật sự là admin.

     /adminBadges/<uid> = true

   Rules (database.rules.json):
     "adminBadges": {
       ".read": "auth != null",
       "$uid": {
         ".write": "auth != null && auth.uid === $uid && (root.child('admins').child(auth.uid).val() === true || auth.token.email === 'admin@com.vn' || auth.token.admin === true)",
         ".validate": "!newData.exists() || newData.isBoolean()"
       }
     }

   Không có node này (Rules cũ chưa dán) thì mọi thứ vẫn chạy: nhãn tự lấy từ chính tài
   khoản đang đăng nhập và từ tên kiểu admin đã biết. */
'use strict';

(() => {
  const NODE = 'adminBadges';

  const adminUids = new Set();
  let selfUid = '';
  let selfIsAdmin = false;
  let stopListener = null;
  let started = false;

  const resolveDb = () => {
    if (typeof database !== 'undefined' && database) return database;
    if (window.firebase?.apps?.length) return window.firebase.database();
    return null;
  };

  /** Tên này có thuộc “gia đình quản trị” không (đọc đồng bộ, dùng cache của name-guard). */
  function looksLikeAdminName(name) {
    const names = window.CatChat?.names;
    if (!names) return /^\s*(admin|root|system|quản\s*trị|quantri)\b/i.test(String(name || ''));
    try {
      if (typeof names.isSharedSync === 'function') return names.isSharedSync(name);
    } catch (error) { /* bỏ qua */ }
    const slug = names.slugFor ? names.slugFor(name) : String(name || '').trim().toLowerCase();
    return ['admin', 'administrator', 'quantri', 'root', 'system'].includes(slug);
  }

  /** uid này có quyền quản trị thật? */
  function isAdminUid(uid) {
    if (!uid) return false;
    if (uid === selfUid && selfIsAdmin) return true;
    return adminUids.has(uid);
  }

  /**
   * Nhãn cho một tên: '' (không cần nhãn), 'admin' hoặc 'member'.
   * Chỉ gắn nhãn khi tên trông giống tên quản trị — tên thường không cần phân biệt.
   */
  function tagFor(uid, name) {
    if (!looksLikeAdminName(name)) return '';
    return isAdminUid(uid) ? 'admin' : 'member';
  }

  function tagLabel(tag) {
    return tag === 'admin' ? 'Quản trị' : tag === 'member' ? 'Thành viên' : '';
  }

  /** Vẽ lại những nơi có hiện tên (đều là hàm có sẵn của app). */
  function repaint() {
    try { if (typeof renderAllMessages === 'function') renderAllMessages(false); } catch (error) { /* chưa đăng nhập */ }
    try { if (typeof renderDirectory === 'function') renderDirectory(); } catch (error) { /* bỏ qua */ }
    try { if (typeof renderMembers === 'function') renderMembers(); } catch (error) { /* bỏ qua */ }
  }

  /** Ghi cờ của chính mình khi đang là admin (Rules cho phép đúng trường hợp này). */
  async function syncSelf() {
    const user = window.firebase?.auth?.().currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    selfUid = String(user?.uid || '');
    selfIsAdmin = Boolean(typeof isAdmin !== 'undefined' && isAdmin) || window.CatChat?.names?.callerIsAdmin?.() === true;
    const db = resolveDb();
    if (!db || !selfUid || !selfIsAdmin) return false;
    if (adminUids.has(selfUid)) return true;
    try {
      await db.ref(`${NODE}/${selfUid}`).set(true);
      adminUids.add(selfUid);
      repaint();
      return true;
    } catch (error) {
      // Rules cũ chưa có node /adminBadges: không sao, nhãn vẫn đúng cho admin hiện tại.
      return false;
    }
  }

  function start() {
    if (started) return;
    started = true;
    const db = resolveDb();
    if (db) {
      const ref = db.ref(NODE);
      const handler = (snapshot) => {
        const value = snapshot.val() || {};
        adminUids.clear();
        Object.keys(value).forEach((uid) => { if (value[uid] === true) adminUids.add(uid); });
        if (selfUid && selfIsAdmin) adminUids.add(selfUid);
        repaint();
      };
      try {
        ref.on('value', handler, () => { /* chưa dán Rules mới: bỏ qua êm */ });
        stopListener = () => { try { ref.off('value', handler); } catch (error) { /* bỏ qua */ } };
      } catch (error) { /* bỏ qua */ }
    }
    // Đổi quyền admin (listener /admins về sau) ⇒ ghi cờ của mình + vẽ lại nhãn.
    window.addEventListener('catchat:admin-state', () => {
      if (!started) start();
      void syncSelf();
    });
    if (typeof isAdmin !== 'undefined' && isAdmin) void syncSelf();
  }

  // Chỉ chạy sau khi đã đăng nhập: lúc đó mới có `database` và có thành viên để gắn nhãn.
  // Sự kiện do channels.js phát ngay sau khi dựng xong listener dữ liệu.
  window.addEventListener('catchat:workspace-ready', () => {
    start();
    void syncSelf();
  }, { once: true });
  // Dự phòng khi mở app đã đăng nhập sẵn và sự kiện phát trước khi tệp này chạy.
  window.setTimeout(() => {
    const view = document.getElementById('appView');
    if (view && !view.hidden && !started) { start(); void syncSelf(); }
  }, 1500);

  window.CatChat = window.CatChat || {};
  window.CatChat.adminBadges = {
    start,
    syncSelf,
    repaint,
    tagFor,
    tagLabel,
    isAdminUid,
    known: () => Array.from(adminUids),
    stop() { if (stopListener) stopListener(); stopListener = null; started = false; }
  };
})();
