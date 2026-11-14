// سطح آسان: حرکت قانونی؛ اغلب محتاط (مهره‌ها را تنها نمی‌گذارد) ولی گاهی تصادفی بازی می‌کند.
import { evaluateSimple } from './eval.js';

export function chooseEasy(outcomes, player, rng = Math.random) {
  if (outcomes.length === 1) return outcomes[0];
  // ۴۰٪ مواقع کاملاً تصادفی
  if (rng() < 0.4) return outcomes[Math.floor(rng() * outcomes.length)];
  let best = null;
  let bestScore = -Infinity;
  for (const o of outcomes) {
    const s = evaluateSimple(o.board, player) + rng() * 3;
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}
