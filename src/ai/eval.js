// تابع ارزیابی موقعیت برای هوش مصنوعی.
// مقدار بالاتر = موقعیت بهتر برای بازیکن p.
import {
  countAt,
  dirOf,
  distanceToOff,
  entryIndex,
  hasContact,
  opponent,
  pipCount,
} from '../rules/board.js';

const ALL_ROLLS = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) ALL_ROLLS.push([a, b]);

/**
 * تعداد تاس‌های (از ۳۶ حالت) که حریف با آن‌ها می‌تواند مهره‌ی تک p را در اندیس idx بزند.
 * محاسبه‌ی تقریبی: تاس‌های تکی، مجموع دو تاس و جفت‌ها، با درنظرگرفتن خانه‌های میانی بسته.
 */
export function hitRolls(board, p, idx) {
  const o = opponent(p);
  const dir = dirOf(o);
  const sources = []; // فاصله‌ی هر منبع تا idx و موقعیت شروع
  if (board.bar[o] > 0) {
    const d = o === 0 ? 24 - idx : idx + 1;
    if (d >= 1 && d <= 24) sources.push({ from: 'bar', dist: d });
  } else {
    for (let i = 0; i < 24; i++) {
      if (countAt(board, o, i) === 0) continue;
      const d = (idx - i) * dir;
      if (d >= 1) sources.push({ from: i, dist: d });
    }
  }
  if (sources.length === 0) return 0;

  const blockedAt = (pos) => pos >= 0 && pos <= 23 && countAt(board, p, pos) >= 2;
  let count = 0;
  for (const [a, b] of ALL_ROLLS) {
    let hit = false;
    for (const s of sources) {
      const startPos = s.from === 'bar' ? (o === 0 ? 24 : -1) : s.from;
      const steps = a === b ? [a, a * 2, a * 3, a * 4] : [a, b, a + b];
      for (const st of steps) {
        if (st !== s.dist) continue;
        // بررسی خانه‌های میانی (برای ترکیب‌ها)
        let ok = true;
        if (a === b) {
          for (let k = 1; k * a < st && ok; k++) if (blockedAt(startPos + dirOf(o) * k * a)) ok = false;
        } else if (st === a + b) {
          const m1 = blockedAt(startPos + dirOf(o) * a);
          const m2 = blockedAt(startPos + dirOf(o) * b);
          ok = !(m1 && m2);
        }
        if (ok) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (hit) count++;
  }
  return count;
}

function ownBlots(board, p) {
  const out = [];
  for (let i = 0; i < 24; i++) if (countAt(board, p, i) === 1) out.push(i);
  return out;
}

function longestPrime(board, p) {
  // طولانی‌ترین رشته‌ی خانه‌های بسته‌ی پشت‌سرهم
  let best = 0;
  let cur = 0;
  for (let i = 0; i < 24; i++) {
    if (countAt(board, p, i) >= 2) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 0;
  }
  return best;
}

/** ارزیابی کامل (متوسط/سخت) */
export function evaluate(board, p) {
  const o = opponent(p);
  const myPips = pipCount(board, p);
  const oppPips = pipCount(board, o);
  let score = (oppPips - myPips) * 1.0;
  score += (board.off[p] - board.off[o]) * 2;

  const contact = hasContact(board);
  if (!contact) return score * 1.5; // مسابقه‌ی سرعتی خالص

  // مهره‌های روی Bar
  score -= board.bar[p] * 22;
  score += board.bar[o] * 16;

  // مهره‌های تک و احتمال زده شدن
  for (const i of ownBlots(board, p)) {
    const risk = hitRolls(board, p, i) / 36;
    const lost = 25 - distanceToOff(p, i) + 6; // پیپی که با زده شدن از دست می‌رود
    score -= risk * (lost * 0.9 + 8);
  }
  // مهره‌های تک حریف: فرصت زدن
  for (const i of ownBlots(board, o)) {
    const risk = hitRolls(board, o, i) / 36;
    score += risk * 6;
  }

  // خانه‌های بسته (خانه‌ی خودی با ≥۲ مهره) و ارزش آن‌ها
  let made = 0;
  let homeMade = 0;
  for (let i = 0; i < 24; i++) {
    const c = countAt(board, p, i);
    if (c >= 2) {
      made++;
      const dist = distanceToOff(p, i);
      if (dist <= 6) homeMade++;
      score += dist <= 6 ? 4.5 : dist <= 12 ? 3.5 : dist <= 18 ? 3 : 2.5;
      if (c > 4) score -= (c - 4) * 1.2; // پشته‌ی خیلی بلند ناکارآمد است
    }
  }
  const prime = longestPrime(board, p);
  if (prime >= 3) score += (prime - 2) * 4;
  // حریف روی Bar و خانه‌ی داخلی بسته = قدرت حمله
  if (board.bar[o] > 0) score += homeMade * 3;
  const oppPrime = longestPrime(board, o);
  if (oppPrime >= 4) score -= (oppPrime - 3) * 4;

  return score;
}

/** ارزیابی ساده برای سطح آسان: فقط ایمنی مهره‌ها و زدن */
export function evaluateSimple(board, p) {
  const o = opponent(p);
  let score = (pipCount(board, o) - pipCount(board, p)) * 0.3;
  score += board.bar[o] * 8 - board.bar[p] * 8;
  score += (board.off[p] - board.off[o]) * 2;
  for (let i = 0; i < 24; i++) {
    const c = countAt(board, p, i);
    if (c === 1) score -= 5; // مهره‌ی تنها = خطر
    else if (c >= 2) score += 1.5;
  }
  return score;
}

export { ALL_ROLLS, entryIndex };
