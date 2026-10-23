/* CatChat · Feature: chống spam & giảm tải (phòng vệ phía máy khách).
   - Giới hạn tần suất gửi tin (token bucket + khoảng cách tối thiểu giữa hai tin).
   - Chặn gửi trùng lặp liên tiếp và bùng nổ reaction.
   - Phạt tăng dần khi cố tình vượt giới hạn, có đếm ngược ngay trên khung soạn tin.
   - Sau nhiều lần vi phạm: yêu cầu giải thử thách proof-of-work nhẹ trước khi gửi tiếp.
   Đây là lớp giảm lạm dụng; chống DDoS thật cần App Check + quota ở Firebase (xem README). */
'use strict';

(() => {
  const MESSAGE_BUCKET = { limit: 8, windowMs: 15000, minGapMs: 600 };
  const ANNOUNCEMENT_BUCKET = { limit: 2, windowMs: 60000, minGapMs: 3000 };
  const REACTION_BUCKET = { limit: 12, windowMs: 10000 };
  const DUPLICATE_WINDOW_MS = 60000;
  const DUPLICATE_MEMORY = 4;
  const CHALLENGE_DIFFICULTY = 3;
  const CHALLENGE_UNLOCK_MS = 10 * 60000;

  const recentTexts = [];
  let chip = null;
  let ticker = null;
  let challengeLayer = null;
  let challengeBusy = false;
  let unlockedUntil = 0;
  let softUntil = 0;
  let duplicateHits = 0;
  let lastLabel = '';
  let lockApplied = false;
  let baseUpdateComposer = null;

  function key() {
    return currentUser?.uid ? `message:${currentUser.uid}` : 'message:guest';
  }

  function normalizeText(text) {
    return String(text || '')
      .toLocaleLowerCase('vi')
      .replace(/[\s\u200b]+/g, ' ')
      .replace(/[.!?,;:~*_`|]/g, '')
      .trim();
  }

  function formatMs(ms) {
    const seconds = Math.max(1, Math.ceil(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
  }

  function setChip(label, tone = '') {
    if (!chip) return;
    chip.textContent = label;
    chip.hidden = !label;
    chip.dataset.tone = tone;
  }

  /** Khoá nút gửi trong lúc bị phạt, kể cả khi composer vừa được vẽ lại. */
  function applyLockToComposer() {
    const locked = Math.max(0, CatChatGuard.lockedFor(key()), softUntil - Date.now());
    if (locked > 0) {
      lockApplied = true;
      if (els.sendButton) {
        els.sendButton.disabled = true;
        els.sendButton.title = `Tạm chờ ${formatMs(locked)} để tránh gửi quá nhanh`;
      }
      return;
    }
    if (lockApplied) {
      lockApplied = false;
      if (els.sendButton) els.sendButton.title = '';
      if (baseUpdateComposer) baseUpdateComposer();
    }
  }

  function updateSecurityChip() {
    const locked = Math.max(0, CatChatGuard.lockedFor(key()));
    const soft = Math.max(0, softUntil - Date.now());
    const strikes = CatChatGuard.strikesFor(key());
    let label;
    let tone = '';
    if (locked > 0) {
      if (strikes >= 3 && Date.now() > unlockedUntil) {
        label = `Tạm khoá ${formatMs(locked)} · cần xác thực`;
        tone = 'danger';
      } else {
        label = `Chậm lại ${formatMs(locked)}`;
        tone = 'warn';
      }
    } else if (soft > 0) {
      label = `Giãn nhịp ${formatMs(soft)}`;
      tone = 'warn';
    } else if (strikes > 0) {
      label = `Đang bảo vệ · ${strikes} lần vượt giới hạn`;
      tone = 'warn';
    } else {
      label = 'Đang bảo vệ';
    }
    if (label !== lastLabel) {
      lastLabel = label;
      setChip(label, tone);
    }
    applyLockToComposer();
  }

  function startTicker() {
    if (ticker) return;
    ticker = window.setInterval(updateSecurityChip, 1000);
  }

  function rememberText(text) {
    const normalized = normalizeText(text);
    recentTexts.push({ normalized, at: Date.now() });
    while (recentTexts.length > DUPLICATE_MEMORY) recentTexts.shift();
    return normalized;
  }

  function isDuplicate(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const time = Date.now();
    return recentTexts.some((entry) => entry.normalized === normalized && time - entry.at < DUPLICATE_WINDOW_MS);
  }

  /** Chặn mềm: chỉ giãn nhịp vài giây, không tính vi phạm. */
  function softBlock(reason, ms = 2000) {
    softUntil = Math.max(softUntil, Date.now() + ms);
    updateSecurityChip();
    toast(`${reason} Chờ ${formatMs(ms)} rồi gửi tiếp nhé.`, 'info');
    return { cancel: true };
  }

  /** Chặn cứng: tính vi phạm, phạt tăng dần; đủ 3 lần thì yêu cầu xác thực. */
  function block(reason) {
    const result = CatChatGuard.penalize(key());
    updateSecurityChip();
    toast(`${reason} Tạm chờ ${formatMs(CatChatGuard.lockedFor(key()))} rồi thử lại nhé.`, 'error');
    if (result.strikes >= 3) window.setTimeout(maybeOpenChallenge, 400);
    return { cancel: true };
  }

  function maybeOpenChallenge() {
    if (Date.now() < unlockedUntil) return;
    if (CatChatGuard.strikesFor(key()) < 3) return;
    openChallenge();
  }

  function openChallenge() {
    if (!challengeLayer) return;
    challengeLayer.hidden = false;
    challengeLayer.classList.add('open');
    challengeLayer.querySelector('.security-challenge-status').textContent = 'Bấm "Xác thực" để tiếp tục gửi tin.';
  }

  function closeChallenge() {
    if (!challengeLayer) return;
    challengeLayer.classList.remove('open');
    challengeLayer.hidden = true;
  }

  async function runChallenge() {
    if (challengeBusy) return;
    challengeBusy = true;
    const button = challengeLayer.querySelector('.security-challenge-main');
    const status = challengeLayer.querySelector('.security-challenge-status');
    button.disabled = true;
    status.textContent = 'Đang xác thực... (máy sẽ tính một chút)';
    try {
      const seed = `${currentUser?.uid || 'guest'}:${Date.now()}`;
      const result = await CatChatGuard.solveChallenge({
        difficulty: CHALLENGE_DIFFICULTY,
        seed,
        onProgress: (nonce) => {
          status.textContent = `Đang xác thực... đã thử ${nonce.toLocaleString('vi')} khoá`;
        }
      });
      if (!result) {
        status.textContent = 'Thiết bị không hỗ trợ xác thực tự động, chuyển sang câu hỏi đơn giản.';
        showFallback();
        return;
      }
      unlockedUntil = Date.now() + CHALLENGE_UNLOCK_MS;
      CatChatGuard.clearPenalty(key());
      status.textContent = `Xong sau ${(result.ms / 1000).toFixed(1)}s. Bạn có thể gửi tin bình thường.`;
      toast('Đã xác thực xong. Gửi tin tiếp được rồi nhé.', 'success');
      window.setTimeout(closeChallenge, 1200);
      updateSecurityChip();
    } finally {
      challengeBusy = false;
      button.disabled = false;
    }
  }

  /** Dự phòng khi trình duyệt không có WebCrypto (ví dụ mở qua http://). */
  function showFallback() {
    if (!challengeLayer) return;
    const fallback = challengeLayer.querySelector('.security-fallback');
    const question = fallback.querySelector('strong');
    const answer = fallback.querySelector('input');
    const check = fallback.querySelector('button');
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    const expected = a + b;
    const mainButton = challengeLayer.querySelector('.security-challenge-main');
    if (mainButton) mainButton.hidden = true;
    fallback.hidden = false;
    question.textContent = `${a} + ${b} = ?`;
    answer.value = '';
    answer.focus();
    const verify = () => {
      if (Number(answer.value) !== expected) {
        answer.value = '';
        challengeLayer.querySelector('.security-challenge-status').textContent = 'Chưa đúng, thử lại nhé.';
        return;
      }
      unlockedUntil = Date.now() + CHALLENGE_UNLOCK_MS;
      CatChatGuard.clearPenalty(key());
      challengeLayer.querySelector('.security-challenge-status').textContent = 'Xong. Bạn có thể gửi tin bình thường.';
      toast('Đã xác thực xong. Gửi tin tiếp được rồi nhé.', 'success');
      fallback.hidden = true;
      window.setTimeout(closeChallenge, 1200);
      updateSecurityChip();
    };
    check.onclick = verify;
    answer.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        verify();
      }
    };
  }

  function buildChallenge() {
    challengeLayer = document.createElement('div');
    challengeLayer.className = 'security-layer';
    challengeLayer.id = 'securityLayer';
    challengeLayer.hidden = true;
    challengeLayer.setAttribute('role', 'dialog');
    challengeLayer.setAttribute('aria-modal', 'true');
    challengeLayer.setAttribute('aria-label', 'Xác thực chống spam');

    const panel = document.createElement('div');
    panel.className = 'security-panel';
    const head = document.createElement('div');
    head.className = 'security-head';
    const title = document.createElement('strong');
    title.textContent = 'Xác thực nhanh';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-button';
    close.setAttribute('aria-label', 'Đóng hộp xác thực');
    close.appendChild(icon('close'));
    close.addEventListener('click', closeChallenge);
    head.append(title, close);

    const copy = document.createElement('p');
    copy.className = 'security-copy';
    copy.textContent = 'Bạn vừa gửi quá nhanh nhiều lần. CatChat sẽ tính một phép kiểm tra nhỏ để chắc là người thật, sau đó bạn gửi tin bình thường trong 10 phút.';
    const status = document.createElement('p');
    status.className = 'security-challenge-status';
    status.textContent = '';
    const fallback = document.createElement('div');
    fallback.className = 'security-fallback';
    fallback.hidden = true;
    const fallbackLabel = document.createElement('label');
    fallbackLabel.textContent = 'Thiết bị không hỗ trợ xác thực tự động. Trả lời câu hỏi: ';
    const question = document.createElement('strong');
    question.textContent = '';
    const answer = document.createElement('input');
    answer.type = 'text';
    answer.inputMode = 'numeric';
    answer.autocomplete = 'off';
    answer.className = 'security-fallback-input';
    answer.setAttribute('aria-label', 'Câu trả lời xác thực');
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'security-challenge-run';
    check.textContent = 'Kiểm tra';
    fallbackLabel.append(question);
    fallback.append(fallbackLabel, answer, check);

    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'security-challenge-run security-challenge-main';
    run.textContent = 'Xác thực';
    run.addEventListener('click', runChallenge);

    panel.append(head, copy, status, run, fallback);
    challengeLayer.appendChild(panel);
    challengeLayer.addEventListener('click', (event) => {
      if (event.target === challengeLayer) closeChallenge();
    });
    document.body.appendChild(challengeLayer);
  }

  CatChat.features.register({
    id: 'anti-flood',
    name: 'Chống spam & giảm tải',
    description: 'Giới hạn tần suất gửi tin, chặn tin trùng và bùng nổ reaction; phạt tăng dần.',
    start() {
      baseUpdateComposer = updateMessageComposer;
      updateMessageComposer = function patchedUpdateComposer(...args) {
        baseUpdateComposer.apply(this, args);
        applyLockToComposer();
      };
      buildChallenge();
      const hint = els.messageForm?.querySelector('.composer-hint') || document.querySelector('.composer-hint');
      if (hint) {
        chip = document.createElement('span');
        chip.className = 'security-chip';
        chip.id = 'securityChip';
        chip.title = 'Lớp bảo vệ chống spam phía máy khách';
        hint.insertBefore(chip, hint.lastElementChild);
      }
      updateSecurityChip();
      startTicker();

      CatChat.actions.register({
        id: 'security-verify',
        label: 'Xác thực để gửi tin lại',
        hint: 'Giải thử thách chống spam và mở khoá 10 phút',
        icon: 'shield',
        group: 'Bảo mật',
        when: () => Boolean(currentUser) && (CatChatGuard.strikesFor(key()) > 0 || CatChatGuard.lockedFor(key()) > 0),
        run() {
          openChallenge();
        }
      });
      CatChat.actions.register({
        id: 'security-status',
        label: 'Xem tình trạng bảo vệ',
        hint: 'Giới hạn gửi tin, số lần vượt và thời gian tạm khoá',
        icon: 'shield',
        group: 'Bảo mật',
        when: () => Boolean(currentUser),
        run() {
          const locked = CatChatGuard.lockedFor(key());
          const strikes = CatChatGuard.strikesFor(key());
          toast(
            locked > 0
              ? `Đang tạm khoá ${formatMs(locked)} · ${strikes} lần vượt giới hạn.`
              : `Không bị giới hạn. Đã ghi ${strikes} lần vượt giới hạn trong phiên này.`,
            'info'
          );
          updateSecurityChip();
        }
      });
    },
    outgoingText(payload) {
      if (!currentUser) return payload;
      const locked = CatChatGuard.lockedFor(key());
      if (locked > 0 && Date.now() > unlockedUntil) {
        toast(`Bạn đang tạm khoá gửi tin còn ${formatMs(locked)}.`, 'error');
        return { ...payload, cancel: true };
      }
      const soft = softUntil - Date.now();
      if (soft > 0) {
        toast(`Giãn nhịp một chút nhé, còn ${formatMs(soft)}.`, 'info');
        return { ...payload, cancel: true };
      }
      const bucket = payload.announcement ? ANNOUNCEMENT_BUCKET : MESSAGE_BUCKET;
      const limit = CatChatGuard.rateLimit(key(), bucket);
      if (!limit.allowed) {
        if (limit.reason === 'min-gap') {
          return softBlock('Hai tin nhắn đang sát nhau quá.', limit.retryAfterMs + 250);
        }
        return block(`Bạn đang gửi nhanh quá (giới hạn ${bucket.limit} tin / ${Math.round(bucket.windowMs / 1000)}s).`);
      }
      if (!payload.announcement && payload.text && isDuplicate(payload.text)) {
        duplicateHits += 1;
        if (duplicateHits >= 2) {
          duplicateHits = 0;
          return block('Bạn lặp lại cùng một nội dung nhiều lần.');
        }
        return softBlock('Tin nhắn này vừa được gửi rồi.', 3000);
      }
      if (!payload.announcement) rememberText(payload.text || '');
      return payload;
    },
    guardWrite(payload) {
      if (payload?.type !== 'reaction' || !currentUser) return false;
      const limit = CatChatGuard.rateLimit(`reaction:${currentUser.uid}`, REACTION_BUCKET);
      if (limit.allowed) return false;
      toast('Bạn thả cảm xúc hơi nhanh, chờ một chút nhé.', 'info');
      return true;
    },
    keydown(event) {
      if (!challengeLayer || challengeLayer.hidden) return false;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChallenge();
        return true;
      }
      return false;
    }
  });
})();
