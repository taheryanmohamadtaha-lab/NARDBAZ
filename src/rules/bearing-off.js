// قوانین خارج کردن مهره‌ها (Bear Off)
import { countAt, distanceToOff, inHome, dirOf } from './board.js';

/** همه‌ی ۱۵ مهره (به‌جز خارج‌شده‌ها) داخل خانه‌ی داخلی‌اند و Bar خالی است؟ */
export function canBearOff(board, p) {
  if (board.bar[p] > 0) return false;
  for (let i = 0; i < 24; i++) {
    if (countAt(board, p, i) > 0 && !inHome(p, i)) return false;
  }
  return true;
}

/** آیا مهره‌ای دورتر از اندیس i (از نظر فاصله تا خروج) وجود دارد؟ */
export function hasFartherChecker(board, p, i) {
  const dist = distanceToOff(p, i);
  for (let j = 0; j < 24; j++) {
    if (countAt(board, p, j) > 0 && distanceToOff(p, j) > dist) return true;
  }
  return false;
}

/**
 * آیا مهره‌ی اندیس i با تاس die می‌تواند خارج شود؟
 *  - عدد دقیق: همیشه مجاز (به شرط canBearOff)
 *  - عدد بزرگ‌تر: فقط وقتی مهره‌ی دورتری وجود نداشته باشد
 */
export function canBearOffFrom(board, p, i, die) {
  if (!canBearOff(board, p)) return false;
  if (countAt(board, p, i) === 0) return false;
  const dist = distanceToOff(p, i);
  if (die === dist) return true;
  if (die > dist) return !hasFartherChecker(board, p, i);
  return false;
}

/** آیا حرکت یک مهره از i با die از لبه‌ی تخته بیرون می‌زند؟ */
export function leavesBoard(p, i, die) {
  const to = i + dirOf(p) * die;
  return to < 0 || to > 23;
}
