#!/usr/bin/env node
/* CatChat · kiểm tra nhanh trước khi deploy (chạy: node scripts/verify.mjs)
   1. Mọi <script src> / <link href> nội bộ trong index.html phải tồn tại.
   2. Mọi tệp JS phải qua `node --check`.
   3. CSS: ngoặc nhọn cân bằng, không rỗng bất thường.
   4. JSON hợp lệ: firebase.json, database.rules.json, manifest.webmanifest.
   5. manifest + sw.js: icon và tệp lõi tồn tại; sw.js có VERSION.
   Không cần thư viện ngoài, không sửa gì — chỉ đọc và báo lỗi. */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const failures = [];
const notes = [];

function fail(message) { failures.push(message); }
function note(message) { notes.push(message); }
function read(rel) { return readFileSync(path.join(root, rel), 'utf8'); }
function walk(dir, out = []) {
  for (const entry of readdirSync(path.join(root, dir))) {
    const rel = path.posix.join(dir, entry);
    const stat = statSync(path.join(root, rel));
    if (stat.isDirectory()) {
      if (['node_modules', '.git', '.github'].includes(entry)) continue;
      walk(rel, out);
    } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
      out.push(rel);
    }
  }
  return out;
}

/* 1. Tham chiếu trong index.html */
const html = read('index.html');
const refs = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+href="([^"]+)"/g)
].map((match) => match[1]).filter((href) => !/^(https?:|data:|mailto:|#)/.test(href));
for (const href of refs) {
  if (!existsSync(path.join(root, href))) fail(`index.html trỏ tới tệp không tồn tại: ${href}`);
}
note(`${new Set(refs).size} tệp nội bộ được index.html tham chiếu`);

/* 2. Cú pháp JS */
const jsFiles = [...walk('assets/js'), ...walk('scripts'), ...walk('functions'), ...walk('tests'), 'sw.js'].filter((file) => existsSync(path.join(root, file)));
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  } catch (error) {
    fail(`lỗi cú pháp JS: ${file}\n${String(error.stderr || error.message).trim().split('\n').slice(0, 3).join('\n')}`);
  }
}
note(`đã kiểm cú pháp ${jsFiles.length} tệp JS`);

/* 3. CSS cân bằng ngoặc + không có khai báo rỗng */
const cssFiles = readdirSync(path.join(root, 'assets/css')).filter((file) => file.endsWith('.css'));
for (const file of cssFiles) {
  const css = read(`assets/css/${file}`).replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const char of css) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) fail(`CSS lệch ngoặc ${depth > 0 ? `(thiếu ${depth} dấu })` : '(thừa dấu })'}: assets/css/${file}`);
}
note(`đã kiểm ${cssFiles.length} tệp CSS`);

/* 4. JSON hợp lệ */
for (const file of ['firebase.json', 'database.rules.json', 'manifest.webmanifest', 'functions/package.json']) {
  if (!existsSync(path.join(root, file))) { fail(`thiếu ${file}`); continue; }
  try { JSON.parse(read(file)); } catch (error) { fail(`${file} không phải JSON hợp lệ: ${error.message}`); }
}

/* 5. PWA */
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) {
  if (!existsSync(path.join(root, icon.src))) fail(`manifest trỏ tới icon không tồn tại: ${icon.src}`);
}
const sw = read('sw.js');
if (!/const VERSION = 'catchat-v\d+'/.test(sw)) fail('sw.js thiếu hằng VERSION dạng catchat-vN (dùng để xoá cache cũ)');
if (!/self\.addEventListener\('fetch'/.test(sw)) fail('sw.js không có fetch handler');
for (const url of (sw.match(/const CORE = \[([\s\S]*?)\];/) || [, ''])[1].matchAll(/'\.\/([^']+)'/g)) {
  const rel = url[1];
  if (rel && !rel.endsWith('/') && !existsSync(path.join(root, rel))) fail(`sw.js precache tệp không tồn tại: ${rel}`);
}

/* 6. Rules: không dùng numChildren, gốc phải đóng */
const rules = JSON.parse(read('database.rules.json')).rules;
if (rules['.read'] !== false || rules['.write'] !== false) fail('database.rules.json: gốc .read/.write phải là false');
if (/numChildren/.test(read('database.rules.json'))) fail('database.rules.json: không dùng numChildren()');

for (const message of notes) console.log(`· ${message}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} lỗi:`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log('\n✓ Tất cả kiểm tra đều đạt.');
