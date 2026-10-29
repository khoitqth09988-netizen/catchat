/* CatChat · Icon, textElement, avatar, thông báo auth, helper quyền admin và mute.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.appendChild(use);
  return svg;
}

/**
 * Chờ một promise nhưng KHÔNG BAO GIỜ chờ quá `ms`.
 *
 * Vì sao cần: các lệnh đọc/ghi Realtime Database khi mất mạng (hoặc khi trình duyệt
 * chặn kết nối) không lỗi mà **treo** — chúng xếp hàng chờ có mạng. Chỉ cần một await
 * như vậy nằm trong luồng khởi động là splash đứng im mãi dù “mạng khoẻ”. Với helper
 * này, mọi bước ở cổng vào đều có hạn chót và app luôn mở được.
 *
 * @param {Promise} promise   việc cần chờ
 * @param {number}  ms        hạn chót (mili giây)
 * @param {*}       fallback  giá trị trả về khi quá giờ (mặc định null)
 * @param {string}  label     nhãn để ghi log khi quá giờ
 */
function withTimeout(promise, ms, fallback = null, label = '') {
  const limit = Number(ms) > 0 ? Number(ms) : 4000;
  let timer = 0;
  const timeout = new Promise((resolve) => {
    timer = window.setTimeout(() => {
      if (label) console.warn(`Quá ${limit}ms khi ${label} — bỏ qua để app vẫn mở được.`);
      resolve(fallback);
    }, limit);
  });
  const work = Promise.resolve(promise).then(
    (value) => value,
    (error) => {
      if (label) console.warn(`Lỗi khi ${label}:`, error?.message || error);
      return fallback;
    }
  );
  return Promise.race([work, timeout]).finally(() => window.clearTimeout(timer));
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function isMuted(uid) {
  const entry = uid ? mutes[uid] : null;
  if (!entry) return false;
  const until = Number(entry.until) || 0;
  return until === 0 || until > Date.now();
}

function activeMutes() {
  return Object.entries(mutes).filter(([uid]) => isMuted(uid));
}

function muteRemainingLabel(entry) {
  const until = Number(entry?.until) || 0;
  if (!until) return 'vĩnh viễn';
  const remaining = until - Date.now();
  if (remaining <= 0) return 'đã hết hạn';
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `còn ${hours} giờ`;
  return `còn ${Math.ceil(hours / 24)} ngày`;
}

function isAdminEmail(user = currentUser) {
  const email = String(user?.email || '').trim().toLocaleLowerCase('en');
  return ADMIN_EMAILS.includes(email);
}

function computeIsAdmin() {
  return hasAdminMarker || hasAdminClaim || hasAdminEmail;
}

function displayNameFor(user = currentUser) {
  if (!user) return 'Thành viên';
  return (user.displayName || user.email?.split('@')[0] || 'Thành viên').trim();
}

function initialsFor(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toLocaleUpperCase('vi-VN');
  return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toLocaleUpperCase('vi-VN');
}

function safeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) { return ''; }
}

function setAvatarContent(element, name, photoURL = '') {
  const safeURL = safeImageUrl(photoURL);
  element.replaceChildren();
  if (!safeURL) {
    element.textContent = initialsFor(name);
    return;
  }
  const image = document.createElement('img');
  image.src = safeURL;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    image.remove();
    if (!element.querySelector('img')) element.appendChild(document.createTextNode(initialsFor(name)));
  }, { once: true });
  element.appendChild(image);
}

function makeAvatar(name, uid, className = 'avatar', photoURL = '') {
  const avatar = textElement('div', className);
  setAvatarContent(avatar, name, photoURL);
  avatar.setAttribute('aria-label', name || 'Thành viên');
  avatar.title = name || 'Thành viên';
  return avatar;
}

function setAuthNotice(message, tone = 'error') {
  if (!message) {
    els.authNotice.hidden = true;
    els.authNoticeText.textContent = '';
    els.authNotice.classList.remove('success', 'info');
    return;
  }
  els.authNotice.hidden = false;
  els.authNoticeText.textContent = message;
  els.authNotice.classList.toggle('success', tone === 'success');
  els.authNotice.classList.toggle('info', tone === 'info');
}

function setAuthError(message) {
  els.authError.hidden = !message;
  els.authErrorText.textContent = message || '';
}

function setAuthBusy(busy) {
  els.authSubmit.disabled = busy;
  els.authSubmitText.textContent = busy ? 'Đang xử lý...' : (isSignUp ? 'Tạo tài khoản' : 'Đăng nhập');
  els.authSubmitArrow.hidden = busy;
  els.authSpinner.hidden = !busy;
}

function friendlyAuthError(error) {
  const code = error?.code || '';
  const messagesByCode = {
    'auth/invalid-email': 'Địa chỉ email chưa đúng định dạng.',
    'auth/user-not-found': 'Không tìm thấy tài khoản này. Hãy kiểm tra email hoặc đăng ký mới.',
    'auth/wrong-password': 'Mật khẩu chưa chính xác. Vui lòng thử lại.',
    'auth/invalid-credential': 'Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.',
    'auth/email-already-in-use': 'Email này đã được sử dụng. Hãy đăng nhập hoặc dùng email khác.',
    'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.',
    'auth/too-many-requests': 'Bạn đã thử quá nhiều lần. Vui lòng chờ một chút rồi thử lại.',
    'auth/network-request-failed': 'Không thể kết nối máy chủ. Hãy kiểm tra mạng rồi thử lại.',
    'auth/operation-not-allowed': 'Firebase chưa bật phương thức đăng nhập email/mật khẩu.',
    'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa.',
    'auth/requires-recent-login': 'Vui lòng đăng nhập lại rồi thử thao tác này.',
    'auth/invalid-action-code': 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
  };
  return messagesByCode[code] || 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
}
