/* CatChat · Feature: tuỳ chọn chuyển động (animation).
   Vì sao cần: trên Windows, công tắc “Hiệu ứng hình ảnh” (Cài đặt → Trợ năng →
   Hiệu ứng hình ảnh) khi tắt sẽ khiến trình duyệt báo prefers-reduced-motion: reduce.
   Khi đó CSS dừng toàn bộ animation — dù máy rất mạnh và trên macOS vẫn chạy bình
   thường. File này cho người dùng chọn lại:

     auto    — theo hệ điều hành (mặc định, tôn trọng lựa chọn trợ năng)
     full    — luôn bật chuyển động
     reduced — luôn giảm chuyển động

   Script chạy sớm (ngay sau features-core.js) và đặt `data-motion` trên <html>
   đồng bộ, để các script khác như boot-screen.js đọc được ngay từ đầu. */
'use strict';

(() => {
  const STORAGE_KEY = 'catchat-motion-v1';
  const HINT_KEY = 'catchat-motion-hint-shown';
  const MODES = [
    { id: 'auto', label: 'Theo máy', hint: 'Tôn trọng cài đặt trợ năng của hệ điều hành' },
    { id: 'full', label: 'Đầy đủ', hint: 'Luôn phát animation, kể cả khi Windows đang tắt hiệu ứng' },
    { id: 'reduced', label: 'Giảm', hint: 'Tắt animation và hiệu ứng con trỏ' }
  ];

  const reduceQuery = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)'); }
    catch (_) { return null; }
  })();

  let mode = 'auto';

  const osReduced = () => Boolean(reduceQuery && reduceQuery.matches);

  function readMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (MODES.some((item) => item.id === saved)) return saved;
    } catch (_) { /* chế độ riêng tư */ }
    return 'auto';
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) { /* bỏ qua */ }
  }

  /** Có nên giảm chuyển động ngay lúc này không (CSS + JS dùng chung một nguồn). */
  function isReduced() {
    if (mode === 'full') return false;
    if (mode === 'reduced') return true;
    return osReduced();
  }

  function apply() {
    const root = document.documentElement;
    root.dataset.motion = mode;
    // Đồng bộ luôn biến thời lượng của design system để transition JS/CSS khớp nhau.
    const reduced = isReduced();
    root.style.setProperty('--ds-dur-fast', reduced ? '.01ms' : '.14s');
    root.style.setProperty('--ds-dur-base', reduced ? '.01ms' : '.22s');
    root.style.setProperty('--ds-dur-slow', reduced ? '.01ms' : '.38s');
    syncButtons();
    syncStatus();
    // Cho các module khác (hiệu ứng con trỏ, splash…) biết để bật/tắt ngay lập tức.
    document.dispatchEvent(new CustomEvent('catchat:motion-change', { detail: { mode, reduced } }));
  }

  function setMode(next, announce = false) {
    mode = MODES.some((item) => item.id === next) ? next : 'auto';
    persist();
    apply();
    if (announce) {
      const label = MODES.find((item) => item.id === mode)?.label || mode;
      toast(`Chuyển động: ${label.toLowerCase()}.`, 'info');
    }
    return mode;
  }

  function syncButtons() {
    document.querySelectorAll('[data-motion-choice]').forEach((button) => {
      const selected = button.dataset.motionChoice === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function syncStatus() {
    const status = document.getElementById('motionStatus');
    if (!status) return;
    const text = status.querySelector('span');
    const reducedNow = isReduced();
    status.classList.toggle('is-ok', !reducedNow);
    if (!text) return;
    if (mode === 'full') {
      text.textContent = 'Đang bật đầy đủ animation, bỏ qua cài đặt giảm chuyển động của máy.';
    } else if (mode === 'reduced') {
      text.textContent = 'Đang tắt animation và hiệu ứng con trỏ.';
    } else if (osReduced()) {
      text.textContent = 'Hệ điều hành đang tắt hiệu ứng chuyển động nên CatChat cũng tạm dừng animation. Chọn “Đầy đủ” nếu bạn muốn xem.';
    } else {
      text.textContent = 'Hệ điều hành đang cho phép chuyển động — CatChat phát animation bình thường.';
    }
  }

  /** Nhắc một lần khi phát hiện máy đang tắt hiệu ứng (thường là Windows). */
  function maybeHintOnce() {
    if (!osReduced() || mode !== 'auto') return;
    let shown = false;
    try { shown = localStorage.getItem(HINT_KEY) === '1'; } catch (_) { shown = false; }
    if (shown) return;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (_) { /* bỏ qua */ }
    window.setTimeout(() => {
      toast('Hệ điều hành đang tắt hiệu ứng chuyển động. Mở Giao diện → Chuyển động → “Đầy đủ” để bật animation.', 'info');
    }, 2200);
  }

  function themeRow(container) {
    const row = document.createElement('div');
    row.className = 'appearance-row motion-row';
    const label = document.createElement('span');
    label.className = 'appearance-label';
    label.textContent = 'Chuyển động';
    const group = document.createElement('div');
    group.className = 'appearance-segmented';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Chọn mức chuyển động');
    MODES.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.title = item.hint;
      button.dataset.motionChoice = item.id;
      button.setAttribute('aria-pressed', String(item.id === mode));
      button.classList.toggle('selected', item.id === mode);
      button.addEventListener('click', () => setMode(item.id, true));
      group.appendChild(button);
    });

    const status = document.createElement('div');
    status.className = 'motion-status';
    status.id = 'motionStatus';
    status.appendChild(icon('sparkles'));
    status.appendChild(document.createElement('span'));

    const hint = document.createElement('p');
    hint.className = 'motion-hint';
    hint.textContent = 'Windows: Cài đặt → Trợ năng → Hiệu ứng hình ảnh (tắt) sẽ khoá animation trong mọi trình duyệt. Chọn “Đầy đủ” để CatChat bỏ qua cài đặt đó.';

    row.append(label, group, status, hint);
    container.appendChild(row);
    syncStatus();
  }

  /* Đặt thuộc tính ngay khi script được nạp (trước boot-screen.js). */
  mode = readMode();
  apply();

  if (reduceQuery) {
    const onChange = () => {
      if (mode !== 'auto') return;
      apply();
    };
    if (typeof reduceQuery.addEventListener === 'function') reduceQuery.addEventListener('change', onChange);
    else if (typeof reduceQuery.addListener === 'function') reduceQuery.addListener(onChange);
  }

  CatChat.features.register({
    id: 'motion',
    name: 'Tuỳ chọn chuyển động',
    description: 'Bật/tắt animation khi hệ điều hành đang giảm chuyển động (Windows, macOS, Android).',

    start() {
      apply();
      maybeHintOnce();
      CatChat.actions.register({
        id: 'motion-cycle',
        label: 'Đổi mức chuyển động',
        hint: 'Theo máy → Đầy đủ → Giảm',
        icon: 'sparkles',
        group: 'Giao diện',
        run() {
          const index = MODES.findIndex((item) => item.id === mode);
          setMode(MODES[(index + 1) % MODES.length].id, true);
        }
      });
    },

    themeExtras(container) {
      themeRow(container);
    }
  });

  /* API dùng chung: CSS đọc qua data-motion, JS đọc qua CatChat.motion. */
  CatChat.motion = {
    modes: MODES.map((item) => ({ ...item })),
    getMode: () => mode,
    setMode: (next) => setMode(next, false),
    isReduced,
    osReduced,
    /** true khi trình duyệt/hệ điều hành đang tắt hiệu ứng. */
    systemHint: () => (osReduced() ? 'Hệ điều hành đang tắt hiệu ứng chuyển động.' : 'Hệ điều hành đang bật hiệu ứng chuyển động.')
  };
})();
