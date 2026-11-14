// ماشین حالت بازی (کاملاً مستقل از گرافیک)
//
// فازها:
//   'opening' : منتظر تاس آغازین
//   'rolling' : منتظر انداختن تاس توسط بازیکنِ نوبت‌دار
//   'moving'  : تاس آمده و حرکت‌های قانونی وجود دارد
//   'blocked' : تاس آمده ولی هیچ حرکت قانونی نیست (باید نوبت رد شود)
//   'over'    : بازی تمام شده
import { createInitialBoard, opponent, cloneBoard } from './board.js';
import { planTurn, legalMoves, applyMove, removeDie, destinationsFrom } from './movement.js';
import { hasWon, gameResult } from './scoring.js';

export function rollDie(rng = Math.random) {
  return 1 + Math.floor(rng() * 6);
}

export function createGame({ mode = 'ai', difficulty = 'medium', humanPlayer = 0 } = {}) {
  return {
    mode, // 'ai' | 'local'
    difficulty, // 'easy' | 'medium' | 'hard'
    humanPlayer,
    board: createInitialBoard(),
    turn: null,
    phase: 'opening',
    dice: null,
    remaining: [],
    played: 0,
    history: [],
    plan: null,
    result: null,
    scores: [0, 0],
    gameNo: 1,
    moveCount: 0,
  };
}

export function isAiTurn(g) {
  return g.mode === 'ai' && g.turn !== null && g.turn !== g.humanPlayer && g.phase !== 'over';
}

function beginMoves(g, values) {
  g.dice = values.slice();
  g.remaining = values[0] === values[1] ? [values[0], values[0], values[0], values[0]] : values.slice();
  g.played = 0;
  g.history = [];
  g.plan = planTurn(g.board, g.turn, values[0], values[1]);
  g.phase = g.plan.requiredLen === 0 ? 'blocked' : 'moving';
}

/** تاس آغازین: هر بازیکن یک تاس. اگر مساوی بود tie=true و باید دوباره انداخت. */
export function rollOpening(g, rng = Math.random) {
  if (g.phase !== 'opening') throw new Error('بازی در فاز تاس آغازین نیست');
  const dice = [rollDie(rng), rollDie(rng)];
  if (dice[0] === dice[1]) return { tie: true, dice };
  g.turn = dice[0] > dice[1] ? 0 : 1;
  beginMoves(g, dice); // برنده با همین دو تاس شروع می‌کند
  return { tie: false, dice, starter: g.turn };
}

export function rollDice(g, rng = Math.random) {
  if (g.phase !== 'rolling') throw new Error('الان نوبت انداختن تاس نیست');
  const values = [rollDie(rng), rollDie(rng)];
  beginMoves(g, values);
  return values;
}

/** برای تست و آموزش: تاس مشخص بده */
export function setDice(g, d1, d2) {
  if (g.turn === null) throw new Error('نوبت مشخص نیست');
  beginMoves(g, [d1, d2]);
  return g.dice;
}

export function getLegalMoves(g) {
  if (g.phase !== 'moving') return [];
  return legalMoves(g.board, g.turn, g.remaining, g.plan, g.played);
}

export function getDestinations(g, from) {
  if (g.phase !== 'moving') return new Map();
  return destinationsFrom(g.board, g.turn, from, g.remaining, g.plan, g.played);
}

/** انجام یک حرکت تکی {from,to,die}. در صورت غیرمجاز بودن خطا می‌دهد. */
export function playMove(g, move) {
  if (g.phase !== 'moving') throw new Error('الان حرکتی مجاز نیست');
  const legal = getLegalMoves(g).find(
    (m) => m.from === move.from && m.to === move.to && m.die === move.die,
  );
  if (!legal) throw new Error('حرکت غیرقانونی');
  const p = g.turn;
  g.history.push({
    board: cloneBoard(g.board),
    remaining: g.remaining.slice(),
    played: g.played,
    move: { ...legal },
  });
  g.board = applyMove(g.board, p, legal);
  g.remaining = removeDie(g.remaining, legal.die);
  g.played += 1;
  g.moveCount += 1;

  if (hasWon(g.board, p)) {
    g.phase = 'over';
    g.result = gameResult(g.board, p);
    g.scores[p] += g.result.points;
    return { ended: 'game', result: g.result };
  }
  if (g.played >= g.plan.requiredLen || g.remaining.length === 0) {
    endTurn(g);
    return { ended: 'turn' };
  }
  return { ended: null };
}

function endTurn(g) {
  g.turn = opponent(g.turn);
  g.phase = 'rolling';
  g.dice = null;
  g.remaining = [];
  g.played = 0;
  g.history = [];
  g.plan = null;
}

/** وقتی هیچ حرکتی ممکن نیست */
export function passTurn(g) {
  if (g.phase !== 'blocked') throw new Error('نوبت را نمی‌توان رد کرد');
  endTurn(g);
}

export function canUndo(g) {
  return g.phase === 'moving' && g.history.length > 0;
}

/** بازگرداندن آخرین حرکت همین نوبت (فقط پیش از پایان نوبت) */
export function undoMove(g) {
  if (!canUndo(g)) return false;
  const h = g.history.pop();
  g.board = h.board;
  g.remaining = h.remaining;
  g.played = h.played;
  g.moveCount -= 1;
  return true;
}

/** شروع بازی بعدی با حفظ امتیازها */
export function nextGame(g) {
  g.board = createInitialBoard();
  g.turn = null;
  g.phase = 'opening';
  g.dice = null;
  g.remaining = [];
  g.played = 0;
  g.history = [];
  g.plan = null;
  g.result = null;
  g.gameNo += 1;
  g.moveCount = 0;
}

// ---- ذخیره و بازیابی ----

export function serializeGame(g) {
  const { plan, ...rest } = g; // plan شامل Map است و دوباره ساخته می‌شود
  return JSON.parse(JSON.stringify(rest));
}

export function restoreGame(data) {
  const g = { ...data, plan: null };
  if (g.phase === 'moving' || g.phase === 'blocked') {
    const startBoard = g.history.length > 0 ? g.history[0].board : g.board;
    g.plan = planTurn(startBoard, g.turn, g.dice[0], g.dice[1]);
  }
  return g;
}
