const wordEl = document.getElementById("word");
const inputEl = document.getElementById("input");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const startMsg = document.getElementById("startMsg");
const typedBox = document.getElementById("typedBox");

let words = [];
let score = 0;
let time = 30;
let currentIndex = 0;
let batchSize = 10;
let batchWords = [];
let currentWordIndex = 0;
let currentWord = "";
let gameStarted = false;
let gameOverState = false;
let timer;

// === Romaji Map Lengkap ===
const romajiMap = {
  // vokal
  a:"あ", i:"い", u:"う", e:"え", o:"お",
  // k-series
  ka:"か", ki:"き", ku:"く", ke:"け", ko:"こ",
  kya:"きゃ", kyu:"きゅ", kyo:"きょ",
  // s-series
  sa:"さ", shi:"し", si:"し", su:"す", se:"せ", so:"そ",
  sha:"しゃ", shu:"しゅ", sho:"しょ",
  // t-series
  ta:"た", chi:"ち", ti:"ち", tsu:"つ", tu:"つ", te:"て", to:"と",
  cha:"ちゃ", chu:"ちゅ", cho:"ちょ",
  // n-series
  na:"な", ni:"に", nu:"ぬ", ne:"ね", no:"の",
  nya:"にゃ", nyu:"にゅ", nyo:"にょ",
  // h-series
  ha:"は", hi:"ひ", fu:"ふ", hu:"ふ", he:"へ", ho:"ほ",
  hya:"ひゃ", hyu:"ひゅ", hyo:"ひょ",
  // m-series
  ma:"ま", mi:"み", mu:"む", me:"め", mo:"も",
  mya:"みゃ", myu:"みゅ", myo:"みょ",
  // y-series
  ya:"や", yu:"ゆ", yo:"よ",
  // r-series
  ra:"ら", ri:"り", ru:"る", re:"れ", ro:"ろ",
  rya:"りゃ", ryu:"りゅ", ryo:"りょ",
  // w-series
  wa:"わ", wo:"を", n:"ん",
  // dakuten
  ga:"が", gi:"ぎ", gu:"ぐ", ge:"げ", go:"ご",
  gya:"ぎゃ", gyu:"ぎゅ", gyo:"ぎょ",
  za:"ざ", ji:"じ", zi:"じ", zu:"ず", ze:"ぜ", zo:"ぞ",
  ja:"じゃ", ju:"じゅ", jo:"じょ", jya:"じゃ", jyu:"じゅ", jyo:"じょ",
  da:"だ", de:"で", do:"ど",
  ba:"ば", bi:"び", bu:"ぶ", be:"べ", bo:"ぼ",
  bya:"びゃ", byu:"びゅ", byo:"びょ",
  pa:"ぱ", pi:"ぴ", pu:"ぷ", pe:"ぺ", po:"ぽ",
  pya:"ぴゃ", pyu:"ぴゅ", pyo:"ぴょ",
  // ekstra
  dzu:"づ", dzi:"づ"
};

// === Parser Manual ===
function romajiToHiragana(input) {
  let result = "";
  let i = 0;
  input = input.toLowerCase();

  while (i < input.length) {
    // double consonant → っ
    if (i+1 < input.length && input[i] === input[i+1] && !"aiueo".includes(input[i])) {
      result += "っ"; i++; continue;
    }

    // 3 huruf (yoon)
    let three = input.substr(i,3);
    if (romajiMap[three]) { result += romajiMap[three]; i+=3; continue; }

    // 2 huruf
    let two = input.substr(i,2);
    if (two==="nn") { result += "ん"; i+=2; continue; }
    if (romajiMap[two]) { result += romajiMap[two]; i+=2; continue; }

    // aturan "n"
    if (input[i]==="n") {
      let next=input[i+1];
      if(!next || !"aiueoy".includes(next)) { result+="ん"; i++; continue; }
    }

    // 1 huruf
    if (romajiMap[input[i]]) { result+=romajiMap[input[i]]; i++; continue; }

    result+=input[i]; i++;
  }
  return result;
}

// === Load Words ===
async function loadWords() {
  try {
    const res = await fetch("word.json");
    words = await res.json();
    getBatch();
  } catch (err) {
    console.error("Gagal load word.json:", err);
  }
}

function getBatch() {
  let availableWords = words.filter(w => !batchWords.includes(w)); // hindari pengulangan batch sebelumnya
  if (availableWords.length < batchSize) availableWords = [...words]; // reset jika sisa kata kurang
  const shuffled = [...availableWords].sort(() => Math.random() - 0.5);
  batchWords = shuffled.slice(0, batchSize);
  currentWordIndex = 0;
  renderBatch();
}

function renderBatch() {
  wordEl.innerHTML = batchWords
    .map((w,i) => i===currentWordIndex ? `<span class="active">${w}</span>` : `<span>${w}</span>`)
    .join(" ");
  currentWord = batchWords[currentWordIndex];
}

// === Game Flow ===
document.addEventListener("keydown", e => {
  if (e.code==="Space") {
    e.preventDefault(); // penting: cegah spasi masuk input
    if (!gameStarted && !gameOverState) startGame();
    else if (gameOverState) resetGame();
  }
});

function startGame() {
  gameStarted = true; gameOverState = false;
  score = 0; time = 30; currentIndex = 0;
  scoreEl.textContent = "スコア: 0";
  timeEl.textContent = "タイム: 30";
  wpmEl.textContent = "WPM: 0";
  startMsg.style.display = "none";
  inputEl.disabled = false;
  inputEl.value = ""; inputEl.focus();
  getBatch();

  timer = setInterval(() => {
    time--;
    timeEl.textContent = "タイム: " + time;
    updateWPM();
    if (time===0) { clearInterval(timer); gameOver(); }
  }, 1000);
}

inputEl.addEventListener("input", () => {
  if (gameOverState) return;
  const converted = romajiToHiragana(inputEl.value);
  typedBox.textContent = converted;

  const spans = wordEl.querySelectorAll("span");
  const activeSpan = spans[currentWordIndex];
  const letters = currentWord.split("");
  const typed = converted.split("");

  activeSpan.innerHTML = letters.map((ch,i) => {
    if (typed[i]==null) return `<span>${ch}</span>`;
    else if (typed[i]===ch) return `<span class="correct">${ch}</span>`;
    else return `<span class="incorrect">${ch}</span>`;
  }).join("");

  if (converted === currentWord) {
    score++;
    scoreEl.textContent = "スコア: " + score;
    inputEl.value = ""; typedBox.textContent = "";
    currentWordIndex++;
    if (currentWordIndex >= batchWords.length) getBatch();
    else renderBatch();
  }
});

function updateWPM() {
  let minutes = (30 - time) / 60;
  if (minutes > 0) {
    let wpm = Math.round(score / minutes);
    wpmEl.textContent = "WPM: " + wpm;
  }
}

function gameOver() {
  gameOverState = true;
  wordEl.textContent = "ゲームオーバー！";
  inputEl.disabled = true;
  startMsg.style.display = "block";
  startMsg.textContent = "もう一度スペースキーでリスタート！ (Press SPACE to Restart)";
}

function resetGame() {
  gameStarted = false;
  gameOverState = false;
  startMsg.style.display = "block";
  startMsg.textContent = "スペースキーを押してスタート！ (Press SPACE to Start)";
  wordEl.textContent = "";
  typedBox.textContent = "";
  inputEl.value = "";
  inputEl.disabled = true;
  scoreEl.textContent = "スコア: 0";
  timeEl.textContent = "タイム: 30";
  wpmEl.textContent = "WPM: 0";
}

// === Mulai ===
loadWords();
