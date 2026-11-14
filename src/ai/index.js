// نقطه‌ی ورود هوش مصنوعی: بر اساس سطح دشواری یک نوبت کامل را انتخاب می‌کند.
// هوش مصنوعی فقط از «نتیجه‌های قانونی» (allTurnOutcomes) انتخاب می‌کند؛ پس نمی‌تواند تقلب کند
// و تاس را هم خودش تعیین نمی‌کند (تاس از بیرون به آن داده می‌شود).
import { allTurnOutcomes, planTurn } from '../rules/movement.js';
import { chooseEasy } from './easy.js';
import { chooseMedium } from './medium.js';
import { chooseHard } from './hard.js';

export const LEVELS = ['easy', 'medium', 'hard'];

/**
 * @returns {{moves: Array}} آرایه‌ی حرکت‌های تکی به ترتیب اجرا
 */
export function chooseTurn(board, player, d1, d2, level = 'medium', rng = Math.random, plan = null) {
  const p = plan || planTurn(board, player, d1, d2);
  const outcomes = allTurnOutcomes(board, player, d1, d2, p);
  if (outcomes.length === 0 || outcomes[0].moves.length === 0) return { moves: [] };
  let pick;
  if (level === 'easy') pick = chooseEasy(outcomes, player, rng);
  else if (level === 'hard') pick = chooseHard(outcomes, player, rng);
  else pick = chooseMedium(outcomes, player, rng);
  return { moves: orderMoves(pick.moves) };
}

// ترتیب اجرای حرکت‌ها برای نمایش طبیعی (ترتیب حفظ می‌شود؛ هر ترتیب خروجی DFS معتبر است)
function orderMoves(moves) {
  return moves;
}
