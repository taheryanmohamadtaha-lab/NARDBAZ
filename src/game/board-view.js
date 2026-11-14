// نمایش گرافیکی تخته‌نرد (برداری، دوبعدی، SVG)
// این فایل هیچ قانونی از بازی نمی‌داند؛ فقط صفحه (board) و راهنماهای بصری را می‌کشد.
//
// مکان‌ها (loc): عدد 0..23 برای خانه‌ها، 'bar' برای Bar و 'off' برای محل خروج.
// نمایش: مختصات «افقی» ثابت است؛ در حالت عمودی گوشی کل تخته ۹۰ درجه چرخانده می‌شود تا بزرگ‌تر دیده شود.

const NS = 'http://www.w3.org/2000/svg';

export const GEO = {
  W: 980,
  H: 720,
  PW: 62, // پهنای هر خانه
  R: 27, // شعاع مهره
  pH: 300, // ارتفاع مثلث
  xLeft: 38,
  barX: 410,
  barW: 56,
  xRight: 466,
  yTop: 38,
  yBottom: 682,
  trayX: 878,
  trayW: 92,
};
const G = GEO;
const MID_Y = G.H / 2;

function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const faNum = (n) => String(n).replace(/\d/g, (d) => FA_DIGITS[d]);

// ---------- هندسه ----------
function colOf(idx) {
  return idx < 12 ? 11 - idx : idx - 12;
}
const isTop = (idx) => idx >= 12;
function colX(col) {
  return col < 6 ? G.xLeft + col * G.PW : G.xRight + (col - 6) * G.PW;
}
export const pointCenterX = (idx) => colX(colOf(idx)) + G.PW / 2;

function stackStep(count, room) {
  if (count <= 1) return 2 * G.R;
  return Math.min(2 * G.R, (room - 2 * G.R) / (count - 1));
}

/** مرکز k‌امین مهره (از صفر، از پایه‌ی مثلث) روی خانه‌ی idx با تعداد count */
export function pointCheckerPos(idx, k, count) {
  const sp = stackStep(count, G.pH);
  const x = pointCenterX(idx);
  const y = isTop(idx) ? G.yTop + G.R + k * sp : G.yBottom - G.R - k * sp;
  return { x, y };
}
/** Bar: سفید پایین، مشکی بالا */
export function barCheckerPos(player, k, count) {
  const sp = stackStep(count, 290);
  const x = G.barX + G.barW / 2;
  const y = player === 0 ? MID_Y + 22 + G.R + k * sp : MID_Y - 22 - G.R - k * sp;
  return { x, y };
}
/** سینی خروج: سفید پایین، مشکی بالا؛ مهره‌ها به‌صورت قرص‌های خوابیده روی هم */
export function offCheckerPos(player, k) {
  const x = G.trayX + G.trayW / 2;
  const h = 15;
  const y = player === 0 ? G.yBottom - 10 - h / 2 - k * h : G.yTop + 10 + h / 2 + k * h;
  return { x, y, h };
}

function locPos(board, player, loc, k, countAfter) {
  if (loc === 'bar') return barCheckerPos(player, k, countAfter);
  if (loc === 'off') return offCheckerPos(player, k);
  return pointCheckerPos(loc, k, countAfter);
}

const ownCount = (board, p, i) => {
  const v = board.points[i];
  return p === 0 ? Math.max(0, v) : Math.max(0, -v);
};

export class BoardView {
  constructor(container, { onDown, onMove, onUp } = {}) {
    this.container = container;
    this.handlers = { onDown, onMove, onUp };
    this.portrait = false;
    this.showNumbers = false;
    this.lastArgs = null;
    this.svg = el('svg', { class: 'board-svg', preserveAspectRatio: 'xMidYMid meet' });
    container.appendChild(this.svg);
    this.defs();
    this.root = el('g', {}, this.svg);
    this.staticLayer = el('g', {}, this.root);
    this.dynLayer = el('g', {}, this.root);
    this.fxLayer = el('g', { 'pointer-events': 'none' }, this.root);
    this.hitLayer = el('g', {}, this.root);
    this.buildStatic();
    this.buildHits();
    this.bindPointer();
    this.applyOrientation();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        const was = this.portrait;
        this.applyOrientation();
        if (was !== this.portrait && this.lastArgs) this.render(...this.lastArgs);
      });
      this.ro.observe(container);
    }
  }

  destroy() {
    this.ro?.disconnect();
    this.svg.remove();
  }

  applyOrientation() {
    const r = this.container.getBoundingClientRect();
    const portrait = r.height > r.width * 1.08;
    this.portrait = portrait;
    if (portrait) {
      this.svg.setAttribute('viewBox', `0 0 ${G.H} ${G.W}`);
      this.root.setAttribute('transform', `translate(${G.H},0) rotate(90)`);
    } else {
      this.svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
      this.root.removeAttribute('transform');
    }
  }

  defs() {
    const d = el('defs', {}, this.svg);
    const grad = (id, stops, extra = {}) => {
      const g = el('radialGradient', { id, cx: '38%', cy: '32%', r: '75%', ...extra }, d);
      stops.forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
    };
    grad('gWhite', [
      ['0%', '#fffaf0'],
      ['65%', '#e9dcc0'],
      ['100%', '#c4b48e'],
    ]);
    grad('gBlack', [
      ['0%', '#5a5a60'],
      ['60%', '#2a2a2e'],
      ['100%', '#111114'],
    ]);
    const wood = el('linearGradient', { id: 'gWood', x1: '0', y1: '0', x2: '1', y2: '1' }, d);
    [
      ['0%', '#8a5a34'],
      ['50%', '#7a4c2b'],
      ['100%', '#693f23'],
    ].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, wood));
    const felt = el('linearGradient', { id: 'gField', x1: '0', y1: '0', x2: '0', y2: '1' }, d);
    [
      ['0%', '#c99a62'],
      ['100%', '#b8864f'],
    ].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, felt));
    const glow = el('radialGradient', { id: 'gGlow' }, d);
    el('stop', { offset: '0%', 'stop-color': '#7dffb0', 'stop-opacity': '0.9' }, glow);
    el('stop', { offset: '100%', 'stop-color': '#7dffb0', 'stop-opacity': '0' }, glow);
    const gold = el('radialGradient', { id: 'gGold' }, d);
    el('stop', { offset: '0%', 'stop-color': '#ffd966', 'stop-opacity': '0.95' }, gold);
    el('stop', { offset: '100%', 'stop-color': '#ffd966', 'stop-opacity': '0' }, gold);
  }

  buildStatic() {
    const s = this.staticLayer;
    // قاب بیرونی
    el('rect', { x: 0, y: 0, width: G.W, height: G.H, rx: 26, fill: '#2a1a10' }, s);
    el('rect', { x: 10, y: 10, width: 856, height: 700, rx: 18, fill: 'url(#gWood)', stroke: '#3b2415', 'stroke-width': 3 }, s);
    // دو نیمه‌ی زمین بازی
    const halves = [G.xLeft, G.xRight];
    for (const x of halves) {
      el('rect', { x: x - 4, y: G.yTop - 4, width: 6 * G.PW + 8, height: G.yBottom - G.yTop + 8, rx: 6, fill: 'url(#gField)', stroke: '#4a2d18', 'stroke-width': 3 }, s);
    }
    // مثلث‌ها
    for (let idx = 0; idx < 24; idx++) {
      const col = colOf(idx);
      const x = colX(col);
      const top = isTop(idx);
      const dark = (col + (top ? 1 : 0)) % 2 === 0;
      const y0 = top ? G.yTop : G.yBottom;
      const y1 = top ? G.yTop + G.pH : G.yBottom - G.pH;
      el(
        'polygon',
        {
          points: `${x + 2},${y0} ${x + G.PW - 2},${y0} ${x + G.PW / 2},${y1}`,
          fill: dark ? '#9c3a2b' : '#f1deb4',
          stroke: dark ? '#6f261b' : '#d2b883',
          'stroke-width': 1.2,
        },
        s,
      );
    }
    // نقش هندسی ایرانی (ختمی) در مرکز هر نیمه
    for (const x of halves) this.khatam(s, x + 3 * G.PW, MID_Y);
    // Bar
    el('rect', { x: G.barX, y: G.yTop - 4, width: G.barW, height: G.yBottom - G.yTop + 8, fill: '#5b3820', stroke: '#3b2415', 'stroke-width': 3 }, s);
    el('line', { x1: G.barX + G.barW / 2, y1: G.yTop, x2: G.barX + G.barW / 2, y2: G.yBottom, stroke: '#7a4c2b', 'stroke-width': 2 }, s);
    // لولا
    [G.yTop + 120, G.yBottom - 120].forEach((y) => el('rect', { x: G.barX + 14, y: y - 18, width: 28, height: 36, rx: 5, fill: '#b9a06a', stroke: '#6d5a31' }, s));
    // سینی‌های خروج
    el('rect', { x: G.trayX, y: G.yTop - 22, width: G.trayW, height: G.yBottom - G.yTop + 44, rx: 12, fill: '#3a2414', stroke: '#1d110a', 'stroke-width': 3 }, s);
    el('line', { x1: G.trayX + 6, y1: MID_Y, x2: G.trayX + G.trayW - 6, y2: MID_Y, stroke: '#6b4326', 'stroke-width': 3 }, s);
    // شماره‌ی خانه‌ها
    this.numberLayer = el('g', { 'pointer-events': 'none' }, s);
  }

  khatam(parent, cx, cy) {
    const g = el('g', { opacity: 0.55, 'pointer-events': 'none' }, parent);
    const sq = (rot, r) =>
      el('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, fill: 'none', stroke: '#6b4326', 'stroke-width': 2.2, transform: `rotate(${rot} ${cx} ${cy})` }, g);
    sq(0, 30);
    sq(45, 30);
    sq(22.5, 20);
    sq(67.5, 20);
    el('circle', { cx, cy, r: 8, fill: '#6b4326' }, g);
  }

  buildHits() {
    const h = this.hitLayer;
    for (let idx = 0; idx < 24; idx++) {
      const x = colX(colOf(idx));
      const top = isTop(idx);
      const y = top ? G.yTop - 6 : G.yBottom - G.pH;
      el('rect', { x, y, width: G.PW, height: G.pH + 6, fill: 'transparent', 'data-loc': String(idx), 'data-kind': 'point' }, h);
    }
    el('rect', { x: G.barX, y: G.yTop, width: G.barW, height: G.yBottom - G.yTop, fill: 'transparent', 'data-loc': 'bar', 'data-kind': 'bar' }, h);
    // سینی‌ها: سفید پایین (۰)، مشکی بالا (۱)
    el('rect', { x: G.trayX, y: MID_Y, width: G.trayW, height: G.yBottom + 22 - MID_Y, fill: 'transparent', 'data-loc': 'off', 'data-off': '0', 'data-kind': 'off' }, h);
    el('rect', { x: G.trayX, y: G.yTop - 22, width: G.trayW, height: MID_Y - G.yTop + 22, fill: 'transparent', 'data-loc': 'off', 'data-off': '1', 'data-kind': 'off' }, h);
  }

  setNumbers(show) {
    this.showNumbers = !!show;
    const n = this.numberLayer;
    while (n.firstChild) n.removeChild(n.firstChild);
    if (!show) return;
    for (let idx = 0; idx < 24; idx++) {
      const x = pointCenterX(idx);
      const top = isTop(idx);
      const y = top ? G.yTop - 12 : G.yBottom + 26;
      const t = el('text', { x, y, 'text-anchor': 'middle', 'font-size': 17, fill: '#f1deb4', 'font-weight': 700 }, n);
      t.textContent = faNum(idx + 1);
      if (this.portrait) t.setAttribute('transform', `rotate(-90 ${x} ${y})`);
    }
  }

  // ---------- رویدادهای لمسی ----------
  locFromTarget(target) {
    const t = target?.closest?.('[data-loc]');
    if (!t) return null;
    const v = t.getAttribute('data-loc');
    if (v === 'bar') return { loc: 'bar' };
    if (v === 'off') return { loc: 'off', player: Number(t.getAttribute('data-off')) };
    return { loc: Number(v) };
  }

  /** مختصات کلاینت → مختصات «تخته» (قبل از چرخش) */
  toBoardCoords(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = this.root.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  bindPointer() {
    const svg = this.svg;
    svg.style.touchAction = 'none';
    svg.addEventListener('pointerdown', (e) => {
      const hit = this.locFromTarget(e.target);
      try {
        svg.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      this.pointerId = e.pointerId;
      this.handlers.onDown?.({ ...hit, ev: e, pos: this.toBoardCoords(e.clientX, e.clientY) });
    });
    svg.addEventListener('pointermove', (e) => {
      if (this.pointerId !== e.pointerId) return;
      this.handlers.onMove?.({ ev: e, pos: this.toBoardCoords(e.clientX, e.clientY) });
    });
    const up = (e) => {
      if (this.pointerId !== e.pointerId) return;
      this.pointerId = null;
      // هدف رها‌کردن را با مختصات پیدا می‌کنیم (چون pointer capture فعال است)
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const hit = this.locFromTarget(under);
      this.handlers.onUp?.({ ...hit, ev: e, cancelled: e.type === 'pointercancel', pos: this.toBoardCoords(e.clientX, e.clientY) });
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }

  // ---------- رسم ----------
  /**
   * @param board صفحه
   * @param opts {
   *   player: بازیکنِ نوبت‌دار (برای تعیین سینی خروج هدف)،
   *   selected: loc، targets: آرایه‌ی loc، sources: آرایه‌ی loc (درخشان)،
   *   hint: {from,to}، spot: {points:[], bar:bool, off:[], home:[]}،
   *   hidden: {loc, player} (مهره‌ی بالایی مخفی)، dragLoc: loc (مهره‌ی بالایی مخفی برای درگ)
   * }
   */
  render(board, opts = {}) {
    this.lastArgs = [board, opts];
    const d = this.dynLayer;
    while (d.firstChild) d.removeChild(d.firstChild);
    const hideKey = opts.hidden ? `${opts.hidden.loc}|${opts.hidden.player}` : null;
    const dragKey = opts.dragLoc !== undefined && opts.dragLoc !== null ? String(opts.dragLoc) : null;

    // نورهای زمینه (spot / targets) زیر مهره‌ها
    const spot = opts.spot || {};
    (spot.points || []).forEach((i) => this.pointGlow(d, i, '#ffd966', 0.38));
    (spot.home || []).forEach((p) => {
      const range = p === 0 ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23];
      range.forEach((i) => this.pointGlow(d, i, '#ffd966', 0.22));
    });
    if (spot.bar) el('rect', { x: G.barX + 2, y: G.yTop, width: G.barW - 4, height: G.yBottom - G.yTop, fill: '#ffd966', opacity: 0.32, class: 'pulse' }, d);
    (spot.off || []).forEach((p) => this.trayGlow(d, p, '#ffd966', 0.35));
    (opts.targets || []).forEach((t) => {
      if (t === 'off') this.trayGlow(d, opts.player ?? 0, '#7dffb0', 0.4);
      else this.pointGlow(d, t, '#7dffb0', 0.42);
    });

    // مهره‌ها روی خانه‌ها
    for (let i = 0; i < 24; i++) {
      const v = board.points[i];
      if (v === 0) continue;
      const p = v > 0 ? 0 : 1;
      const n = Math.abs(v);
      for (let k = 0; k < n; k++) {
        if (k === n - 1 && (hideKey === `${i}|${p}` || (dragKey === String(i) && opts.dragPlayer === p))) continue;
        const pos = pointCheckerPos(i, k, n);
        this.checker(d, pos.x, pos.y, p, k === n - 1 && n > 5 ? n : 0);
      }
    }
    // Bar
    for (const p of [0, 1]) {
      const n = board.bar[p];
      for (let k = 0; k < n; k++) {
        if (k === n - 1 && (hideKey === `bar|${p}` || (dragKey === 'bar' && opts.dragPlayer === p))) continue;
        const pos = barCheckerPos(p, k, n);
        this.checker(d, pos.x, pos.y, p, 0);
      }
    }
    // مهره‌های خارج‌شده
    for (const p of [0, 1]) {
      const n = board.off[p];
      for (let k = 0; k < n; k++) {
        if (k === n - 1 && hideKey === `off|${p}`) continue;
        const pos = offCheckerPos(p, k);
        this.offChecker(d, pos.x, pos.y, pos.h, p);
      }
    }

    // مهره‌ی قابل انتخاب (درخشان)
    (opts.sources || []).forEach((loc) => this.topRing(d, board, opts.player ?? 0, loc, '#ffd966', true));
    if (opts.selected !== undefined && opts.selected !== null) this.topRing(d, board, opts.player ?? 0, opts.selected, '#7dffb0', false);
    // نقطه‌ی هدف
    (opts.targets || []).forEach((t) => {
      if (t === 'off') return;
      const own = ownCount(board, opts.player ?? 0, t);
      const pos = pointCheckerPos(t, own, own + 1);
      const c = el('circle', { cx: pos.x, cy: pos.y, r: 11, fill: '#7dffb0', stroke: '#1d6b43', 'stroke-width': 2, class: 'pulse' }, d);
      c.setAttribute('opacity', 0.9);
    });
    // پیکان راهنما
    if (opts.hint) this.arrow(d, board, opts.player ?? 0, opts.hint);
  }

  pointGlow(parent, idx, color, op) {
    const col = colOf(idx);
    const x = colX(col);
    const top = isTop(idx);
    const y0 = top ? G.yTop : G.yBottom;
    const y1 = top ? G.yTop + G.pH : G.yBottom - G.pH;
    el('polygon', { points: `${x},${y0} ${x + G.PW},${y0} ${x + G.PW / 2},${y1}`, fill: color, opacity: op, stroke: color, 'stroke-width': 2, class: 'pulse' }, parent);
  }
  trayGlow(parent, p, color, op) {
    const y = p === 0 ? MID_Y : G.yTop - 22;
    const h = p === 0 ? G.yBottom + 22 - MID_Y : MID_Y - G.yTop + 22;
    el('rect', { x: G.trayX, y, width: G.trayW, height: h, rx: 12, fill: color, opacity: op, stroke: color, 'stroke-width': 3, class: 'pulse' }, parent);
  }

  checker(parent, x, y, p, badge) {
    const g = el('g', {}, parent);
    el('circle', { cx: x + 2, cy: y + 4, r: G.R, fill: 'rgba(0,0,0,0.38)' }, g);
    el('circle', { cx: x, cy: y, r: G.R, fill: p === 0 ? 'url(#gWhite)' : 'url(#gBlack)', stroke: p === 0 ? '#8c7a52' : '#000', 'stroke-width': 1.5 }, g);
    el('circle', { cx: x, cy: y, r: G.R - 7, fill: 'none', stroke: p === 0 ? 'rgba(120,100,60,.55)' : 'rgba(255,255,255,.18)', 'stroke-width': 2 }, g);
    el('circle', { cx: x, cy: y, r: G.R - 14, fill: 'none', stroke: p === 0 ? 'rgba(120,100,60,.35)' : 'rgba(255,255,255,.1)', 'stroke-width': 1.5 }, g);
    if (badge) {
      const t = el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: p === 0 ? '#3b2a10' : '#f2f2f2' }, g);
      t.textContent = faNum(badge);
      if (this.portrait) t.setAttribute('transform', `rotate(-90 ${x} ${y})`);
    }
    return g;
  }
  offChecker(parent, x, y, h, p) {
    const g = el('g', {}, parent);
    el('rect', { x: x - 38, y: y - h / 2 + 1, width: 76, height: h - 2, rx: 5, fill: p === 0 ? '#e9dcc0' : '#2a2a2e', stroke: p === 0 ? '#8c7a52' : '#000', 'stroke-width': 1.2 }, g);
    return g;
  }

  topPos(board, player, loc) {
    if (loc === 'bar') return barCheckerPos(player, Math.max(0, board.bar[player] - 1), Math.max(1, board.bar[player]));
    const n = ownCount(board, player, loc);
    return pointCheckerPos(loc, Math.max(0, n - 1), Math.max(1, n));
  }
  topRing(parent, board, player, loc, color, pulse) {
    const pos = this.topPos(board, player, loc);
    el('circle', { cx: pos.x, cy: pos.y, r: G.R + 5, fill: 'none', stroke: color, 'stroke-width': 4, class: pulse ? 'pulse' : '' }, parent);
    el('circle', { cx: pos.x, cy: pos.y, r: G.R + 12, fill: color === '#7dffb0' ? 'url(#gGlow)' : 'url(#gGold)', opacity: 0.55 }, parent);
  }

  arrow(parent, board, player, hint) {
    const a = this.topPos(board, player, hint.from);
    let b;
    if (hint.to === 'off') b = { x: G.trayX + G.trayW / 2, y: player === 0 ? G.yBottom - 60 : G.yTop + 60 };
    else {
      const own = ownCount(board, player, hint.to);
      b = pointCheckerPos(hint.to, own, own + 1);
    }
    const g = el('g', { 'pointer-events': 'none' }, parent);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + (Math.abs(a.x - b.x) > 20 ? -70 : 0);
    el('path', { d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`, fill: 'none', stroke: '#ffd966', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': '2 14', class: 'dash' }, g);
    el('circle', { cx: b.x, cy: b.y, r: 16, fill: '#ffd966', opacity: 0.9, class: 'pulse' }, g);
  }

  // ---------- درگ ----------
  showGhost(pos, p) {
    this.hideGhost();
    this.ghost = el('g', {}, this.fxLayer);
    this.checker(this.ghost, 0, 0, p, 0);
    this.ghost.setAttribute('transform', `translate(${pos.x},${pos.y}) scale(1.12)`);
  }
  moveGhost(pos) {
    this.ghost?.setAttribute('transform', `translate(${pos.x},${pos.y}) scale(1.12)`);
  }
  hideGhost() {
    this.ghost?.remove();
    this.ghost = null;
  }

  // ---------- انیمیشن حرکت ----------
  /**
   * @param before صفحه قبل از حرکت، after صفحه بعد از حرکت
   * @returns Promise پس از پایان انیمیشن
   */
  animateMove(before, after, player, move, duration, renderOpts = {}) {
    const fromCount = move.from === 'bar' ? before.bar[player] : ownCount(before, player, move.from);
    const a = locPos(before, player, move.from, fromCount - 1, fromCount);
    let b;
    let toLoc = move.to;
    if (move.to === 'off') b = offCheckerPos(player, after.off[player] - 1);
    else {
      const n = ownCount(after, player, move.to);
      b = pointCheckerPos(move.to, n - 1, n);
    }
    this.render(after, { ...renderOpts, hidden: { loc: toLoc, player } });
    if (duration <= 0 || typeof Element.prototype.animate !== 'function') {
      this.render(after, renderOpts);
      return Promise.resolve();
    }
    const g = el('g', {}, this.fxLayer);
    if (move.to === 'off') this.offChecker(g, 0, 0, 15, player);
    else this.checker(g, 0, 0, player, 0);
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        g.remove();
        this.render(after, renderOpts);
        resolve();
      };
      try {
        const anim = g.animate(
          [
            { transform: `translate(${a.x}px,${a.y}px) scale(1.15)` },
            { transform: `translate(${(a.x + b.x) / 2}px,${(a.y + b.y) / 2 - 24}px) scale(1.25)`, offset: 0.5 },
            { transform: `translate(${b.x}px,${b.y}px) scale(1)` },
          ],
          { duration, easing: 'ease-in-out', fill: 'forwards' },
        );
        anim.onfinish = done;
        setTimeout(done, duration + 120);
      } catch (_) {
        done();
      }
    });
  }
}
