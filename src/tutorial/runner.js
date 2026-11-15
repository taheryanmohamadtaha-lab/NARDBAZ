// اجرای مرحله‌های آموزش و تمرین روی تخته‌ی واقعی (با همان موتور قوانین بازی).
//
// انواع مرحله (step.kind):
//   info   : توضیح + نورانداز روی تخته
//   demo   : نمایش خودکار حرکت‌ها (moves) روی تخته
//   task   : کاربر خودش حرکت می‌کند (dice, expect | check | until)
//   pick   : کاربر یک خانه را لمس می‌کند (correct, wrong)
//   choice : پرسش چندگزینه‌ای (options, correct)
import { BoardView, faNum } from '../game/board-view.js';
import { MoveInput } from '../game/input.js';
import { createGame, setDice, playMove, undoMove, canUndo } from '../rules/game-state.js';
import { applyMove } from '../rules/movement.js';
import { cloneBoard } from '../rules/board.js';
import { h, clear, delay } from '../ui/dom.js';
import { dieEl } from '../ui/dice.js';
import { sfx } from '../audio/sound.js';
import { judge } from './evaluate.js';

export class ScenarioRunner {
  /**
   * @param opts {container, app, title, steps, practice:boolean, onComplete(info), onExit()}
   */
  constructor(opts) {
    this.opts = opts;
    this.app = opts.app;
    this.steps = opts.steps;
    this.i = 0;
    this.curBoard = null;
    this.busy = false;
    this.done = false;
    this.failedOnce = false;
    this.destroyed = false;
    this.runId = 0;
    this.build();
    this.enter(0);
  }

  build() {
    const c = this.opts.container;
    clear(c);
    c.className = 'screen lesson-screen';
    this.stepLabel = h('div', { class: 'status' });
    const top = h(
      'div',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'بازگشت', onClick: () => this.opts.onExit?.() }, '→'),
      h('div', { class: 'title-center' }, this.opts.title, this.stepLabel),
      h('span', { class: 'icon-btn ghost' }),
    );
    this.progressBar = h('div', { class: 'progress' }, (this.progressFill = h('i')));
    this.boardWrap = h('div', { class: 'board-wrap' });
    this.toastEl = h('div', { class: 'toast hidden' });
    this.boardWrap.appendChild(this.toastEl);
    this.view = new BoardView(this.boardWrap, { theme: this.app.settings().boardTheme });
    this.coach = h('div', { class: 'coach' });
    this.diceBar = h('div', { class: 'dice-bar' });
    this.nextBtn = h('button', { class: 'btn primary', onClick: () => this.next() }, 'ادامه');
    this.repeatBtn = h('button', { class: 'btn', onClick: () => this.enter(this.i) }, '⟲ تکرار');
    this.undoBtn = h('button', { class: 'btn', onClick: () => this.undo() }, '↩ بازگشت حرکت');
    this.hintBtn = h('button', { class: 'btn', onClick: () => this.hint() }, '💡 راهنما');
    this.buttons = h('div', { class: 'actions' });
    c.append(top, this.progressBar, this.boardWrap, h('div', { class: 'side' }, this.diceBar, this.coach, this.buttons));
    this.input = new MoveInput(this.view, {
      ctx: () => ({ g: this.g, enabled: this.canMove(), hints: true }),
      refresh: () => this.draw(),
      playChain: (chain) => this.playChain(chain),
      message: (t, k) => this.toast(t, k),
      sfx,
    });
  }

  destroy() {
    this.destroyed = true;
    this.runId++;
    this.view.destroy();
  }

  get step() {
    return this.steps[this.i];
  }

  toast(text, kind = 'info') {
    this.toastEl.textContent = text;
    this.toastEl.className = `toast ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), 3000);
  }

  canMove() {
    return !this.destroyed && !this.busy && !this.done && this.step.kind === 'task' && !!this.g && this.g.phase === 'moving';
  }

  // ---------- ورود به مرحله ----------
  async enter(i) {
    const run = ++this.runId;
    this.i = i;
    const s = this.step;
    this.busy = false;
    this.done = false;
    this.input.reset();
    this.g = null;
    this.answerShown = false;
    this.toastEl.classList.add('hidden');
    if (s.board) this.curBoard = cloneBoard(s.board);
    if (!this.curBoard) this.curBoard = cloneBoard(this.steps.find((x) => x.board).board);
    this.startBoard = cloneBoard(this.curBoard);
    this.view.setNumbers(s.numbers ?? this.opts.numbers ?? true);
    this.stepLabel.textContent = `مرحله ${faNum(i + 1)} از ${faNum(this.steps.length)}`;
    this.progressFill.style.width = `${(i / this.steps.length) * 100}%`;

    // پیام آموزشی (قابل خاموش شدن از تنظیمات؛ پرسش‌ها و تمرین‌ها همیشه نمایش داده می‌شوند)
    this.renderCoach();

    if (s.kind === 'task') {
      const g = createGame({ mode: 'local' });
      g.board = cloneBoard(this.curBoard);
      g.turn = s.player ?? 0;
      g.phase = 'rolling';
      setDice(g, s.dice[0], s.dice[1]);
      this.g = g;
      this.attempt = [];
    } else {
      this.g = null;
    }
    if (s.kind === 'pick') {
      this.view.handlers = {
        onDown: () => {},
        onMove: () => {},
        onUp: (e) => this.onPick(e),
      };
    } else {
      this.input.view.handlers = {
        onDown: (e) => this.input.down(e),
        onMove: (e) => this.input.move(e),
        onUp: (e) => this.input.up(e),
      };
    }
    this.draw();
    this.renderButtons();

    if (s.kind === 'demo') {
      this.nextBtn.disabled = true;
      await this.runDemo(run);
    }
  }

  renderCoach() {
    const s = this.step;
    clear(this.coach);
    const show = this.app.settings().tutorialMessages || this.opts.practice || ['task', 'pick', 'choice'].includes(s.kind);
    this.coachMain = h('div', { class: 'coach-text' });
    if (s.title) this.coach.appendChild(h('h3', {}, s.title));
    if (show) this.coachMain.textContent = s.text || '';
    this.coach.appendChild(this.coachMain);
    this.feedback = h('div', { class: 'feedback' });
    this.coach.appendChild(this.feedback);
    if (s.kind === 'choice') {
      const box = h('div', { class: 'choices' });
      s.options.forEach((o, k) => {
        box.appendChild(h('button', { class: 'btn choice', onClick: (ev) => this.onChoice(k, ev.currentTarget) }, o));
      });
      this.coach.appendChild(box);
      this.choiceBox = box;
    }
  }

  renderButtons() {
    const s = this.step;
    clear(this.buttons);
    const last = this.i === this.steps.length - 1;
    this.nextBtn.textContent = last ? (this.opts.practice ? 'پایان' : 'پایان درس ✓') : 'ادامه';
    const needAction = ['task', 'pick', 'choice'].includes(s.kind);
    this.nextBtn.disabled = needAction || s.kind === 'demo';
    if (s.kind === 'task') this.buttons.append(this.hintBtn, this.undoBtn);
    this.buttons.append(this.repeatBtn);
    if (this.opts.practice && needAction) {
      this.buttons.append(h('button', { class: 'btn', onClick: () => this.showAnswer() }, '👁 نمایش پاسخ'));
    }
    this.buttons.append(this.nextBtn);
    this.undoBtn.disabled = true;
    if (this.opts.practice && this.i > 0) this.nextBtn.classList.add('primary');
  }

  draw(extra = {}) {
    const s = this.step;
    const board = this.g ? this.g.board : this.curBoard;
    const vis = this.g ? this.input.visual() : {};
    const spot = s.spot ? { ...s.spot } : undefined;
    this.view.render(board, { ...vis, spot: this.done ? undefined : spot, ...extra });
    this.drawDice();
    if (this.g) this.undoBtn.disabled = !(this.canMove() && canUndo(this.g));
  }

  drawDice() {
    const s = this.step;
    clear(this.diceBar);
    const dice = s.dice;
    if (!dice) return;
    const doubles = dice[0] === dice[1];
    const rem = this.g ? this.g.remaining.slice() : dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice.slice();
    const vals = doubles ? [dice[0], dice[0], dice[0], dice[0]] : dice;
    for (const v of vals) {
      const k = rem.indexOf(v);
      const used = this.g ? k < 0 : false;
      if (k >= 0) rem.splice(k, 1);
      this.diceBar.appendChild(dieEl(v, { used, small: doubles }));
    }
  }

  // ---------- نمایش خودکار ----------
  async runDemo(run) {
    const s = this.step;
    const p = s.player ?? 0;
    await delay(500);
    for (const m of s.moves) {
      if (run !== this.runId || this.destroyed) return;
      const before = this.curBoard;
      const after = applyMove(before, p, m);
      if (m.hit) sfx.hit();
      else if (m.to === 'off') sfx.bearOff();
      else sfx.move();
      await this.view.animateMove(before, after, p, m, 520, { player: p });
      this.curBoard = after;
      await delay(260);
    }
    if (run !== this.runId) return;
    if (s.after) this.feedback.textContent = s.after;
    this.nextBtn.disabled = false;
    this.draw();
  }

  // ---------- تمرین حرکت ----------
  async playChain(chain) {
    if (this.busy) return;
    this.busy = true;
    const run = this.runId;
    const g = this.g;
    const p = g.turn;
    const first = chain[0];
    const last = chain[chain.length - 1];
    let ended = null;
    for (const m of chain) {
      const before = g.board;
      const res = playMove(g, m);
      this.attempt.push(m);
      if (m.hit) sfx.hit();
      else if (m.to === 'off') sfx.bearOff();
      else sfx.move();
      this.drawDice();
      await this.view.animateMove(before, g.board, p, m, 360, { player: p });
      if (this.destroyed || run !== this.runId) return;
      if (res.ended) ended = res.ended;
    }
    this.busy = false;
    const info = {
      chain,
      from: first.from,
      to: last.to,
      hit: chain.some((m) => m.hit),
      board: g.board,
      attempt: this.attempt.slice(),
      ended,
      player: p,
    };
    this.evaluate(info);
  }

  evaluate(info) {
    const r = judge(this.step, info);
    if (r.status === 'ok') return this.success();
    if (r.status === 'fail') return this.failure(r.msg);
    this.draw();
  }

  success(msg) {
    const s = this.step;
    this.done = true;
    sfx.good();
    this.setFeedback(`✓ ${msg || s.ok || 'آفرین! درست بود.'}`, 'ok');
    if (this.opts.practice && s.explain) this.appendExplain(s.explain);
    this.input.reset();
    this.draw();
    this.nextBtn.disabled = false;
    this.nextBtn.classList.add('primary');
  }

  async failure(msg) {
    sfx.error();
    this.failedOnce = true;
    this.setFeedback(`✗ ${msg}`, 'bad');
    if (this.opts.practice && this.step.explain) this.appendExplain(this.step.explain);
    this.busy = true;
    const run = this.runId;
    await delay(1300);
    if (this.destroyed || run !== this.runId) return;
    // بازگرداندن مرحله به حالت اول، با حفظ پیام توضیحی
    const fb = this.feedback.cloneNode(true);
    await this.enter(this.i);
    if (this.feedback) {
      this.feedback.className = fb.className;
      this.feedback.innerHTML = fb.innerHTML;
    }
  }

  setFeedback(text, kind) {
    this.feedback.className = `feedback ${kind}`;
    this.feedback.textContent = text;
  }

  appendExplain(text) {
    this.feedback.appendChild(h('div', { class: 'explain' }, '📘 ', text));
  }

  undo() {
    if (!this.canMove() || !canUndo(this.g)) return;
    undoMove(this.g);
    this.attempt.pop();
    this.input.reset();
    sfx.click();
    this.draw();
  }

  hint() {
    if (!this.canMove()) return;
    this.input.showHint();
  }

  showAnswer() {
    const s = this.step;
    this.answerShown = true;
    this.input.reset();
    if (s.answer && this.g) {
      this.input.hint = { ...s.answer };
      this.draw();
    }
    this.feedback.className = 'feedback info';
    this.feedback.textContent = s.answerText || 'پیکان طلایی حرکت پیشنهادی را نشان می‌دهد.';
    if (s.explain) this.appendExplain(s.explain);
    if (s.kind === 'pick') {
      const pts = typeof s.correct === 'function' ? Array.from({ length: 24 }, (_, k) => k).filter(s.correct) : s.correct;
      this.draw({ spot: { points: pts } });
    }
    if (s.kind === 'choice') {
      this.choiceBox?.querySelectorAll('button')[s.correct]?.classList.add('right');
    }
    this.nextBtn.disabled = false;
  }

  // ---------- pick و choice ----------
  onPick(e) {
    const s = this.step;
    if (this.done || e.loc === undefined || typeof e.loc !== 'number') return;
    const ok = typeof s.correct === 'function' ? s.correct(e.loc) : s.correct.includes(e.loc);
    if (ok) {
      this.done = true;
      sfx.good();
      this.setFeedback(`✓ ${s.ok || 'درست است!'}`, 'ok');
      if (this.opts.practice && s.explain) this.appendExplain(s.explain);
      this.draw({ spot: { points: [e.loc] } });
      this.nextBtn.disabled = false;
    } else {
      sfx.error();
      this.failedOnce = true;
      const w = typeof s.wrong === 'function' ? s.wrong(e.loc) : s.wrong?.[e.loc] || s.wrongDefault;
      this.setFeedback(`✗ ${w || 'درست نیست؛ دوباره نگاه کن.'}`, 'bad');
    }
  }

  onChoice(k, btn) {
    const s = this.step;
    if (this.done) return;
    if (k === s.correct) {
      this.done = true;
      sfx.good();
      btn.classList.add('right');
      this.setFeedback(`✓ ${s.explain || 'درست است!'}`, 'ok');
      this.nextBtn.disabled = false;
    } else {
      sfx.error();
      this.failedOnce = true;
      btn.classList.add('wrong');
      btn.disabled = true;
      this.setFeedback(`✗ ${s.why?.[k] || 'درست نیست؛ گزینه‌ی دیگری را امتحان کن.'}`, 'bad');
    }
  }

  next() {
    sfx.click();
    if (this.i >= this.steps.length - 1) {
      this.opts.onComplete?.({ failedOnce: this.failedOnce });
      return;
    }
    this.enter(this.i + 1);
  }
}
