// تولید حرکت‌های قانونی و اعمال آن‌ها.
// قانون کلیدی: بازیکن باید تا جای ممکن از «بیشترین تعداد تاس» استفاده کند.
// برای رعایت این قانون، قبل از شروع نوبت «طول لازم» (requiredLen) را با جست‌وجوی کامل پیدا می‌کنیم
// و هر حرکتی که نتواند به یک توالی با آن طول برسد، غیرمجاز است.
import {
  cloneBoard,
  countAt,
  dirOf,
  entryIndex,
  boardKey,
  signOf,
  opponent,
} from './board.js';
import { canBearOff, canBearOffFrom } from './bearing-off.js';

/** همه‌ی حرکت‌های تکی ممکن با یک عدد تاس (بدون در نظر گرفتن قانون بیشترین استفاده) */
export function singleMoves(board, p, die) {
  const moves = [];
  const opp = opponent(p);

  if (board.bar[p] > 0) {
    const to = entryIndex(p, die);
    const oc = countAt(board, opp, to);
    if (oc < 2) moves.push({ from: 'bar', to, die, hit: oc === 1 });
    return moves;
  }

  const dir = dirOf(p);
  const bearOK = canBearOff(board, p);
  for (let i = 0; i < 24; i++) {
    if (countAt(board, p, i) === 0) continue;
    const to = i + dir * die;
    if (to < 0 || to > 23) {
      if (bearOK && canBearOffFrom(board, p, i, die)) {
        moves.push({ from: i, to: 'off', die, hit: false });
      }
      continue;
    }
    const oc = countAt(board, opp, to);
    if (oc >= 2) continue;
    moves.push({ from: i, to, die, hit: oc === 1 });
  }
  return moves;
}

/** اعمال یک حرکت؛ صفحه‌ی جدید برمی‌گردد (صفحه‌ی اصلی تغییر نمی‌کند) */
export function applyMove(board, p, move) {
  const b = cloneBoard(board);
  const s = signOf(p);
  if (move.from === 'bar') b.bar[p] -= 1;
  else b.points[move.from] -= s;

  if (move.to === 'off') {
    b.off[p] += 1;
  } else {
    if (b.points[move.to] === -s) {
      // زدن مهره‌ی تک حریف
      b.points[move.to] = 0;
      b.bar[opponent(p)] += 1;
    }
    b.points[move.to] += s;
  }
  return b;
}

function removeOne(arr, value) {
  const idx = arr.indexOf(value);
  const out = arr.slice();
  out.splice(idx, 1);
  return out;
}

function sortedAsc(arr) {
  return arr.slice().sort((a, b) => a - b);
}

/** بیشترین تعداد حرکتی که با تاس‌های rem (آرایه‌ی مرتب) از این صفحه می‌شود انجام داد */
export function remainingDepth(board, p, rem, memo) {
  if (rem.length === 0) return 0;
  const key = boardKey(board) + '#' + p + '#' + rem.join('');
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let best = 0;
  let prev = -1;
  for (let k = 0; k < rem.length && best < rem.length; k++) {
    const d = rem[k];
    if (d === prev) continue;
    prev = d;
    const rest = removeOne(rem, d);
    for (const m of singleMoves(board, p, d)) {
      const v = 1 + remainingDepth(applyMove(board, p, m), p, rest, memo);
      if (v > best) best = v;
      if (best === rem.length) break;
    }
  }
  memo.set(key, best);
  return best;
}

/**
 * برنامه‌ی نوبت: تاس‌ها، طول لازم، و (در صورت لزوم) «تنها عدد مجاز».
 * اگر فقط یکی از دو تاس قابل بازی باشد و هر دو به‌تنهایی ممکن باشند، باید عدد بزرگ‌تر بازی شود.
 */
export function planTurn(board, p, d1, d2) {
  const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  const memo = new Map();
  const requiredLen = remainingDepth(board, p, sortedAsc(dice), memo);
  let onlyDie = null;
  if (d1 !== d2 && requiredLen === 1) {
    const hi = Math.max(d1, d2);
    onlyDie = singleMoves(board, p, hi).length > 0 ? hi : Math.min(d1, d2);
  }
  return { dice, requiredLen, onlyDie, memo };
}

/**
 * حرکت‌های قانونی بعدی.
 * remaining: تاس‌های باقی‌مانده، played: تعداد حرکت‌های انجام‌شده در این نوبت
 * خروجی بر اساس عدد تاس صعودی مرتب است.
 */
export function legalMoves(board, p, remaining, plan, played) {
  const need = plan.requiredLen - played;
  if (need <= 0 || remaining.length === 0) return [];
  const rem = sortedAsc(remaining);
  const out = [];
  let prev = -1;
  for (const d of rem) {
    if (d === prev) continue;
    prev = d;
    if (plan.onlyDie != null && d !== plan.onlyDie) continue;
    const rest = removeOne(rem, d);
    for (const m of singleMoves(board, p, d)) {
      const nb = applyMove(board, p, m);
      if (1 + remainingDepth(nb, p, rest, plan.memo) >= need) out.push(m);
    }
  }
  return out;
}

export function removeDie(remaining, die) {
  return removeOne(remaining, die);
}

/**
 * مقصدهای ممکن برای یک مهره‌ی مشخص (from)، شامل حرکت‌های ترکیبی با چند تاس.
 * خروجی: Map(مقصد → آرایه‌ای از حرکت‌های تکی). کوتاه‌ترین زنجیره انتخاب می‌شود.
 */
export function destinationsFrom(board, p, from, remaining, plan, played) {
  const out = new Map();
  function rec(b, cur, rem, pl, chain) {
    const options = legalMoves(b, p, rem, plan, pl).filter((m) => m.from === cur);
    for (const m of options) {
      const nc = chain.concat(m);
      const existing = out.get(m.to);
      if (!existing || existing.length > nc.length) out.set(m.to, nc);
      if (m.to !== 'off' && nc.length < 4) {
        const rest = removeOne(rem, m.die);
        if (rest.length > 0) rec(applyMove(b, p, m), m.to, rest, pl + 1, nc);
      }
    }
  }
  rec(board, from, remaining, played, []);
  return out;
}

/**
 * همه‌ی نتیجه‌های ممکن یک نوبت کامل (برای هوش مصنوعی).
 * خروجی: آرایه‌ای از {moves, board}؛ هر صفحه‌ی نهایی فقط یک بار می‌آید.
 */
export function allTurnOutcomes(board, p, d1, d2, planArg) {
  const plan = planArg || planTurn(board, p, d1, d2);
  if (plan.requiredLen === 0) return [{ moves: [], board }];
  const results = new Map();
  const visited = new Set();

  function dfs(b, rem, moves) {
    if (moves.length === plan.requiredLen) {
      const k = boardKey(b);
      if (!results.has(k)) results.set(k, { moves, board: b });
      return;
    }
    const vk = boardKey(b) + '#' + rem.join('');
    if (visited.has(vk)) return;
    visited.add(vk);
    const need = plan.requiredLen - moves.length;
    let prev = -1;
    for (const d of rem) {
      if (d === prev) continue;
      prev = d;
      if (plan.onlyDie != null && d !== plan.onlyDie) continue;
      const rest = removeOne(rem, d);
      for (const m of singleMoves(b, p, d)) {
        const nb = applyMove(b, p, m);
        if (1 + remainingDepth(nb, p, rest, plan.memo) < need) continue;
        dfs(nb, rest, moves.concat(m));
      }
    }
  }
  dfs(board, sortedAsc(plan.dice), []);
  return Array.from(results.values());
}
