/* CatChat · Feature: hiệu ứng con trỏ.
   - Di chuyển: vòng sáng bám theo con trỏ + vệt hạt nhỏ.
   - Bấm: sóng lan + chùm hạt sáng + vài dấu chân mèo.
   - Cuộn trang: dấu chân và vệt sáng trôi theo hướng cuộn.
   Chỉ chạy trên thiết bị có chuột thật (hover + pointer: fine), tự tắt khi
   người dùng bật prefers-reduced-motion, và có công tắc Tắt / Nhẹ / Đầy đủ
   trong hộp thoại “Bộ lông của CatChat”. */
'use strict';

(() => {
  const STORAGE_KEY = 'catchat-cursor-fx-v1';
  const MODES = [
    { id: 'off', label: 'Tắt' },
    { id: 'light', label: 'Nhẹ' },
    { id: 'full', label: 'Đầy đủ' }
  ];
  const MAX_PARTICLES = 42;
  const TRAIL_GAP = 26;
  const SCROLL_GAP = 95;

  let mode = 'full';
  let layer = null;
  let follower = null;
  let activeParticles = 0;
  let pointerX = 0;
  let pointerY = 0;
  let followerX = 0;
  let followerY = 0;
  let hasPointer = false;
  let rafId = 0;
  let lastMoveAt = 0;
  let lastTrailX = 0;
  let lastTrailY = 0;
  let lastScrollAt = 0;
  let pressTimer = 0;
  let attached = false;
  const scrollPositions = new WeakMap();

  const reducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  };
  const finePointer = () => {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    catch (_) { return false; }
  };
  // Chỉ hạ xuống mức “Nhẹ” khi thiết bị báo rất ít RAM (0,25–1 GB). Không dựa vào
  // hardwareConcurrency vì nhiều trình duyệt trả về 1 do chính sách riêng tư.
  const lowPowerDevice = () => {
    const memory = Number(navigator.deviceMemory);
    return Number.isFinite(memory) && memory > 0 && memory <= 1;
  };
  const canRun = () => attached && mode !== 'off' && finePointer() && !reducedMotion();

  function readMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (MODES.some((item) => item.id === saved)) return saved;
    } catch (_) { /* chế độ riêng tư */ }
    return lowPowerDevice() ? 'light' : 'full';
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) { /* bỏ qua */ }
  }

  /* ── Lớp hiệu ứng ─────────────────────────────────────────── */
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.className = 'cursor-fx';
    layer.id = 'cursorFx';
    layer.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    follower = document.createElement('div');
    follower.className = 'cursor-fx-follower';
    follower.appendChild(document.createElement('i'));
    layer.appendChild(follower);
    document.body.appendChild(layer);
    return layer;
  }

  function setVisible(visible) {
    if (!layer) return;
    layer.hidden = !visible;
    layer.classList.toggle('is-active', visible && hasPointer);
  }

  function spawn(kind, x, y, props = {}) {
    if (!canRun() || activeParticles >= MAX_PARTICLES) return null;
    ensureLayer();
    const node = document.createElement('span');
    node.className = `cursor-fx-${kind}`;
    if (kind === 'paw') node.textContent = '🐾';
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(y)}px`;
    Object.keys(props).forEach((key) => node.style.setProperty(key, props[key]));
    activeParticles += 1;
    let finished = false;
    const release = () => {
      if (finished) return;
      finished = true;
      activeParticles = Math.max(0, activeParticles - 1);
      node.remove();
    };
    node.addEventListener('animationend', release);
    layer.appendChild(node);
    // Lưới an toàn: nếu animationend không chạy (tab bị ẩn giữa chừng) vẫn dọn node.
    window.setTimeout(release, 1600);
    return node;
  }

  function ring(x, y) {
    spawn('ring', x, y);
  }

  function sparks(x, y, count, spread = 30) {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.5;
      const distance = spread * (0.55 + Math.random() * 0.75);
      spawn('spark', x, y, {
        '--dx': `${(Math.cos(angle) * distance).toFixed(1)}px`,
        '--dy': `${(Math.sin(angle) * distance).toFixed(1)}px`,
        '--fx-dur': `${Math.round(520 + Math.random() * 200)}ms`
      });
    }
  }

  function paws(x, y) {
    if (mode !== 'full') return;
    const drifts = [
      { dx: 10, dy: -34, rot: -14 },
      { dx: -14, dy: -26, rot: 12 }
    ];
    drifts.forEach((drift, index) => {
      spawn('paw', x + (index === 0 ? 9 : -9), y + (index === 0 ? 10 : 4), {
        '--dx': `${drift.dx}px`,
        '--dy': `${drift.dy}px`,
        '--rot': `${drift.rot + Math.round(Math.random() * 14 - 7)}deg`,
        '--fx-dur': `${Math.round(820 + Math.random() * 220)}ms`
      });
    });
  }

  function burst(x, y) {
    if (!canRun()) return;
    ring(x, y);
    sparks(x, y, mode === 'full' ? 6 : 4);
    paws(x, y);
  }

  function trail(x, y) {
    if (mode !== 'full' || !canRun()) return;
    const dx = x - lastTrailX;
    const dy = y - lastTrailY;
    if (dx * dx + dy * dy < TRAIL_GAP * TRAIL_GAP) return;
    lastTrailX = x;
    lastTrailY = y;
    spawn('trail', x + (Math.random() * 6 - 3), y + (Math.random() * 6 - 3), {
      '--dx': `${(dx * 0.16).toFixed(1)}px`,
      '--dy': `${(8 + Math.random() * 10).toFixed(1)}px`
    });
  }

  function scrollFx(direction, x, y) {
    if (mode !== 'full' || !canRun()) return;
    const now = Date.now();
    if (now - lastScrollAt < SCROLL_GAP) return;
    lastScrollAt = now;
    const lift = direction > 0 ? -1 : 1;
    for (let index = 0; index < 2; index += 1) {
      spawn('paw', x + (Math.random() * 26 - 13), y + (index * 14 - 7), {
        '--dx': `${(Math.random() * 20 - 10).toFixed(1)}px`,
        '--dy': `${(lift * (52 + Math.random() * 26)).toFixed(1)}px`,
        '--rot': `${Math.round(Math.random() * 40 - 20)}deg`,
        '--fx-dur': `${Math.round(760 + Math.random() * 200)}ms`
      });
    }
    spawn('streak', x, y, {
      '--dx': '0px',
      '--dy': `${(lift * 70).toFixed(1)}px`
    });
  }

  /* ── Vòng sáng bám theo con trỏ ───────────────────────────── */
  function frame() {
    rafId = 0;
    if (!follower) return;
    const dx = pointerX - followerX;
    const dy = pointerY - followerY;
    followerX += dx * 0.24;
    followerY += dy * 0.24;
    follower.style.transform = `translate3d(${followerX.toFixed(2)}px, ${followerY.toFixed(2)}px, 0)`;
    const stillMoving = Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4;
    const recentlyActive = Date.now() - lastMoveAt < 900;
    if (stillMoving || recentlyActive) rafId = window.requestAnimationFrame(frame);
  }

  function startFollower() {
    if (!rafId) rafId = window.requestAnimationFrame(frame);
  }

  /* ── Sự kiện ──────────────────────────────────────────────── */
  function isInteractive(target) {
    return target instanceof Element
      && Boolean(target.closest('button, a, input, textarea, select, summary, [role="button"], [contenteditable="true"]'));
  }

  function onPointerMove(event) {
    if (!canRun() || !event.isPrimary) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!hasPointer) {
      hasPointer = true;
      followerX = pointerX;
      followerY = pointerY;
      setVisible(true);
    }
    lastMoveAt = Date.now();
    ensureLayer();
    trail(pointerX, pointerY);
    startFollower();
  }

  function onPointerDown(event) {
    if (!canRun() || event.button !== 0) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    hasPointer = true;
    lastMoveAt = Date.now();
    followerX = pointerX;
    followerY = pointerY;
    setVisible(true);
    ensureLayer();
    burst(pointerX, pointerY);
    layer.classList.add('is-pressed');
    window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => layer.classList.remove('is-pressed'), 260);
    startFollower();
  }

  function onPointerOver(event) {
    if (!canRun() || !layer) return;
    layer.classList.toggle('is-hot', isInteractive(event.target));
  }

  function onPointerLeave() {
    hasPointer = false;
    if (layer) layer.classList.remove('is-active', 'is-pressed', 'is-hot');
  }

  function onWheel(event) {
    if (!canRun() || !event.deltaY) return;
    scrollFx(event.deltaY > 0 ? 1 : -1, event.clientX || pointerX, event.clientY || pointerY);
  }

  function onScroll(event) {
    if (!canRun()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const previous = scrollPositions.get(target) ?? target.scrollTop;
    const delta = target.scrollTop - previous;
    scrollPositions.set(target, target.scrollTop);
    if (Math.abs(delta) < 8) return;
    // Chỉ chạy khi người dùng đang thật sự cuộn bằng chuột / thanh cuộn.
    if (Date.now() - lastMoveAt > 2400) return;
    const rect = target.getBoundingClientRect();
    const x = hasPointer ? pointerX : rect.left + rect.width - 40;
    const y = hasPointer ? pointerY : rect.top + rect.height / 2;
    scrollFx(delta > 0 ? 1 : -1, x, y);
  }

  function attach() {
    if (attached) return;
    attached = true;
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerover', onPointerOver, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    document.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('blur', onPointerLeave);
    try {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = () => applyMode();
      if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
      else if (typeof query.addListener === 'function') query.addListener(onChange);
    } catch (_) { /* trình duyệt cũ */ }
  }

  function applyMode() {
    if (!canRun()) {
      if (layer) {
        layer.classList.remove('is-active', 'is-pressed', 'is-hot');
        layer.hidden = true;
      }
      return;
    }
    ensureLayer();
    layer.hidden = false;
    if (hasPointer) layer.classList.add('is-active');
  }

  function setMode(next, announce = false) {
    const value = MODES.some((item) => item.id === next) ? next : 'full';
    mode = value;
    persist();
    applyMode();
    syncButtons();
    if (announce) {
      const label = MODES.find((item) => item.id === mode)?.label || mode;
      toast(`Hiệu ứng con trỏ: ${label.toLowerCase()}.`, 'info');
    }
    return mode;
  }

  function syncButtons() {
    document.querySelectorAll('[data-cursor-fx-choice]').forEach((button) => {
      const selected = button.dataset.cursorFxChoice === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function themeRow(container) {
    const row = document.createElement('div');
    row.className = 'appearance-row';
    const label = document.createElement('span');
    label.className = 'appearance-label';
    label.textContent = 'Hiệu ứng con trỏ';
    const group = document.createElement('div');
    group.className = 'appearance-segmented';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Chọn mức hiệu ứng con trỏ');
    MODES.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.dataset.cursorFxChoice = item.id;
      button.setAttribute('aria-pressed', String(item.id === mode));
      button.classList.toggle('selected', item.id === mode);
      button.addEventListener('click', () => setMode(item.id, false));
      group.appendChild(button);
    });
    row.append(label, group);
    container.appendChild(row);
    if (!finePointer()) {
      const note = document.createElement('p');
      note.className = 'appearance-note';
      note.textContent = 'Thiết bị cảm ứng không hiển thị hiệu ứng con trỏ.';
      container.appendChild(note);
    }
  }

  CatChat.features.register({
    id: 'cursor-fx',
    name: 'Hiệu ứng con trỏ',
    description: 'Vệt sáng khi di chuyển, sóng khi bấm, dấu chân khi cuộn — chỉ trên máy có chuột.',

    start() {
      mode = readMode();
      attach();
      applyMode();
      CatChat.actions.register({
        id: 'cursor-fx-cycle',
        label: 'Đổi hiệu ứng con trỏ',
        hint: 'Tắt → Nhẹ → Đầy đủ',
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

  CatChat.cursorFx = {
    modes: MODES.map((item) => ({ ...item })),
    getMode: () => mode,
    setMode: (next) => setMode(next, false),
    burst: (x, y) => burst(x ?? pointerX, y ?? pointerY),
    activeParticles: () => activeParticles
  };
})();
