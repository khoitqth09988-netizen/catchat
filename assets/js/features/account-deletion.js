/* CatChat · Feature: admin xoá tài khoản của thành viên khỏi hệ thống.
   Luồng xoá gồm 4 lớp, chạy tuần tự và báo rõ lớp nào lỗi:
     1. Ghi "bia mộ" /deletedUsers/<uid> để lưu vết ai xoá ai, lúc nào.
     2. Cấm vĩnh viễn /bans/<uid> (deleted: true) — người bị xoá bị đăng xuất ngay
        và không đăng nhập lại được, kể cả khi tài khoản Firebase Auth còn tồn tại.
     3. Xoá dữ liệu: /members, /memberEmails, /mutes, reaction, tuỳ chọn tin nhắn.
     4. Tuỳ chọn gọi Cloud Function `deleteUserAccount` để xoá luôn bản ghi Firebase Auth
        (cần deploy functions/ và bật enableAccountDeletionFunction trong config.js).

   Vì sao phải có bước 4 ở server: trình duyệt KHÔNG thể xoá tài khoản Auth của người khác,
   việc đó chỉ làm được bằng Firebase Admin SDK. */
'use strict';

(() => {
  const CONFIRM_WORD = 'XOA';
  const AUTH_FUNCTION_NAME = 'deleteUserAccount';

  let layer = null;
  let resolver = null;
  let targetUid = '';
  let options = { removeMessages: false, removeReactions: true };
  let busy = false;

  function accountLabel(uid) {
    const member = members[uid] || {};
    const email = memberEmails[uid]?.email || member.email || '';
    const name = memberDisplayName(uid, member);
    return { name, email, uid };
  }

  function buildDialog() {
    layer = document.createElement('div');
    layer.className = 'confirm-layer account-delete-layer';
    layer.id = 'accountDeleteLayer';
    layer.hidden = true;

    const dialog = document.createElement('section');
    dialog.className = 'confirm-dialog account-delete-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'accountDeleteTitle');
    dialog.setAttribute('aria-describedby', 'accountDeleteDescription');

    const head = document.createElement('div');
    head.className = 'account-delete-head';
    const headCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'account-delete-eyebrow';
    eyebrow.textContent = 'QUẢN TRỊ · KHÔNG THỂ HOÀN TÁC';
    const title = document.createElement('h2');
    title.id = 'accountDeleteTitle';
    title.textContent = 'Xoá tài khoản khỏi hệ thống?';
    headCopy.append(eyebrow, title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-button';
    close.setAttribute('aria-label', 'Đóng hộp thoại xoá tài khoản');
    close.appendChild(icon('close'));
    close.addEventListener('click', () => closeDialog(null));
    head.append(headCopy, close);

    const description = document.createElement('p');
    description.id = 'accountDeleteDescription';
    description.className = 'account-delete-copy';

    const target = document.createElement('div');
    target.className = 'account-delete-target';
    const targetAvatar = document.createElement('div');
    targetAvatar.className = 'account-delete-avatar';
    const targetCopy = document.createElement('div');
    targetCopy.className = 'account-delete-target-copy';
    const targetName = document.createElement('strong');
    const targetMeta = document.createElement('span');
    targetCopy.append(targetName, targetMeta);
    const copyUid = document.createElement('button');
    copyUid.type = 'button';
    copyUid.className = 'account-delete-copy-button';
    copyUid.textContent = 'Sao chép UID';
    copyUid.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(targetUid);
        toast('Đã sao chép UID để xoá trong Firebase Console.', 'success');
      } catch (error) {
        toast('Trình duyệt không cho sao chép tự động. UID đang hiện trong hộp thoại.', 'error');
      }
    });
    target.append(targetAvatar, targetCopy, copyUid);

    const list = document.createElement('ul');
    list.className = 'account-delete-list';
    [
      'Xoá hồ sơ thành viên, email liên kết và trạng thái cấm chat.',
      'Cấm vĩnh viễn UID này: bị đăng xuất ngay và không đăng nhập lại được.',
      'Lưu vết vào /deletedUsers để quản trị viên khác biết ai đã xoá.'
    ].forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    });

    const choices = document.createElement('div');
    choices.className = 'account-delete-choices';
    const makeChoice = (key, labelText, hintText, checked) => {
      const label = document.createElement('label');
      label.className = 'account-delete-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.accountDeleteOption = key;
      input.checked = checked;
      const copy = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = labelText;
      const small = document.createElement('small');
      small.textContent = hintText;
      copy.append(strong, small);
      label.append(input, copy);
      return label;
    };
    choices.append(
      makeChoice('removeReactions', 'Xoá reaction của người này', 'Dọn các lượt thả cảm xúc trong tin nhắn gần đây.', true),
      makeChoice('removeMessages', 'Xoá tin nhắn trong kênh đang mở', 'Chỉ kênh hiện tại, tối đa 100 tin gần nhất.', false)
    );

    const authNote = document.createElement('div');
    authNote.className = 'account-delete-note';
    const noteTitle = document.createElement('strong');
    noteTitle.textContent = 'Tài khoản đăng nhập Firebase Auth cần xoá ở máy chủ';
    const noteBody = document.createElement('p');
    noteBody.textContent = 'Trình duyệt không có quyền xoá tài khoản Auth của người khác. Sau khi xoá ở đây, hãy: (1) deploy functions/ rồi bật enableAccountDeletionFunction trong config.js, hoặc (2) vào Firebase Console → Authentication → tìm UID và xoá thủ công.';
    authNote.append(noteTitle, noteBody);

    const confirmWrap = document.createElement('label');
    confirmWrap.className = 'account-delete-confirm';
    const confirmLabel = document.createElement('span');
    const confirmCode = document.createElement('strong');
    confirmCode.textContent = CONFIRM_WORD;
    confirmLabel.append(document.createTextNode('Nhập '), confirmCode, document.createTextNode(' để xác nhận'));
    const confirmInput = document.createElement('input');
    confirmInput.type = 'text';
    confirmInput.autocomplete = 'off';
    confirmInput.spellcheck = false;
    confirmInput.dataset.accountDeleteConfirm = '1';
    confirmInput.setAttribute('aria-label', `Nhập ${CONFIRM_WORD} để xác nhận xoá tài khoản`);
    confirmWrap.append(confirmLabel, confirmInput);

    const footer = document.createElement('div');
    footer.className = 'account-delete-footer';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'account-delete-cancel';
    cancel.textContent = 'Huỷ';
    cancel.addEventListener('click', () => closeDialog(null));
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'account-delete-accept';
    accept.dataset.accountDeleteAccept = '1';
    accept.disabled = true;
    accept.textContent = 'Xoá tài khoản';
    accept.addEventListener('click', () => submitDialog());
    footer.append(cancel, accept);

    confirmInput.addEventListener('input', () => {
      accept.disabled = busy || confirmInput.value.trim().toUpperCase() !== CONFIRM_WORD;
    });
    confirmInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !accept.disabled) {
        event.preventDefault();
        submitDialog();
      }
    });

    dialog.append(head, description, target, list, choices, authNote, confirmWrap, footer);
    layer.appendChild(dialog);
    layer.addEventListener('click', (event) => {
      if (event.target === layer) closeDialog(null);
    });
    document.body.appendChild(layer);

    layer.__refs = {
      description, targetAvatar, targetName, targetMeta, confirmInput, accept, cancel,
      choices, noteBody
    };
  }

  function closeDialog(result) {
    if (!layer) return;
    layer.classList.remove('open');
    layer.hidden = true;
    document.body.classList.remove('body-locked');
    if (resolver) {
      const resolve = resolver;
      resolver = null;
      resolve(result);
    }
  }

  function submitDialog() {
    if (busy) return;
    const refs = layer?.__refs;
    if (!refs) return;
    if (refs.confirmInput.value.trim().toUpperCase() !== CONFIRM_WORD) return;
    options = {
      removeReactions: Boolean(refs.choices.querySelector('[data-account-delete-option="removeReactions"]')?.checked),
      removeMessages: Boolean(refs.choices.querySelector('[data-account-delete-option="removeMessages"]')?.checked)
    };
    busy = true;
    refs.accept.disabled = true;
    refs.accept.textContent = 'Đang xoá...';
    closeDialog({ confirmed: true, options });
    busy = false;
  }

  function openDialog(uid) {
    return new Promise((resolve) => {
      if (!layer) buildDialog();
      targetUid = uid;
      options = { removeMessages: false, removeReactions: true };
      const refs = layer.__refs;
      const info = accountLabel(uid);
      refs.description.textContent = 'Toàn bộ dữ liệu của thành viên này trong CatChat sẽ bị xoá và không thể khôi phục.';
      refs.targetAvatar.replaceChildren(makeAvatar(info.name, uid, 'avatar'));
      refs.targetName.textContent = info.name;
      refs.targetMeta.textContent = `${info.email || 'Không có email'} · UID ${uid}`;
      refs.confirmInput.value = '';
      refs.accept.disabled = true;
      refs.accept.textContent = 'Xoá tài khoản';
      refs.cancel.disabled = false;
      refs.choices.querySelectorAll('input').forEach((input) => {
        input.checked = input.dataset.accountDeleteOption === 'removeReactions';
      });
      layer.hidden = false;
      layer.classList.add('open');
      document.body.classList.add('body-locked');
      resolver = resolve;
      window.setTimeout(() => refs.confirmInput.focus(), 40);
    });
  }

  async function isAdminAccount(uid) {
    try {
      const snapshot = await adminsRef.child(uid).once('value');
      return snapshot.val() === true;
    } catch (error) {
      return false;
    }
  }

  /** Xoá reaction của một uid trong các tin nhắn đang có trong bộ nhớ. */
  async function removeUserReactions(uid) {
    if (!messageReactionsRef) return 0;
    const ids = Object.keys(messageReactions || {});
    if (!ids.length) return 0;
    const tasks = [];
    ids.forEach((messageId) => {
      const keys = Object.keys(messageReactions[messageId] || {});
      keys.forEach((reactionKey) => {
        if (messageReactions[messageId][reactionKey]?.[uid] === undefined) return;
        tasks.push(messageReactionsRef.child(messageId).child(reactionKey).child(uid).remove());
      });
    });
    const results = await Promise.allSettled(tasks);
    return results.filter((result) => result.status === 'fulfilled').length;
  }

  async function removeUserMessages(uid) {
    if (!messagesRef) return 0;
    const ids = Array.from(messages.entries()).filter(([, data]) => data && data.uid === uid).map(([id]) => id);
    if (!ids.length) return 0;
    const results = await Promise.allSettled(ids.map((id) => messagesRef.child(id).remove()));
    await Promise.allSettled(ids.map((id) => messageReactionsRef?.child(id).remove() ?? Promise.resolve()));
    return results.filter((result) => result.status === 'fulfilled').length;
  }

  /** Gọi Cloud Function (nếu đã cấu hình) để xoá bản ghi Firebase Auth. */
  async function callAuthDeletion(uid) {
    if (!firebaseConfig?.enableAccountDeletionFunction) return { attempted: false, deleted: false };
    try {
      if (!window.firebase?.functions) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Không tải được Firebase Functions SDK'));
          document.head.appendChild(script);
        });
      }
      const region = firebaseConfig.functionsRegion || 'us-central1';
      const callable = firebase.app().functions(region).httpsCallable(AUTH_FUNCTION_NAME);
      const result = await callable({ uid });
      return { attempted: true, deleted: Boolean(result?.data?.deleted), message: result?.data?.message || '' };
    } catch (error) {
      return { attempted: true, deleted: false, error: String(error?.message || error) };
    }
  }

  async function deleteMemberAccount(uid) {
    if (!isAdmin) {
      toast('Chỉ quản trị viên được xoá tài khoản.', 'error');
      return;
    }
    if (!uid || !currentUser) return;
    if (uid === currentUser.uid) {
      toast('Bạn không thể xoá tài khoản đang đăng nhập.', 'error');
      return;
    }
    const info = accountLabel(uid);
    if (await isAdminAccount(uid)) {
      toast(`${info.name} đang là quản trị viên — hạ quyền admin trước khi xoá tài khoản.`, 'error');
      return;
    }

    const answer = await openDialog(uid);
    if (!answer?.confirmed) return;
    const { removeMessages, removeReactions } = answer.options;

    const summary = { data: 0, reactions: 0, messages: 0, auth: null, failed: [] };
    const attempt = async (label, task) => {
      try {
        return await task();
      } catch (error) {
        summary.failed.push(label);
        console.warn(`Xoá tài khoản: bước "${label}" lỗi:`, error);
        return null;
      }
    };

    // 1) Bia mộ + 2) cấm vĩnh viễn (đăng xuất người dùng ngay qua listener /bans/<uid>)
    await attempt('bia mộ', () => deletedUsersRef.child(uid).set({
      uid,
      name: info.name.slice(0, 60),
      email: String(info.email || '').slice(0, 160),
      deletedBy: currentUser.uid,
      deletedByName: displayNameFor(currentUser).slice(0, 32),
      deletedAt: currentTimestamp(),
      authDeleted: false
    }));
    await attempt('cấm truy cập', () => bansRef.child(uid).set({
      reason: 'Tài khoản đã bị quản trị viên xoá khỏi hệ thống.',
      bannedBy: currentUser.uid,
      bannedAt: currentTimestamp(),
      deleted: true
    }));

    // 3) Dữ liệu hồ sơ
    const dataTasks = await attempt('dữ liệu hồ sơ', () => Promise.allSettled([
      membersRef.child(uid).remove(),
      memberEmailsRef.child(uid).remove(),
      mutesRef.child(uid).remove()
    ]));
    if (dataTasks) summary.data = dataTasks.filter((result) => result.status === 'fulfilled').length;

    if (removeReactions) {
      summary.reactions = (await attempt('reaction', () => removeUserReactions(uid))) || 0;
    }
    if (removeMessages) {
      summary.messages = (await attempt('tin nhắn', () => removeUserMessages(uid))) || 0;
    }

    // 4) Bản ghi Firebase Auth (chỉ khi đã deploy Cloud Function)
    summary.auth = await callAuthDeletion(uid);
    if (summary.auth?.deleted) {
      await attempt('cập nhật bia mộ', () => deletedUsersRef.child(uid).update({ authDeleted: true, authDeletedAt: currentTimestamp() }));
    }

    // 5) Dọn state cục bộ để UI đổi ngay, không chờ listener
    delete members[uid];
    delete memberEmails[uid];
    delete presence[uid];
    delete mutes[uid];
    bans[uid] = { reason: 'Tài khoản đã bị quản trị viên xoá khỏi hệ thống.', deleted: true };
    if (removeMessages) {
      Array.from(messages.entries()).filter(([, data]) => data?.uid === uid).forEach(([id]) => messages.delete(id));
    }
    closeMemberProfile();
    renderMembers();
    renderAdminPanel();
    renderAllMessages(false);
    updateMessageComposer();

    void logAdminAction('deleteAccount', `Xoá tài khoản ${info.name}${info.email ? ` (${info.email})` : ''} · UID ${uid}`, uid);

    const parts = [
      `Xoá dữ liệu của ${info.name}`,
      `reaction: ${summary.reactions}`,
      removeMessages ? `tin nhắn: ${summary.messages}` : 'giữ tin nhắn'
    ];
    if (summary.auth?.deleted) parts.push('đã xoá cả tài khoản Auth');
    else if (summary.auth?.error) parts.push(`Auth chưa xoá (${summary.auth.error})`);
    else parts.push('Auth cần xoá ở Console/functions');

    toast(`${parts.join(' · ')}.`, summary.failed.length ? 'error' : 'success');
    if (summary.failed.length) {
      console.warn('Các bước xoá tài khoản chưa hoàn tất:', summary.failed);
    }
  }

  CatChat.accountDeletion = { deleteMember: deleteMemberAccount, open: openDialog, CONFIRM_WORD };

  CatChat.features.register({
    id: 'account-deletion',
    name: 'Xoá tài khoản thành viên',
    description: 'Admin xoá dữ liệu, cấm vĩnh viễn và (tuỳ chọn) xoá tài khoản Firebase Auth.',
    memberActions({ uid, isSelf, addAction }) {
      if (!isAdmin || isSelf) return;
      addAction('Xoá tài khoản khỏi hệ thống', 'danger', 'user-x', () => {
        closeMemberProfile();
        void deleteMemberAccount(uid);
      });
    },
    start() {
      CatChat.actions.register({
        id: 'account-delete',
        label: 'Xoá tài khoản thành viên',
        hint: 'Chọn thành viên trong hồ sơ hoặc danh sách quản trị',
        icon: 'user-x',
        group: 'Quản trị',
        when: () => Boolean(isAdmin),
        run() {
          if (!isAdmin) return;
          const candidates = memberEntries().filter(([uid]) => uid !== currentUser?.uid);
          if (!candidates.length) {
            toast('Chưa có thành viên nào khác để xoá.', 'info');
            return;
          }
          openMemberPicker(candidates);
        }
      });
    },
    keydown(event) {
      if (!layer || layer.hidden) return false;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog(null);
        return true;
      }
      return false;
    }
  });

  /** Chọn nhanh thành viên cần xoá từ bảng lệnh (Alt+K). */
  function openMemberPicker(candidates) {
    const picker = document.createElement('div');
    picker.className = 'confirm-layer account-delete-layer account-delete-picker';
    picker.hidden = false;
    const panel = document.createElement('section');
    panel.className = 'confirm-dialog account-delete-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.textContent = 'Chọn thành viên cần xoá';
    const list = document.createElement('div');
    list.className = 'account-delete-pick-list';
    candidates.slice(0, 60).forEach(([uid, member]) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'account-delete-pick';
      item.append(makeAvatar(memberDisplayName(uid, member), uid, 'avatar'), textElement('span', '', memberDisplayName(uid, member)));
      item.addEventListener('click', () => {
        picker.remove();
        document.body.classList.remove('body-locked');
        void deleteMemberAccount(uid);
      });
      list.appendChild(item);
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'account-delete-cancel';
    cancel.textContent = 'Đóng';
    cancel.addEventListener('click', () => {
      picker.remove();
      document.body.classList.remove('body-locked');
    });
    panel.append(title, list, cancel);
    picker.appendChild(panel);
    picker.addEventListener('click', (event) => {
      if (event.target === picker) {
        picker.remove();
        document.body.classList.remove('body-locked');
      }
    });
    document.body.appendChild(picker);
    document.body.classList.add('body-locked');
  }
})();
