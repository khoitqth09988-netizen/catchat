/* CatChat · Trạng thái Firebase Storage và chế độ "không có Storage".
   Gói miễn phí (Spark) có thể chưa bật được Storage. Khi đó app KHÔNG được vỡ:
   - Ảnh đính kèm chuyển sang chế độ dán liên kết https:// (không upload gì).
   - Ảnh đại diện dùng chữ cái đầu (makeAvatar đã hỗ trợ sẵn).
   - Nút đính kèm đổi nhãn để người dùng biết vì sao không mở hộp chọn tệp.
   Nạp sau database.js, trước composer.js/session.js. */
'use strict';

let storageAvailable = true;
let storageNoticeShown = false;

const STORAGE_DISABLED_HINT = 'Dự án chưa bật Firebase Storage nên chưa tải ảnh lên được. Bạn vẫn chat bình thường; muốn gửi ảnh, hãy dán liên kết https:// của ảnh.';

/** Storage có dùng được không (đã khởi tạo và chưa gặp lỗi bucket/quyền). */
function storageReady() {
  return Boolean(storage) && storageAvailable;
}

/** Lỗi thuộc về hạ tầng Storage (bucket chưa tạo, project chưa bật Storage…)
    — khác với lỗi Rules (storage/unauthorized) chỉ cần sửa quyền. */
function isStorageUnavailableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  if (code === 'storage/bucket-not-found' || code === 'storage/unknown' || code === 'storage/retry-limit-exceeded') return true;
  if (code === 'storage/project-not-found') return true;
  return /bucket.*not.*(found|exist)|no default bucket|does not exist|project.*not.*found|cors/.test(message);
}

/** Tắt mọi lần upload về sau và cập nhật giao diện cho khớp. */
function markStorageUnavailable(error) {
  if (!storageAvailable) return;
  storageAvailable = false;
  console.warn('Firebase Storage không dùng được, chuyển sang chế độ dán liên kết ảnh:', error);
  refreshMediaUi();
  if (!storageNoticeShown) {
    storageNoticeShown = true;
    toast(STORAGE_DISABLED_HINT, 'info');
  }
}

/** Đồng bộ nhãn nút đính kèm / đổi ảnh đại diện với trạng thái Storage. */
function refreshMediaUi() {
  const ready = storageReady();
  if (typeof els === 'undefined' || !els) return;
  if (els.attachImageButton) {
    els.attachImageButton.title = ready ? 'Đính kèm ảnh' : 'Đính kèm ảnh bằng liên kết (Firebase Storage chưa bật)';
    els.attachImageButton.setAttribute('aria-label', els.attachImageButton.title);
    els.attachImageButton.classList.toggle('is-link-only', !ready);
  }
  if (els.sidebarAvatar) {
    els.sidebarAvatar.title = ready ? 'Đổi ảnh đại diện' : 'Đổi ảnh đại diện cần Firebase Storage';
  }
}

/** Báo cho người dùng biết vì sao không mở được hộp chọn ảnh. */
function showStorageHint() {
  toast(STORAGE_DISABLED_HINT, 'info');
}
