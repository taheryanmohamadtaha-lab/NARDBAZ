// داوری مرحله‌های «task» (بدون وابستگی به رابط کاربری، قابل تست)
/**
 * info = { chain, from, to, hit, board, attempt, ended, player }
 * خروجی: { status: 'ok' | 'fail' | 'continue', msg? }
 */
export function judge(step, info) {
  let r = null;
  if (step.check) r = step.check(info);
  else if (step.expect) {
    const okMove = step.expect.some((e) => e.from === info.from && e.to === info.to);
    r = okMove ? true : step.wrong || 'این حرکت قانونی است، ولی هدف این مرحله نیست. دوباره تلاش کن.';
  } else if (step.until === 'turnEnd') {
    r = info.ended ? true : null;
  }
  if (r === true) return { status: 'ok' };
  if (typeof r === 'string') return { status: 'fail', msg: r };
  if (r === false) return { status: 'fail', msg: 'این حرکت هدف مرحله را برآورده نمی‌کند.' };
  if (info.ended) return { status: 'fail', msg: 'نوبت تمام شد ولی هدف مرحله انجام نشد. دوباره تلاش کن.' };
  return { status: 'continue' };
}
