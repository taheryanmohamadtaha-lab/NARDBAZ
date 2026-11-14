import { App } from './ui/app.js';

window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App(document.getElementById('app'));
});
