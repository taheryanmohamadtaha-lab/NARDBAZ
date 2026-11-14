// سطح سخت: Expectiminimax دو لایه‌ای (حرکت من → ۲۱ تاس ممکن حریف → بهترین پاسخ حریف)
// برای عملکرد خوب روی گوشی:
//  - فقط N کاندید برتر (طبق ارزیابی یک‌مرحله‌ای) بررسی می‌شوند
//  - محدودیت زمانی دارد؛ اگر زمان تمام شد، با اطلاعات موجود بهترین انتخاب برمی‌گردد
import { evaluate } from './eval.js';
import { allTurnOutcomes } from '../rules/movement.js';
import { opponent, hasContact } from '../rules/board.js';
import { hasWon } from '../rules/scoring.js';

// ۲۱ حالت یکتای تاس با وزن (جفت‌ها ۱، غیرجفت‌ها ۲ از ۳۶)
const ROLL_TABLE = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLL_TABLE.push({ a, b, w: a === b ? 1 : 2 });

export function chooseHard(outcomes, player, rng = Math.random, opts = {}) {
  if (outcomes.length === 1) return outcomes[0];
  const topN = opts.topN ?? 8;
  const timeBudgetMs = opts.timeBudgetMs ?? 1500;
  const deadline = Date.now() + timeBudgetMs;

  // مرحله‌ی ۱: رتبه‌بندی با ارزیابی ایستا
  const ranked = outcomes
    .map((o) => ({ o, s: evaluate(o.board, player) }))
    .sort((x, y) => y.s - x.s);
  const candidates = ranked.slice(0, topN);

  // اگر مسابقه‌ی سرعتی خالص است، ارزیابی ایستا کافی و دقیق است
  if (!hasContact(candidates[0].o.board)) return candidates[0].o;

  const opp = opponent(player);
  let best = candidates[0];
  let bestValue = -Infinity;
  for (const cand of candidates) {
    if (hasWon(cand.o.board, player)) return cand.o;
    let total = 0;
    let weight = 0;
    let complete = true;
    for (const r of ROLL_TABLE) {
      if (Date.now() > deadline) {
        complete = false;
        break;
      }
      const replies = allTurnOutcomes(cand.o.board, opp, r.a, r.b);
      // حریف بهترین پاسخ را (از دید خودش) انتخاب می‌کند
      let worstForMe = Infinity;
      for (const rep of replies) {
        const v = hasWon(rep.board, opp) ? -1e6 : evaluate(rep.board, player);
        if (v < worstForMe) worstForMe = v;
      }
      total += worstForMe * r.w;
      weight += r.w;
    }
    if (!complete) {
      // زمان تمام شد: اگر هنوز کاندید کامل ارزیابی نشده، از ارزیابی ایستا استفاده نکن مگر هیچ کاندیدی کامل نشده باشد
      if (bestValue === -Infinity) return cand.o === candidates[0].o ? cand.o : best.o;
      break;
    }
    const value = total / weight + (rng() - 0.5) * 0.05;
    if (value > bestValue) {
      bestValue = value;
      best = cand;
    }
  }
  return best.o;
}
