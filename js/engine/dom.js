export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function show(el) {
  if (!el) return;
  el.classList.remove("hidden");
}
export function hide(el) {
  if (!el) return;
  el.classList.add("hidden");
}

export function on(el, event, handler, opts) {
  if (!el) return;
  el.addEventListener(event, handler, opts);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
