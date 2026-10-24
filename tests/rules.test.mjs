#!/usr/bin/env node
/* CatChat · mô phỏng Rules Realtime Database (không cần Firebase Emulator).
   Chạy: node tests/rules.test.mjs

   Cách làm: biểu thức Rules gần như JS thuần (&&, ||, ===, .val(), .child(), now, auth…),
   nên chỉ cần:
     1. đổi `$var` → `vars.var`,
     2. đổi `.val().length` → `.valLength()`,
     3. chạy bằng new Function với các tham số root/newData/data/now/auth/vars.
   Mục tiêu không phải mô phỏng 100% Firebase, mà là chốt các quy tắc quan trọng:
   không giả danh admin, không ghi tin người khác, không đẩy timestamp tương lai,
   adminLog chỉ ghi thêm, khách chưa đăng nhập không ghi được gì. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = JSON.parse(readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')).rules;
const NOW = 1_800_000_000_000;

class Node {
  constructor(value) { this._value = value ?? null; }
  child(key) { return new Node(this._value && typeof this._value === 'object' ? this._value[key] : null); }
  val() { return this._value; }
  valLength() { return typeof this._value === 'string' ? this._value.length : 0; }
  exists() { return this._value !== null && this._value !== undefined; }
  isString() { return typeof this._value === 'string'; }
  isNumber() { return typeof this._value === 'number' && Number.isFinite(this._value); }
  hasChildren(keys) {
    return Boolean(this._value) && typeof this._value === 'object'
      && keys.every((key) => this._value[key] !== null && this._value[key] !== undefined);
  }
}

const DB = {
  admins: { admin1: true },
  members: {
    u1: { uid: 'u1', name: 'Mèo con' },
    u2: { uid: 'u2', name: 'admin' },
    admin1: { uid: 'admin1', name: 'Quản trị' }
  },
  channels: { general: { name: 'general' }, k1: { name: 'k1' } },
  messages: { m1: { uid: 'u1', name: 'Mèo con', text: 'cũ', kind: 'message', timestamp: 1_700_000_000_000 } },
  channelMessages: { k1: { cm1: { uid: 'u1', name: 'Mèo con', text: 'cũ', kind: 'message', timestamp: 1_700_000_000_000 } } },
  adminLog: { log1: { type: 'edit', detail: 'x', adminUid: 'admin1', timestamp: 1_700_000_000_000 } }
};

const auth = (uid, email) => ({ uid, token: { email, admin: false } });
const AUTH_U1 = auth('u1', 'meo@x.vn');
const AUTH_U2 = auth('u2', 'ke@x.vn');
const AUTH_ADMIN = auth('admin1', 'admin@com.vn');

function evaluate(source, env) {
  let code = String(source);
  code = code.replace(/\$([A-Za-z0-9_]+)/g, 'vars.$1');
  code = code.replace(/\.val\(\)\.length/g, '.valLength()');
  let fn;
  try {
    fn = new Function('root', 'newData', 'data', 'now', 'auth', 'vars', `return Boolean(${code});`);
  } catch (error) {
    throw new Error(`Rules không dịch được: ${error.message}\n  ${source}`);
  }
  try {
    return fn(new Node(env.db ?? DB), new Node(env.new), new Node(env.old), env.now ?? NOW, env.auth, env.vars ?? {});
  } catch (_) {
    // Truy cập auth.uid khi chưa đăng nhập: Firebase coi biểu thức là sai, không phải lỗi.
    return false;
  }
}

/** Kiểm cả .write lẫn .validate của node. */
function allowed(node, env) {
  if (node['.write'] !== undefined && !evaluate(node['.write'], env)) return false;
  if (node['.validate'] !== undefined && !evaluate(node['.validate'], env)) return false;
  return true;
}

const MESSAGES = RULES.messages.$messageId;
const CHANNEL = RULES.channelMessages.$channelId.$messageId;
const LOG = RULES.adminLog.$entryId;

const message = (uid, name, extra = {}) => ({ uid, name, text: 'xin chào', kind: 'message', timestamp: NOW, ...extra });
const env = (a, next, prev = null, vars = {}) => ({ auth: a, new: next, old: prev, vars, now: NOW });

const cases = [];
const test = (label, expected, run) => cases.push({ label, expected, run });

/* Tin nhắn chung */
test('thành viên gửi tin của mình, đúng tên', true, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con'), null, { messageId: 'm9' })));
test('giả uid admin', false, () => allowed(MESSAGES, env(AUTH_U1, message('admin1', 'Mèo con'), null, { messageId: 'm9' })));
test('giả tên admin', false, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'admin'), null, { messageId: 'm9' })));
test('tên quá 32 ký tự', false, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'M'.repeat(33)), null, { messageId: 'm9' })));
test('timestamp tương lai 10 phút', false, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con', { timestamp: NOW + 600_000 }), null, { messageId: 'm9' })));
test('timestamp lệch 2 phút (đồng hồ máy)', true, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con', { timestamp: NOW - 120_000 }), null, { messageId: 'm9' })));
test('sửa nội dung, giữ timestamp', true, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con', { timestamp: 1_700_000_000_000, text: 'mới' }), DB.messages.m1, { messageId: 'm1' })));
test('sửa tin người khác', false, () => allowed(MESSAGES, env(AUTH_U2, message('u2', 'admin', { timestamp: 1_700_000_000_000 }), DB.messages.m1, { messageId: 'm1' })));
test('admin sửa tin người khác', true, () => allowed(MESSAGES, env(AUTH_ADMIN, message('u1', 'Mèo con', { timestamp: 1_700_000_000_000, text: 'admin sửa' }), DB.messages.m1, { messageId: 'm1' })));
test('xoá tin của mình', true, () => allowed(MESSAGES, env(AUTH_U1, null, DB.messages.m1, { messageId: 'm1' })));
test('xoá tin người khác', false, () => allowed(MESSAGES, env(AUTH_U2, null, DB.messages.m1, { messageId: 'm1' })));
test('thành viên đăng thông báo toàn máy chủ', false, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con', { kind: 'announcement', text: 'báo' }), null, { messageId: 'a9' })));
test('admin đăng thông báo', true, () => allowed(MESSAGES, env(AUTH_ADMIN, message('admin1', 'Quản trị', { kind: 'announcement', text: 'báo' }), null, { messageId: 'a9' })));
test('ảnh từ liên kết https', true, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con', { imageURL: 'https://example.com/a.png', imageName: 'Ảnh từ liên kết' }), null, { messageId: 'm9' })));
test('ảnh có URL quá dài', false, () => allowed(MESSAGES, env(AUTH_U1, message('u1', 'Mèo con', { imageURL: `https://example.com/${'a'.repeat(4100)}` }), null, { messageId: 'm9' })));

/* Tin nhắn trong kênh */
test('kênh: tin đúng tên', true, () => allowed(CHANNEL, env(AUTH_U1, message('u1', 'Mèo con'), null, { channelId: 'k1', messageId: 'cm9' })));
test('kênh: giả tên', false, () => allowed(CHANNEL, env(AUTH_U1, message('u1', 'Quản trị'), null, { channelId: 'k1', messageId: 'cm9' })));
test('kênh: kênh không tồn tại', false, () => allowed(CHANNEL, env(AUTH_U1, message('u1', 'Mèo con'), null, { channelId: 'khong-co', messageId: 'cm9' })));

/* Nhật ký quản trị: append-only */
test('nhật ký: admin thêm mục', true, () => allowed(LOG, env(AUTH_ADMIN, { type: 'edit', detail: 'x', adminUid: 'admin1', timestamp: NOW }, null, { entryId: 'log9' })));
test('nhật ký: mạo adminUid', false, () => allowed(LOG, env(AUTH_ADMIN, { type: 'edit', detail: 'x', adminUid: 'u1', timestamp: NOW }, null, { entryId: 'log9' })));
test('nhật ký: xoá mục cũ', false, () => allowed(LOG, env(AUTH_ADMIN, null, DB.adminLog.log1, { entryId: 'log1' })));
test('nhật ký: sửa mục cũ', false, () => allowed(LOG, env(AUTH_ADMIN, DB.adminLog.log1, DB.adminLog.log1, { entryId: 'log1' })));
test('nhật ký: người thường thêm', false, () => allowed(LOG, env(AUTH_U1, { type: 'edit', detail: 'x', adminUid: 'u1', timestamp: NOW }, null, { entryId: 'log9' })));

/* Chưa đăng nhập */
test('khách gửi tin', false, () => allowed(MESSAGES, env(null, message('u1', 'Mèo con'), null, { messageId: 'm9' })));

/* Cấu trúc tổng quát */
test('gốc Rules phải đóng', true, () => RULES['.read'] === false && RULES['.write'] === false);
test('không dùng numChildren()', true, () => !readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8').includes('numChildren'));
test('không có node nào mở toàn bộ', true, () => JSON.stringify(RULES).replace(/"\.(?:read|write)":"true"/g, '').length === JSON.stringify(RULES).length);

let failed = 0;
for (const { label, expected, run } of cases) {
  let got;
  try { got = run(); } catch (error) { got = `LỖI: ${error.message}`; }
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — mong đợi ${expected}, nhận ${got}`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} tình huống Rules đạt.`);
process.exit(failed ? 1 : 0);
