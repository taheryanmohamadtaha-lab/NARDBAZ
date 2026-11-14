// سطح متوسط: ارزیابی یک‌مرحله‌ای (مهره‌های تک، احتمال زده شدن، خانه‌های بسته، Bar، Pip)
import { evaluate } from './eval.js';

export function scoreOutcomes(outcomes, player) {
  return outcomes.map((o) => ({ outcome: o, score: evaluate(o.board, player) }));
}

export function chooseMedium(outcomes, player, rng = Math.random) {
  if (outcomes.length === 1) return outcomes[0];
  let best = null;
  let bestScore = -Infinity;
  for (const o of outcomes) {
    const s = evaluate(o.board, player) + (rng() - 0.5) * 1.5; // کمی تنوع
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}
