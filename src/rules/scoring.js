// امتیازدهی: برد عادی ۱، گامون ۲، بک‌گامون ۳
import { countAt, inHome, opponent, CHECKERS_PER_PLAYER } from './board.js';

export const RESULT_KIND = { NORMAL: 'normal', GAMMON: 'gammon', BACKGAMMON: 'backgammon' };

export function hasWon(board, p) {
  return board.off[p] === CHECKERS_PER_PLAYER;
}

/**
 * نتیجه‌ی بازی برای بازنده‌ای که بازی تمام شده:
 *  - برد عادی: بازنده دست‌کم یک مهره خارج کرده است.
 *  - گامون: بازنده هیچ مهره‌ای خارج نکرده است.
 *  - بک‌گامون: گامون + بازنده هنوز مهره‌ای روی Bar یا در خانه‌ی داخلی برنده دارد.
 */
export function gameResult(board, winner) {
  const loser = opponent(winner);
  let kind = RESULT_KIND.NORMAL;
  if (board.off[loser] === 0) {
    kind = RESULT_KIND.GAMMON;
    let trapped = board.bar[loser] > 0;
    for (let i = 0; i < 24 && !trapped; i++) {
      // خانه‌ی داخلی برنده = خانه‌ی داخلی همان بازیکن
      if (inHome(winner, i) && countAt(board, loser, i) > 0) trapped = true;
    }
    if (trapped) kind = RESULT_KIND.BACKGAMMON;
  }
  const points = kind === RESULT_KIND.NORMAL ? 1 : kind === RESULT_KIND.GAMMON ? 2 : 3;
  return { winner, kind, points };
}

export const RESULT_TEXT_FA = {
  normal: 'برد عادی',
  gammon: 'برد گامون',
  backgammon: 'برد بک‌گامون',
};
