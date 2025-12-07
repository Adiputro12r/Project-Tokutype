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

// 🔹 Load kanji data
game.setHooks({
  loadWords: async () => {
    const res = await fetch("../../database/kanji.json");
    const data = await res.json();
    game.allData = data;
    return data.filter(d => d.kanji);
  },
  convertInput: (raw) => toHiragana(raw),
});

// 🔹 Helper untuk memilih bacaan hiragana
function getKanjiReadings(item) {
  if (item.type === "single") {
    const pools = [];
    if (item.onyomi?.length) pools.push("onyomi");
    if (item.kunyomi?.length) pools.push("kunyomi");
    const pick = pools[Math.floor(Math.random() * pools.length)];
    const reading = item[pick][Math.floor(Math.random() * item[pick].length)];
    // Hapus titik dari Kunyomi untuk typing (misalnya "まな.ぶ" jadi "まなぶ")
    return [toHiragana(reading.replace(/\./g, ""))];
  } else if (item.type === "word" && item.reading?.length) {
    const reading = item.reading[Math.floor(Math.random() * item.reading.length)];
    return [toHiragana(reading)];
  }
  return [];
}

// 🔹 Override batch renderer agar bisa menampilkan <ruby>
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

  // render <ruby>
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

// 🔹 Input handler dengan warna dinamis
inputEl.addEventListener("input", () => {
  if (!game.gameStarted || game.gameOverState) return;

  const converted = toHiragana(inputEl.value);
  const wordData = game.batchAnswers[game.currentIndex];
  if (!wordData) return;

  const currentWordElement = document.querySelector('.word-item.active-word');
  const displayedReading = currentWordElement 
    ? currentWordElement.getAttribute('data-reading') 
    : wordData.readings[0];

  const fullTarget = displayedReading;
  const isCompleteAndCorrect = converted === fullTarget;

  // tampilkan di typedBox
  let html = "";
  for (let i = 0; i < fullTarget.length; i++) {
    const typed = converted[i];
    const correct = fullTarget[i];
    
    if (typed === correct) {
      // Menggunakan complete-correct jika sudah selesai dan benar
      const cssClass = isCompleteAndCorrect ? "complete-correct" : "partial-correct";
      html += `<span class="${cssClass}">${typed}</span>`;
    } else if (typed !== undefined) {
      html += `<span class="incorrect">${typed}</span>`;
    } else {
      // Karakter yang belum diketik
      html += `<span class="pending">${correct}</span>`;
    }
  }
  typedBox.innerHTML = html;

  // update furigana warna per karakter
  if (currentWordElement) {
    const rubyRT = currentWordElement.querySelector('rt');
    if (rubyRT) {
      let rtHTML = "";
      for (let i = 0; i < fullTarget.length; i++) {
        const typed = converted[i];
        const correct = fullTarget[i];
        
        if (typed === correct) {
          // Menggunakan complete-correct jika sudah selesai dan benar
          const cssClass = isCompleteAndCorrect ? "complete-correct" : "partial-correct";
          rtHTML += `<span class="${cssClass}">${correct}</span>`;
        } else if (typed !== undefined) {
          rtHTML += `<span class="incorrect">${correct}</span>`;
        } else {
          rtHTML += `<span class="pending">${correct}</span>`;
        }
      }
      rubyRT.innerHTML = rtHTML;
    }
  }

  // ✅ Jika benar semua (Perbaikan Logika Warna Final)
  if (isCompleteAndCorrect) {
    const items = document.querySelectorAll(".word-item");
    const current = items[game.currentIndex];
    
    // 🌟 PERBAIKAN 1: Pastikan typedBox memiliki warna 'correct' final sebelum di-reset (opsional, tapi baik untuk feedback visual sesaat)
    typedBox.innerHTML = fullTarget.split('')
      .map(ch => `<span class="correct">${ch}</span>`).join('');
      
    if (current) {
      current.classList.remove("active-word");
      current.classList.add("done-word");

      // 🌟 PERBAIKAN 2: Pastikan furigana (rt) diset ke warna 'correct' final (hijau)
      const rubyRT = current.querySelector('rt');
      if (rubyRT) {
        rubyRT.innerHTML = fullTarget.split('')
          .map(ch => `<span class="correct">${ch}</span>`).join('');
      }
    }

    game.score++;
    game._updateScore();
    game.currentIndex++;
    
    // Reset input dan typedBox BARU setelah memberikan feedback visual
    inputEl.value = "";
    typedBox.innerHTML = ""; 

    if (game.currentIndex >= game.batchAnswers.length) {
      game._pickBatch();
    } else {
      items[game.currentIndex].classList.add("active-word");
    }
  }
});

//  Inisialisasi game (tanpa override apa pun)
game.init().catch(err => {
  wordEl.textContent = "Failed to load kanji data.";
  console.error(err);
});