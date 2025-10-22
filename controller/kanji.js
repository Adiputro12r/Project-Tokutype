import { BaseGame } from "./basegame.js";
import { toHiragana } from "../lib/converter.js";

const wordEl = document.getElementById("word");
const inputEl = document.getElementById("input");
const typedBox = document.getElementById("typedBox");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const startMsg = document.getElementById("startMsg");

const game = new BaseGame({
  wordEl,
  inputEl,
  typedBox,
  scoreEl,
  timeEl,
  wpmEl,
  startMsg,
  initialTime: 120,
  batchSize: 5,
  strict: false,
});

game.allData = [];
game.batchAnswers = [];
game.currentCharIndex = 0;

// Load kanji data
game.setHooks({
  loadWords: async () => {
    const res = await fetch("../../database/kanji.json");
    const data = await res.json();
    game.allData = data;
    return data.filter(d => d.kanji);
  },
  convertInput: (raw) => toHiragana(raw),
});

// Helper: ambil bacaan hiragana per kanji
function getKanjiReadings(item) {
  if (item.type === "single") {
    const pools = [];
    if (item.onyomi?.length) pools.push("onyomi");
    if (item.kunyomi?.length) pools.push("kunyomi");
    const pick = pools[Math.floor(Math.random() * pools.length)];
    const reading = item[pick][Math.floor(Math.random() * item[pick].length)];
    return [toHiragana(reading.replace(/\./g, ""))];
  } else if (item.type === "word" && item.reading?.length) {
    const reading = item.reading[Math.floor(Math.random() * item.reading.length)];
    return [toHiragana(reading)];
  }
  return [];
}

// Override batch untuk kanji dengan ruby
game._pickBatch = function () {
  const pool = [...this.allData].sort(() => Math.random() - 0.5);
  const selected = pool.slice(0, Math.min(this.batchSize, pool.length));

  this.batchWords = selected.map(i => i.kanji);
  this.batchAnswers = selected.map(i => ({
    kanji: i.kanji,
    readings: getKanjiReadings(i),
    type: i.type
  }));

  this.currentIndex = 0;

  // Render <ruby> dengan hiragana reading
  const html = selected.map((item, idx) => {
    const readings = this.batchAnswers[idx].readings;
    const cls = idx === 0 ? "active-word" : "";
    const reading = readings[0] || "";
    
    return `<span class="word-item ${cls}" data-reading="${reading}">
      <ruby>${item.kanji}<rt>${reading}</rt></ruby>
    </span>`;
  }).join(" ");

  this.wordEl.innerHTML = html;
  this.inputEl.value = "";
  this.typedBox.innerHTML = "";
};

// Input handler khusus untuk kanji
inputEl.addEventListener("input", () => {
  if (!game.gameStarted || game.gameOverState) return;
  
  const converted = toHiragana(inputEl.value);
  const wordData = game.batchAnswers[game.currentIndex];
  if (!wordData) return;

  // Ambil reading yang sesuai
  const currentWordElement = document.querySelector('.word-item.active-word');
  const displayedReading = currentWordElement 
    ? currentWordElement.getAttribute('data-reading') 
    : wordData.readings[0];
  
  const fullTarget = displayedReading;

  // Tampilkan progress typing di typedBox
  let html = "";
  let isAllCorrect = true;

  for (let i = 0; i < fullTarget.length; i++) {
    const typed = converted[i];
    const correct = fullTarget[i];
    
    if (typed !== undefined) {
      if (typed === correct) {
        html += `<span class="correct">${typed}</span>`;
      } else {
        html += `<span class="incorrect">${typed}</span>`;
        isAllCorrect = false;
      }
    } else {
      html += `<span class="pending">${correct}</span>`;
      isAllCorrect = false;
    }
  }

  typedBox.innerHTML = html;

  // Jika semua benar dan lengkap
  if (isAllCorrect && converted === fullTarget) {
    const items = document.querySelectorAll(".word-item");
    if (items[game.currentIndex]) {
      // Tandai sebagai done
      items[game.currentIndex].classList.remove("active-word");
      items[game.currentIndex].classList.add("done-word");
    }

    game.score++;
    game._updateScore();
    game.currentIndex++;
    inputEl.value = "";
    typedBox.innerHTML = "";

    // Jika batch selesai, ambil batch baru
    if (game.currentIndex >= game.batchAnswers.length) {
      game._pickBatch();
    } else {
      // Aktifkan kata berikutnya
      items[game.currentIndex].classList.add("active-word");
    }
  }
});

// Override _startGame untuk memastikan batch dimuat
game._startGame = function() {
  if (this.interval) return;
  
  this.gameStarted = true;
  this.gameOverState = false;
  this.score = 0;
  this.time = this.initialTime;
  
  this._updateScore();
  this._updateTime();
  
  this._pickBatch();
  
  this.inputEl.disabled = false;
  this.inputEl.value = "";
  this.typedBox.innerHTML = "";
  this.startMsg.style.display = "none";
  
  this.inputEl.focus();
  
  clearInterval(this.interval);
  this.interval = setInterval(() => {
    this.time--;
    this.timeEl.textContent = this.time;
    
    // Update WPM
    const minutes = (this.initialTime - this.time) / 60;
    this.wpmEl.textContent = minutes > 0 ? Math.round(this.score / minutes) : 0;
    
    if (this.time <= 0) {
      this._gameOver();
    }
  }, 1000);
};

// Override start untuk menggunakan _startGame yang baru
game.start = function() {
  if (!this.allData.length) return;
  this._startGame();
};

// Override _gameOver
game._gameOver = function() {
  clearInterval(this.interval);
  this.gameOverState = true;
  this.gameStarted = false;
  this.wordEl.innerHTML = `<div style="text-align: center; font-size: 32px; color: #667eea;">
    <p>ゲームオーバー！ (Game Over)</p>
    <p style="font-size: 24px; margin-top: 20px; color: #333;">
      Final Score: <strong>${this.score}</strong> | WPM: <strong>${this.wpmEl.textContent}</strong>
    </p>
  </div>`;
  this.inputEl.disabled = true;
  this.startMsg.style.display = "block";
  this.startMsg.textContent = "Press SPACE to restart";
};

// Initialize game
game.init().catch(err => {
  wordEl.textContent = "Failed to load kanji data.";
  console.error(err);
});