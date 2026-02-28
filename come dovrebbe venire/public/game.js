// ════════════════════════════════════════════════════════════
//  WORDLE ITALIANO — game.js
//  Logica di gioco lato client
//  Comunica con il server Express tramite fetch() (API REST)
// ════════════════════════════════════════════════════════════

'use strict';

// ── Layout tastiera italiana ─────────────────────────────────
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['INVIO','Z','X','C','V','B','N','M','⌫']
];

// ── Stato del gioco ──────────────────────────────────────────
const state = {
  playerName:  '',
  difficulty:  null,      // 5, 6, o 8
  targetWord:  '',
  maxAttempts: 0,
  currentRow:  0,
  currentCol:  0,
  currentGuess:[],        // Array di lettere della riga corrente
  grid:        [],        // Matrice [riga][col] → { letter, state }
  keyStates:   {},        // Mappa lettera → 'correct'|'present'|'absent'
  gameOver:    false,
  won:         false,
  timerStart:  null,
  timerInterval:null,
  elapsedSec:  0,
  history:     []         // Storico risultati per la mini-griglia
};

// ── Riferimenti DOM ─────────────────────────────────────────
const screens = {
  setup:    document.getElementById('setupScreen'),
  game:     document.getElementById('gameScreen'),
  result:   document.getElementById('resultScreen')
};

// ════════════════════════════════════════════════════════════
//  NAVIGAZIONE FRA SCHERMATE
// ════════════════════════════════════════════════════════════
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ════════════════════════════════════════════════════════════
//  SETUP — Selezione nome e difficoltà
// ════════════════════════════════════════════════════════════

// Gestione click sulle card di difficoltà
document.querySelectorAll('.diff-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.difficulty = parseInt(card.dataset.length);
  });
});

// Pulsante INIZIA PARTITA
document.getElementById('startBtn').addEventListener('click', startGame);

async function startGame() {
  const nameInput = document.getElementById('playerName').value.trim();
  const errEl     = document.getElementById('setupError');

  // Validazione input
  if (!nameInput) {
    showSetupError('Inserisci il tuo nome!');
    return;
  }
  if (!state.difficulty) {
    showSetupError('Seleziona una difficoltà!');
    return;
  }

  errEl.classList.add('hidden');
  state.playerName = nameInput;

  // Numero massimo di tentativi in base alla difficoltà
  state.maxAttempts = state.difficulty === 5 ? 6 : state.difficulty === 6 ? 7 : 8;

  try {
    // ── Chiamata API GET /api/word → ottiene parola casuale dal server ──
    // Il server legge il file .txt corrispondente e restituisce una parola JSON
    const res  = await fetch(`/api/word?difficulty=${state.difficulty}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Errore server');

    state.targetWord = data.word;

    // Inizializza la griglia vuota
    initGrid();
    buildGridDOM();
    buildKeyboard();
    updateHeader();

    // Avvia timer
    startTimer();

    // Passa alla schermata di gioco
    showScreen('game');

  } catch (err) {
    showSetupError('Errore: ' + err.message);
  }
}

function showSetupError(msg) {
  const errEl = document.getElementById('setupError');
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
}

// ════════════════════════════════════════════════════════════
//  INIZIALIZZAZIONE GRIGLIA
// ════════════════════════════════════════════════════════════
function initGrid() {
  state.currentRow   = 0;
  state.currentCol   = 0;
  state.currentGuess = [];
  state.gameOver     = false;
  state.won          = false;
  state.keyStates    = {};
  state.history      = [];
  state.elapsedSec   = 0;

  // Crea matrice state.grid[rows][cols]
  state.grid = Array.from({ length: state.maxAttempts }, () =>
    Array.from({ length: state.difficulty }, () => ({ letter: '', state: '' }))
  );
}

// ════════════════════════════════════════════════════════════
//  COSTRUZIONE DOM — Griglia
// ════════════════════════════════════════════════════════════
function buildGridDOM() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';

  // Adatta la dimensione tile per parole lunghe
  const tileSize = state.difficulty >= 8 ? '44px' : '58px';
  document.documentElement.style.setProperty('--tile-size', tileSize);

  for (let r = 0; r < state.maxAttempts; r++) {
    const row = document.createElement('div');
    row.className = 'grid-row';
    row.id = `row-${r}`;

    for (let c = 0; c < state.difficulty; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    gridEl.appendChild(row);
  }
}

// ════════════════════════════════════════════════════════════
//  COSTRUZIONE DOM — Tastiera virtuale
// ════════════════════════════════════════════════════════════
function buildKeyboard() {
  const kbEl = document.getElementById('keyboard');
  kbEl.innerHTML = '';

  KB_ROWS.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'kb-row';

    row.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'kb-key';
      btn.textContent = key;
      btn.dataset.key = key;

      if (key === 'INVIO' || key === '⌫') btn.classList.add('wide');

      // Event listener su ogni tasto virtuale
      btn.addEventListener('click', () => handleKey(key));
      rowDiv.appendChild(btn);
    });

    kbEl.appendChild(rowDiv);
  });
}

// ════════════════════════════════════════════════════════════
//  TIMER
// ════════════════════════════════════════════════════════════
function startTimer() {
  stopTimer(); // Ferma eventuali timer precedenti
  state.timerStart = Date.now();
  state.timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimer() {
  state.elapsedSec = Math.floor((Date.now() - state.timerStart) / 1000);
  const m = Math.floor(state.elapsedSec / 60);
  const s = state.elapsedSec % 60;
  document.getElementById('timerDisplay').textContent =
    `${m}:${s.toString().padStart(2, '0')}`;
}

// ════════════════════════════════════════════════════════════
//  AGGIORNAMENTO HEADER DI GIOCO
// ════════════════════════════════════════════════════════════
function updateHeader() {
  const labels = { 5: '🌱 FACILE', 6: '🔥 MEDIO', 8: '💀 DIFFICILE' };
  document.getElementById('diffBadge').textContent   = labels[state.difficulty];
  document.getElementById('playerDisplay').textContent = state.playerName;
  document.getElementById('attemptsDisplay').textContent =
    `${state.currentRow}/${state.maxAttempts}`;
}

// ════════════════════════════════════════════════════════════
//  INPUT — Tastiera fisica e virtuale
// ════════════════════════════════════════════════════════════

// Listener tastiera fisica
document.addEventListener('keydown', e => {
  if (screens.game.classList.contains('active') && !state.gameOver) {
    if (e.key === 'Enter') {
      handleKey('INVIO');
    } else if (e.key === 'Backspace') {
      handleKey('⌫');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKey(e.key.toUpperCase());
    }
  }
});

// Gestore centrale input
function handleKey(key) {
  if (state.gameOver) return;

  if (key === '⌫') {
    deleteLetter();
  } else if (key === 'INVIO') {
    submitGuess();
  } else if (/^[A-Z]$/.test(key)) {
    addLetter(key);
  }
}

// ── Aggiunta lettera ─────────────────────────────────────────
function addLetter(letter) {
  if (state.currentCol >= state.difficulty) return; // Riga piena

  state.currentGuess.push(letter);
  state.grid[state.currentRow][state.currentCol].letter = letter;

  const tile = getTile(state.currentRow, state.currentCol);
  tile.textContent = letter;
  tile.classList.add('filled', 'pop');
  tile.addEventListener('animationend', () => tile.classList.remove('pop'), { once: true });

  state.currentCol++;
}

// ── Cancellazione lettera ────────────────────────────────────
function deleteLetter() {
  if (state.currentCol <= 0) return;

  state.currentCol--;
  state.currentGuess.pop();
  state.grid[state.currentRow][state.currentCol].letter = '';

  const tile = getTile(state.currentRow, state.currentCol);
  tile.textContent = '';
  tile.classList.remove('filled');
}

// ════════════════════════════════════════════════════════════
//  SUBMIT TENTATIVO → chiamata POST /api/guess
// ════════════════════════════════════════════════════════════
async function submitGuess() {
  if (state.currentCol < state.difficulty) {
    showMessage('Parola troppo corta!');
    shakeRow(state.currentRow);
    return;
  }

  const guess = state.currentGuess.join('');

  try {
    // ── POST /api/guess: invia la parola tentata e quella target ──
    // Il server calcola il risultato lettera per lettera (correct/present/absent)
    const res  = await fetch('/api/guess', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ guess, target: state.targetWord })
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || 'Errore server');
      return;
    }

    // Rivela le tile con animazione a cascata
    await revealRow(state.currentRow, data.result, data.guess);

    // Salva la riga nel history (per mini-griglia finale)
    state.history.push(data.result);

    // Aggiorna stati tastiera
    updateKeyStates(data.guess, data.result);

    // Incrementa tentativi
    state.currentRow++;
    state.currentCol  = 0;
    state.currentGuess = [];
    document.getElementById('attemptsDisplay').textContent =
      `${state.currentRow}/${state.maxAttempts}`;

    // Controlla esito
    const isWon = data.result.every(r => r === 'correct');

    if (isWon) {
      state.gameOver = true;
      state.won      = true;
      stopTimer();
      showMessage('🎉 Hai indovinato!');
      setTimeout(() => showResult(true), 1600);
      saveResult(true);

    } else if (state.currentRow >= state.maxAttempts) {
      state.gameOver = true;
      state.won      = false;
      stopTimer();
      showMessage(`La parola era: ${state.targetWord}`);
      setTimeout(() => showResult(false), 1800);
      saveResult(false);
    }

  } catch (err) {
    showMessage('Errore di rete.');
    console.error(err);
  }
}

// ════════════════════════════════════════════════════════════
//  ANIMAZIONE — Rivelazione riga
// ════════════════════════════════════════════════════════════
function revealRow(rowIdx, result, guess) {
  return new Promise(resolve => {
    const delay = 300; // ms tra ogni tile

    result.forEach((state_, colIdx) => {
      setTimeout(() => {
        const tile = getTile(rowIdx, colIdx);
        tile.classList.add('flip');

        // Applica colore a metà animazione (quando è "girata")
        setTimeout(() => {
          tile.classList.remove('filled');
          tile.classList.add(state_);
          state.grid[rowIdx][colIdx].state  = state_;
          state.grid[rowIdx][colIdx].letter = guess[colIdx];
        }, delay / 2);

        // Risolve la promise dopo l'ultima tile
        if (colIdx === result.length - 1) {
          setTimeout(resolve, delay);
        }
      }, colIdx * delay);
    });
  });
}

// ════════════════════════════════════════════════════════════
//  AGGIORNA COLORI TASTIERA
// ════════════════════════════════════════════════════════════
function updateKeyStates(guess, result) {
  // Priorità: correct > present > absent
  const priority = { correct: 3, present: 2, absent: 1 };

  result.forEach((res, i) => {
    const letter   = guess[i];
    const current  = state.keyStates[letter];
    const currPri  = current ? priority[current] : 0;
    if (priority[res] > currPri) {
      state.keyStates[letter] = res;
    }
  });

  // Aggiorna DOM tastiera
  Object.entries(state.keyStates).forEach(([letter, st]) => {
    const key = document.querySelector(`[data-key="${letter}"]`);
    if (key) {
      key.classList.remove('correct', 'present', 'absent');
      key.classList.add(st);
    }
  });
}

// ════════════════════════════════════════════════════════════
//  SALVA RISULTATO → POST /api/results
// ════════════════════════════════════════════════════════════
async function saveResult(won) {
  try {
    // ── POST /api/results: salva partita nel file JSON sul server ──
    await fetch('/api/results', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player:     state.playerName,
        word:       state.targetWord,
        attempts:   state.currentRow,
        time:       state.elapsedSec,
        difficulty: state.difficulty,
        won
      })
    });
  } catch (err) {
    console.warn('Errore salvataggio risultato:', err);
  }
}

// ════════════════════════════════════════════════════════════
//  SCHERMATA RISULTATO
// ════════════════════════════════════════════════════════════
function showResult(won) {
  // Aggiorna contenuto schermata risultato
  document.getElementById('resultEmoji').textContent  = won ? '🎉' : '😔';
  document.getElementById('resultTitle').textContent  = won ? 'HAI VINTO!' : 'HAI PERSO';
  document.getElementById('resultSubtitle').textContent = won
    ? `Complimenti ${state.playerName}!`
    : `La parola era: ${state.targetWord}`;

  const m = Math.floor(state.elapsedSec / 60);
  const s = state.elapsedSec % 60;
  document.getElementById('resTime').textContent     = `${m}:${s.toString().padStart(2,'0')}`;
  document.getElementById('resAttempts').textContent = `${state.currentRow}/${state.maxAttempts}`;
  document.getElementById('resWord').textContent     = state.targetWord;

  // Costruisce mini-griglia riepilogo
  buildMiniGrid();

  showScreen('result');
}

function buildMiniGrid() {
  const container = document.getElementById('miniGrid');
  container.innerHTML = '';

  state.history.forEach(rowResult => {
    const row = document.createElement('div');
    row.className = 'mini-row';
    rowResult.forEach(res => {
      const tile = document.createElement('div');
      tile.className = `mini-tile ${res}`;
      row.appendChild(tile);
    });
    container.appendChild(row);
  });
}

// ════════════════════════════════════════════════════════════
//  GIOCA ANCORA — resetta e torna al setup
// ════════════════════════════════════════════════════════════
document.getElementById('playAgainBtn').addEventListener('click', () => {
  // Reset selezione difficoltà
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  state.difficulty = null;
  document.getElementById('playerName').value = state.playerName; // Mantiene il nome
  showScreen('setup');
});

// ════════════════════════════════════════════════════════════
//  UTILITÀ DOM
// ════════════════════════════════════════════════════════════
function getTile(row, col) {
  return document.getElementById(`tile-${row}-${col}`);
}

function showMessage(text) {
  const msg = document.getElementById('gameMessage');
  msg.textContent = text;
  msg.classList.remove('hidden');
  // Rimuove e re-aggiunge per resettare animazione CSS
  msg.style.animation = 'none';
  msg.offsetHeight; // Forza reflow
  msg.style.animation = '';
  setTimeout(() => msg.classList.add('hidden'), 2600);
}

function shakeRow(rowIdx) {
  const row = document.getElementById(`row-${rowIdx}`);
  row.classList.add('shake');
  row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}
