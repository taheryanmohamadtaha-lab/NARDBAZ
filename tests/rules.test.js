import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialBoard,
  totalCheckers,
  pipCount,
  WHITE,
  BLACK,
} from '../src/rules/board.js';
import {
  singleMoves,
  applyMove,
  planTurn,
  legalMoves,
  allTurnOutcomes,
  destinationsFrom,
} from '../src/rules/movement.js';
import { canBearOff } from '../src/rules/bearing-off.js';
import { gameResult } from '../src/rules/scoring.js';
import { isMoveLegal, explainIllegal } from '../src/rules/validation.js';
import {
  createGame,
  rollOpening,
  setDice,
  playMove,
  getLegalMoves,
  passTurn,
  undoMove,
  serializeGame,
  restoreGame,
} from '../src/rules/game-state.js';
import { boardFrom, fill } from './helpers.js';

const hasMove = (moves, from, to, die) =>
  moves.some((m) => m.from === from && m.to === to && (die === undefined || m.die === die));

// اندیس = شماره‌ی خانه از دید سفید - ۱
const W = (n) => n - 1;

test('چیدمان اولیه: ۱۵ مهره برای هر بازیکن و موقعیت‌های درست', () => {
  const b = createInitialBoard();
  assert.equal(totalCheckers(b, WHITE), 15);
  assert.equal(totalCheckers(b, BLACK), 15);
  assert.equal(b.points[W(24)], 2);
  assert.equal(b.points[W(13)], 5);
  assert.equal(b.points[W(8)], 3);
  assert.equal(b.points[W(6)], 5);
  // مشکی قرینه
  assert.equal(b.points[0], -2);
  assert.equal(b.points[11], -5);
  assert.equal(b.points[16], -3);
  assert.equal(b.points[18], -5);
  assert.equal(pipCount(b, WHITE), 167);
  assert.equal(pipCount(b, BLACK), 167);
});

test('حرکت صحیح با تاس و جهت حرکت دو بازیکن', () => {
  const b = createInitialBoard();
  const wm = singleMoves(b, WHITE, 3);
  assert.ok(hasMove(wm, W(24), W(21), 3));
  assert.ok(hasMove(wm, W(13), W(10), 3));
  const bm = singleMoves(b, BLACK, 3);
  assert.ok(hasMove(bm, 0, 3, 3)); // مشکی رو به بالا
  assert.ok(!hasMove(bm, 23, 20));
});

test('حرکت به خانه‌ی خالی و خانه‌ی خودی مجاز است', () => {
  const b = createInitialBoard();
  assert.ok(hasMove(singleMoves(b, WHITE, 5), W(13), W(8), 5)); // خانه‌ی خودی (۸)
  assert.ok(hasMove(singleMoves(b, WHITE, 3), W(24), W(21), 3)); // خانه‌ی خالی (۲۱)
});

test('حرکت غیرمجاز به خانه‌ی بسته (چیدمان اولیه)', () => {
  const b = createInitialBoard();
  // سفید از ۲۴ با ۵ به اندیس ۱۸ می‌رسد که ۵ مهره‌ی مشکی دارد
  assert.ok(!hasMove(singleMoves(b, WHITE, 5), W(24), 18));
  // سفید از ۱۳ با ۲ به اندیس ۱۰ می‌رسد که خالی است؛ ولی با ۱ به اندیس ۱۱ می‌رسد که ۵ مهره‌ی مشکی دارد
  assert.ok(!hasMove(singleMoves(b, WHITE, 1), W(13), 11));
});

test('خانه‌ی بسته: سفید نمی‌تواند روی دو مهره‌ی مشکی بنشیند', () => {
  const b = boardFrom({ w: { 10: 1, 24: 1 }, b: { 17: 2 } }); // مشکی روی اندیس 7
  fill(b, WHITE);
  fill(b, BLACK);
  // مشکی: خانه‌ی 17 از دید مشکی = اندیس 24-17 = 7 ؛ سفید از اندیس 9 (خانه‌ی 10) با 2 به اندیس 7 می‌رود → بسته
  const m = singleMoves(b, WHITE, 2);
  assert.ok(!hasMove(m, 9, 7));
  assert.ok(hasMove(m, 9, 8) === false); // با ۲ فقط به ۷ می‌رسد
});

test('زدن مهره‌ی تک حریف و انتقال به Bar', () => {
  const b = boardFrom({ w: { 10: 1 }, b: { 17: 1 } }); // مشکی تک در اندیس 7
  fill(b, WHITE);
  fill(b, BLACK);
  const m = singleMoves(b, WHITE, 2).find((x) => x.from === 9 && x.to === 7);
  assert.ok(m && m.hit);
  const nb = applyMove(b, WHITE, m);
  assert.equal(nb.bar[BLACK], 1);
  assert.equal(nb.points[7], 1);
});

test('ورود از Bar و ممنوعیت حرکت مهره‌های دیگر', () => {
  const b = boardFrom({ w: { 10: 1, 6: 1 }, b: { 1: 1 }, bar: [1, 0] });
  // سفید: ۱ مهره روی bar + ۲ روی تخته
  b.off[WHITE] = 12;
  fill(b, BLACK);
  const m = singleMoves(b, WHITE, 3);
  assert.equal(m.length, 1);
  assert.equal(m[0].from, 'bar');
  assert.equal(m[0].to, 21); // 24-3
  // ورود به خانه‌ی بسته‌ی حریف ناممکن است
  const b2 = boardFrom({ w: { 10: 1 }, b: { 4: 2 }, bar: [1, 0] });
  // مشکی روی اندیس 20 (خانه‌ی ۴ از دید مشکی = اندیس 20) ، سفید با 4 وارد اندیس 20 می‌شود → بسته
  fill(b2, WHITE);
  fill(b2, BLACK);
  assert.equal(singleMoves(b2, WHITE, 4).length, 0);
  assert.ok(singleMoves(b2, WHITE, 5).length === 1);
});

test('وقتی مهره روی Bar است، planTurn فقط حرکت ورود می‌دهد', () => {
  const b = boardFrom({ w: { 10: 3 }, b: { 4: 2, 5: 2 }, bar: [1, 0] });
  fill(b, WHITE);
  fill(b, BLACK);
  const plan = planTurn(b, WHITE, 4, 1);
  const legal = legalMoves(b, WHITE, plan.dice, plan, 0);
  assert.ok(legal.every((m) => m.from === 'bar'));
  assert.ok(legal.length >= 1);
});

test('جفت آوردن: چهار حرکت', () => {
  const b = createInitialBoard();
  const plan = planTurn(b, WHITE, 3, 3);
  assert.equal(plan.dice.length, 4);
  assert.equal(plan.requiredLen, 4);
  const outs = allTurnOutcomes(b, WHITE, 3, 3, plan);
  assert.ok(outs.length > 10);
  assert.ok(outs.every((o) => o.moves.length === 4));
});

test('استفاده‌ی اجباری از هر دو تاس در صورت امکان', () => {
  const b = createInitialBoard();
  const plan = planTurn(b, WHITE, 6, 1);
  assert.equal(plan.requiredLen, 2);
  const outs = allTurnOutcomes(b, WHITE, 6, 1, plan);
  assert.ok(outs.every((o) => o.moves.length === 2));
});

test('ترتیب‌های مختلف دو تاس نتیجه‌ی یکسان می‌دهند (مثلاً 6-1 و 1-6)', () => {
  const b = createInitialBoard();
  const a = allTurnOutcomes(b, WHITE, 6, 1).map((o) => o.board.points.join()).sort();
  const c = allTurnOutcomes(b, WHITE, 1, 6).map((o) => o.board.points.join()).sort();
  assert.deepEqual(a, c);
});

test('اگر ترتیب تاس‌ها مهم باشد، حرکت اول فقط با تاسی است که امکان استفاده از هر دو را می‌دهد', () => {
  // یک مهره‌ی سفید روی خانه‌ی ۸ (اندیس ۷)؛ مشکی اندیس ۶ را بسته است.
  // با ۱ نمی‌شود (بسته)؛ با ۲ به اندیس ۵ می‌رود و سپس با ۱ به اندیس ۴ → هر دو تاس قابل استفاده، ولی فقط با ترتیب ۲ سپس ۱.
  const b = boardFrom({ w: { 8: 1 }, b: { 18: 2 } });
  fill(b, WHITE);
  fill(b, BLACK);
  const plan = planTurn(b, WHITE, 1, 2);
  assert.equal(plan.requiredLen, 2);
  const legal = legalMoves(b, WHITE, plan.dice, plan, 0);
  assert.ok(legal.length > 0 && legal.every((m) => m.die === 2));
});

test('اولویت عدد بزرگ‌تر وقتی فقط یکی از دو تاس بازی‌شدنی است', () => {
  // مهره‌ی سفید روی اندیس ۱۰. با ۶ به اندیس ۴ و با ۱ به اندیس ۹ می‌رسد (هر دو آزاد).
  // ولی بعد از ۶: از اندیس ۴ با ۱ به اندیس ۳ (بسته)؛ بعد از ۱: از اندیس ۹ با ۶ به اندیس ۳ (بسته) → فقط یک تاس قابل استفاده است.
  const b = boardFrom({ w: { 11: 1 }, b: { 21: 2 } });
  fill(b, WHITE);
  fill(b, BLACK);
  const plan = planTurn(b, WHITE, 6, 1);
  assert.equal(plan.requiredLen, 1);
  assert.equal(plan.onlyDie, 6);
  const legal = legalMoves(b, WHITE, plan.dice, plan, 0);
  assert.ok(legal.length > 0 && legal.every((m) => m.die === 6));
});

test('اگر بخشی از جفت قابل اجرا باشد، تا بیشترین تعداد حرکت انجام می‌شود', () => {
  // یک مهره‌ی سفید در اندیس 10؛ مشکی خانه‌ی اندیس 4 را بسته → با جفت ۲: 10→8→6 (بعد 4 بسته) = ۲ حرکت
  const b = boardFrom({ w: { 11: 1 }, b: { 20: 2 } }); // اندیس 4
  fill(b, WHITE);
  fill(b, BLACK);
  const plan = planTurn(b, WHITE, 2, 2);
  assert.equal(plan.requiredLen, 2);
  const outs = allTurnOutcomes(b, WHITE, 2, 2, plan);
  assert.ok(outs.every((o) => o.moves.length === 2));
});

test('خارج کردن: فقط وقتی همه‌ی مهره‌ها در خانه‌ی داخلی‌اند', () => {
  const home = boardFrom({ w: { 6: 3, 3: 2 } });
  fill(home, WHITE);
  fill(home, BLACK);
  assert.ok(canBearOff(home, WHITE));
  const notHome = boardFrom({ w: { 6: 3, 7: 1 } });
  fill(notHome, WHITE);
  fill(notHome, BLACK);
  assert.ok(!canBearOff(notHome, WHITE));
  const moves = singleMoves(notHome, WHITE, 6);
  assert.ok(!moves.some((m) => m.to === 'off'));
});

test('خارج کردن با عدد دقیق', () => {
  const b = boardFrom({ w: { 6: 2, 3: 1 } });
  fill(b, WHITE);
  fill(b, BLACK);
  const m = singleMoves(b, WHITE, 3);
  assert.ok(m.some((x) => x.from === 2 && x.to === 'off'));
});

test('خارج کردن با عدد بزرگ‌تر فقط وقتی مهره‌ی دورتر نیست', () => {
  const b = boardFrom({ w: { 3: 2, 2: 1 } }); // دورترین مهره در خانه‌ی ۳
  fill(b, WHITE);
  fill(b, BLACK);
  const m6 = singleMoves(b, WHITE, 6);
  assert.ok(m6.some((x) => x.from === 2 && x.to === 'off')); // ۶ > ۳ و مهره‌ی دورتر نیست
  assert.ok(!m6.some((x) => x.from === 1 && x.to === 'off')); // مهره‌ی خانه‌ی ۲ نمی‌تواند چون خانه‌ی ۳ دورتر است
  const m5 = singleMoves(b, WHITE, 5);
  assert.ok(!m5.some((x) => x.from === 1 && x.to === 'off'));
});

test('خارج کردن با عدد بزرگ‌تر وقتی مهره‌ی دورتر وجود دارد غیرمجاز است', () => {
  const b = boardFrom({ w: { 6: 1, 2: 2 } });
  fill(b, WHITE);
  fill(b, BLACK);
  const m5 = singleMoves(b, WHITE, 5);
  // خانه‌ی ۲ با ۵ نمی‌تواند خارج شود چون مهره در خانه‌ی ۶ هست
  assert.ok(!m5.some((x) => x.from === 1 && x.to === 'off'));
  const m6 = singleMoves(b, WHITE, 6);
  assert.ok(m6.some((x) => x.from === 5 && x.to === 'off'));
});

test('مشکی هم درست خارج می‌کند', () => {
  const b = boardFrom({ b: { 6: 2, 2: 1 } });
  fill(b, WHITE);
  fill(b, BLACK);
  assert.ok(canBearOff(b, BLACK));
  // مشکی خانه‌ی ۲ (از دید مشکی) اندیس 22، فاصله 2
  const m = singleMoves(b, BLACK, 2);
  assert.ok(m.some((x) => x.from === 22 && x.to === 'off'));
});

test('پایان بازی و تشخیص برد عادی، گامون و بک‌گامون', () => {
  // برد عادی: بازنده یک مهره خارج کرده
  const normal = boardFrom({ b: { 10: 14 }, off: [15, 1] });
  assert.equal(gameResult(normal, WHITE).kind, 'normal');
  assert.equal(gameResult(normal, WHITE).points, 1);
  // گامون: بازنده هیچ مهره‌ای خارج نکرده و همه‌ی مهره‌هایش از خانه‌ی داخلی برنده دور است
  const gammon = boardFrom({ b: { 10: 15 }, off: [15, 0] }); // مشکی اندیس 14
  const g = gameResult(gammon, WHITE);
  assert.equal(g.kind, 'gammon');
  assert.equal(g.points, 2);
  // بک‌گامون: مهره‌ی مشکی در خانه‌ی داخلی سفید (اندیس 0..5)
  const bg = boardFrom({ b: { 14: 14, 24: 1 }, off: [15, 0] }); // اندیس 0 مشکی
  const r = gameResult(bg, WHITE);
  assert.equal(r.kind, 'backgammon');
  assert.equal(r.points, 3);
  // بک‌گامون با مهره‌ی روی Bar
  const bg2 = boardFrom({ b: { 10: 14 }, bar: [0, 1], off: [15, 0] });
  assert.equal(gameResult(bg2, WHITE).kind, 'backgammon');
});

test('جریان بازی: تاس آغازین، حرکت، تغییر نوبت و جلوگیری از حرکت با تاس مصرف‌شده', () => {
  const g = createGame({ mode: 'local' });
  let seq = [6, 2];
  const rng = () => (seq.shift() - 1) / 6 + 0.01;
  const r = rollOpening(g, rng);
  assert.equal(r.tie, false);
  assert.equal(g.turn, WHITE);
  assert.deepEqual(g.dice, [6, 2]);
  const m1 = getLegalMoves(g).find((m) => m.die === 6 && m.from === W(24));
  assert.ok(m1);
  playMove(g, m1);
  assert.equal(g.phase, 'moving');
  assert.deepEqual(g.remaining, [2]);
  // استفاده‌ی دوباره از تاس ۶ ممکن نیست
  assert.throws(() => playMove(g, { ...m1 }));
  const m2 = getLegalMoves(g).find((x) => x.die === 2);
  const res = playMove(g, m2);
  assert.equal(res.ended, 'turn');
  assert.equal(g.turn, BLACK);
  assert.equal(g.phase, 'rolling');
});

test('تاس آغازین مساوی تکرار می‌شود', () => {
  const g = createGame({ mode: 'local' });
  const seq = [3, 3];
  const r = rollOpening(g, () => (seq.shift() - 1) / 6 + 0.01);
  assert.equal(r.tie, true);
  assert.equal(g.phase, 'opening');
});

test('Undo فقط تا پیش از پایان نوبت', () => {
  const g = createGame({ mode: 'local' });
  g.turn = WHITE;
  g.phase = 'rolling';
  setDice(g, 6, 1);
  const before = g.board.points.join();
  const m = getLegalMoves(g)[0];
  playMove(g, m);
  assert.notEqual(g.board.points.join(), before);
  assert.ok(undoMove(g));
  assert.equal(g.board.points.join(), before);
  assert.equal(g.remaining.length, 2);
});

test('وقتی هیچ حرکتی نیست، فاز blocked و رد کردن نوبت', () => {
  const g = createGame({ mode: 'local' });
  g.board = boardFrom({ bar: [1, 0] });
  // کل خانه‌ی ورود سفید (اندیس ۱۸ تا ۲۳) با مهره‌های مشکی بسته است
  for (let i = 18; i <= 23; i++) g.board.points[i] = -2;
  g.board.points[5] = 1;
  g.turn = WHITE;
  g.phase = 'rolling';
  setDice(g, 3, 5);
  assert.equal(g.phase, 'blocked');
  assert.equal(getLegalMoves(g).length, 0);
  passTurn(g);
  assert.equal(g.turn, BLACK);
  assert.equal(g.phase, 'rolling');
});

test('پایان بازی با خارج شدن آخرین مهره و ثبت امتیاز', () => {
  const g = createGame({ mode: 'local' });
  g.board = boardFrom({ w: { 1: 1 }, b: { 12: 15 }, off: [14, 0] });
  g.turn = WHITE;
  g.phase = 'rolling';
  setDice(g, 1, 4);
  const m = getLegalMoves(g).find((x) => x.to === 'off');
  const res = playMove(g, m);
  assert.equal(res.ended, 'game');
  assert.equal(g.phase, 'over');
  assert.equal(g.result.kind, 'gammon');
  assert.equal(g.scores[WHITE], 2);
});

test('ذخیره و بازیابی بازی نیمه‌تمام', () => {
  const g = createGame({ mode: 'local' });
  g.turn = WHITE;
  g.phase = 'rolling';
  setDice(g, 5, 3);
  playMove(g, getLegalMoves(g)[0]);
  const data = JSON.parse(JSON.stringify(serializeGame(g)));
  const g2 = restoreGame(data);
  assert.equal(g2.phase, 'moving');
  assert.deepEqual(getLegalMoves(g2), getLegalMoves(g));
  assert.ok(undoMove(g2));
});

test('مقصدهای ترکیبی با دو تاس', () => {
  const g = createGame({ mode: 'local' });
  g.turn = WHITE;
  g.phase = 'rolling';
  setDice(g, 3, 2);
  const dests = destinationsFrom(g.board, WHITE, W(13), g.remaining, g.plan, 0);
  assert.ok(dests.has(W(10)));
  assert.ok(dests.has(W(11)));
  assert.equal(dests.get(W(8)).length, 2); // 13 → 8 با ترکیب 3+2
});

test('isMoveLegal و پیام‌های فارسی', () => {
  const g = createGame({ mode: 'local' });
  g.turn = WHITE;
  g.phase = 'rolling';
  setDice(g, 6, 1);
  // ۱۳ → ۷ با ۶ (اندیس ۱۲ به ۶) مجاز است
  assert.ok(isMoveLegal(g.board, WHITE, g.remaining, g.plan, 0, { from: 12, to: 6, die: 6 }));
  // ۲۴ → اندیس ۱۸ با ۵ ممکن نیست (تاس ۵ نداریم)
  assert.ok(!isMoveLegal(g.board, WHITE, g.remaining, g.plan, 0, { from: 23, to: 18, die: 5 }));
  // خانه‌ی بسته: ۲۴ → اندیس ۱۷ با ۶ بسته است؟ اندیس ۱۷ خالی است؛ پس برای خانه‌ی بسته از اندیس ۱۲ با ۱ به اندیس ۱۱ می‌رویم
  assert.match(explainIllegal(g.board, WHITE, g.remaining, g.plan, 0, 12, 11), /بسته/);
  // مهره‌ای که وجود ندارد
  assert.match(explainIllegal(g.board, WHITE, g.remaining, g.plan, 0, 15, 14), /مهره/);
  // خارج کردن پیش از موعد
  assert.match(explainIllegal(g.board, WHITE, g.remaining, g.plan, 0, 5, 'off'), /خانه‌ی داخلی/);
  // مهره روی Bar
  const g2 = createGame({ mode: 'local' });
  g2.board = boardFrom({ w: { 6: 2 }, bar: [1, 0] });
  g2.board.off[WHITE] = 12;
  g2.turn = WHITE;
  g2.phase = 'rolling';
  setDice(g2, 6, 1);
  assert.match(explainIllegal(g2.board, WHITE, g2.remaining, g2.plan, 0, 5, 4), /Bar/);
});

test('هیچ مهره‌ای هنگام بازی از بین نمی‌رود یا اضافه نمی‌شود (۱۰۰ بازی تصادفی کوتاه)', () => {
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let n = 0; n < 100; n++) {
    const g = createGame({ mode: 'local' });
    while (g.phase === 'opening') rollOpening(g, rng);
    for (let step = 0; step < 400 && g.phase !== 'over'; step++) {
      if (g.phase === 'rolling') rollDice(g, rng);
      if (g.phase === 'blocked') {
        passTurn(g);
        continue;
      }
      while (g.phase === 'moving') {
        const lm = getLegalMoves(g);
        assert.ok(lm.length > 0, 'در فاز moving باید حرکت قانونی وجود داشته باشد');
        playMove(g, lm[Math.floor(rng() * lm.length)]);
      }
      assert.equal(totalCheckers(g.board, WHITE), 15);
      assert.equal(totalCheckers(g.board, BLACK), 15);
    }
  }
});

import { rollDice } from '../src/rules/game-state.js';
