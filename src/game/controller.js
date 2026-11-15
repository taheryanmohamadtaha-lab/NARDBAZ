// کنترل‌کننده‌ی صفحه‌ی بازی: جریان نوبت‌ها، تاس، هوش مصنوعی، ذخیره‌ی خودکار و آمار.
import { BoardView, faNum } from './board-view.js';
import { MoveInput } from './input.js';
import {
  createGame,
  rollOpening,
  rollDice,
  playMove,
  passTurn,
  undoMove,
  canUndo,
  nextGame,
  isAiTurn,
  serializeGame,
  restoreGame,
  getLegalMoves,
} from '../rules/game-state.js';
import { pipCount } from '../rules/board.js';
import { RESULT_TEXT_FA } from '../rules/scoring.js';
import { aiChoose } from '../ai/client.js';
import { h, clear, modal, confirmDialog, delay } from '../ui/dom.js';
import { dieEl } from '../ui/dice.js';
import { sfx } from '../audio/sound.js';
import * as store from '../storage/store.js';

const SPEED = { slow: 1.6, normal: 1, fast: 0.55 };
const LEVEL_FA = { easy: 'آسان', medium: 'متوسط', hard: 'سخت' };

export class GameController {
  constructor({ container, app, mode, difficulty, resume }) {
    this.app = app;
    this.container = container;
    this.destroyed = false;
    this.busy = false;
    this.token = 0;
    this.settings = app.settings();

    if (resume) {
      this.g = restoreGame(resume);
      // اگر وسط نوبت هوش مصنوعی ذخیره شده، نوبت را از اول شروع می‌کنیم
      if (isAiTurn(this.g)) while (canUndo(this.g)) undoMove(this.g);
    } else {
      this.g = createGame({ mode, difficulty });
    }
    this.build();
    this.input = new MoveInput(this.view, {
      ctx: () => ({ g: this.g, enabled: this.canHumanMove(), hints: this.app.settings().hints }),
      refresh: () => this.draw(),
      playChain: (chain) => this.playChain(chain),
      message: (t, k) => this.toast(t, k),
      sfx,
    });
    this.draw();
    this.step();
  }

  // ---------- ساخت رابط ----------
  build() {
    const c = this.container;
    clear(c);
    c.className = 'screen game-screen';
    this.statusEl = h('div', { class: 'status' }, '');
    this.soundBtn = h('button', { class: 'icon-btn', 'aria-label': 'صدا', onClick: () => this.toggleSound() });
    this.updateSoundBtn();
    const top = h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'توقف', onClick: () => this.pause() }, '☰'),
      this.statusEl,
      this.soundBtn,
    );
    this.oppCard = h('div', { class: 'pcard' });
    this.meCard = h('div', { class: 'pcard' });
    const cards = h('div', { class: 'pcards' }, this.oppCard, this.meCard);
    this.boardWrap = h('div', { class: 'board-wrap' });
    this.toastEl = h('div', { class: 'toast hidden' });
    this.boardWrap.appendChild(this.toastEl);
    this.view = new BoardView(this.boardWrap, { theme: this.app.settings().boardTheme });
    this.diceBar = h('div', { class: 'dice-bar' });
    this.rollBtn = h('button', { class: 'btn primary big roll-btn hidden', onClick: () => this.humanRoll() }, 'انداختن تاس');
    this.hintBtn = h('button', { class: 'btn', onClick: () => this.hint() }, '💡 راهنما');
    this.undoBtn = h('button', { class: 'btn', onClick: () => this.undo() }, '↩ بازگشت حرکت');
    this.leftEl = h('div', { class: 'left-moves' }, '');
    const actions = h('div', { class: 'actions' }, this.hintBtn, this.undoBtn);
    c.append(top, this.boardWrap, h('div', { class: 'side' }, cards, h('div', { class: 'dice-area' }, this.diceBar, this.rollBtn), this.leftEl, actions));
  }

  destroy() {
    this.destroyed = true;
    this.token++;
    this.view?.destroy();
  }

  names() {
    const g = this.g;
    if (g.mode === 'ai') {
      return ['شما (سفید)', `هوش مصنوعی ${LEVEL_FA[g.difficulty]} (مشکی)`];
    }
    return ['بازیکن ۱ (سفید)', 'بازیکن ۲ (مشکی)'];
  }

  speed() {
    return SPEED[this.app.settings().animSpeed] ?? 1;
  }

  // ---------- وضعیت ----------
  canHumanMove() {
    const g = this.g;
    return !this.destroyed && !this.busy && g.phase === 'moving' && !isAiTurn(g);
  }

  draw(extra = {}) {
    const g = this.g;
    const vis = this.input ? this.input.visual() : {};
    this.view.render(g.board, { ...vis, ...extra });
    this.drawCards();
    this.drawDice();
    this.drawStatus();
    const human = this.canHumanMove();
    this.undoBtn.disabled = !(human && canUndo(g));
    this.hintBtn.disabled = !human;
  }

  drawCards() {
    const g = this.g;
    const names = this.names();
    const card = (p, el) => {
      clear(el);
      el.className = `pcard ${p === 0 ? 'white' : 'black'}${g.turn === p ? ' active' : ''}`;
      el.append(
        h('span', { class: `dot ${p === 0 ? 'w' : 'b'}` }),
        h('div', { class: 'pinfo' },
          h('b', {}, names[p]),
          h('small', {}, `امتیاز ${faNum(g.scores[p])} • پیپ ${faNum(pipCount(g.board, p))} • خارج‌شده ${faNum(g.board.off[p])}`),
        ),
      );
    };
    card(1, this.oppCard);
    card(0, this.meCard);
  }

  drawDice(rolling = false) {
    const g = this.g;
    clear(this.diceBar);
    if (!g.dice) {
      this.leftEl.textContent = '';
      return;
    }
    const doubles = g.dice[0] === g.dice[1];
    const rem = g.remaining.slice();
    const vals = doubles ? [g.dice[0], g.dice[0], g.dice[0], g.dice[0]] : g.dice;
    for (const v of vals) {
      const i = rem.indexOf(v);
      const used = i < 0;
      if (!used) rem.splice(i, 1);
      this.diceBar.appendChild(dieEl(v, { used, small: doubles, rolling }));
    }
    if (g.phase === 'moving') this.leftEl.textContent = `حرکت‌های باقی‌مانده: ${faNum(Math.max(0, g.plan.requiredLen - g.played))}`;
    else this.leftEl.textContent = '';
  }

  drawStatus() {
    const g = this.g;
    const names = this.names();
    let t = '';
    if (g.phase === 'opening') t = 'تاس آغازین: هر بازیکن یک تاس می‌اندازد';
    else if (g.phase === 'over') t = 'بازی تمام شد';
    else if (g.phase === 'blocked') t = `${names[g.turn]}: حرکتی ندارد`;
    else if (g.phase === 'rolling') t = `نوبت ${names[g.turn]}: تاس بیندازید`;
    else t = isAiTurn(g) ? 'هوش مصنوعی در حال فکر کردن…' : `نوبت ${names[g.turn]}`;
    this.statusEl.textContent = t;
  }

  toast(text, kind = 'info') {
    if (!text) return;
    this.toastEl.textContent = text;
    this.toastEl.className = `toast ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), 3200);
  }

  updateSoundBtn() {
    this.soundBtn.textContent = this.app.settings().sound ? '🔊' : '🔇';
  }
  toggleSound() {
    const s = this.app.settings();
    this.app.updateSettings({ sound: !s.sound });
    this.updateSoundBtn();
    sfx.click();
  }

  save() {
    if (this.g.phase === 'over') store.clearSavedGame();
    else store.setSavedGame(serializeGame(this.g));
  }

  // ---------- جریان بازی ----------
  async step() {
    if (this.destroyed) return;
    const tk = ++this.token;
    const g = this.g;
    this.draw();
    this.save();
    this.rollBtn.classList.add('hidden');

    if (g.phase === 'opening') {
      this.showRoll('تاس آغازین');
      return;
    }
    if (g.phase === 'rolling') {
      if (isAiTurn(g)) {
        await delay(650 * this.speed());
        if (tk !== this.token) return;
        await this.doRoll();
      } else this.showRoll('انداختن تاس');
      return;
    }
    if (g.phase === 'blocked') {
      this.toast('هیچ حرکت قانونی وجود ندارد؛ نوبت رد می‌شود.', 'warn');
      await delay(1500 * this.speed());
      if (tk !== this.token) return;
      passTurn(g);
      return this.step();
    }
    if (g.phase === 'moving' && isAiTurn(g)) return this.aiPlay(tk);
    if (g.phase === 'over') return this.finish();
  }

  showRoll(label) {
    this.rollBtn.textContent = label;
    this.rollBtn.classList.remove('hidden');
  }

  async humanRoll() {
    if (this.busy) return;
    this.rollBtn.classList.add('hidden');
    await this.doRoll();
  }

  async rollAnimation() {
    sfx.dice();
    const g = this.g;
    const dur = 650 * this.speed();
    const end = Date.now() + dur;
    while (Date.now() < end && !this.destroyed) {
      clear(this.diceBar);
      this.diceBar.append(dieEl(1 + Math.floor(Math.random() * 6), { rolling: true }), dieEl(1 + Math.floor(Math.random() * 6), { rolling: true }));
      await delay(90);
    }
    return g;
  }

  async doRoll() {
    const g = this.g;
    this.busy = true;
    this.draw();
    await this.rollAnimation();
    if (this.destroyed) return;
    if (g.phase === 'opening') {
      const r = rollOpening(g);
      this.busy = false;
      clear(this.diceBar);
      this.diceBar.append(dieEl(r.dice[0]), dieEl(r.dice[1]));
      const names = this.names();
      if (r.tie) {
        this.toast(`هر دو ${faNum(r.dice[0])} آوردند؛ دوباره تاس می‌اندازیم.`, 'info');
        await delay(1300 * this.speed());
        return this.step();
      }
      this.toast(`سفید: ${faNum(r.dice[0])} • مشکی: ${faNum(r.dice[1])} — ${names[r.starter]} شروع می‌کند.`, 'info');
      await delay(1100 * this.speed());
      return this.step();
    }
    rollDice(g);
    this.busy = false;
    return this.step();
  }

  async playSingle(m) {
    const g = this.g;
    const p = g.turn;
    const before = g.board;
    const res = playMove(g, m);
    const after = g.board;
    if (m.hit) sfx.hit();
    else if (m.to === 'off') sfx.bearOff();
    else sfx.move();
    this.drawDice();
    await this.view.animateMove(before, after, p, m, 330 * this.speed(), { player: g.turn ?? p });
    return res;
  }

  async playChain(chain) {
    if (this.busy) return;
    this.busy = true;
    this.input.reset();
    let last = null;
    for (const m of chain) {
      last = await this.playSingle(m);
      if (this.destroyed) return;
      if (last.ended) break;
    }
    this.busy = false;
    this.step();
  }

  async aiPlay(tk) {
    const g = this.g;
    this.busy = true;
    this.draw();
    const t0 = Date.now();
    let res;
    try {
      res = await aiChoose(g.board, g.turn, g.dice[0], g.dice[1], g.difficulty);
    } catch (_) {
      res = { moves: [] };
    }
    const minThink = 500 * this.speed();
    if (Date.now() - t0 < minThink) await delay(minThink - (Date.now() - t0));
    if (tk !== this.token || this.destroyed) return;
    for (const m of res.moves) {
      const r = await this.playSingle(m);
      if (this.destroyed) return;
      if (r.ended) break;
      await delay(180 * this.speed());
    }
    this.busy = false;
    // اگر به هر دلیل هنوز حرکتی مانده بود (نباید پیش بیاید)، بازی گیر نکند
    if (this.g.phase === 'moving' && isAiTurn(this.g) && getLegalMoves(this.g).length === 0) {
      this.g.phase = 'blocked';
    }
    this.step();
  }

  // ---------- دکمه‌ها ----------
  hint() {
    if (!this.canHumanMove()) return;
    this.input.showHint();
  }

  undo() {
    if (!this.canHumanMove() || !canUndo(this.g)) return;
    undoMove(this.g);
    this.input.reset();
    sfx.click();
    this.draw();
    this.save();
  }

  pause() {
    sfx.click();
    modal({
      title: 'توقف بازی',
      body: 'بازی به‌صورت خودکار ذخیره شده است.',
      buttons: [
        { label: 'ادامه‌ی بازی', kind: 'primary' },
        {
          label: 'شروع دوباره',
          onClick: async () => {
            if (await confirmDialog('بازی فعلی رها شود و بازی تازه شروع شود؟', 'شروع دوباره')) this.app.startGame(this.g.mode, this.g.difficulty);
          },
        },
        { label: 'خروج به منو', onClick: () => this.app.showMenu() },
      ],
    });
  }

  // ---------- پایان بازی ----------
  finish() {
    const g = this.g;
    if (this._finished === g.gameNo) return;
    this._finished = g.gameNo;
    store.clearSavedGame();
    const r = g.result;
    const names = this.names();
    const stats = store.getStats();
    let youWon = null;
    if (g.mode === 'ai') {
      youWon = r.winner === g.humanPlayer;
      const lv = stats.ai[g.difficulty];
      if (youWon) {
        lv.w++;
        stats.points += r.points;
        stats.streak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        if (r.kind === 'gammon') stats.gammons++;
        if (r.kind === 'backgammon') stats.backgammons++;
        if (stats.fastestWinMoves === null || g.moveCount < stats.fastestWinMoves) stats.fastestWinMoves = g.moveCount;
      } else {
        lv.l++;
        stats.streak = 0;
      }
    } else {
      stats.local.games++;
    }
    store.setStats(stats);
    if (youWon === false) sfx.lose();
    else sfx.win();

    const title = g.mode === 'ai' ? (youWon ? '🎉 شما بردید!' : 'هوش مصنوعی برد') : `${names[r.winner]} برنده شد!`;
    const body = h('div', { class: 'result' },
      h('p', {}, `${RESULT_TEXT_FA[r.kind]} — ${faNum(r.points)} امتیاز`),
      h('p', { class: 'muted' }, `مجموع امتیازها: ${names[0]} ${faNum(g.scores[0])} ، ${names[1]} ${faNum(g.scores[1])}`),
    );
    modal({
      title,
      body,
      dismissible: false,
      buttons: [
        {
          label: 'بازی بعدی',
          kind: 'primary',
          onClick: () => {
            nextGame(g);
            this.input.reset();
            this.step();
          },
        },
        { label: 'منوی اصلی', onClick: () => this.app.showMenu() },
      ],
    });
  }
}
