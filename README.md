# CatChat 🐾

Ứng dụng chat cộng đồng chạy hoàn toàn trên trình duyệt với Firebase (Auth + Realtime Database + Storage).
Trước đây toàn bộ app nằm trong một `index.html`; nay mã nguồn đã được tách thành nhiều file để dễ đọc,
dễ mở rộng và có thể thêm tính năng mới mà không phải sửa code lõi.

## Cấu trúc

```
index.html                     Khung HTML + sprite icon + thứ tự nạp CSS/JS
assets/css/                    Giao diện, tách theo khu vực
  boot.css                     Màn hình chờ (splash) + chuyển cảnh khi mở app
  design-system.css            Design token: spacing, bo góc, chữ, elevation, motion, màu ngữ nghĩa
  base.css                     Reset, biến màu, màn hình đăng nhập, khung chat
  workspace.css                Bố cục kiểu Discord: sidebar, kênh, hàng tin nhắn
  themes.css                   5 theme: light, dark, lavender, ocean, halloween
  cat-skin.css                 Lớp da “tổ mèo”: bong bóng, Miu, con trỏ mèo
  halloween.css                Bảng màu gốc của theme Halloween
  views.css                    Tab thành viên, hồ sơ, emoji picker, kiểm duyệt
  chat-extras.css              Reaction và phòng thông báo
  admin.css                    Admin nâng cao: tổng quan, cấm chat, nhật ký
  moderation.css               Sửa/ghim tin nhắn, khoá kênh
  features.css                 Giao diện của các tính năng mở rộng
  chat-pro.css                 Nhịp tin nhắn, gộp tin, “Tin nhắn mới”, skeleton, đang nhập…
  cursor-fx.css                Hiệu ứng con trỏ: vệt sáng, sóng khi bấm, dấu chân khi cuộn
  polish.css                   Lớp hoàn thiện thiết kế cho toàn bộ bề mặt (nạp trước halloween-night)
  halloween-night.css          Halloween ma mị (nạp cuối để ghi đè theme Halloween)
  motion.css                   Tuỳ chọn chuyển động (Theo máy / Đầy đủ / Giảm) + guard prefers-reduced-motion
  compact.css                  Bố cục gọn kiểu Discord: mật độ dày, bớt blur diện tích lớn
  mobile.css                   Điện thoại, vùng an toàn, bàn phím ảo, màn hình thấp (nạp cuối cùng)
assets/js/app/                 Lõi ứng dụng, nạp theo thứ tự bằng <script defer>
  config.js                    Hằng số, cấu hình Firebase, helper $ / $$
  state.js                     Tham chiếu DOM, tham chiếu Firebase, state dùng chung
  presence.js                  Nguồn duy nhất cho “ai đang trực tuyến”: TTL, nhịp tim, đếm online
  ui-helpers.js                Icon, textElement, avatar, helper quyền/mute
  security.js                  CatChatGuard: rate limit, phạt tăng dần, proof-of-work
  appcheck.js                  Firebase App Check (tuỳ chọn) — chặn bot/script lạ
  theme.js                     Lưu và áp dụng giao diện
  auth.js                      Đăng nhập, đăng ký, đặt lại mật khẩu
  database.js                  subscribe/cleanup realtime, hiển thị lỗi Firebase
  channels.js                  Danh sách kênh, chuyển/tạo kênh, listener tin nhắn
  session.js                   setAdminState, phiên đăng nhập, presence, avatar
  message-format.js            Định dạng thời gian, nhãn ngày, nút trả lời
  messages.js                  Reaction, render tin nhắn (gộp tin, mốc “Tin nhắn mới”),
                               tải thêm lịch sử, tìm kiếm, ghim hiển thị
  composer.js                  Khung soạn tin, gửi tin, gửi thông báo
  message-actions.js           Xoá tin nhắn, dọn kênh
  members.js                   Tab thành viên, danh bạ, hồ sơ, emoji picker
  extras.js                    Tin nhắn đã lưu, Miu, bộ con trỏ mèo
  admin.js                     Xác nhận, cấm thành viên, mở/đóng bảng admin, toast
  admin-tools.js               Kiểm duyệt tin nhắn trong admin
  moderation.js                Sửa/xoá/ghim tin, khoá kênh, mute, nhật ký, export
  events.js                    Toàn bộ event listener + khởi tạo Firebase
  features-core.js             Lõi hệ thống tính năng (registry + hook)
  boot.js                      Khởi động app (luôn nạp cuối)
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
  anti-flood.js                Giới hạn tần suất gửi tin, chống trùng, chống spam reaction
  login-guard.js               Chặn dò mật khẩu: 5 lần/phút rồi khoá tăng dần
  account-deletion.js          Admin xoá tài khoản thành viên (có hàm purge dùng lại được)
  identity-guard.js            Dấu vân tay thiết bị/IP, chặn vĩnh viễn, giới hạn 2 tài khoản mỗi máy
  identity-blocks.js           Tab quản trị “Chặn vĩnh viễn” (thiết bị / IP / khoá tự động)
  name-guard.js                Tên hiển thị duy nhất (/displayNames); tên kiểu “admin” là tên dùng chung
  admin-badges.js              Nhãn quyền hạn dưới tên: “Quản trị” / “Thành viên” (/adminBadges)
  boot-screen.js               Tiến trình khởi động thật cho splash (step/finish/fail)
  typing-indicator.js          Chỉ báo “ai đang nhập…” qua node /typing
  motion.js                    Tuỳ chọn chuyển động dùng chung cho CSS + JS
  viewport.js                  Bàn phím ảo, vùng an toàn, đổi kích thước / xoay ngang
  cursor-fx.js                 Hiệu ứng con trỏ: di chuyển, bấm, cuộn (có công tắc Tắt/Nhẹ/Đầy đủ)
  pwa.js                       Đăng ký Service Worker + manifest (cài như app)
  ui-mode.js                   Chọn giao diện theo thiết bị (chạy trước lần vẽ đầu)
  mobile-ui.js                 Thanh tab, ngăn kéo kênh, bảng cài đặt của giao diện mobile
  deep-link.js                 Lối tắt PWA: đọc ?view=chat|members|announcements sau khi đăng nhập
  early-guard.js               Gác cổng khởi động sớm: báo mạng yếu + nút Thử lại trước cả Firebase SDK
  media.js                     Trạng thái Storage: có thì upload, không thì dán liên kết ảnh
functions/                     Cloud Functions: xoá tài khoản Auth, lấy mã IP, tự khoá định danh
  package.json                 Khai báo phụ thuộc + engines Node 22 (bắt buộc để deploy được)
storage.rules                  Storage Rules cho ảnh chat + avatar (dán riêng trong Console)
database.rules.json            Bản Rules Realtime Database đầy đủ (dán vào Firebase Console)
manifest.webmanifest           PWA: tên, icon, màu, chế độ standalone
sw.js                          Service Worker: shell network-first, cache-bust theo VERSION
assets/icons/                  Icon PWA 192/512/maskable + apple-touch-icon
scripts/verify.mjs             Kiểm tra trước khi deploy (chạy: node scripts/verify.mjs)
tests/                         harness dùng chung + rules + cascade CSS mobile + nhận diện thiết bị +
                               mobile-ui + smoke + flows + deep-link (jsdom, chạy trong CI)
.github/workflows/deploy.yml   CI: kiểm tra tĩnh, deploy Firebase Hosting nếu có secret
SECURITY.md                    Checklist bảo mật: App Check, Rules, quota, CSP
ROADMAP.md                     Lộ trình full stack: đã xong gì, còn gì
```

Không dùng bundler: mọi file là script cổ điển nạp bằng `<script defer>` để giữ đúng thứ tự,
nên vẫn mở trực tiếp `index.html` bằng `file://` được (chỉ cần Internet cho Firebase SDK).

**Tên file không đánh số.** Thứ tự nạp được quy định duy nhất bởi danh sách `<script>` / `<link>`
trong `index.html` — muốn đổi thứ tự thì sửa ở đó, không phụ thuộc tên file.

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
   (sau `features-core.js`, trước `boot.js`).
3. Nếu cần style riêng, thêm vào `assets/css/features.css`.

Tính năng lỗi được cô lập: `CatChat.features.failures()` ghi lại lỗi và phần còn lại của app vẫn chạy.

## Trải nghiệm chat

- **Màn hình chờ có tiến trình thật**: `boot-screen.js` cập nhật từng bước (chuẩn bị giao diện →
  xác thực thiết bị → kết nối Firebase → kiểm tra phiên → tải tin nhắn). Nếu Firefox/Chrome chặn
  hoặc mạng hỏng, splash hiện lỗi kèm nút **Thử lại** thay vì quay vô hạn. Toàn bộ chuyển động
  tôn trọng `prefers-reduced-motion`.
- **Skeleton thay màn hình trống**: trong lúc chờ 100 tin gần nhất, danh sách hiện khung xương
  nhấp nháy (`aria-busy="true"`) rồi mới vẽ nội dung thật.
- **Gộp tin cùng người gửi**: các tin liên tiếp trong 5 phút của cùng một người được gộp (ẩn avatar
  và tên, hiện giờ khi rê chuột) — giống Discord/Slack.
- **Mốc “Tin nhắn mới” + nút nổi**: khi đang xem lại tin cũ, tin mới không kéo bạn xuống đáy;
  một dải “Tin nhắn mới” đánh dấu chỗ bắt đầu và nút `N tin nhắn mới` đưa bạn về cuối.
- **Tải thêm lịch sử**: kênh chỉ nghe 100 tin gần nhất; nút “Tin nhắn cũ hơn” lật thêm 50 tin mỗi lần
  và giữ nguyên vị trí đang đọc.
- **“Đang nhập…”**: ghi trạng thái gõ vào `/typing/<channelId>/<uid>` (tự hết hạn sau 7 giây,
  `onDisconnect` dọn khi đóng tab). Tính năng tự tắt nếu Rules chưa có node `/typing`.

### Rules cho tính năng “đang nhập…”

```json
"typing": {
  ".read": "auth != null",
  "$channelId": {
    "$uid": {
      ".write": "auth != null && !root.child('bans').child(auth.uid).exists() && auth.uid === $uid",
      ".validate": "!newData.exists() || (newData.hasChildren(['name','at']) && newData.child('name').isString() && newData.child('name').val().length <= 60 && newData.child('at').isNumber())"
    }
  }
}
```

## Menu hành động của tin nhắn (⋯)

Mỗi tin nhắn có **một** nút `⋯` nằm ngay sau tên và giờ gửi. Bấm vào mở menu gồm:

| Mục | Quyền |
|---|---|
| Trả lời | mọi thành viên |
| Lưu / Bỏ lưu | mọi thành viên |
| Sao chép nội dung | mọi thành viên (từ hook `messageTools`) |
| Sửa tin nhắn | chủ tin nhắn (hoặc admin) |
| Ghim / Bỏ ghim | admin |
| Xoá tin nhắn | chủ tin nhắn (hoặc admin) |

Hàng meta vì thế chỉ còn **tên → giờ → ⋯**: tên luôn sát avatar, không còn icon rời.
Menu mở **ngay cạnh tin nhắn**: bên phải hàng tin nếu còn chỗ, hết chỗ thì sang bên trái,
màn hình hẹp mới rơi xuống dưới nút (và lật lên trên nếu sát đáy). Toạ độ luôn được kẹp trong khung nhìn.
Menu đóng khi chọn một mục, bấm ra ngoài, nhấn `Esc`, cuộn danh sách hoặc xoay/đổi kích thước cửa sổ.
Trên cảm ứng (≤ 760px) nút `⋯` luôn hiện và mục cao 38px cho dễ bấm. Các nút bên trong vẫn giữ `data-*` cũ nên handler uỷ quyền trong `events.js` không đổi —
feature thêm nút mới chỉ cần mount vào container `context.container` như trước.

## Hệ thống thiết kế

Toàn bộ giao diện dùng chung một bộ token trong `assets/css/design-system.css`:

| Nhóm | Token | Ghi chú |
|---|---|---|
| Khoảng cách | `--ds-space-1..9` | nấc 4/6/8/12/16/20/24/32/44px |
| Bo góc | `--ds-radius-xs..xl`, `--ds-radius-pill` | 8 → 26px |
| Chữ | `--ds-text-2xs..2xl`, `--ds-weight-*` | thang cỡ + độ đậm thống nhất |
| Chuyển động | `--ds-ease-*`, `--ds-dur-*` | 3 nhịp: 140 / 220 / 380ms |
| Độ nổi | `--ds-elev-1..3`, `--ds-inner-light` | có biến thể riêng cho theme tối & Halloween |
| Màu ngữ nghĩa | `--ds-success/-danger/-warning/-info` (+ bản `-soft`) | dùng cho toast, trạng thái, cảnh báo |
| Focus | `--ds-focus` | vòng focus 2 lớp, chỉ hiện với bàn phím |

`assets/css/polish.css` áp token lên **mọi bề mặt**: màn hình đăng nhập, sidebar, topbar, thanh kênh,
danh sách tin nhắn, khung soạn tin, cột thành viên, hộp thoại, hồ sơ, bảng quản trị, tin đã lưu, bảng
lệnh, bảng phím tắt, toast… vì tất cả màu đều lấy từ `--theme-*` nên **5 bảng màu đều đúng**.

Chi tiết đáng chú ý:

- **Sidebar**: vạch nhấn chuyển động ở mục đang chọn, kênh trượt nhẹ khi hover, thẻ hồ sơ có viền riêng.
- **Topbar & thanh kênh**: nền kính mờ (`backdrop-filter`), pill đồng bộ, chấm online có nhịp lan.
- **Tin nhắn**: nhóm nút trả lời/lưu/sao chép/sửa xuất hiện theo cụm khi hover, dải ngày **dính đỉnh**
  khi cuộn, bong bóng có vạch nhấn theo màu theme, reaction nhún khi bấm.
- **Toast**: vạch màu theo loại (thành công/lỗi/thông tin) + thanh đếm ngược 4,8 giây khớp với thời gian
  tự đóng trong `toast()`.
- **Bảng quản trị**: tab có gạch chân trượt, thẻ số liệu nổi nhẹ, nút nguy hiểm đổi sang đỏ khi hover.
- **Khả năng truy cập**: liên kết “Bỏ qua điều hướng” (`ds-skip-link`) đưa focus tới ô soạn tin hoặc ô email,
  vòng focus thống nhất, `prefers-reduced-motion` và `prefers-contrast: more` đều được xử lý.

## Mượt mà & hiệu ứng

**Tải nhanh hơn**
- `preconnect` tới `www.gstatic.com` và `dns-prefetch` cho Auth / Realtime Database / Storage ngay trong
  `<head>` → SDK và dữ liệu tới sớm hơn.
- Splash chỉ dùng `transform` + `opacity` (không còn `filter: blur()` phủ toàn màn hình hay
  `backdrop-filter`), nên không tụt frame trên máy yếu; quầng sáng đổi sang `radial-gradient`.
- Thời gian giữ splash tối thiểu 720ms (trước là 900ms) — vẫn đủ để animation kịp “thở” nhưng không chờ vô ích.
- Ảnh trong tin nhắn có khung chờ nhấp nháy rồi **hiện dần** khi tải xong (không nhảy layout, không khung trống).

**Hiệu ứng con trỏ** (`assets/js/features/cursor-fx.js`)
- **Di chuyển**: vòng sáng bám theo con trỏ (nội suy 24%/frame) + vệt hạt nhỏ.
- **Bấm**: sóng lan + chùm 6 hạt sáng + 2 dấu chân mèo.
- **Cuộn**: dấu chân + vệt sáng trôi ngược hướng cuộn (nghe cả `wheel` lẫn `scroll` của vùng tin nhắn).
- Tối ưu: chỉ `transform`/`opacity`, tối đa 42 hạt cùng lúc, một vòng `requestAnimationFrame` duy nhất và
  tự dừng khi con trỏ ngừng di chuyển; phần tử tái sử dụng bị dọn ngay khi animation kết thúc.
- Tự tắt trên thiết bị cảm ứng, khi người dùng chọn giảm chuyển động, và tự chọn mức **Nhẹ** trên máy
  rất ít RAM (`navigator.deviceMemory` ≤ 1).
- Đổi mức trong **Giao diện → Hiệu ứng con trỏ** (Tắt / Nhẹ / Đầy đủ) hoặc bảng lệnh `Alt + K`
  → “Đổi hiệu ứng con trỏ”. Lựa chọn lưu trên thiết bị.

**Tuỳ chọn chuyển động** (`assets/css/motion.css` + `assets/js/features/motion.js`)
- Nguyên nhân animation “chỉ chạy trên Mac”: Windows → **Cài đặt → Trợ năng → Hiệu ứng hình ảnh** tắt
  khiến trình duyệt báo `prefers-reduced-motion: reduce`, và CSS dừng toàn bộ animation dù máy rất mạnh.
- CatChat tôn trọng cài đặt đó nhưng **không khoá cứng**: `assets/js/features/motion.js` đặt
  `data-motion` trên `<html>` theo 3 mức — `auto` (theo máy, mặc định), `full` (luôn bật), `reduced` (luôn giảm).
- Mọi khối `@media (prefers-reduced-motion: reduce)` trong CSS đều được khoá bằng
  `html:not([data-motion="full"])`, nên chọn “Đầy đủ” là mọi animation chạy lại ngay, không cần đổi cài đặt Windows.
- Đổi trong **Giao diện → Chuyển động** hoặc bảng lệnh `Alt+K` → “Đổi mức chuyển động”; lựa chọn lưu ở
  `localStorage` (`catchat-motion-v1`). Hiệu ứng con trỏ dùng chung lựa chọn này.

## Điện thoại & khi thu nhỏ cửa sổ

`assets/css/mobile.css` (nạp cuối cùng) + `assets/js/features/viewport.js` lo riêng phần này, không đụng
vào 17 file CSS cũ.

- **Vùng an toàn**: tai thỏ (cả phía trên) và vạch home của iPhone được cộng vào thanh trên, thanh điều
  hướng dưới đáy, khung soạn tin, toast và ngăn kéo (`env(safe-area-inset-*)` ⇒ biến `--safe-*`).
  Cần thiết vì `index.html` dùng `viewport-fit=cover` + status bar `black-translucent`: khi cài PWA,
  nội dung sẽ chạm mép trên nếu không cộng `--safe-top`.
- **Bàn phím ảo**: `visualViewport` được theo dõi liên tục; `--app-vh` luôn là chiều cao còn thấy được.
  Khi bàn phím mở, thanh điều hướng lùi lại (`html.is-keyboard-open`) để ô soạn tin nằm
  ngay trên bàn phím — trước đây trên iOS ô soạn tin bị bàn phím che.
- **Thu nhỏ / phóng to cửa sổ, xoay ngang**: đổi mức (`phone` / `tablet` / `desktop`) sẽ đóng ngăn kéo
  thành viên và bảng emote đang mở, đưa khung tin nhắn về cuối nếu bạn đang ở gần cuối, và phát sự kiện
  `catchat:viewport-change`. Không còn cảnh ngăn kéo “treo” lại sau khi đổi kích thước.
- **Màn hình thấp** (`max-height: 520px`, điện thoại nằm ngang): thu gọn topbar, thanh kênh và khung soạn
  tin, ẩn gợi ý bàn phím.
- **Nội dung dài**: bong bóng tin nhắn, banner, hồ sơ đều `overflow-wrap: anywhere`; ảnh không tràn ngang.
- **Hộp thoại cuộn được**: hồ sơ, giao diện, xác nhận, cấm chat đều có `max-height: calc(var(--app-vh) - 24px)`
  nên phần thông tin và nút hành động không bị cắt mất trên màn hình nhỏ.
- **Chạm**: `touch-action: manipulation` (bỏ trễ 300ms), không còn flash xám khi bấm. Trên mọi thiết bị
  không có chuột (`hover: none` / `pointer: coarse`): nút `⋯` **luôn hiện** (kể cả iPad 768–1080px,
  trước đây bị vô hình), mục menu hành động cao **44px**, nút gửi 44px, nút đính kèm/emote 42px;
  vùng bấm của `⋯` được nới bằng pseudo-element nên không làm xê dịch hàng tên.
- **Cỡ chữ**: ≤760px, nội dung tin nhắn 15px (thay vì 13,5px), tên 13,5px, giờ gửi 11,5px,
  gợi ý soạn tin 10,5px, ô soạn tin 16px. Tuỳ chọn Giao diện → Cỡ chữ vẫn ghi đè được.
- **Bàn phím mobile**: ô soạn tin có `enterkeyhint="send"` + `autocapitalize="sentences"`, các ô tìm kiếm
  có `enterkeyhint="search"`; iOS không còn tự phóng to khi chạm ô nhập (font 16px trong
  `@supports (-webkit-touch-callout: none)`, áp cho cả màn hình ≤760px kể cả iPhone nằm ngang).
- Máy yếu vẫn nhẹ: ở ≤640px mọi `backdrop-filter` đã bị bỏ từ trước, file này không thêm animation mới.

## Giao diện app riêng cho điện thoại (`data-ui="mobile"`)

Máy tính vẫn dùng giao diện cũ. Điện thoại / máy tính bảng cảm ứng nhận **một giao diện khác hẳn**,
dựng trên chính các phần tử cũ nên mọi tính năng (realtime, quản trị, bản nháp, thông báo, tìm kiếm,
ghim, tệp đính kèm…) giữ nguyên.

- **Nhận diện lúc tải trang**: `assets/js/app/ui-mode.js` nạp ngay trong `<head>` (không `defer`), gắn
  `data-ui="mobile"` hoặc `"desktop"` lên `<html>` **trước lần vẽ đầu** nên không bị nhấp nháy đổi bố cục.
  Điều kiện: màn hình ≤ 760px, hoặc con trỏ chính là cảm ứng và ≤ 1024px, hoặc có điểm chạm và ≤ 820px.
  Ép thử bằng `?ui=mobile` / `?ui=desktop`. Xoay ngang hay đổi kích thước cửa sổ sẽ tự tính lại.
- **Bố cục mobile** (`assets/css/mobile-app.css`, nạp cuối): thanh trên 56px (tên kênh + công cụ, chừa tai thỏ),
  vùng tin nhắn chiếm phần còn lại, ô soạn tin neo ngay trên **thanh tab 4 mục** ở đáy:
  `Kênh · Trò chuyện · Thành viên · Cài đặt`.
- **Kênh**: ngăn kéo trượt từ trái = `#sidebar` gốc, hiện lại đầy đủ logo, điều hướng và danh sách kênh
  (bản ≤1080px trước đây chỉ có dải icon). Đầu ngăn kéo có tiêu đề + nút ✕ (dính đỉnh khi cuộn), ô
  **tìm kênh** lọc ngay trên máy (gõ không dấu vẫn ra “mèo-con”, tự áp lại khi có kênh mới), và
  **vuốt sang trái ≥ 64px để đóng**. Chọn kênh xong ngăn kéo tự đóng; hồ sơ bám đáy để nút đăng xuất
  luôn thấy dù danh sách dài.
- **Bàn phím ảo + ngăn kéo**: khi gõ vào ô tìm kênh, bàn phím mở (mobile.css ẩn thanh điều hướng dưới
  đáy bằng `opacity: 0`) — ngăn kéo dùng chung `#sidebar` nên có luật riêng giữ `opacity: 1` và
  `pointer-events: auto`, chiều cao theo `--app-vh` để không bị bàn phím che.
- **Xếp lớp (đã sửa lỗi “bấm Kênh thấy mờ tịt”)**: `.app-view` không còn `animation` (animation opacity
  từng tạo stacking context khiến ngăn kéo 78 bị lớp mờ che), lớp mờ `z-index: 76` **chỉ làm tối,
  không blur**, ngăn kéo/bảng cài đặt `z-index: 78`; thanh tab (45) chìm dưới lớp mờ. Ngăn kéo đóng
  dùng `visibility: hidden` nên không còn điểm dừng Tab ngoài màn hình.
- **Thành viên**: tab mở danh bạ toàn màn hình (`#directoryPanel`) — có tìm kiếm, lọc trực tuyến/bị cấm.
- **Cài đặt**: bảng trượt từ đáy gom Giao diện & cỡ chữ, Bảng quản trị (chỉ admin), Tin nhắn đã lưu,
  Thông báo toàn máy chủ, Miu, trạng thái kết nối và Đăng xuất — tất cả **bấm hộ lại đúng nút cũ**,
  không nhân bản logic. Nút Back của Android / phím Esc đóng bảng trước khi rời trang.
- **An toàn cho giao diện cũ**: *mọi* luật trong `mobile-app.css` bắt đầu bằng `html[data-ui="mobile"]`;
  `scripts/verify.mjs` kiểm tra điều này nên không thể vô tình làm lệch giao diện máy tính.
- **Màu**: dùng biến `--theme-*` nên hoà với cả 5 bảng màu (light / dark / lavender / ocean / halloween).
- Thanh tab tự ẩn khi bàn phím ảo mở (nhường chỗ cho ô soạn tin), khi ở màn hình đăng nhập, và nằm dưới
  các lớp hộp thoại có sẵn (đã lưu, hồ sơ, quản trị, xác nhận) để không đè lên nút bấm.

### Hai lỗi đã sửa trong đợt này

- `<meta name="apple-mobile-web-app-capable">` bị Chrome cảnh báo lỗi thời ⇒ thêm
  `<meta name="mobile-web-app-capable" content="yes">` và vẫn giữ bản Apple cho iOS.
- `assets/js/features/drafts.js` ném `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`
  mỗi lần `keydown` không có `event.key` (bộ gõ tiếng Việt / bàn phím Android trả mã 229). Nay đọc
  `event.key` an toàn và bỏ qua `event.isComposing`. Cùng lỗi tiềm ẩn đã vá ở `shortcuts.js`,
  `command-palette.js` và `events.js` (Ctrl/Cmd + K).
- **Ngăn kéo kênh bị mờ**: xem mục *Xếp lớp* ở trên — nguyên nhân là stacking context + lớp mờ có blur.
  Tester `tests/mobile.test.mjs` chốt thứ tự `thanh tab < lớp mờ < ngăn kéo` để lỗi này không tái diễn.

### Nâng cấp kèm theo (đợt này)

- **Hiệu năng điện thoại**: bỏ `backdrop-filter` ở thanh trên, khung soạn tin và thanh tab (dải cố định
  nên blur là thứ tốn GPU nhất khi cuộn); ngăn kéo và bảng cài đặt dùng nền đục theo `--theme-*`.
- **Ảnh trong tin nhắn**: giới hạn `max-height: min(260px, 42dvh)` trên mobile, khung chờ nhỏ lại nên
  danh sách tin ít “nhảy” khi ảnh tải xong.
- **Font khi ngoại tuyến**: `sw.js` cache `fonts.googleapis.com` + `fonts.gstatic.com` (tối đa 24 mục,
  tự dọn) ⇒ mở PWA lúc mất mạng vẫn đúng kiểu chữ Nunito thay vì nhảy sang font hệ thống.

## Đợt 26 — rà soát toàn bộ và chốt bản cuối

Đợt này không thêm tính năng lớn: mục tiêu là **đọc lại toàn bộ mã, chạy hết test và sửa những lỗi
chỉ lộ khi thao tác thật**. Danh sách việc đã làm:

### Lỗi thật đã sửa

| Lỗi | Người dùng thấy gì | Cách sửa |
|---|---|---|
| Khoá lưu giao diện lệch tên | Chọn màu xong tải lại trang là mất, quay về mặc định | `theme.js` đọc/ghi `catchat-theme-v1`, vẫn đọc khoá cũ `cham-chat-theme` và ghi cả hai |
| Ngăn kéo mobile **không có** `id="sidebar"` | “Vuốt sang trái để đóng” và “chọn kênh xong tự đóng ngăn kéo” không chạy chút nào — JS tìm `#sidebar` ra `null` rồi bỏ qua trong im lặng, còn test dựng DOM giả có id nên vẫn xanh | Thêm `id="sidebar"` cho `<aside class="sidebar">`, cho `mobile-ui.js` chấp nhận cả `.sidebar`, và **kiểm thử trên đúng `index.html`** (chọn kênh + vuốt bằng phần tử thật) |
| Vuốt để đóng ngăn kéo bị “kẹt” | Kéo ngăn kéo rồi nhấc tay ra ngoài mép trái ⇒ ngăn kéo đứng nguyên giữa màn hình, không đóng được | `setPointerCapture` + lắng nghe `pointerup`/`pointercancel` ở `window` để luôn kết thúc thao tác kéo |
| Hỏi “Bỏ bản nháp và đổi kênh?” | Chuyển kênh khi đang gõ dở bị chặn bởi hộp thoại, trong khi tính năng *Bản nháp theo kênh* vẫn lưu lại ⇒ thông báo sai và người dùng ngại chuyển kênh | Chỉ hỏi khi sắp mất thứ **không** lưu được (ảnh đính kèm / tin đang trả lời); nội dung đang gõ được lưu nháp tự động |
| Lối tắt PWA `?view=` bị bỏ qua | Giữ biểu tượng app → “Thành viên” / “Thông báo” chỉ mở trang như thường | Thêm `assets/js/app/deep-link.js`: đọc `view`, chờ `catchat:workspace-ready`, áp dụng, xác nhận lại rồi xoá `?view` khỏi địa chỉ |
| Ảnh ngoài nhận được địa chỉ trang chat | Máy chủ ảnh biết bạn đang ở trang nào (kèm cả `?view=…`) | `referrerPolicy = 'no-referrer'` cho ảnh tin nhắn và avatar |
| Esc đóng nhầm lớp phía sau | Đang mở ngăn kéo mobile, bấm Esc lại đóng luôn menu ⋯ / bảng thành viên bên dưới | Ngăn kéo nghe Esc ở **pha capture** và `stopPropagation()` |

### Hạ tầng kiểm thử

- `tests/harness.mjs` — khung dựng app dùng chung: nhúng CSS/JS thật vào jsdom, thay Firebase bằng RTDB
  trong bộ nhớ (**không có Storage**, đúng gói miễn phí), listener `value` phát giá trị hiện có ngay khi
  đăng ký giống RTDB thật. `tests/smoke.test.mjs`, `tests/flows.test.mjs`, `tests/deep-link.test.mjs`
  đều dựa trên nó nên không còn ba bản stub chép tay lệch nhau.
- `tests/flows.test.mjs` (15 nhóm luồng) nay phủ thêm: lệnh `/shrug`, sửa tin qua menu ⋯, ghim tin,
  bật/thoát chế độ thông báo, tạo kênh và **nháp theo kênh** (rời kênh → quay lại vẫn còn chữ).
- `tests/deep-link.test.mjs` kiểm lối tắt PWA, kể cả trường hợp app tự chuyển về `#phòng-chung` sau khi
  đăng nhập (phải bật lại chế độ thông báo, không được “bật rồi tắt ngay”).
- Test chờ theo **điều kiện** (`waitFor`) thay vì ngủ cố định ở những chỗ phụ thuộc mạng/CPU, nên chạy
  trên CI chậm vẫn ổn định.

### Dọn dẹp

- `sw.js` tăng `VERSION` lên `catchat-v8` để mọi máy đã cài PWA nhận bản mới (xoá cache cũ khi activate).
- `npm test` trong `tests/` chạy đủ 7 tệp: rules, cascade mobile, nhận diện thiết bị, mobile-ui, smoke,
  flows, deep-link — CI dùng đúng lệnh này.

## Đợt 27 — mạng yếu, ngăn kéo mobile và tên “admin”

Ba lỗi người dùng báo khi dùng Chrome trên điện thoại:

### 1. Mạng yếu thì không mở được app

Nguyên nhân: `index.html` nạp Firebase SDK từ `www.gstatic.com` bằng `<script defer>`. Script
`defer` phải chạy **theo đúng thứ tự**, nên chỉ cần một tệp SDK "treo" (mạng 3G chập chờn, nhà mạng
chặn gstatic) là mọi script CatChat phía sau không bao giờ chạy — splash đứng im, không có thông báo
gì ngoài dòng "đang kết nối".

- `assets/js/app/early-guard.js` (mới, nạp trong `<head>`, **trước** Firebase SDK, không `defer`):
  sau 9 giây thiếu `window.firebase` thì báo đúng nguyên nhân ngay trên splash; sau 18 giây vẫn chưa
  mở được app thì hiện hộp lỗi + nút **Thử lại** (chỉ hoạt động khi app chưa mở xong).
- `events.js` khi thiếu SDK sẽ **tự nạp lại** 3 tệp Firebase một lần (có hạn 10 giây/tệp) trước khi báo
  lỗi, nên mạng chớp tắt không bắt người dùng tải lại cả trang.
- `sw.js`: `VERSION` lên **`catchat-v8`**, thêm `NETWORK_TIMEOUT = 3200` — trang và JS/CSS chờ mạng tối
  đa 3,2 giây rồi trả bản trong cache (vẫn cập nhật cache khi mạng về). Lần mở sau trên mạng yếu vì thế
  gần như tức thì. Trang ngoại tuyến có nút "Thử lại" dạng liên kết (không dùng `onclick` vì CSP chặn).

### 2. Bấm vào kênh vẫn còn một lớp mờ, không nhìn thấy gì

Nguyên nhân gốc: `<aside class="sidebar">` trong `index.html` **không có `id="sidebar"`**, trong khi
`mobile-ui.js` tìm ngăn kéo bằng `document.querySelector('#sidebar')`. Kết quả: `sidebar` = `null`,
phần "chọn kênh thì đóng ngăn kéo" không được gắn, nên bấm kênh xong ngăn kéo + lớp mờ vẫn nằm đó.
Test cũ dựng DOM giả *có* id nên vẫn xanh.

- Thêm `id="sidebar"`; `mobile-ui.js` nhận cả `#sidebar` lẫn `.sidebar` và cảnh báo nếu không thấy.
- Lưới an toàn thứ hai: nghe **pha capture trên `document`** — bấm `.channel-link` / `.nav-link` /
  nút tạo kênh luôn đóng ngăn kéo, kể cả khi HTML cũ còn trong cache.
- Tự chữa: `MutationObserver` trên `data-mobile-sheet` gọi lại `syncSheetChrome()`, nên mất thuộc tính
  là lớp mờ ẩn ngay.
- CSS: `#mobileScrim[hidden] { display: none !important }` và
  `html[data-ui="mobile"]:not([data-mobile-sheet]) #mobileScrim { pointer-events: none }` — dù có lỗi
  gì thì lớp mờ cũng không khoá được màn hình.

### 3. Đăng ký với tên “admin” bị đổi thành “admin (a1b2)”

Nguyên nhân: `/displayNames` giữ khoá duy nhất cho mọi tên, nên khi tên đã có người dùng, `syncMemberProfile`
tự thêm hậu tố UID. Người dùng thấy tên mình bị đổi mà không hiểu vì sao.

Theo lựa chọn của chủ dự án — **cho phép đặt tên “admin” và phân biệt bằng nhãn**:

- Tên kiểu quản trị (`admin`, `administrator`, `quantri`, `root`, `system`, và tên của chính các tài
  khoản trong `/admins`) là **tên dùng chung**: `claim()` bỏ qua chúng, không chiếm khoá
  `/displayNames` ⇒ nhiều người cùng tên được, và tài khoản quản trị thật **không bị mất tên**.
- Tên thường vẫn **duy nhất** như trước; nếu trùng, app báo ngay tại ô tên kèm gợi ý (chưa tạo tài khoản).
- **Không còn tự đổi tên**: nếu lúc đăng nhập phát hiện trùng, app giữ nguyên tên người dùng đã chọn và
  chỉ ghi cảnh báo cho quản trị.
- **Nhãn quyền hạn** (`assets/js/features/admin-badges.js`): node mới `/adminBadges/<uid> = true`, ai đã
  đăng nhập cũng đọc được, mỗi người chỉ ghi được cờ của chính mình và chỉ khi thật sự là admin. Nhãn
  hiện ngay sau tên trong tin nhắn và trong danh bạ: **“Quản trị”** (đúng là admin) hoặc **“Thành viên” /
  “Chỉ là tên hiển thị”** (chỉ trùng tên). Nhãn dựa trên uid, **không** dựa vào chữ trong tên.
- Xoá tài khoản thành viên giờ **giải phóng khoá tên** để người khác dùng lại.

> **Rules RTDB cần dán lại** vì có thêm node `/adminBadges` (xem `database.rules.json`). Chưa dán thì
> app vẫn chạy: nhãn lấy từ tài khoản đang đăng nhập và danh sách tên kiểu admin mặc định.

### 4. CSP chặn long-polling của Firebase (đợt 28)

Khi WebSocket bị chặn — rất thường gặp trên mạng di động yếu, Wi-Fi công ty, VPN hoặc DNS lọc —
Realtime Database tự chuyển sang **long-polling bằng JSONP**: nó tải
`<script src="https://chat-e58b5-default-rtdb.firebaseio.com/.lp?...">`. CSP cũ chỉ cho `script-src`
tải từ `www.gstatic.com`, `*.firebaseapp.com`… nên **mọi kênh long-polling bị chặn**, SDK đã tải xong mà
app không đồng bộ được gì, console đầy lỗi `violates the following Content Security Policy directive`.

Đây chính là nửa còn lại của lỗi “mạng yếu thì load không vào” ở đợt 27.

- `index.html` + `firebase.json`: thêm **đúng** host dữ liệu trong `config.js` vào `script-src`
  (`https://chat-e58b5-default-rtdb.firebaseio.com`) — không dùng wildcard, không thêm
  `'unsafe-inline'`/`'unsafe-eval'`, không đổi `object-src 'none'`.
- `early-guard.js`: bắt sự kiện `securitypolicyviolation`; nếu script của host dữ liệu bị chặn thì nhãn
  kết nối đổi thành **“Bị chặn kết nối”** (kèm chú thích) và hiện toast nêu rõ host bị chặn — thay vì để
  người dùng thấy “Đang kết nối” mãi.
- `sw.js`: `VERSION` lên **`catchat-v8`** để máy đã cài PWA nhận `index.html` mới (CSP nằm trong meta của
  trang, mà trang cũ còn trong cache thì vẫn dính CSP cũ).
- `tests/resilience.test.mjs`: CSP trong `index.html` và trong header `firebase.json` **phải trùng nhau**
  và phải chứa host trong `config.js`; vẫn cấm `'unsafe-inline'`/`'unsafe-eval'`; mô phỏng vi phạm CSP
  để kiểm nhãn “Bị chặn kết nối” + toast.

> Đổi database (sang project/region khác) thì phải sửa `databaseURL` **và** CSP ở cả hai file — test sẽ
> báo đỏ nếu quên.

### Kiểm thử mới

- `tests/resilience.test.mjs`: thứ tự nạp `early-guard.js` trước SDK, `NETWORK_TIMEOUT` trong `sw.js`,
  splash hiện lỗi + nút Thử lại khi thiếu Firebase, bấm kênh luôn đóng ngăn kéo, lớp mờ tự ẩn.
- `tests/names.test.mjs`: đăng ký tên “admin” thành công và giữ nguyên tên, tên thường vẫn duy nhất,
  không tự thêm hậu tố, nhãn “Quản trị”/“Thành viên” hiện đúng chỗ, xoá tài khoản giải phóng tên.
- `tests/rules.test.mjs`: 38 tình huống (thêm 5 tình huống cho `/adminBadges`, cập nhật `/displayNames`).
- `tests/harness.mjs`: `createUserWithEmailAndPassword` giờ tạo `currentUser` có `updateProfile`/`delete`,
  `displayName` lấy từ phần trước `@` như tài khoản thật.

## Trạng thái trực tuyến & hồ sơ thành viên

- `assets/js/app/presence.js` là nguồn duy nhất trả lời “ai đang online” (`isUserOnline`, `onlineMemberCount`).
  Mọi chỗ trước đây đọc thẳng `presence[uid]` (member list, danh bạ, bảng quản trị, command palette) đều
  chuyển sang dùng hàm này.
- `/presence/<uid> = { state: 'online', lastChanged }`; node quá **3 phút** không có nhịp tim bị coi là ngoại
  tuyến, nên đóng tab / mất mạng đột ngột không còn hiện “trực tuyến mãi”. Nhịp tim 60 giây giữ node luôn mới
  (kể cả tab nền bị trình duyệt bóp timer), quét lại mỗi 30 giây để danh sách tự cập nhật khi ai đó hết hạn.
- Chính mình được xác định theo `.info/connected`, nên lần đầu mở app hồ sơ của bạn không còn hiện “Ngoại tuyến”.
- Số “đang trực tuyến” chỉ đếm uid còn trong `/members` ⇒ khớp với danh sách, không còn cộng nhầm tài khoản đã xoá.
- `lastSeen` được ghi khi kết nối, khi rời trang (`pagehide`), khi quay lại tab và tối đa 4 phút một lần.
- Hồ sơ thành viên **vẽ lại được**: mở khi dữ liệu chưa tải xong sẽ hiện “Đang tải hồ sơ…”, rồi tự cập nhật
  ngay khi `/members`, `presence` hoặc email về (trước đây phải đóng rồi mở lại). Nhãn “Hoạt động gần nhất”
  đổi sang dạng tương đối: *Vừa xong · 5 phút trước · 3 giờ trước*, và là “Đang trực tuyến” khi người đó online.
- Không thêm node mới ⇒ **Rules Realtime Database không cần thay đổi**.

## Chặn vĩnh viễn & giới hạn 2 tài khoản mỗi thiết bị/IP

Ba lớp chặn, tất cả đều **vĩnh viễn cho tới khi quản trị viên gỡ**:

| Lớp | Node | Ai ghi | Hiệu lực |
|---|---|---|---|
| Tài khoản | `/bans/<uid>` (`permanent: true`) | admin | chặn ngay khi đăng nhập, listener đá ra tức thì |
| Thiết bị | `/deviceBans/<deviceHash>` | admin | chặn trước khi vào app, kể cả tài khoản mới |
| IP | `/ipBans/<ipHash>` | admin | như trên (cần Cloud Function để biết IP) |

- **Mã thiết bị** = băm SHA-256 của dấu vân tay trình duyệt + UUID lưu trong `localStorage`
  (`catchat-device-id-v1`). Mở hồ sơ thành viên (vai trò admin) sẽ thấy **Mã thiết bị / Mã IP** kèm nút sao chép.
- **Mã IP** chỉ có khi triển khai `functions/getClientIdentity` và bật `enableIdentityFunction: true`
  trong `config.js`. Không có hàm này thì app vẫn chặn theo thiết bị, chỉ là không chặn được IP.
- **Giới hạn 2 tài khoản**: mỗi lần đăng nhập, `/identityLedger/<deviceHash>/<uid>` và
  `/identityIpLedger/<ipHash>/<uid>` được ghi lại. Khi một định danh có **quá 2 uid**, hệ thống:
  1. tạo `/identityLocks/<hash>` = `{ kind, reason, uids }` → mọi tài khoản trong đó bị chặn vào app;
  2. cấm `/bans/<uid>` (nếu phiên hiện tại là admin) và dọn dữ liệu hồ sơ;
  3. phiên đang dùng bị đăng xuất ngay kèm thông báo lý do.
  Đã deploy `onIdentityLedgerWrite` thì bước này chạy ở **máy chủ**, tự xoá cả Firebase Auth.
- Tab **Quản trị → Chặn vĩnh viễn** liệt kê 3 danh sách trên, thêm chặn tay bằng mã, bỏ chặn, và nút
  “Xoá toàn bộ tài khoản trong khoá”. Hồ sơ thành viên có thêm nút **Cấm vĩnh viễn (tài khoản + thiết bị + IP)**.

> Giới hạn cần biết: dấu vân tay trình duyệt có thể đổi (xoá dữ liệu, ẩn danh, đổi máy) và IP công cộng
> chỉ đọc được ở server. Đây là lớp giảm lạm dụng, **không phải** bằng chứng tuyệt đối — chặn thật phải
> dựa vào Firebase Rules + App Check + Cloud Function (xem `SECURITY.md`).

## Tên hiển thị: duy nhất với tên thường, dùng chung với tên kiểu “admin”

Mỗi tên chỉ thuộc về một người. Khi đăng ký, tên được chuẩn hoá rồi “giữ chỗ” trong
`/displayNames/<slug> = <uid>` bằng transaction, nên hai người bấm cùng lúc cũng chỉ một người thắng:

| Tên nhập | slug |
|---|---|
| `Mèo Con` | `meo-con` |
| `mèo   con` | `meo-con` |
| `Đường` | `duong` |

- Trùng tên ⇒ app báo ngay **tại ô tên** kèm gợi ý `Tên 2` và chưa tạo tài khoản (nếu vẫn lọt qua bước
  kiểm tra, tài khoản vừa tạo bị xoá ngay để không để lại rác).
- **Ngoại lệ — tên kiểu quản trị** (`admin`, `administrator`, `quantri`, `root`, `system`, và tên của
  chính các tài khoản trong `/admins`): đây là **tên dùng chung**, không giữ khoá `/displayNames`, nên
  nhiều người cùng đặt được và quản trị thật không bị mất tên. Phân biệt bằng nhãn “Quản trị” /
  “Thành viên” ngay sau tên (xem `features/admin-badges.js`).
- **Không tự đổi tên người dùng.** Nếu lúc đăng nhập phát hiện trùng tên (dữ liệu cũ), app giữ nguyên
  tên đã chọn thay vì thêm hậu tố `(abcd)` như trước, và chỉ ghi cảnh báo cho quản trị.
- Khi tên đổi, khoá tên cũ được dọn tự động (`forgetOtherSlugs`); khi xoá tài khoản, khoá tên được
  giải phóng để người khác dùng lại.
- Cần node `displayNames` trong Rules (đã có trong cả hai file Rules); thiếu node thì app **không**
  chặn đăng nhập mà chỉ cảnh báo trong console.

> Rules không chuẩn hoá được chuỗi (không có `toLowerCase`), nên slug do trình duyệt tính. Đây là lớp
> chặn trùng tên cho luồng bình thường; muốn chặn tuyệt đối phải dùng Cloud Function.

## Xoá kênh

Quản trị viên mở kênh rồi bấm nút **xoá kênh** (biểu tượng `#` gạch chéo) trên thanh tiêu đề kênh:
xác nhận + lý do → app dọn `channelMessages/<id>` (kèm reaction), `pins`, `locks`, `typing`, rồi xoá
`channels/<id>`. Mọi người đang ở trong kênh đó được tự chuyển về `#phòng-chung`.

- Thứ tự quan trọng: tin nhắn bị xoá **trước** khi kênh biến mất, vì Rules xoá tin nhắn yêu cầu
  `/channels/<id>` còn tồn tại.
- Kênh hệ thống `#phòng-chung` và `#thông-báo` không xoá được (cả ở UI lẫn Rules).
- Hành động được ghi vào `/adminLog` với số tin nhắn đã xoá kèm lý do.

## Bố cục gọn kiểu Discord

`assets/css/compact.css` (nạp sau `polish.css`, trước `mobile.css`) chỉnh **mật độ**, không đổi bảng màu:

- Sidebar 228px, thanh trên 58px, thanh kênh 54px, danh sách thành viên 264px — mắt đọc nhanh hơn.
- Bong bóng tin nhắn 7×10px, avatar 28px, khoảng cách giữa tin 8px, gộp tin liền mạch chặt hơn.
- Khung soạn tin thấp hơn (textarea tối đa 96px), nhãn gợi ý nhỏ lại; emote chèn qua nút 🙂 trên thanh soạn.
- Bỏ `backdrop-filter` ở sidebar (diện tích lớn, tốn GPU nhất khi cuộn) và giảm blur thanh trên.
- Chuyển cảnh ngắn hơn (~0.22s / 0.13s) để cảm giác phản hồi nhanh, vẫn tôn trọng tuỳ chọn giảm chuyển động.

## Bảo mật

Xem [SECURITY.md](SECURITY.md) để biết chi tiết. Tóm tắt những gì đã có:

- `CatChatGuard` (`assets/js/app/security.js`): token bucket, phạt tăng dần, thử thách proof-of-work.
- `anti-flood.js`: 8 tin/15s, cách nhau 600ms, chặn tin trùng, 12 reaction/10s.
- `login-guard.js`: tối đa 5 lần đăng nhập/phút, khoá 1→30 phút, giữ trạng thái qua localStorage.
- CSP + `referrer` policy trong `index.html`; App Check (tuỳ chọn) trong `assets/js/app/appcheck.js`.

> Chống DDoS thật phải nằm ở hạ tầng (App Check + Rules + quota/budget alert). Lớp phía trình duyệt
> chỉ giảm lạm dụng và bảo vệ trải nghiệm, không thay thế được máy chủ.

## Xoá tài khoản thành viên (admin)

Vào **hồ sơ thành viên** hoặc **Quản trị → Thành viên** → nút `⛔` (user-x), hoặc bảng lệnh `Alt+K`
→ “Xoá tài khoản thành viên”.

Một lần xoá gồm các bước:

1. Ghi `/deletedUsers/<uid>` — lưu ai xoá ai, lúc nào (chỉ admin đọc được).
2. Ghi `/bans/<uid>` với `deleted: true` — người bị xoá bị **đăng xuất ngay** và không đăng nhập lại được.
3. Xoá `/members/<uid>`, `/memberEmails/<uid>`, `/mutes/<uid>`, reaction của họ trong các tin đang hiển thị;
   tuỳ chọn xoá luôn tin nhắn của họ trong kênh đang mở.
4. Ghi `/adminLog` type `deleteAccount`.
5. (Tuỳ chọn) gọi Cloud Function `deleteUserAccount` để xoá luôn bản ghi **Firebase Authentication**.

> Trình duyệt không thể xoá tài khoản Auth của người khác — cần Admin SDK. Deploy thư mục `functions/`
> rồi đặt `enableAccountDeletionFunction: true` trong `assets/js/app/config.js`, hoặc xoá tay trong
> Firebase Console → Authentication. Xem [functions/README.md](functions/README.md).

Admin không xoá được: chính mình, hoặc một tài khoản đang là admin (phải hạ quyền trước).

## Không có Firebase Storage (gói miễn phí)

Dự án vẫn chạy đủ tính năng chat khi chưa bật Storage:

- **Gửi ảnh**: bấm nút đính kèm → app hỏi **liên kết ảnh https://** thay vì mở hộp chọn tệp.
  Ảnh chỉ là URL công khai lưu trong `imageURL` của tin nhắn (≤ 4096 ký tự, Rules cho phép),
  **không upload gì lên Firebase** nên không cần Storage, không tốn quota.
- **Ảnh đại diện**: dùng chữ cái đầu của tên (avatar chữ) — không cần Storage.
- Nếu lỡ bật Storage sau này, app tự nhận và quay lại luồng chọn tệp bình thường; khi gặp lỗi
  kiểu `storage/bucket-not-found`, app tự chuyển sang chế độ liên kết và báo một lần.
- `storage.rules` trong repo để dành cho lúc bật Storage; **không dán cũng không sao** —
  chỉ ảnh upload mới cần tới nó.

## Firebase

- Bật Authentication (Email/Password), Realtime Database và Storage.
- Dán Security Rules cho **Realtime Database** — đây mới là thứ quyết định quyền ghi thật, UI chỉ ẩn/hiện nút.
  Mở [`database.rules.json`](database.rules.json) → copy **toàn bộ file** → dán vào Console → Realtime Database
  → Rules → Publish. Đây là bộ Rules duy nhất của dự án:

  - gốc **đóng** (`".read": false`, `".write": false`), mở quyền theo từng node;
  - 23 node, gồm cả `displayNames`, `adminBadges`, `pins`, `locks`, `typing`, `mutes`, `adminLog`,
    `deletedUsers`
    và 6 node định danh (`memberIdentity`, `identityLedger`, `identityIpLedger`, `deviceBans`, `ipBans`, `identityLocks`);
  - admin = `/admins/<uid> = true` ∨ `auth.token.email === 'admin@com.vn'` ∨ `auth.token.admin === true`.

> ⚠️ Không tự thêm quyền ở gốc. Nếu gốc mở (`"true"`), người bị cấm tự xoá được `/bans/<uid>`,
> `/deviceBans/<mã>`, `/identityLocks/<mã>` và tự thêm mình vào `/admins` — mọi lớp chặn thành hình thức.
> Node `/admins` chỉ admin hiện tại ghi được; tài khoản quản trị đầu tiên đặt tay trong Console
> (Console bỏ qua Rules).
- Ảnh chat và avatar dùng **Storage Rules** riêng, không nằm trong Rules của Realtime Database.
  Mở [`storage.rules`](storage.rules) → copy **toàn bộ file** → Console → Storage → Rules → Publish.
  Chỉ chủ tài khoản ghi được vào `chatImages/<uid>/…` (≤ 5 MB) và `avatars/<uid>/…` (≤ 8 MB),
  `contentType` phải là `image/*`; mọi đường dẫn khác bị chặn.
- `/adminLog` là **append-only**: admin chỉ `push` được mục mới, không xoá/sửa. Nút “Dọn nhật ký”
  trong bảng quản trị chỉ ghi thêm một dấu `log-purge` để ẩn mục cũ khỏi giao diện — bản ghi gốc
  vẫn còn để kiểm toán.
- Tin nhắn: Rules đối chiếu `name` với `/members/<uid>/name` và đòi `timestamp` không lệch quá
  5 phút so với giờ máy chủ ⇒ không giả danh admin, không đẩy tin lên đầu bằng timestamp tương lai.
- Tài khoản `admin@com.vn` (hoặc UID có `/admins/<uid> = true`) sẽ thấy bảng quản trị.

## Chạy thử cục bộ

Chỉ xem giao diện (vẫn cần Internet cho Firebase SDK):

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Kiểm tra toàn bộ mã trước khi commit (không cần cài gì):

```bash
node scripts/verify.mjs
# · tham chiếu tài nguyên trong index.html
# · node --check cho 45+ tệp JS (kể cả functions/, sw.js)
# · CSS cân bằng ngoặc · JSON hợp lệ · icon PWA · Rules gốc đóng, không numChildren()
```

### Kiểm thử tự động (không cần Firebase thật)

```bash
node scripts/verify.mjs        # cú pháp JS/CSS/JSON, tài nguyên, PWA, Rules tĩnh
node tests/rules.test.mjs      # mô phỏng Rules: 38 tình huống quyền ghi
cd tests && npm install && npm test   # 9 tệp: rules, mobile, ui-mode, mobile-ui, smoke, flows,
                                      #        deep-link, resilience, names
```

Chạy riêng từng tệp cũng được (đứng ở thư mục gốc repo):

```bash
node tests/flows.test.mjs      # luồng người dùng thật: gửi/sửa/ghim/nháp/kênh/mobile
node tests/deep-link.test.mjs  # lối tắt PWA ?view=chat|members|announcements
```

- `tests/rules.test.mjs` dịch biểu thức trong `database.rules.json` sang JS rồi chạy:
  giả danh admin, giả uid, timestamp tương lai, sửa/xoá tin người khác, adminLog append-only,
  khách chưa đăng nhập, kênh không tồn tại… Không cần Emulator, chạy trong ~0,1 giây.
- `tests/harness.mjs` là khung dùng chung cho smoke/flows/deep-link: nhúng CSS/JS thật vào jsdom, thay
  Firebase bằng RTDB trong bộ nhớ (**không có Storage**) và phát giá trị hiện có ngay khi đăng ký
  listener, giống RTDB thật.
- `tests/smoke.test.mjs` kiểm cấu trúc + menu `⋯`, phân quyền admin/thường, thông báo toàn máy chủ, chế
  độ dán ảnh bằng liên kết, gửi tin kèm `imageURL`, và bắt lỗi runtime.
- `tests/flows.test.mjs` bấm/gõ như người dùng: gửi tin, trả lời, reaction, tìm kiếm, theme, danh bạ,
  tin đã lưu, quản trị, mobile, lệnh `/shrug`, sửa + ghim tin, bật/thoát thông báo, tạo kênh, nháp theo kênh.
- `tests/deep-link.test.mjs` kiểm lối tắt PWA đọc `?view=`, chỉ nhận 3 giá trị hợp lệ, chỉ áp dụng sau
  khi đăng nhập và xoá tham số khỏi địa chỉ sau khi dùng.
- `tests/resilience.test.mjs` kiểm đường "mạng yếu": `early-guard.js` nạp trước Firebase SDK, splash hiện
  lỗi + nút Thử lại, `sw.js` có hạn chờ mạng rồi dùng cache; và đường "ngăn kéo mobile": bấm kênh luôn
  đóng ngăn kéo, lớp mờ tự ẩn khi mất `data-mobile-sheet`.
- `tests/names.test.mjs` kiểm tên hiển thị: đăng ký tên “admin” thành công và giữ nguyên tên, tên thường
  vẫn duy nhất, không tự thêm hậu tố `(xxxx)`, nhãn “Quản trị”/“Thành viên” trong tin nhắn + danh bạ,
  xoá tài khoản giải phóng khoá tên.
- `tests/mobile.test.mjs` tự đánh giá `@media` + specificity trên 20 tệp CSS ở 3 khổ màn hình
  (390px cảm ứng, 820px iPad, 1280px chuột) để chắc rằng rule mobile **thực sự thắng**:
  chữ tin nhắn 15px, ô soạn tin 16px, mục menu 44px, nút `⋯` hiện trên iPad, desktop không đổi.
  Test cũng chốt rằng **mọi** luật của `mobile-app.css` nằm trong `html[data-ui="mobile"]` (hoặc
  `html:not([data-ui="mobile"])` để ẩn khung mới trên máy tính), thanh tab dùng `grid`, ngăn kéo
  `fixed` + `visibility: hidden` khi đóng, và **thứ tự xếp lớp `thanh tab < lớp mờ < ngăn kéo`** —
  đúng lỗi “bấm Kênh bị mờ”.
- `tests/mobile-ui.test.mjs` còn kiểm nút ✕ của ngăn kéo, ô lọc kênh (gõ có dấu/không dấu, thông báo
  “không tìm thấy”, tự xoá bộ lọc khi đóng, tự áp lại khi danh sách kênh được vẽ lại).
- `tests/ui-mode.test.mjs` kiểm bộ nhận diện thiết bị: 360/390px cảm ứng → `mobile`, iPad 1024px cảm ứng
  → `mobile`, laptop 1280px và laptop cảm ứng 1100px → `desktop`; `?ui=desktop` / `?ui=mobile` ép được.
- `tests/mobile-ui.test.mjs` dựng DOM tối thiểu rồi bấm thử: mở/đóng ngăn kéo, aria-expanded, lớp mờ,
  Esc, chọn kênh tự đóng, các mục trong bảng cài đặt gọi đúng nút cũ, phản chiếu trạng thái kết nối,
  ẩn thanh tab khi đăng xuất và khi chuyển sang giao diện máy tính.
- Cả chín chạy tự động trong GitHub Actions (`.github/workflows/deploy.yml`): job **Kiểm tra tĩnh**
  chạy `verify` + `rules`, job **Kiểm thử giao diện (jsdom)** cài jsdom rồi chạy `npm test`.

### Firebase Emulator (chạy full stack ở máy)

```bash
npm install -g firebase-tools
firebase emulators:start            # auth 9099 · database 9000 · storage 9199 · UI 4000
firebase emulators:start --only auth,database,storage,hosting
```

`firebase.json` đã khai báo đủ cổng. Muốn app nói chuyện với emulator, thêm một lần trong Console
của trình duyệt (chỉ khi phát triển):

```js
firebase.database().useEmulator('localhost', 9000);
firebase.auth().useEmulator('http://localhost:9099');
firebase.storage().useEmulator('localhost', 9199);
```

### Cloud Functions

```bash
cd functions
npm install            # firebase-admin + firebase-functions, engines Node 22
npm run check          # node --check index.js
cd ..
firebase deploy --only functions
```

Deploy xong thì bật trong `assets/js/app/config.js`:
`enableAccountDeletionFunction: true` (xoá tài khoản Auth) và `enableIdentityFunction: true`
(lấy IP thật cho giới hạn thiết bị/IP).

### PWA

- `manifest.webmanifest` + `sw.js` đã có sẵn: mở bằng HTTPS (GitHub Pages/Firebase Hosting) là
  cài được lên màn hình chính/desktop.
- Trang, JS và CSS tải **network-first** ⇒ deploy xong là thấy bản mới ngay (tên tệp không có hash);
  ảnh/icon dùng stale-while-revalidate; **không** cache dữ liệu Firebase.
- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`) được cache riêng, trả cache trước và
  cập nhật ngầm: mở app nhanh hơn và ngoại tuyến vẫn giữ đúng font. Cache font tự dọn còn 24 mục.
- Khi sửa nhiều tệp tĩnh và muốn xoá cache cũ ngay, tăng `VERSION` trong `sw.js`
  (hiện là `catchat-v8`).

### CI/CD

`.github/workflows/deploy.yml` chạy `node scripts/verify.mjs` cho mọi push/PR vào `main`.
Muốn tự deploy Firebase Hosting: tạo secret `FIREBASE_SERVICE_ACCOUNT` (JSON của service account
có quyền Firebase Hosting Admin). Không có secret thì job deploy được bỏ qua, GitHub Pages vẫn phục vụ
nhánh `main` như trước.

> Rules và Functions **không** tự deploy trong CI: chủ dự án dán Rules tay trong Console để kiểm soát
> từng thay đổi, và deploy Functions bằng lệnh ở trên.
