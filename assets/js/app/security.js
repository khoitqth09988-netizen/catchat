/* CatChat · Lớp phòng vệ phía máy khách (rate limit, chống spam, challenge).
   Lưu ý: đây chỉ là lớp giảm tải/giảm lạm dụng trong trình duyệt.
   Chống DDoS thật phải nằm ở hạ tầng: Firebase App Check, quota, Cloud Armor/CDN.
   Mọi trạng thái ở đây là tạm thời (trong bộ nhớ) và có thể bị người dùng xoá. */
'use strict';

const CatChatGuard = (() => {
  /** Token bucket: mỗi khoá có sức chứa tối đa và tốc độ hồi phục riêng. */
  const buckets = new Map();
  /** Số lần vi phạm và thời điểm mở khoá của từng khoá. */
  const penalties = new Map();
  const history = [];
  const listeners = new Set();

  function nowMs() {
    return Date.now();
  }

  function emit(event) {
    history.push({ ...event, at: nowMs() });
    if (history.length > 120) history.shift();
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.warn('CatChatGuard listener lỗi:', error);
      }
    });
  }

  /**
   * Tiêu một lượt trong token bucket.
   * @returns {{allowed: boolean, retryAfterMs: number, remaining: number}}
   */
  function rateLimit(key, { limit = 5, windowMs = 10000, minGapMs = 0, cost = 1 } = {}) {
    const time = nowMs();
    const refillPerMs = limit / Math.max(1, windowMs);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: limit, updatedAt: time, lastUsed: 0 };
      buckets.set(key, bucket);
    }
    const elapsed = Math.max(0, time - bucket.updatedAt);
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillPerMs);
    bucket.updatedAt = time;
    if (minGapMs > 0 && time - bucket.lastUsed < minGapMs) {
      const retryAfterMs = minGapMs - (time - bucket.lastUsed);
      emit({ type: 'throttle', key, retryAfterMs, reason: 'min-gap' });
      return { allowed: false, retryAfterMs, remaining: Math.floor(bucket.tokens), reason: 'min-gap' };
    }
    if (bucket.tokens < cost) {
      const retryAfterMs = Math.ceil((cost - bucket.tokens) / refillPerMs);
      emit({ type: 'throttle', key, retryAfterMs, reason: 'bucket' });
      return { allowed: false, retryAfterMs, remaining: Math.floor(bucket.tokens), reason: 'bucket' };
    }
    bucket.tokens -= cost;
    bucket.lastUsed = time;
    return { allowed: true, retryAfterMs: 0, remaining: Math.floor(bucket.tokens), reason: '' };
  }

  /** Ghi nhận vi phạm và trả về thời gian phạt (ms). Mức phạt tăng dần theo số lần. */
  function penalize(key, { steps = [10000, 30000, 60000, 180000, 600000] } = {}) {
    const time = nowMs();
    const record = penalties.get(key) || { strikes: 0, until: 0 };
    record.strikes += 1;
    const step = steps[Math.min(record.strikes - 1, steps.length - 1)];
    record.until = Math.max(record.until, time + step);
    penalties.set(key, record);
    emit({ type: 'penalty', key, strikes: record.strikes, until: record.until });
    return { penaltyMs: step, strikes: record.strikes, until: record.until };
  }

  function lockedFor(key) {
    const record = penalties.get(key);
    if (!record) return 0;
    return Math.max(0, record.until - nowMs());
  }

  function strikesFor(key) {
    return penalties.get(key)?.strikes || 0;
  }

  function clearPenalty(key) {
    if (key) penalties.delete(key);
    else penalties.clear();
  }

  function resetBucket(key) {
    buckets.delete(key);
  }

  function stats() {
    return {
      keys: [...buckets.keys()],
      penalties: [...penalties.entries()].map(([key, value]) => ({
        key,
        strikes: value.strikes,
        lockedMs: Math.max(0, value.until - nowMs())
      })),
      events: history.slice(-20)
    };
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /**
   * Thử thách proof-of-work nhẹ: tìm nonce sao cho SHA-256("<seed>:<nonce>") bắt đầu bằng `difficulty` số 0 hex.
   * Mục đích: làm chậm script tự động khi bị nghi spam, không ảnh hưởng người dùng bình thường.
   */
  async function solveChallenge({ difficulty = 3, seed = String(nowMs()), onProgress } = {}) {
    if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
    const encoder = new TextEncoder();
    const target = '0'.repeat(difficulty);
    const startedAt = nowMs();
    let nonce = 0;
    while (nowMs() - startedAt < 20000) {
      for (let batch = 0; batch < 250; batch += 1, nonce += 1) {
        const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${seed}:${nonce}`));
        const hex = Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        if (hex.startsWith(target)) return { nonce, hex, ms: nowMs() - startedAt };
      }
      if (typeof onProgress === 'function') onProgress(nonce);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    return null;
  }

  return {
    rateLimit,
    penalize,
    lockedFor,
    strikesFor,
    clearPenalty,
    resetBucket,
    stats,
    onChange,
    solveChallenge,
    now: nowMs
  };
})();
