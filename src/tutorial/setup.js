// ساخت صفحه‌ی آموزشی. شماره‌ی خانه‌ها همیشه از دید «سفید» است (خانه‌ی n ⇒ اندیس n-1)
// برای هر دو رنگ: mk({ w: {24: 2}, b: {1: 2}, bar: [سفید, مشکی], off: [سفید, مشکی] })
export function mk({ w = {}, b = {}, bar = [0, 0], off = [0, 0] } = {}) {
  const points = new Array(24).fill(0);
  for (const [n, c] of Object.entries(w)) points[Number(n) - 1] += c;
  for (const [n, c] of Object.entries(b)) points[Number(n) - 1] -= c;
  return { points, bar: bar.slice(), off: off.slice() };
}

/** شماره‌ی خانه (۱ تا ۲۴ از دید سفید) → اندیس */
export const idx = (n) => n - 1;
