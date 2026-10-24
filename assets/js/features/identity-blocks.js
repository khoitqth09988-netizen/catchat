/* CatChat · Feature: tab quản trị “Chặn vĩnh viễn”.
   Hiển thị và quản lý ba danh sách:
     • Thiết bị bị chặn   (/deviceBans)   — admin thêm/xoá tay
     • IP bị chặn         (/ipBans)       — admin thêm/xoá tay (cần Cloud Function để biết IP)
     • Khoá tự động       (/identityLocks)— hệ thống tự tạo khi một máy/IP tạo quá 2 tài khoản
   Toàn bộ dữ liệu đi qua CatChat.identity (assets/js/features/identity-guard.js).
   Không thêm animation nặng; danh sách dài vẫn cuộn mượt vì chỉ dựng lại khi mở tab. */
'use strict';

(() => {
  const KIND_LABEL = { device: 'Thiết bị', ip: 'IP', lock: 'Khoá tự động' };
  let busy = false;
  let lastRender = 0;

  const byId = (id) => document.getElementById(id);

  function relativeTime(value) {
    const at = Number(value) || 0;
    if (!at) return 'không rõ thời điểm';
    const diff = Date.now() - at;
    if (diff < 60000) return 'vừa xong';
    const minutes = Math.round(diff / 60000);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.round(diff / 3600000);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.round(diff / 86400000);
    if (days < 30) return `${days} ngày trước`;
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(at));
  }

  function shortHash(hash) {
    const value = String(hash || '');
    if (value.length <= 16) return value;
    return `${value.slice(0, 10)}…${value.slice(-4)}`;
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`Đã sao chép ${label}.`, 'success');
    } catch (_) {
      toast('Trình duyệt không cho phép sao chép tự động.', 'error');
    }
  }

  function makeRow({ hash, kind, data, accounts, onRemove, extraButton }) {
    const row = document.createElement('div');
    row.className = 'identity-row';

    const glyph = document.createElement('div');
    glyph.className = 'identity-row-icon';
    glyph.appendChild(icon(kind === 'ip' ? 'wifi' : kind === 'lock' ? 'lock' : 'shield'));
    row.appendChild(glyph);

    const copyWrap = document.createElement('div');
    copyWrap.className = 'identity-row-copy';
    const title = document.createElement('strong');
    title.textContent = KIND_LABEL[kind] || kind;
    title.title = hash;
    copyWrap.appendChild(title);

    const meta = document.createElement('span');
    const parts = [shortHash(hash)];
    if (accounts) parts.push(`${accounts} tài khoản`);
    if (data?.reason) parts.push(String(data.reason).slice(0, 90));
    parts.push(relativeTime(data?.at));
    meta.textContent = parts.join(' · ');
    copyWrap.appendChild(meta);

    const note = document.createElement('small');
    note.className = 'identity-row-hash';
    note.textContent = hash;
    copyWrap.appendChild(note);
    row.appendChild(copyWrap);

    const actions = document.createElement('div');
    actions.className = 'identity-row-actions';

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'admin-action';
    copyButton.title = 'Sao chép mã';
    copyButton.setAttribute('aria-label', 'Sao chép mã');
    copyButton.appendChild(icon('hash'));
    copyButton.addEventListener('click', () => copy(hash, 'mã'));
    actions.appendChild(copyButton);

    if (extraButton) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `admin-action${extraButton.danger ? ' danger' : ''}`;
      button.title = extraButton.title;
      button.setAttribute('aria-label', extraButton.title);
      button.appendChild(icon(extraButton.icon || 'trash'));
      button.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        try { await extraButton.run(); } finally { busy = false; }
      });
      actions.appendChild(button);
    }

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-action unban';
    remove.title = 'Bỏ chặn / mở khoá';
    remove.setAttribute('aria-label', 'Bỏ chặn / mở khoá');
    remove.appendChild(icon('unban'));
    remove.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      try { await onRemove(); } finally { busy = false; }
    });
    actions.appendChild(remove);
    row.appendChild(actions);
    return row;
  }

  function fillList(container, rows, emptyText) {
    if (!container) return;
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    rows.forEach((row) => container.appendChild(row));
  }

  async function render() {
    const panel = byId('adminBlocksTab');
    if (!panel || !window.CatChat?.identity) return;
    if (!isAdmin) return;
    const data = await CatChat.identity.listAll();
    lastRender = Date.now();

    const status = byId('identityStatusLine');
    if (status) {
      status.textContent = data.ipEnabled
        ? `Máy này: ${shortHash(data.identity.deviceHash)} · giới hạn ${data.maxAccounts} tài khoản mỗi thiết bị/IP`
        : `Máy này: ${shortHash(data.identity.deviceHash)} · giới hạn ${data.maxAccounts} tài khoản. Chặn IP cần deploy Cloud Function getClientIdentity.`;
    }

    const renderBans = (entries, kind) => Object.entries(entries).map(([hash, info]) => makeRow({
      hash,
      kind,
      data: info,
      onRemove: async () => {
        if (kind === 'device') await CatChat.identity.unbanDevice(hash);
        else await CatChat.identity.unbanIp(hash);
        toast('Đã bỏ chặn.', 'success');
        void logAdminAction('unban', `Bỏ chặn ${kind === 'device' ? 'thiết bị' : 'IP'} ${hash.slice(0, 12)}`);
        render();
      }
    }));

    const deviceRows = renderBans(data.deviceBans, 'device');
    const ipRows = renderBans(data.ipBans, 'ip');
    fillList(byId('deviceBanList'), deviceRows, 'Chưa chặn thiết bị nào.');
    fillList(byId('ipBanList'), ipRows, 'Chưa chặn IP nào.');
    const deviceCount = byId('deviceBanCount');
    if (deviceCount) deviceCount.textContent = String(deviceRows.length);
    const ipCount = byId('ipBanCount');
    if (ipCount) ipCount.textContent = String(ipRows.length);

    const lockRows = Object.entries(data.locks).map(([hash, info]) => {
      const accounts = Object.keys(info?.uids || {}).length;
      return makeRow({
        hash,
        kind: 'lock',
        data: info,
        accounts,
        extraButton: {
          title: 'Xoá toàn bộ tài khoản trong khoá này',
          icon: 'user-x',
          danger: true,
          run: async () => {
            const confirmed = await openConfirm({
              title: 'Xoá toàn bộ tài khoản bị khoá?',
              description: `Sẽ xoá dữ liệu của ${accounts} tài khoản thuộc định danh này (không gồm tài khoản đang đăng nhập của bạn).`,
              acceptLabel: 'Xoá tất cả', tone: 'danger', iconName: 'user-x'
            });
            if (!confirmed) return;
            const result = await CatChat.identity.purgeIdentityLock(hash);
            toast(`Đã xoá ${result.purged.length}/${result.uids.length} tài khoản.`, result.purged.length ? 'success' : 'info');
            void logAdminAction('deleteAccount', `Dọn ${result.purged.length} tài khoản trong khoá định danh ${hash.slice(0, 12)}`);
            render();
          }
        },
        onRemove: async () => {
          const confirmed = await openConfirm({
            title: 'Mở khoá định danh này?',
            description: 'Các tài khoản trong khoá có thể đăng nhập lại. Hãy chắc chắn bạn đã xử lý xong.',
            acceptLabel: 'Mở khoá', tone: 'primary', iconName: 'unban'
          });
          if (!confirmed) return;
          await CatChat.identity.unlockIdentity(hash);
          toast('Đã mở khoá định danh.', 'success');
          void logAdminAction('unban', `Mở khoá định danh ${hash.slice(0, 12)}`);
          render();
        }
      });
    });
    fillList(byId('identityLockList'), lockRows, 'Không có định danh nào bị khoá tự động.');
    const lockCount = byId('identityLockCount');
    if (lockCount) lockCount.textContent = String(lockRows.length);

    const tabCount = byId('adminTabBlockCount');
    if (tabCount) {
      const total = deviceRows.length + ipRows.length + lockRows.length;
      tabCount.textContent = String(total);
      tabCount.hidden = total === 0;
    }
  }

  async function submitManualBan(event) {
    event.preventDefault();
    if (!isAdmin || busy) return;
    const kind = byId('identityBanKind')?.value === 'ip' ? 'ip' : 'device';
    const hash = String(byId('identityBanHash')?.value || '').trim();
    const reason = String(byId('identityBanReason')?.value || '').trim();
    if (!hash) {
      toast('Hãy dán mã thiết bị hoặc mã IP cần chặn.', 'error');
      return;
    }
    busy = true;
    try {
      if (kind === 'device') await CatChat.identity.banDevice(hash, reason);
      else await CatChat.identity.banIp(hash, reason);
      toast(`Đã chặn vĩnh viễn ${kind === 'ip' ? 'IP' : 'thiết bị'}.`, 'success');
      void logAdminAction('ban', `Chặn vĩnh viễn ${kind === 'ip' ? 'IP' : 'thiết bị'} ${hash.slice(0, 12)}${reason ? ` · ${reason}` : ''}`);
      const input = byId('identityBanHash');
      if (input) input.value = '';
      const reasonInput = byId('identityBanReason');
      if (reasonInput) reasonInput.value = '';
      await render();
    } catch (error) {
      showDatabaseError(error, 'Không chặn được. Kiểm tra quyền ghi /deviceBans và /ipBans trong Rules.');
    } finally {
      busy = false;
    }
  }

  function start() {
    byId('identityBanForm')?.addEventListener('submit', submitManualBan);
    byId('identityRefreshButton')?.addEventListener('click', () => { void render(); });
    // Làm mới nhẹ khi tab quản trị được mở lại (quay lại sau > 20 giây).
    const overlay = byId('adminOverlay');
    overlay?.addEventListener('click', (event) => {
      if (!event.target.closest?.('[data-tab="blocks"]')) return;
      void render();
    });
  }

  window.CatChat = window.CatChat || {};
  window.CatChat.identityBlocks = { render, lastRender: () => lastRender };

  CatChat.features.register({
    id: 'identity-blocks',
    name: 'Quản trị chặn vĩnh viễn',
    description: 'Tab quản trị liệt kê thiết bị/IP bị chặn và các định danh bị khoá tự động.',
    memberActions({ uid, isSelf, addAction }) {
      if (!isAdmin || isSelf || !window.CatChat?.identity) return;
      addAction('Cấm vĩnh viễn (tài khoản + thiết bị + IP)', 'danger', 'ban', async () => {
        const confirmed = await openConfirm({
          title: 'Cấm vĩnh viễn thành viên này?',
          description: 'Tài khoản bị cấm vĩnh viễn; thiết bị và IP đang dùng (nếu đã bật Cloud Function định danh) cũng bị chặn.',
          acceptLabel: 'Cấm vĩnh viễn', tone: 'danger', reason: true, iconName: 'ban'
        });
        if (!confirmed) return;
        try {
          const result = await CatChat.identity.banAccountEverywhere(uid, confirmed.reason || 'Cấm vĩnh viễn bởi quản trị viên.');
          toast(result.device ? 'Đã cấm tài khoản, thiết bị và IP.' : 'Đã cấm tài khoản (chưa có mã thiết bị để chặn kèm).', 'success');
          closeMemberProfile();
          void logAdminAction('ban', `Cấm vĩnh viễn ${members[uid]?.name || uid}`, uid);
        } catch (error) {
          showDatabaseError(error, 'Không cấm vĩnh viễn được. Kiểm tra Rules của /bans, /deviceBans, /ipBans.');
        }
      });
    },
    start
  });
})();
