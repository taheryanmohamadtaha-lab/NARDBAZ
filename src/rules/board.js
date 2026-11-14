// ثابت‌ها و ابزارهای پایه‌ی صفحه‌ی تخته‌نرد (بدون هیچ وابستگی به گرافیک)
//
// نمایش صفحه:
//   points[i] برای i = 0..23. عدد مثبت = تعداد مهره‌های سفید، عدد منفی = تعداد مهره‌های مشکی.
//   سفید (بازیکن ۰) از اندیس ۲۳ به سمت ۰ حرکت می‌کند؛ خانه‌ی داخلی سفید: اندیس ۰ تا ۵.
//   مشکی (بازیکن ۱) از اندیس ۰ به سمت ۲۳ حرکت می‌کند؛ خانه‌ی داخلی مشکی: اندیس ۱۸ تا ۲۳.
//   «شماره‌ی خانه» از دید سفید = اندیس + ۱ (خانه‌ی ۲۴ یعنی اندیس ۲۳).

export const WHITE = 0;
export const BLACK = 1;
export const CHECKERS_PER_PLAYER = 15;

export const opponent = (p) => 1 - p;
export const dirOf = (p) => (p === WHITE ? -1 : 1);
export const signOf = (p) => (p === WHITE ? 1 : -1);

export function createInitialBoard() {
  const points = new Array(24).fill(0);
  // سفید: ۲ مهره در خانه‌ی ۲۴، ۵ در ۱۳، ۳ در ۸، ۵ در ۶
  points[23] = 2;
  points[12] = 5;
  points[7] = 3;
  points[5] = 5;
  // مشکی: قرینه
  points[0] = -2;
  points[11] = -5;
  points[16] = -3;
  points[18] = -5;
  return { points, bar: [0, 0], off: [0, 0] };
}

export function cloneBoard(b) {
  return { points: b.points.slice(), bar: b.bar.slice(), off: b.off.slice() };
}

export function countAt(b, p, i) {
  const v = b.points[i];
  return p === WHITE ? (v > 0 ? v : 0) : v < 0 ? -v : 0;
}

/** اندیسی که مهره از Bar با عدد تاس d وارد آن می‌شود */
export function entryIndex(p, d) {
  return p === WHITE ? 24 - d : d - 1;
}

/** فاصله‌ی مهره‌ی روی اندیس i تا خروج از تخته (۱ تا ۲۴) */
export function distanceToOff(p, i) {
  return p === WHITE ? i + 1 : 24 - i;
}

export function inHome(p, i) {
  return p === WHITE ? i <= 5 : i >= 18;
}

export function totalCheckers(b, p) {
  let n = b.bar[p] + b.off[p];
  for (let i = 0; i < 24; i++) n += countAt(b, p, i);
  return n;
}

export function pipCount(b, p) {
  let pips = b.bar[p] * 25;
  for (let i = 0; i < 24; i++) pips += countAt(b, p, i) * distanceToOff(p, i);
  return pips;
}

export function boardKey(b) {
  return b.points.join(',') + '|' + b.bar[0] + ',' + b.bar[1] + '|' + b.off[0] + ',' + b.off[1];
}

/** آیا دو بازیکن هنوز می‌توانند به هم برخورد کنند؟ (برای تشخیص مسابقه‌ی خالص سرعتی) */
export function hasContact(b) {
  if (b.bar[0] > 0 || b.bar[1] > 0) return true;
  // سفید به سمت اندیس کمتر می‌رود. اگر دورترین مهره‌ی مشکی (کمترین اندیس) از نزدیک‌ترین مهره‌ی سفید جلوتر نباشد، برخورد ممکن است.
  let whiteMin = 99; // کمترین اندیس سفید
  let blackMax = -1; // بیشترین اندیس مشکی
  let blackMin = 99;
  let whiteMax = -1;
  for (let i = 0; i < 24; i++) {
    if (b.points[i] > 0) {
      if (i < whiteMin) whiteMin = i;
      if (i > whiteMax) whiteMax = i;
    } else if (b.points[i] < 0) {
      if (i > blackMax) blackMax = i;
      if (i < blackMin) blackMin = i;
    }
  }
  if (whiteMax < 0 || blackMax < 0) return false;
  // سفید حرکت رو به پایین، مشکی رو به بالا: وقتی کمترین اندیس سفید > بیشترین اندیس مشکی، از هم رد شده‌اند.
  return whiteMin <= blackMax;
}
