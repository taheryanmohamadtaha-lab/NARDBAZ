// ابزار ساخت صفحه‌ی آزمایشی
import { WHITE } from '../src/rules/board.js';

/**
 * boardFrom({ w: {شماره‌ی خانه از دید سفید: تعداد}, b: {...}, bar:[w,b], off:[w,b] })
 * شماره‌ی خانه از دید «هر بازیکن» است: خانه‌ی n برای سفید اندیس n-1،
 * و برای مشکی اندیس 24-n (چون مشکی از جهت مخالف می‌شمارد).
 */
export function boardFrom({ w = {}, b = {}, bar = [0, 0], off = [0, 0] } = {}) {
  const points = new Array(24).fill(0);
  for (const [n, c] of Object.entries(w)) points[Number(n) - 1] += c;
  for (const [n, c] of Object.entries(b)) points[24 - Number(n)] -= c;
  return { points, bar: bar.slice(), off: off.slice() };
}

/** برای تکمیل ۱۵ مهره با خارج‌شده‌ها: مجموع مهره‌های روی تخته + bar + off = 15 */
export function fill(board, p, spot) {
  // مهره‌های کم‌شده را به‌صورت off ثبت می‌کند تا مجموع ۱۵ شود
  let n = board.bar[p] + board.off[p];
  for (let i = 0; i < 24; i++) n += p === WHITE ? Math.max(0, board.points[i]) : Math.max(0, -board.points[i]);
  board.off[p] += 15 - n;
  return board;
}
