import { $, show, hide, on } from "../engine/dom.js";

let modal, modalBody, modalClose;

export function initModalSystem() {
  modal = $("#modal");
  modalBody = $("#modal-body");
  modalClose = $("#modal-close");

  on(modalClose, "click", () => closeModal());
  on(modal, "click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Esc closes modal
  on(document, "keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal?.classList.contains("hidden")) closeModal();
    }
  });
}

export function openModal({ title = "", html = "", actions = [] } = {}) {
  if (!modal || !modalBody) return;

  const safeTitle = title ? `<h2 style="margin:0 0 8px">${escapeHTML(title)}</h2>` : "";
  const buttons = actions.length
    ? `<div class="modal-actions">${actions.map((a, i) =>
        `<button data-act="${i}">${escapeHTML(a.label || "OK")}</button>`
      ).join("")}</div>`
    : "";

  modalBody.innerHTML = `${safeTitle}${html}${buttons}`;
  show(modal);

  if (actions.length) {
    const actionWrap = modalBody.querySelector(".modal-actions");
    actionWrap?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const idx = Number(btn.dataset.act);
      const act = actions[idx];
      if (act?.onClick) act.onClick();
    });
  }
}

export function closeModal() {
  if (!modal || !modalBody) return;
  modalBody.innerHTML = "";
  hide(modal);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[c]));
}
