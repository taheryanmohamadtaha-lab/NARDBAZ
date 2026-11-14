// ابزارهای ساده‌ی DOM
export function h(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** پنجره‌ی گفت‌وگو. buttons: [{label, kind, onClick, keepOpen}] */
export function modal({ title, body, buttons = [], dismissible = true }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal', role: 'dialog' });
  if (title) box.appendChild(h('h2', {}, title));
  if (body) box.appendChild(typeof body === 'string' ? h('p', {}, body) : body);
  const row = h('div', { class: 'modal-buttons' });
  const close = () => back.remove();
  for (const b of buttons) {
    row.appendChild(
      h(
        'button',
        {
          class: `btn ${b.kind || ''}`,
          onClick: () => {
            if (!b.keepOpen) close();
            b.onClick?.();
          },
        },
        b.label,
      ),
    );
  }
  if (buttons.length) box.appendChild(row);
  back.appendChild(box);
  if (dismissible) back.addEventListener('pointerdown', (e) => e.target === back && close());
  document.body.appendChild(back);
  return { close, box };
}

export function confirmDialog(message, okLabel = 'تأیید', cancelLabel = 'انصراف') {
  return new Promise((resolve) => {
    modal({
      body: message,
      dismissible: false,
      buttons: [
        { label: cancelLabel, onClick: () => resolve(false) },
        { label: okLabel, kind: 'danger', onClick: () => resolve(true) },
      ],
    });
  });
}

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
