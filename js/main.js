import { boot } from "./app.js";

boot().catch(err => {
  console.error("Boot failed:", err);
  alert("Bandscape failed to start. Check the console for details.");
});
