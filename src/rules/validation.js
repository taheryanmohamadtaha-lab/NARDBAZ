// اعتبارسنجی حرکت و توضیح فارسی دلیل غیرمجاز بودن
import { countAt, dirOf, opponent, distanceToOff } from './board.js';
import { canBearOff, hasFartherChecker } from './bearing-off.js';
import { legalMoves, destinationsFrom } from './movement.js';

export function isMoveLegal(board, p, remaining, plan, played, move) {
  return legalMoves(board, p, remaining, plan, played).some(
    (m) => m.from === move.from && m.to === move.to && m.die === move.die,
  );
}

/**
 * پیام فارسی برای وقتی که کاربر می‌خواهد از `from` به `to` برود ولی حرکت مجاز نیست.
 * from: اندیس یا 'bar'، to: اندیس یا 'off'
 */
export function explainIllegal(board, p, remaining, plan, played, from, to) {
  if (remaining.length === 0 || plan.requiredLen - played <= 0) {
    return 'تاسی برای استفاده باقی نمانده است.';
  }
  if (board.bar[p] > 0 && from !== 'bar') {
    return 'ابتدا باید مهره‌ی زده‌شده را از Bar وارد بازی کنید.';
  }
  if (from !== 'bar' && countAt(board, p, from) === 0) {
    return 'در این خانه مهره‌ی شما وجود ندارد.';
  }
  if (to === 'off') {
    if (!canBearOff(board, p)) {
      return 'تا وقتی همه‌ی مهره‌ها در خانه‌ی داخلی نباشند، خارج کردن مجاز نیست.';
    }
    const dist = distanceToOff(p, from);
    const maxDie = Math.max(...remaining);
    if (maxDie < dist) return 'عدد تاس برای خارج کردن این مهره کافی نیست.';
    if (hasFartherChecker(board, p, from)) {
      return 'مهره‌ی دورتری در خانه‌های داخلی دارید؛ با عدد بزرگ‌تر نمی‌توان این مهره را خارج کرد.';
    }
  } else {
    const opp = opponent(p);
    if (countAt(board, opp, to) >= 2) return 'این خانه بسته است (دو یا چند مهره‌ی حریف دارد).';
    if (from !== 'bar') {
      const delta = (to - from) * dirOf(p);
      if (delta <= 0) return 'مهره‌ها فقط در جهت حرکت خودشان می‌روند.';
      const sum = remaining.reduce((a, b) => a + b, 0);
      if (!remaining.includes(delta) && delta > sum) {
        return 'فاصله از عدد تاس‌های باقی‌مانده بیشتر است.';
      }
      if (!remaining.includes(delta) && !isReachableBySum(remaining, delta)) {
        return 'این فاصله با عدد تاس‌های شما نمی‌خواند.';
      }
    } else {
      return 'این خانه با تاس‌های شما قابل ورود نیست.';
    }
  }
  // به این‌جا که برسیم با تاس‌ها ممکن است ولی قانون «بیشترین استفاده از تاس» مانع است
  const dests = destinationsFrom(board, p, from, remaining, plan, played);
  if (dests.size === 0) return 'این مهره حرکت مجازی ندارد.';
  return 'این حرکت مجاز نیست؛ باید تا جای ممکن از هر دو تاس استفاده کنید (در صورت امکان از تاس بزرگ‌تر).';
}

function isReachableBySum(remaining, delta) {
  // آیا زیرمجموعه‌ای از تاس‌ها مجموعش delta است؟ (حداکثر ۴ تاس)
  const n = remaining.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let s = 0;
    for (let k = 0; k < n; k++) if (mask & (1 << k)) s += remaining[k];
    if (s === delta) return true;
  }
  return false;
}
