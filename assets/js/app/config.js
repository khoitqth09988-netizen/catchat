/* CatChat · Hằng số, cấu hình Firebase và helper DOM ($ / $$).
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

const ADMIN_EMAILS = ['admin@com.vn'];
const REACTIONS = [
  { key: 'like', glyph: '👍', label: 'Thích' },
  { key: 'heart', glyph: '❤️', label: 'Yêu thích' },
  { key: 'laugh', glyph: '😂', label: 'Haha' },
  { key: 'wow', glyph: '😮', label: 'Ngạc nhiên' }
];
const THEME_OPTIONS = [
  { id: 'light', name: 'Sữa ấm', color: '#fdf6ee' },
  { id: 'dark', name: 'Đêm mèo', color: '#161219' },
  { id: 'lavender', name: 'Hoa anh đào', color: '#fdf3f6' },
  { id: 'ocean', name: 'Trà xanh', color: '#f2f8f1' },
  { id: 'halloween', name: 'Halloween', color: '#140f1c' }
];
const firebaseConfig = {
  apiKey: "AIzaSyAf8xiMmAipgxxrGVDjeLdQIeU1yqVEXu0",
  authDomain: "chat-e58b5.firebaseapp.com",
  databaseURL: "https://chat-e58b5-default-rtdb.firebaseio.com",
  projectId: "chat-e58b5",
  storageBucket: "chat-e58b5.firebasestorage.app",
  messagingSenderId: "723561612208",
  appId: "1:723561612208:web:03f38d2ac4b85e59e18c75",
  // Tuỳ chọn nhưng rất nên bật khi chạy thật: Firebase App Check (reCAPTCHA v3).
  // Lấy site key ở Firebase Console → App Check → Apps → reCAPTCHA v3, rồi dán vào đây.
  // Để trống thì app chạy bình thường, chỉ là không có lớp xác thực thiết bị ở phía máy chủ.
  appCheckSiteKey: "",
  // Xoá tài khoản Firebase Auth của người khác chỉ làm được bằng Admin SDK.
  // Deploy thư mục functions/ rồi đổi thành true để app gọi Cloud Function deleteUserAccount.
  // Để false: app vẫn xoá dữ liệu + cấm vĩnh viễn UID, nhưng bản ghi Auth phải xoá tay trong Console.
  enableAccountDeletionFunction: false,
  functionsRegion: "us-central1"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
