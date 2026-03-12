// js/main.js - ES module entrypoint

import { boot } from "./app.js";

window.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("Boot failed:", err);

    // Make failures obvious so you don't get a "dead" UI with no clue why.
    alert(
      "Bandscape failed to start.\n\n" +
      "Open DevTools → Console to see the error.\n\n" +
      (err?.message || String(err))
    );
  });
});