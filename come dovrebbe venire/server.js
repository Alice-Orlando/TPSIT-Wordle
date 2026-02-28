// ============================================================
//  WORDLE ITALIANO - Server Express.js
//  Progetto didattico - Node.js / Express
// ============================================================

// --- IMPORT DEI MODULI (CommonJS require) ---
const express = require('express');       // Framework web per Node.js
const fs      = require('fs');            // Modulo filesystem di Node.js (built-in)
const path    = require('path');          // Gestione percorsi file (built-in)

// --- CREAZIONE DELL'APP EXPRESS ---
const app  = express();
const PORT = process.env.PORT || 3000;   // Variabile d'ambiente o porta default

// ============================================================
//  MIDDLEWARE (funzioni eseguite ad ogni richiesta)
// ============================================================

// Middleware per il parsing del JSON nel body delle richieste (POST)
app.use(express.json());

// Middleware per il parsing di dati URL-encoded (form HTML tradizionali)
app.use(express.urlencoded({ extended: true }));

// Middleware per servire file statici dalla cartella "public"
// Ogni file in /public è accessibile direttamente (HTML, CSS, JS, immagini)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware personalizzato di logging (eseguito su OGNI richiesta)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next(); // Passa il controllo al prossimo middleware/route
});

// ============================================================
//  PERCORSI FILE
// ============================================================
const WORDS_DIR   = path.join(__dirname, 'words');
const RESULTS_FILE = path.join(__dirname, 'data', 'results.json');

// Assicura che la directory data e il file results.json esistano
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(RESULTS_FILE)) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify([]));
}

// ============================================================
//  FUNZIONI HELPER
// ============================================================

/**
 * Legge le parole dal file corrispondente alla lunghezza scelta.
 * Utilizza fs.readFileSync (I/O sincrono - semplice per file piccoli)
 * @param {number} length - Lunghezza parola (5, 6, 8)
 * @returns {string[]} Array di parole in maiuscolo
 */
function getWords(length) {
  const filePath = path.join(WORDS_DIR, `words_${length}.txt`);
  const content  = fs.readFileSync(filePath, 'utf-8');
  // Split per righe, trim spazi, filtra righe vuote, e filtra per lunghezza esatta
  return content
    .split('\n')
    .map(w => w.trim().toUpperCase())
    .filter(w => w.length === length);
}

/**
 * Sceglie una parola casuale dall'array
 * @param {string[]} words
 * @returns {string}
 */
function getRandomWord(words) {
  return words[Math.floor(Math.random() * words.length)];
}

/**
 * Legge i risultati dal file JSON
 * @returns {Object[]}
 */
function readResults() {
  const data = fs.readFileSync(RESULTS_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Salva i risultati nel file JSON
 * Utilizza fs.writeFileSync per scrittura sincrona
 * @param {Object[]} results
 */
function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

// ============================================================
//  ROUTES - API REST
// ============================================================

/**
 * GET /api/word?difficulty=5|6|8
 * Restituisce una parola casuale per la difficoltà scelta
 * Query parameters: difficulty
 */
app.get('/api/word', (req, res) => {
  // Lettura query parameter con validazione
  const difficulty = parseInt(req.query.difficulty);

  if (![5, 6, 8].includes(difficulty)) {
    // Risposta con status HTTP 400 (Bad Request)
    return res.status(400).json({ error: 'Difficoltà non valida. Usa 5, 6 o 8.' });
  }

  try {
    const words = getWords(difficulty);
    if (words.length === 0) {
      return res.status(500).json({ error: 'Nessuna parola trovata per questa difficoltà.' });
    }
    const word = getRandomWord(words);
    // Risposta JSON con status 200 (default)
    res.json({ word, length: word.length });
  } catch (err) {
    console.error('Errore lettura parole:', err);
    res.status(500).json({ error: 'Errore del server.' });
  }
});

/**
 * POST /api/guess
 * Valida un tentativo del giocatore
 * Body (JSON): { guess: string, target: string }
 * Restituisce per ogni lettera: 'correct', 'present', 'absent'
 */
app.post('/api/guess', (req, res) => {
  // Destrutturazione del body della richiesta
  const { guess, target } = req.body;

  if (!guess || !target || guess.length !== target.length) {
    return res.status(400).json({ error: 'Dati non validi.' });
  }

  const guessUpper  = guess.toUpperCase();
  const targetUpper = target.toUpperCase();

  // Algoritmo di valutazione stile Wordle
  const result   = Array(guessUpper.length).fill('absent');
  const targetArr = targetUpper.split('');
  const guessArr  = guessUpper.split('');

  // Prima passata: lettere corrette nella posizione giusta
  for (let i = 0; i < guessArr.length; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i]    = 'correct';
      targetArr[i] = null; // Marca come usata
      guessArr[i]  = null;
    }
  }

  // Seconda passata: lettere presenti ma in posizione errata
  for (let i = 0; i < guessArr.length; i++) {
    if (guessArr[i] === null) continue;
    const idx = targetArr.indexOf(guessArr[i]);
    if (idx !== -1) {
      result[i]      = 'present';
      targetArr[idx] = null;
    }
  }

  res.json({ result, guess: guessUpper });
});

/**
 * POST /api/results
 * Salva il risultato di una partita
 * Body (JSON): { player, word, attempts, time, difficulty, won }
 */
app.post('/api/results', (req, res) => {
  const { player, word, attempts, time, difficulty, won } = req.body;

  if (!player || !word || attempts === undefined || time === undefined) {
    return res.status(400).json({ error: 'Dati mancanti.' });
  }

  const results = readResults();

  // Nuovo record con timestamp ISO
  const newRecord = {
    id:         Date.now(),           // ID univoco basato su timestamp
    player:     player.trim(),
    word,
    attempts,
    time,                             // Tempo in secondi
    difficulty,
    won,
    date:       new Date().toISOString()
  };

  results.push(newRecord);
  saveResults(results);

  res.status(201).json({ message: 'Risultato salvato!', record: newRecord });
});

/**
 * GET /api/leaderboard
 * Restituisce la classifica ordinata
 * Query params: limit (default 20)
 */
app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  const results = readResults();

  // Filtra solo le partite vinte, ordina per: tentativi ASC, poi tempo ASC
  const sorted = results
    .filter(r => r.won)
    .sort((a, b) => {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts;
      return a.time - b.time;
    })
    .slice(0, limit); // Limita i risultati

  res.json(sorted);
});

/**
 * GET /api/stats
 * Statistiche globali del gioco
 */
app.get('/api/stats', (req, res) => {
  const results = readResults();
  const won     = results.filter(r => r.won);

  res.json({
    totalGames:  results.length,
    totalWins:   won.length,
    winRate:     results.length ? Math.round((won.length / results.length) * 100) : 0,
    avgAttempts: won.length ? (won.reduce((s, r) => s + r.attempts, 0) / won.length).toFixed(1) : 0,
    avgTime:     won.length ? Math.round(won.reduce((s, r) => s + r.time, 0) / won.length) : 0
  });
});

// ============================================================
//  ROUTE DI FALLBACK per SPA (Single Page Application)
//  Reindirizza tutte le richieste non gestite all'index
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
//  GESTIONE ERRORI GLOBALE
//  Middleware con 4 parametri = error handler in Express
// ============================================================
app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err.stack);
  res.status(500).json({ error: 'Errore interno del server.' });
});

// ============================================================
//  AVVIO SERVER
//  app.listen() avvia il server HTTP sulla porta specificata
// ============================================================
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════╗');
  console.log(`║  🟩 WORDLE ITALIANO in ascolto     ║`);
  console.log(`║  http://localhost:${PORT}              ║`);
  console.log('╚════════════════════════════════════╝');
});

// Esporta app per eventuali test (modulo CommonJS)
module.exports = app;
