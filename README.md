# CatChat 🐾

Ứng dụng chat cộng đồng chạy hoàn toàn trên trình duyệt với Firebase (Auth + Realtime Database + Storage).
Trước đây toàn bộ app nằm trong một `index.html`; nay mã nguồn đã được tách thành nhiều file để dễ đọc,
dễ mở rộng và có thể thêm tính năng mới mà không phải sửa code lõi.

## Cấu trúc

```
index.html                     Khung HTML + sprite icon + thứ tự nạp CSS/JS
assets/css/                    Giao diện, tách theo khu vực
  base.css                     Reset, biến màu, màn hình đăng nhập, khung chat
  workspace.css                Bố cục kiểu Discord: sidebar, kênh, hàng tin nhắn
  themes.css                   5 theme: light, dark, lavender, ocean, halloween
  cat-skin.css                 Lớp da “tổ mèo”: bong bóng, sticker, Miu, con trỏ mèo
  halloween.css                Bảng màu gốc của theme Halloween
  views.css                    Tab thành viên, hồ sơ, emoji picker, kiểm duyệt
  chat-extras.css              Reaction và phòng thông báo
  admin.css                    Admin nâng cao: tổng quan, cấm chat, nhật ký
  moderation.css               Sửa/ghim tin nhắn, khoá kênh
  features.css                 Giao diện của các tính năng mở rộng
  halloween-night.css          Halloween ma mị (nạp cuối để ghi đè theme Halloween)
assets/js/app/                 Lõi ứng dụng, nạp theo thứ tự bằng <script defer>
  01-config.js                 Hằng số, cấu hình Firebase, helper $ / $$
  02-state.js                  Tham chiếu DOM, tham chiếu Firebase, state dùng chung
  03-ui-helpers.js             Icon, textElement, avatar, helper quyền/mute
  04-theme.js                  Lưu và áp dụng giao diện
  05-auth.js                   Đăng nhập, đăng ký, đặt lại mật khẩu
  06-database.js               subscribe/cleanup realtime, hiển thị lỗi Firebase
  07-channels.js               Danh sách kênh, chuyển/tạo kênh, listener tin nhắn
  08-session.js                setAdminState, phiên đăng nhập, presence, avatar
  09-message-format.js         Định dạng thời gian, nhãn ngày, nút trả lời
  10-messages.js               Reaction, render tin nhắn, tìm kiếm, ghim hiển thị
  11-composer.js               Khung soạn tin, gửi tin, gửi thông báo
  12-message-actions.js        Xoá tin nhắn, dọn kênh
  13-members.js                Tab thành viên, danh bạ, hồ sơ, emoji picker
  14-extras.js                 Tin nhắn đã lưu, sticker, Miu, vết chân mèo, con trỏ
  15-admin.js                  Xác nhận, cấm thành viên, mở/đóng bảng admin, toast
  16-admin-tools.js            Kiểm duyệt tin nhắn trong admin
  17-moderation.js             Sửa/xoá/ghim tin, khoá kênh, mute, nhật ký, export
  18-events.js                 Toàn bộ event listener + khởi tạo Firebase
  20-features-core.js          Lõi hệ thống tính năng (registry + hook)
  24-boot.js                   Khởi động app (luôn nạp cuối)
assets/js/features/            Tính năng mở rộng, mỗi tính năng một file
  slash-commands.js            Lệnh gõ “/”: /me, /shrug, /flip, /8ball, /cat, /roll, /help
  rich-text.js                 Định dạng tin nhắn: **đậm**, *nghiêng*, ~~gạch~~, `mã`,
                               ```khối mã```, ||spoiler|| và liên kết tự động
  mentions.js                  Gợi ý @tên khi gõ, tô sáng mention, nháy tiêu đề + chuông
                               khi bạn được nhắc tên
  message-tools.js             Nút sao chép tin nhắn + “Tìm tin nhắn trong kênh” ở hồ sơ
  drafts.js                    Bản nháp riêng cho từng kênh (localStorage), Alt+D để xoá
  shortcuts.js                 Bảng phím tắt “?”, Alt+↑/↓ chuyển kênh, Alt+S/T/A
  command-palette.js           Bảng lệnh nhanh Alt+K: kênh, thành viên, hành động
  appearance-extras.js         Màu nhấn, cỡ chữ, mật độ tin nhắn trong hộp thoại giao diện
```

Không dùng bundler: mọi file là script cổ điển nạp bằng `<script defer>` để giữ đúng thứ tự,
nên vẫn mở trực tiếp `index.html` bằng `file://` được (chỉ cần Internet cho Firebase SDK).

## Thêm một tính năng mới

1. Tạo `assets/js/features/ten-tinh-nang.js`:

```js
(() => {
  CatChat.features.register({
    id: 'ten-tinh-nang',
    name: 'Tên tính năng',
    start() { /* chạy một lần khi app khởi động: gắn DOM, listener riêng */ },
    outgoingText(payload) { /* đổi payload.text hoặc trả { cancel: true } để chặn gửi */ },
    messageBody(element, { id, data }) { /* định dạng/tô màu nội dung tin nhắn */ },
    incomingMessage({ id, data, channelId }) { /* tin nhắn mới vừa tới */ },
    channelChanged(channelId) { /* vừa chuyển kênh */ },
    messageTools(container, { id, data }) { /* thêm nút vào thanh công cụ tin nhắn */ },
    memberActions({ uid, name, addAction }) { /* thêm hành động trong hồ sơ thành viên */ },
    themeExtras(container) { /* thêm điều khiển vào hộp thoại giao diện */ },
    keydown(event) { /* trả về true nếu đã xử lý phím */ }
  });

  // Hành động dùng chung: tự hiện trong bảng lệnh nhanh Alt+K
  CatChat.actions.register({
    id: 'ten-hanh-dong',
    label: 'Nhãn hiển thị',
    hint: 'Mô tả ngắn',
    icon: 'sparkles',
    group: 'Nhóm',
    when: () => Boolean(currentUser), // tuỳ chọn
    run() { toast('Xin chào!', 'success'); }
  });
})();
```

2. Thêm `<script defer src="assets/js/features/ten-tinh-nang.js"></script>` vào `index.html`
   (sau `20-features-core.js`, trước `24-boot.js`).
3. Nếu cần style riêng, thêm vào `assets/css/features.css`.

Tính năng lỗi được cô lập: `CatChat.features.failures()` ghi lại lỗi và phần còn lại của app vẫn chạy.

## Firebase

- Bật Authentication (Email/Password), Realtime Database và Storage.
- Dán Security Rules cho **Realtime Database** (xem phần Rules trong PR gần nhất) — đây mới là thứ
  quyết định quyền ghi thật, UI chỉ ẩn/hiện nút.
- Ảnh chat và avatar dùng **Storage Rules** riêng, không nằm trong Rules của Realtime Database.
- Tài khoản `admin@com.vn` (hoặc UID có `/admins/<uid> = true`) sẽ thấy bảng quản trị.

## Chạy thử cục bộ

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```
