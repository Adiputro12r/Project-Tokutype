// controller/hiragana.js
import { BaseGame } from "./basegame.js";          // dari /controller/
import { toHiragana } from "../lib/converter.js";  // dari /lib/

const wordEl = document.getElementById("word");
const inputEl = document.getElementById("input");
const typedBox = document.getElementById("typedBox");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const startMsg = document.getElementById("startMsg");

const game = new BaseGame({
  wordEl, inputEl, typedBox, scoreEl, timeEl, wpmEl, startMsg,
  initialTime: 60, batchSize: 10, strict: false
});

game.setHooks({
  loadWords: async () => {
    const res = await fetch("../../database/hiragana.json");
    const arr = await res.json();
    return arr.map(s => String(s).trim()).filter(Boolean);
  },
  convertInput: (raw) => toHiragana(raw),
  onRenderWord: (word) => {
    if (!word) { wordEl.innerHTML = ""; return; }
    const spans = word.split("").map(ch => `<span class="pending">${ch}</span>`).join("");
    wordEl.innerHTML = spans;
  }
});

game.init().catch(err => {
  console.error("Init failed:", err);
  wordEl.textContent = "Failed to load words. Check console.";
});
