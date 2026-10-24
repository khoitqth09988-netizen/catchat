# CatChat — lộ trình thành một web full stack thật

> Đánh giá dựa trên mã nguồn hiện tại (2026-10): `index.html` + 42 file JS (~9.6k dòng) chạy trực tiếp
> trên Firebase Hosting, không build step; dữ liệu ở Realtime Database; Auth Email/Password; ảnh ở
> Storage; 4 Cloud Function tuỳ chọn.

## 0. Trạng thái sau đợt 19 — phần nào đã xong

| Hạng mục | Trạng thái | Ở đâu |
|---|---|---|
| `functions/package.json` (Node 22, firebase-admin, firebase-functions), `functions/.gitignore` | ✅ xong | `functions/` |
| Emulator (auth 9099, database 9000, storage 9199, functions 5001, hosting 5000, UI 4000) | ✅ xong | `firebase.json → emulators` |
| `storage.rules` + khai báo `storage` trong `firebase.json` | ✅ xong (cần dán vào Console) | `storage.rules` |
| CI kiểm tra tĩnh + deploy hosting tuỳ chọn | ✅ xong | `.github/workflows/deploy.yml`, `scripts/verify.mjs` |
| Bịt lỗ hổng `name` / `timestamp` / `adminLog` trong Rules | ✅ xong (JSON mới ở chat) | `database.rules.json` |
| PWA: manifest, icon, Service Worker network-first, cache-bust theo `VERSION` | ✅ xong | `manifest.webmanifest`, `sw.js`, `assets/js/features/pwa.js` |
| Menu ⋯ gộp Trả lời / Lưu / Sao chép / Sửa / Ghim / Xoá | ✅ xong | `assets/js/app/messages.js`, `chat-pro.css` |
| Chạy được khi **không có Storage** (gói miễn phí) | ✅ xong | `assets/js/app/media.js`: ảnh bằng liên kết https, avatar chữ |
| Tự kiểm thử trong CI: mô phỏng Rules + smoke test jsdom | ✅ xong | `tests/`, `.github/workflows/deploy.yml` |
| Tối ưu mobile: ⋯ luôn hiện trên cảm ứng, vùng chạm 44px, safe-area trên, chữ 15–16px | ✅ xong | `assets/css/mobile.css`, `index.html` |
| App Check **enforce** cho RTDB + Storage | ⏳ việc trong Console (xem `SECURITY.md` §2) |
| Rate limit thật ở Functions, chuyển ghi tin nhắn sang Function | ⏳ P1 |
| Tìm kiếm lịch sử, phân trang, push notification, DM, vai trò | ⏳ P1 |

## 1. Đang có gì (không cần làm lại)

| Lớp | Hiện trạng |
|---|---|
| Frontend | SPA thuần JS, tách module theo tính năng, CSS 19 lớp, theme + giảm chuyển động, mobile |
| Auth | Email/Password, phân quyền admin 3 nguồn (`/admins`, email, custom claim) |
| Database | RTDB 24 node, Rules gốc đóng, validate độ dài/kiểu, whitelist reaction |
| Storage | Ảnh chat + avatar (chưa có `storage.rules` trong repo) |
| Backend | 4 Cloud Function: xoá Auth, lấy mã IP, khoá định danh, trigger hạn mức |
| Vận hành | Hosting + CSP/header bảo mật trong `firebase.json` |

## 2. Việc **bắt buộc** để gọi là full stack (P0)

### 2.1 Backend phải là nơi quyết định, không phải trình duyệt

Hiện tại mọi thứ quan trọng đều do client tự khai. Ba lỗ hổng cụ thể trong Rules hiện tại:

| Lỗ hổng | Hệ quả | Cách sửa |
|---|---|---|
| `messages/$id/.validate` chỉ kiểm `name` là chuỗi ≤ 32 | Người dùng gửi tin với `name: "admin"` ⇒ **giả danh quản trị viên** | Bỏ `name` khỏi dữ liệu client, hoặc Cloud Function đối chiếu `/members/<uid>/name` rồi mới ghi |
| `timestamp` chỉ kiểm `isNumber()` | Client gửi timestamp tương lai ⇒ **tin nhắn ghim vĩnh viễn trên cùng**, phá sắp xếp | Dùng `ServerValue.TIMESTAMP`; Rules so `newData.timestamp === now` (sai số ±5s) |
| `/adminLog` cho admin `remove()` | Xoá dấu vết quản trị | Tách node append-only: chỉ `push`, không cho xoá/sửa; hoặc ghi bằng Function |
| `/bans`, `/identityLocks` do client tạo | Người bị cấm tự gỡ nếu Rules sai một dòng | Chuyển sang callable Function có kiểm tra quyền |

**Kết luận:** dứt điểm 4 mục trên = chuyển các luồng ghi nhạy cảm (gửi tin, cấm, xoá, khoá định danh)
sang Cloud Functions (callable + trigger), client chỉ gửi ý định.

### 2.2 Dự án Functions phải deploy được

- Thiếu `functions/package.json` (không có `engines`, `firebase-functions`, `firebase-admin`, lockfile)
  ⇒ `firebase deploy --only functions` hiện **thất bại**.
- Thêm `functions/.eslintrc` hoặc bật kiểm tra cú pháp trong CI.
- Thêm `firebase.json → "emulators"` (auth, database, storage, functions, hosting) để chạy thử ở máy.

### 2.3 Storage Rules

- Chưa có `storage.rules` trong repo ⇒ quyền ghi ảnh/avatar đang phụ thuộc Console.
- Cần: chỉ chủ tài khoản ghi vào `chatImages/<uid>/…` và `avatars/<uid>…`; giới hạn ≤ 5 MB,
  `contentType` ∈ jpeg/png/webp; chặn ghi đè ảnh người khác; thêm `"storage"` vào `firebase.json`.
- Kèm giới hạn phía client (đã có nén) và dọn ảnh mồ côi khi tin nhắn bị xoá (Function theo lịch).

### 2.4 App Check + chống lạm dụng phía server

- Bật App Check (reCAPTCHA v3) và **enforce** cho RTDB + Storage; hiện chỉ có khung `appcheck.js`.
- Rate limit thật ở Functions: N tin/phút/uid, N ảnh/ngày/uid (client bucket chỉ là trải nghiệm).
- Cloud Armor/budget alert đã ghi trong `SECURITY.md`, cần bật thực tế.

### 2.5 CI/CD

- GitHub Actions: `node --check` toàn bộ JS → rules unit test (Firebase Emulator + `@firebase/rules-unit-testing`)
  → deploy `hosting` / `rules` / `functions` khi merge `main`.
- Hai môi trường: `staging` + `production` (`.firebaserc` hai project, `firebase use`).
- Không có build step nên asset không có hash ⇒ phải thêm version vào query hoặc Service Worker cache-bust
  để tránh trình duyệt dùng CSS/JS cũ sau khi deploy.

## 3. Việc nên làm để dùng được lâu dài (P1)

| Hạng mục | Vì sao | Gợi ý triển khai |
|---|---|---|
| **Tìm kiếm tin nhắn** | Hiện chỉ tìm trong 100 tin đang tải | Đồng bộ `messages` sang BigQuery/Algolia bằng Extension; hoặc Firestore + `where` |
| **Phân trang & lịch sử** | `limitToLast(100)` + "tải thêm 50" là chặn cứng | Giữ RTDB cho realtime, archive tin cũ sang Firestore/BigQuery |
| **Thông báo (push)** | Đóng tab là mất tin | Service Worker + FCM, token lưu `/devices`; Rules theo `auth.uid` |
| **PWA / offline** | Web chat cần cài như app | `manifest.webmanifest` + SW cache app shell, offline queue cho tin nhắn |
| **DM / phòng riêng** | Chat chỉ có kênh công khai | Node `/threads/<id>` + Rules theo thành viên; hoặc chuyển sang Firestore |
| **Tệp đính kèm** | Chỉ có ảnh | Storage + validate loại/dung lượng + quét virus (Extension) |
| **Vai trò chi tiết** | Chỉ có admin/không | `/roles/<uid> = {moderator, …}`, Rules đọc theo role, không hard-code email |
| **Chỉ số & log** | Không biết lỗi thật khi người dùng báo | Firebase Analytics + Sentry (web) + Structured logs của Functions |

## 4. Vận hành & dữ liệu (P2 nhưng đừng bỏ)

- **Backup**: bật RTDB daily backup + export định kỳ ra GCS; thử khôi phục 1 lần.
- **Retention**: chính sách xoá tin > N tháng, ảnh mồ côi, `/adminLog` > 90 ngày (Function theo lịch).
- **Chi phí**: RTDB tính theo lượt tải; các listener `value` trên node lớn (`/identityLedger`,
  `/members`) nên chuyển sang đọc có giới hạn hoặc cache server.
- **Tuân thủ**: xuất dữ liệu của một người, xoá hoàn toàn (Auth + RTDB + Storage) trong 1 lệnh admin.
- **Kiểm thử**: hiện chỉ có smoke test jsdom chạy tay. Cần bộ test Rules + vài E2E (Playwright) cho
  đăng nhập, gửi tin, sửa/xoá, cấm, xoá kênh — chạy trong CI.

## 5. Thứ tự làm đề xuất

1. ~~`functions/package.json` + emulator + CI~~ — **đã xong (đợt 19)**.
2. ~~`storage.rules`~~ — **đã xong**; còn **enforce App Check** trong Console (bước tay, 15 phút).
3. ~~Bịt 3 lỗ hổng Rules ở §2.1~~ — **đã xong ở mức Rules** (tên/timestamp/adminLog append-only);
   bước còn lại là chuyển ghi tin nhắn sang Function để chống spam ở phía server (2–3 ngày).
4. Push notification (PWA đã xong phần cài đặt + cache; còn FCM) (1 ngày).
5. Tìm kiếm + phân trang lịch sử (BigQuery sync) (2–3 ngày).
6. DM + tệp đính kèm + vai trò chi tiết (1 tuần).

> Tiêu chí "đã là full stack": một người dùng ác ý gọi thẳng REST API Firebase **không** làm được gì
> ngoài việc app cho phép; mọi thay đổi đi qua một pipeline có test và có thể rollback; khi có sự cố
> có log, có backup, có thông báo.
