/* CatChat · Feature: tên hiển thị là duy nhất (không ai trùng tên người khác).
   Cách làm: mỗi tên được "giữ chỗ" bằng một khoá đã chuẩn hoá trong /displayNames.

     /displayNames/<slug> = "<uid>"      // slug: chữ thường, bỏ dấu, gạch ngang

   Ví dụ “Mèo Con”, “mèo con”, “MEO-CON” đều ra slug `meo-con` → chỉ một người giữ được.
   Việc giữ chỗ dùng transaction nên hai người bấm đăng ký cùng lúc cũng chỉ một người thắng.

   Rules đi kèm (database.rules.json / database.rules.strict.json):

     "displayNames": {
       ".read": "auth != null",
       "$slug": {
         ".write": "auth != null && newData.val() === auth.uid && (!data.exists() || data.val() === auth.uid)",
         ".validate": "!newData.exists() || newData.val() === auth.uid"
       }
     }

   Lưu ý: Rules không chuẩn hoá được chuỗi, nên khoá slug do trình duyệt tính. Đây là lớp
   chặn trùng tên ở luồng đăng ký/đăng nhập bình thường; kẻ sửa dữ liệu thủ công vẫn cần
   Cloud Function hoặc Rules chặt hơn mới chặn tuyệt đối.

   ── Tên kiểu “admin” là tên DÙNG CHUNG, không phải tên dành riêng ──────────
   Ai cũng có thể đặt tên hiển thị là “admin”, “quản trị”, “root”… (ví dụ để thử nghiệm).
   Những tên này KHÔNG chiếm khoá duy nhất trong /displayNames, nên nhiều người cùng dùng
   được và tài khoản quản trị thật không bị mất tên. Để không ai nhầm lẫn, danh sách thành
   viên và tên dưới mỗi tin nhắn hiện thêm nhãn:
     · “Quản trị viên” — uid có trong /adminBadges (chỉ quản trị ghi được, xem Rules);
     · “Thành viên”    — người dùng tên kiểu admin nhưng không phải quản trị.
   Nhãn dựa trên quyền thật, KHÔNG dựa vào chữ trong tên, nên không thể giả bằng cách đổi tên. */

'use strict';

(() => {
  const NODE = 'displayNames';
  const MAX_SLUG = 40;
  // Tên kiểu quản trị: dùng chung cho mọi người, không chiếm khoá duy nhất.
  const SHARED_SLUGS = new Set(['admin', 'administrator', 'quantri', 'root', 'system']);
  let adminNamesCache = { slugs: new Set(), at: 0 };
  const ADMIN_NAMES_TTL = 60 * 1000;

  let allNamesPromise = null;

  function resolveDb() {
    if (typeof database !== 'undefined' && database) return database;
    if (window.firebase?.apps?.length) return firebase.database();
    return null;
  }

  /** Chuẩn hoá tên thành khoá so sánh: "Mèo  Con 🐱" → "meo-con". */
  function slugFor(value) {
    const raw = String(value || '').trim().toLocaleLowerCase('vi');
    if (!raw) return '';
    const ascii = raw.replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return ascii
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG)
      .replace(/-+$/g, '');
  }

  /** Slug của các tên thuộc “gia đình quản trị” đang có trong hệ thống
      (lấy từ ADMIN_EMAILS + tên của các uid trong /admins). Chỉ dùng để nhận biết
      một tên là tên kiểu admin, KHÔNG dùng để chặn ai. */
  async function adminFamilySlugs() {
    const slugs = new Set(SHARED_SLUGS);
    try {
      (Array.isArray(window.ADMIN_EMAILS) ? window.ADMIN_EMAILS : []).forEach((email) => {
        const slug = slugFor(String(email || '').split('@')[0]);
        if (slug) slugs.add(slug);
      });
    } catch (error) { /* không có danh sách email thì dùng danh sách mặc định */ }
    if (Date.now() - adminNamesCache.at < ADMIN_NAMES_TTL) {
      adminNamesCache.slugs.forEach((slug) => slugs.add(slug));
      return slugs;
    }
    const db = resolveDb();
    if (db) {
      try {
        const admins = (await db.ref('admins').once('value')).val() || {};
        const uids = Object.keys(admins).filter((uid) => admins[uid] === true);
        const names = await Promise.all(uids.map((uid) => db.ref(`members/${uid}/name`).once('value')
          .then((snap) => String(snap.val() || ''))
          .catch(() => '')));
        names.forEach((name) => {
          const slug = slugFor(name);
          if (slug) slugs.add(slug);
        });
      } catch (error) {
        // Chưa đọc được /admins (người xem không phải quản trị): vẫn đủ danh sách mặc định.
      }
    }
    adminNamesCache = { slugs, at: Date.now() };
    return slugs;
  }

  /** Tên này có phải kiểu “admin” không? (luôn trả Promise để nơi gọi dùng thống nhất) */
  async function isShared(name) {
    const slug = slugFor(name);
    if (!slug) return false;
    if (SHARED_SLUGS.has(slug)) return true;
    if (Date.now() - adminNamesCache.at < ADMIN_NAMES_TTL && adminNamesCache.slugs.has(slug)) return true;
    const slugs = await adminFamilySlugs();
    return slugs.has(slug);
  }

  /** Bản đồng bộ của isShared: dùng cache (và danh sách mặc định) để vẽ nhãn ngay,
      không phải chờ Promise trong lúc render danh sách tin nhắn/thành viên. */
  function isSharedSync(name) {
    const slug = slugFor(name);
    if (!slug) return false;
    if (SHARED_SLUGS.has(slug)) return true;
    if (adminNamesCache.slugs.has(slug)) return true;
    try {
      return (Array.isArray(window.ADMIN_EMAILS) ? window.ADMIN_EMAILS : [])
        .some((email) => slugFor(String(email || '').split('@')[0]) === slug);
    } catch (error) {
      return false;
    }
  }

  /** Bí danh cũ (đợt trước dùng để CHẶN tên quản trị). Nay là tên dùng chung ⇒ luôn false. */
  const isReserved = () => Promise.resolve(false);

  /** Đang đăng nhập bằng tài khoản quản trị (email trong ADMIN_EMAILS hoặc /admins) */
  function callerIsAdmin() {
    const user = window.firebase?.auth?.().currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    if (!user) return false;
    const email = String(user.email || '').trim().toLocaleLowerCase('en');
    const emails = Array.isArray(window.ADMIN_EMAILS) ? window.ADMIN_EMAILS : [];
    if (email && emails.includes(email)) return true;
    if (typeof hasAdminMarker !== 'undefined' && hasAdminMarker === true) return true;
    if (typeof hasAdminClaim !== 'undefined' && hasAdminClaim === true) return true;
    if (typeof isAdmin !== 'undefined' && isAdmin === true && typeof currentUser !== 'undefined' && currentUser?.uid === user.uid) return true;
    return false;
  }

  /**
   * Giữ chỗ tên cho một uid.
   * Trả về { ok, slug, shared?, taken?, skipped?, unknown? }.
   *   ok:true  + shared:true   → tên kiểu admin, ai cũng dùng được, không chiếm khoá.
   *   ok:false + taken:true    → tên đã có người dùng, phải chọn tên khác.
   *   ok:true  + unknown:true  → chưa đọc/ghi được (Rules cũ), không chặn người dùng.
   */
  async function claim(uid, name) {
    const slug = slugFor(name);
    if (!uid || !slug) return { ok: true, slug, skipped: true };
    // Tên kiểu “admin”: dùng chung (nhiều người cùng tên), nhãn quyền hạn lo phần phân biệt.
    if (SHARED_SLUGS.has(slug) || await isShared(name)) return { ok: true, slug, shared: true, skipped: true };
    const db = resolveDb();
    if (!db) return { ok: true, slug, skipped: true };
    try {
      const result = await db.ref(`${NODE}/${slug}`).transaction((current) => {
        if (current === null || current === undefined) return uid;
        return current === uid ? uid : undefined; // undefined = huỷ transaction
      });
      if (result.committed && result.snapshot.val() === uid) return { ok: true, slug };
      return { ok: false, slug, taken: true };
    } catch (error) {
      // Thiếu node /displayNames trong Rules thì không được chặn đăng nhập của mọi người.
      console.warn('Chưa kiểm tra được tên trùng (cần node /displayNames trong Rules):', error?.message || error);
      return { ok: true, slug, unknown: true };
    }
  }

  /** Bỏ giữ chỗ (chỉ khi chính uid đang giữ). Dùng khi đổi tên hoặc xoá tài khoản,
      nếu không tên cũ bị khoá vĩnh viễn cho người đã rời tổ mèo. */
  async function release(uid, name) {
    const slug = slugFor(name);
    const db = resolveDb();
    if (!db || !uid || !slug) return false;
    try {
      const result = await db.ref(`${NODE}/${slug}`).transaction((current) => (current === uid ? null : undefined));
      return Boolean(result.committed);
    } catch (error) {
      console.warn('Không bỏ được giữ chỗ tên:', error?.message || error);
      return false;
    }
  }

  /** Ai đang giữ tên này? '' nếu còn trống. */
  async function holderOf(name) {
    const slug = slugFor(name);
    const db = resolveDb();
    if (!db || !slug) return '';
    try {
      const value = await db.ref(`${NODE}/${slug}`).once('value');
      return String(value.val() || '');
    } catch (error) {
      console.warn('Không đọc được /displayNames:', error?.message || error);
      return '';
    }
  }

  /** Dọn các khoá cũ của chính uid (khi tên đổi, khoá cũ không nên giữ chỗ nữa). */
  async function forgetOtherSlugs(uid, keepSlug) {
    const db = resolveDb();
    if (!db || !uid) return;
    try {
      if (!allNamesPromise) allNamesPromise = db.ref(NODE).once('value').then((snap) => snap.val() || {});
      const all = await allNamesPromise;
      const stale = Object.keys(all || {}).filter((slug) => all[slug] === uid && slug !== keepSlug);
      await Promise.allSettled(stale.map((slug) => db.ref(`${NODE}/${slug}`).remove()));
    } catch (error) {
      console.warn('Không dọn được khoá tên cũ:', error?.message || error);
    }
  }

  /**
   * Dùng khi đăng nhập: giữ chỗ tên hiện tại cho uid + dọn khoá cũ.
   * Trả về { ok, slug, taken?, holder?, unknown? }.
   */
  async function ensure(uid, name) {
    const result = await claim(uid, name);
    if (result.ok && !result.skipped && !result.unknown) void forgetOtherSlugs(uid, result.slug);
    if (!result.ok) result.holder = await holderOf(name);
    return result;
  }

  /** Gợi ý tên chưa ai dùng: "Mèo Con" → "Mèo Con 2", "Mèo Con 3"… */
  async function suggest(name, limit = 5) {
    const base = String(name || '').trim().slice(0, 28);
    for (let index = 2; index <= limit + 1; index += 1) {
      const candidate = `${base} ${index}`;
      const holder = await holderOf(candidate);
      if (!holder) return candidate;
    }
    return `${base} ${Math.floor(Math.random() * 900 + 100)}`.slice(0, 32);
  }

  function resetCache() {
    allNamesPromise = null;
  }

  window.CatChat = window.CatChat || {};
  window.CatChat.names = {
    slugFor,
    claim,
    release,
    holderOf,
    ensure,
    suggest,
    isShared,
    isSharedSync,
    isReserved,
    adminFamilySlugs,
    callerIsAdmin,
    resetCache
  };
})();
