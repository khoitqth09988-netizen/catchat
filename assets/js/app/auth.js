/* CatChat · Chuyển chế độ đăng nhập, đăng nhập/đăng ký và gửi mail đặt lại mật khẩu.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

function switchAuthMode() {
  isSignUp = !isSignUp;
  setAuthError('');
  setAuthNotice('');
  els.authForm.classList.remove('mode-pulse');
  void els.authForm.offsetWidth;
  els.authForm.classList.add('mode-pulse');
  els.displayNameField.hidden = !isSignUp;
  els.confirmPasswordField.hidden = !isSignUp;
  els.displayName.required = isSignUp;
  els.confirmPassword.required = isSignUp;
  els.password.autocomplete = isSignUp ? 'new-password' : 'current-password';
  els.authTitle.textContent = isSignUp ? 'Tạo tài khoản' : 'Đăng nhập';
  els.authEyebrow.textContent = isSignUp ? 'BẮT ĐẦU KẾT NỐI' : 'RẤT VUI ĐƯỢC GẶP LẠI';
  els.authDescription.textContent = isSignUp
    ? 'Tạo tài khoản miễn phí để tham gia không gian CatChat.'
    : 'Đăng nhập để tiếp tục những câu chuyện còn dang dở.';
  els.authSubmitText.textContent = isSignUp ? 'Tạo tài khoản' : 'Đăng nhập';
  $('#authSwitchText').firstChild.textContent = isSignUp ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? ';
  els.toggleAuthMode.textContent = isSignUp ? 'Đăng nhập' : 'Đăng ký ngay';
  els.forgotPassword.hidden = isSignUp;
  window.setTimeout(() => (isSignUp ? els.displayName : els.email).focus(), 90);
}

async function submitAuth(event) {
  event.preventDefault();
  setAuthError('');
  setAuthNotice('');
  if (!firebaseReady || !auth) {
    setAuthError('Dịch vụ đăng nhập chưa sẵn sàng. Hãy tải lại trang hoặc kiểm tra kết nối Firebase.');
    return;
  }
  const email = els.email.value.trim();
  const password = els.password.value;
  const displayName = els.displayName.value.trim();
  const confirmPassword = els.confirmPassword.value;
  if (!email || !password) {
    setAuthError('Vui lòng nhập email và mật khẩu.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthError('Địa chỉ email chưa đúng định dạng.');
    els.email.focus();
    return;
  }
  if (password.length < 6) {
    setAuthError('Mật khẩu cần có ít nhất 6 ký tự.');
    els.password.focus();
    return;
  }
  if (isSignUp && !displayName) {
    setAuthError('Vui lòng nhập tên hiển thị.');
    els.displayName.focus();
    return;
  }
  if (isSignUp && displayName.length > 32) {
    setAuthError('Tên hiển thị không được dài quá 32 ký tự.');
    els.displayName.focus();
    return;
  }
  if (isSignUp && password !== confirmPassword) {
    setAuthError('Mật khẩu xác nhận chưa khớp.');
    els.confirmPassword.focus();
    return;
  }

  // Tên kiểu “admin” (admin, root, quản trị…) là tên dùng chung: ai cũng đặt được, không
  // chiếm khoá duy nhất, và được phân biệt bằng nhãn “Quản trị viên” / “Thành viên” trong
  // danh sách thành viên và dưới mỗi tin nhắn. Với các tên khác, tên vẫn là duy nhất nên
  // kiểm trước khi tạo tài khoản: báo ngay tại ô tên thay vì tạo rồi xoá.
  if (isSignUp && window.CatChat?.names) {
    setAuthBusy(true);
    try {
      // Mạng yếu: kiểm tra tên cũng phải có hạn chót, nếu không nút sẽ quay mãi.
      const shared = await withTimeout(CatChat.names.isShared(displayName), 5000, false, 'kiểm tra tên dùng chung');
      if (!shared && await withTimeout(CatChat.names.holderOf(displayName), 5000, null, 'kiểm tra tên đã có người dùng')) {
        const suggestion = await CatChat.names.suggest(displayName);
        els.displayName.value = suggestion;
        setAuthError(`Tên hiển thị “${displayName}” đã có người dùng. Thử “${suggestion}” hoặc một tên khác nhé.`);
        els.displayName.focus();
        return;
      }
    } catch (error) {
      console.warn('Chưa kiểm tra được tên hiển thị:', error);
    } finally {
      setAuthBusy(false);
    }
  }

  setAuthBusy(true);
  // Mạng yếu: Firebase có thể mất 20–30 giây mới trả lời. Nói rõ là app vẫn đang
  // chạy thay vì để nút “Đăng nhập” quay im lặng.
  const slowTimer = window.setTimeout(() => {
    setAuthError('Mạng đang rất chậm — CatChat vẫn đang thử kết nối, bạn đợi thêm một chút nhé.');
  }, 8000);
  try {
    if (isSignUp) {
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      // Tên hiển thị là duy nhất: giữ chỗ /displayNames/<slug> trước khi lưu hồ sơ.
      const claim = window.CatChat?.names?.claim
        ? await withTimeout(CatChat.names.claim(credential.user.uid, displayName), 7000, { ok: true }, 'giữ tên hiển thị')
        : { ok: true };
      if (claim && claim.ok === false && claim.taken) {
        // Chưa có gì được ghi vào /members nên chỉ cần trả lại tài khoản vừa tạo.
        await credential.user.delete().catch(() => auth.signOut().catch(() => {}));
        const suggestion = await CatChat.names.suggest(displayName);
        els.displayName.value = suggestion;
        setAuthError(`Tên hiển thị “${displayName}” đã có người dùng. Thử “${suggestion}” hoặc một tên khác nhé.`);
        els.displayName.focus();
        return;
      }
      await credential.user.updateProfile({ displayName });
      try {
        await withTimeout(syncMemberProfile(credential.user), 7000, null, 'lưu hồ sơ thành viên');
      } catch (profileError) { console.warn('Không lưu được hồ sơ thành viên:', profileError); }
      setAuthNotice('Tài khoản đã được tạo. Đang mở không gian trò chuyện...', 'success');
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    setAuthError(friendlyAuthError(error));
  } finally {
    window.clearTimeout(slowTimer);
    setAuthBusy(false);
  }
}

async function sendPasswordReset() {
  setAuthError('');
  const email = els.email.value.trim();
  if (!email) {
    setAuthError('Nhập email của bạn trước, sau đó chọn “Quên mật khẩu?”.');
    els.email.focus();
    return;
  }
  if (!firebaseReady || !auth) {
    setAuthError('Dịch vụ đăng nhập chưa sẵn sàng.');
    return;
  }
  els.forgotPassword.disabled = true;
  try {
    await auth.sendPasswordResetEmail(email);
    setAuthNotice('Đã gửi hướng dẫn đặt lại mật khẩu tới email của bạn. Hãy kiểm tra cả thư mục spam.', 'success');
  } catch (error) {
    setAuthError(friendlyAuthError(error));
  } finally {
    els.forgotPassword.disabled = false;
  }
}
