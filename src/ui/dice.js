// تاس دوبعدی با نقطه‌های واضح
import { h } from './dom.js';

const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function dieEl(value, { used = false, small = false, rolling = false } = {}) {
  const cells = [];
  for (let i = 0; i < 9; i++) cells.push(h('i', { class: PIPS[value]?.includes(i) ? 'pip' : '' }));
  return h('div', { class: `die${used ? ' used' : ''}${small ? ' small' : ''}${rolling ? ' rolling' : ''}`, 'data-v': value }, ...cells);
}
