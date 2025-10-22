// controller/baseGame.js
export class BaseGame {
  constructor(opts) {
    this.wordEl = opts.wordEl;
    this.inputEl = opts.inputEl;
    this.typedBox = opts.typedBox;
    this.scoreEl = opts.scoreEl;
    this.timeEl = opts.timeEl;
    this.wpmEl = opts.wpmEl;
    this.startMsg = opts.startMsg;

    this.initialTime = opts.initialTime ?? 60;
    this.batchSize = opts.batchSize ?? 10;
    this.strict = opts.strict ?? true;

    this.allWords = [];
    this.batchWords = [];
    this.currentIndex = 0;
    this.currentWord = "";
    this.score = 0;
    this.time = this.initialTime;
    this.timer = null;
    this.gameStarted = false;
    this.gameOverState = false;

    this.hooks = { loadWords: null, convertInput: null, onRenderWord: null };

    this._bindEvents();
  }

  setHooks(h) { this.hooks = { ...this.hooks, ...h }; }

  async init() {
    if (!this.hooks.loadWords) throw new Error("loadWords hook required");
    this.allWords = await this.hooks.loadWords();
    if (!Array.isArray(this.allWords)) this.allWords = [];
    this._resetUI();
  }

  _bindEvents() {
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!this.gameStarted && !this.gameOverState) this.start();
        else if (this.gameOverState) this.reset();
      }
    });

    this.inputEl.addEventListener("input", () => {
      if (!this.gameStarted || this.gameOverState) return;
      this._onInput();
    });
  }

  start() {
    if (!this.allWords.length) return;
    this.gameStarted = true;
    this.gameOverState = false;
    this.score = 0;
    this.time = this.initialTime;
    this._updateScore();
    this._updateTime();
    this.startMsg.style.display = "none";
    this.inputEl.disabled = false;
    this.inputEl.value = "";
    this.typedBox.textContent = "";
    this._pickBatch();
    this._startTimer();
    this.inputEl.focus();
  }

  _startTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.time--;
      this._updateTime();
      this._updateWPM();
      if (this.time <= 0) {
        clearInterval(this.timer);
        this._gameOver();
      }
    }, 1000);
  }

  _pickBatch() {
    const pool = [...this.allWords].sort(() => Math.random() - 0.5);
    this.batchWords = pool.slice(0, Math.min(this.batchSize, pool.length));
    this.currentIndex = 0;
    this._renderAllWords();
  }

  _renderAllWords() {
    const allWordsHTML = this.batchWords.map((word, idx) => {
      const isActive = idx === this.currentIndex;
      const isPast = idx < this.currentIndex;
      const spans = word.split("").map(ch => {
        const className = isPast ? 'completed' : 'pending';
        return `<span class="${className}">${ch}</span>`;
      }).join("");
      
      const wordClass = isActive ? 'word-item active-word' : 'word-item';
      return `<span class="${wordClass}">${spans}</span>`;
    }).join(' ');
    
    this.wordEl.innerHTML = allWordsHTML;
    this.inputEl.value = "";
    this.typedBox.textContent = "";
  }

  _onInput() {
    const raw = this.inputEl.value;
    const converted = this.hooks.convertInput ? this.hooks.convertInput(raw) : raw;
    this.typedBox.textContent = converted;
    this._highlight(converted);
  }

  _highlight(converted) {
    const currentWord = this.batchWords[this.currentIndex] || "";
    const letters = currentWord.split("");
    const typed = (converted || "").split("");
    
    // Update only the ACTIVE word
    const wordItems = this.wordEl.querySelectorAll('.word-item');
    const activeWordEl = wordItems[this.currentIndex];
    
    if (!activeWordEl) return;
    
    // ✅ Cek apakah ada pending conversion
    const raw = this.inputEl.value;
    const isPending = raw.length > converted.length;
    
    const spans = letters.map((ch, idx) => {
      const t = typed[idx];
      
      if (t == null || t === "") {
        return `<span class="pending">${ch}</span>`;
      }
      if (t === ch) {
        return `<span class="correct">${ch}</span>`;
      }
      // ✅ Jika pending conversion, jangan tandai sebagai salah
      if (isPending && idx === typed.length - 1) {
        return `<span class="pending">${ch}</span>`;
      }
      return `<span class="incorrect">${ch}</span>`;
    });
    
    activeWordEl.innerHTML = spans.join("");

    // ✅ Check if current word is complete and correct
    if (converted === currentWord && converted !== "") {
      this.score++;
      this._updateScore();
      
      // Mark word as completed
      activeWordEl.classList.remove('active-word');
      activeWordEl.classList.add('word-completed');
      activeWordEl.innerHTML = currentWord.split("").map(ch => 
        `<span class="completed">${ch}</span>`
      ).join("");
      
      this.currentIndex++;
      
      // Check if all 10 words completed
      if (this.currentIndex >= this.batchWords.length) {
        this._pickBatch();
      } else {
        // Move to next word in the same batch
        const nextWordEl = wordItems[this.currentIndex];
        if (nextWordEl) {
          nextWordEl.classList.add('active-word');
        }
        this.inputEl.value = "";
        this.typedBox.textContent = "";
      }
    }

    // Strict mode: prevent typing beyond length
    if (this.strict) {
      const lettersCount = letters.length;
      const rawInput = this.inputEl.value;
      
      // ✅ PERBAIKAN: Cek apakah ada pending conversion
      const isPendingConversion = rawInput.length > converted.length;
      
      // ✅ Beri toleransi untuk konversi (max 2 char pending: ch, sh, ts, dll)
      const maxPendingChars = 2;
      const allowedLength = lettersCount + maxPendingChars;
      
      if (!isPendingConversion && rawInput.length > allowedLength) {
        this.inputEl.value = this.inputEl.value.slice(0, allowedLength);
        const newConverted = this.hooks.convertInput 
          ? this.hooks.convertInput(this.inputEl.value) 
          : this.inputEl.value;
        this.typedBox.textContent = newConverted;
        this._highlight(newConverted);
      }
    }
  }

  _updateScore() { this.scoreEl.textContent = this.score; }
  _updateTime() { this.timeEl.textContent = this.time; }
  _updateWPM() {
    const minutes = (this.initialTime - this.time) / 60;
    this.wpmEl.textContent = minutes > 0 ? Math.round(this.score / minutes) : 0;
  }

  _gameOver() {
    this.gameOverState = true;
    this.wordEl.textContent = "ゲームオーバー！ (Game Over)";
    this.inputEl.disabled = true;
    this.startMsg.style.display = "block";
    this.startMsg.textContent = "Press SPACE to restart";
  }

  reset() {
    clearInterval(this.timer);
    this.gameStarted = false;
    this.gameOverState = false;
    this.batchWords = [];
    this.currentIndex = 0;
    this.currentWord = "";
    this.score = 0;
    this.time = this.initialTime;
    this._updateScore();
    this._updateTime();
    this.wpmEl.textContent = 0;
    this.startMsg.style.display = "block";
    this.startMsg.textContent = "Press SPACE to start";
    this.wordEl.innerHTML = "";
    this.typedBox.textContent = "";
    this.inputEl.value = "";
    this.inputEl.disabled = true;
  }

  _resetUI() {
    this.reset();
  }
}