// ============================================================
//  SPOTIFYCLONE - Server Node.js + Express
// ============================================================

// ── 1. IMPORTAZIONE MODULI ──────────────────────────────────
const express = require('express');   // Framework web
const path    = require('path');      // Gestione percorsi file (cross-platform)
const fs      = require('fs');        // Lettura e scrittura file
const crypto  = require('crypto');    // Generazione ID univoci

// ── 2. INIZIALIZZAZIONE ─────────────────────────────────────
const app  = express();
const PORT = 3000;

// Percorsi ai file del progetto
const DB_PATH     = path.join(__dirname, 'data', 'db.json');
const PUBLIC_PATH = path.join(__dirname, 'public');

// ── 3. MIDDLEWARE ────────────────────────────────────────────
// I middleware sono funzioni che "intercettano" ogni richiesta
// prima che arrivi al gestore finale (route handler).

// Serve automaticamente i file statici della cartella 'public'
app.use(express.static(PUBLIC_PATH));

// Permette di leggere il corpo JSON delle richieste (es. POST)
app.use(express.json());

// Middleware di log: stampa in console ogni richiesta in arrivo
app.use(function(req, res, next) {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// ── 4. FUNZIONI DI UTILITÀ ───────────────────────────────────

// Legge il file db.json e restituisce i dati come oggetto JS
function readDB() {
  const contenuto = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(contenuto);
}

// Sovrascrive il file db.json con i nuovi dati
function writeDB(dati) {
  fs.writeFileSync(DB_PATH, JSON.stringify(dati, null, 2), 'utf-8');
}

// Genera un ID casuale di 16 caratteri esadecimali
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// Rimuove la password prima di inviare i dati utente al client
function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// ── 5. MIDDLEWARE DI AUTENTICAZIONE ─────────────────────────
// Protegge le route private. Il client invia l'ID utente
// nell'header 'X-User-Id'.
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  const db   = readDB();
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.status(401).json({ error: 'Utente non trovato' });
  }

  // Aggiunge l'utente alla richiesta: le route successive possono usare req.currentUser
  req.currentUser = user;
  next();
}

// ── 6. ROUTE: AUTENTICAZIONE ─────────────────────────────────

// POST /api/auth/register → crea un nuovo utente
app.post('/api/auth/register', function(req, res) {
  const { username, password, avatar, bio } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }

  const db = readDB();

  const esiste = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (esiste) {
    return res.status(409).json({ error: 'Username già in uso' });
  }

  const nuovoUtente = {
    id:        generateId(),
    username:  username.trim(),
    password:  password,
    avatar:    avatar || '🎧',
    bio:       bio    || '',
    createdAt: new Date().toISOString()
  };

  db.users.push(nuovoUtente);
  writeDB(db);

  res.status(201).json({ message: 'Registrazione avvenuta', user: sanitizeUser(nuovoUtente) });
});

// POST /api/auth/login → verifica username e password
app.post('/api/auth/login', function(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Credenziali mancanti' });
  }

  const db   = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Username o password errati' });
  }

  res.json({ message: 'Login ok', user: sanitizeUser(user) });
});

// ── 7. ROUTE: PLAYLIST ───────────────────────────────────────

// GET /api/playlists → restituisce tutte le playlist (con info autore)
app.get('/api/playlists', function(req, res) {
  const db = readDB();

  const playlistConAutore = db.playlists.map(function(pl) {
    const autore = db.users.find(u => u.id === pl.userId) || {};
    return { ...pl, author: sanitizeUser(autore) };
  });

  res.json(playlistConAutore);
});

// GET /api/playlists/:id → restituisce una singola playlist
app.get('/api/playlists/:id', function(req, res) {
  const db = readDB();
  const pl = db.playlists.find(p => p.id === req.params.id);

  if (!pl) {
    return res.status(404).json({ error: 'Playlist non trovata' });
  }

  const autore = db.users.find(u => u.id === pl.userId) || {};
  res.json({ ...pl, author: sanitizeUser(autore) });
});

// POST /api/playlists → crea una nuova playlist (richiede login)
app.post('/api/playlists', requireAuth, function(req, res) {
  const { name, subtitle, cover } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Il nome è obbligatorio' });
  }

  const db = readDB();

  const nuovaPlaylist = {
    id:        generateId(),
    userId:    req.currentUser.id,
    name:      name.trim(),
    subtitle:  subtitle ? subtitle.trim() : '',
    cover:     cover || '🎵',
    songs:     [],
    createdAt: new Date().toISOString()
  };

  db.playlists.push(nuovaPlaylist);
  writeDB(db);

  res.status(201).json(nuovaPlaylist);
});

// PUT /api/playlists/:id → modifica una playlist (solo il proprietario)
app.put('/api/playlists/:id', requireAuth, function(req, res) {
  const { name, subtitle, cover } = req.body;
  const db  = readDB();
  const idx = db.playlists.findIndex(p => p.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Playlist non trovata' });
  }

  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  db.playlists[idx] = {
    ...db.playlists[idx],
    name:     name     || db.playlists[idx].name,
    subtitle: subtitle !== undefined ? subtitle : db.playlists[idx].subtitle,
    cover:    cover    || db.playlists[idx].cover
  };

  writeDB(db);
  res.json(db.playlists[idx]);
});

// DELETE /api/playlists/:id → elimina una playlist (solo il proprietario)
app.delete('/api/playlists/:id', requireAuth, function(req, res) {
  const db  = readDB();
  const idx = db.playlists.findIndex(p => p.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Playlist non trovata' });
  }

  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  db.playlists.splice(idx, 1);
  writeDB(db);

  res.json({ message: 'Playlist eliminata' });
});

// ── 8. ROUTE: CANZONI ────────────────────────────────────────

// POST /api/playlists/:playlistId/songs → aggiunge una canzone
app.post('/api/playlists/:playlistId/songs', requireAuth, function(req, res) {
  const { playlistId }                             = req.params;
  const { title, artist, album, duration, genre } = req.body;

  if (!title || !artist) {
    return res.status(400).json({ error: 'Titolo e artista sono obbligatori' });
  }

  const db  = readDB();
  const idx = db.playlists.findIndex(p => p.id === playlistId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Playlist non trovata' });
  }

  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const nuovaCanzone = {
    id:       generateId(),
    title:    title.trim(),
    artist:   artist.trim(),
    album:    album    ? album.trim()    : '',
    duration: duration ? duration.trim() : '0:00',
    genre:    genre    ? genre.trim()    : 'Altro'
  };

  db.playlists[idx].songs.push(nuovaCanzone);
  writeDB(db);

  res.status(201).json(nuovaCanzone);
});

// DELETE /api/playlists/:playlistId/songs/:songId → rimuove una canzone
app.delete('/api/playlists/:playlistId/songs/:songId', requireAuth, function(req, res) {
  const { playlistId, songId } = req.params;
  const db  = readDB();
  const idx = db.playlists.findIndex(p => p.id === playlistId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Playlist non trovata' });
  }

  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const numPrima = db.playlists[idx].songs.length;
  db.playlists[idx].songs = db.playlists[idx].songs.filter(s => s.id !== songId);

  if (db.playlists[idx].songs.length === numPrima) {
    return res.status(404).json({ error: 'Canzone non trovata' });
  }

  writeDB(db);
  res.json({ message: 'Canzone rimossa' });
});

// ── 9. ROUTE: UTENTI ─────────────────────────────────────────

// GET /api/users → lista di tutti gli utenti (senza password)
app.get('/api/users', function(req, res) {
  const db = readDB();
  let utenti = db.users.map(sanitizeUser);

  // Filtro opzionale: /api/users?search=mario
  if (req.query.search) {
    const regex = new RegExp(req.query.search, 'i');
    utenti = utenti.filter(u => regex.test(u.username) || regex.test(u.bio));
  }

  res.json(utenti);
});

// ── 10. GESTIONE ERRORI ──────────────────────────────────────

// Rotta catch-all per le API non trovate
app.use('/api/*', function(req, res) {
  res.status(404).json({ error: 'Endpoint non trovato: ' + req.method + ' ' + req.url });
});

// Error handler globale (riconosciuto da Express grazie ai 4 parametri)
app.use(function(err, req, res, next) {
  console.error('[ERRORE]', err.stack);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ── 11. AVVIO DEL SERVER ─────────────────────────────────────
app.listen(PORT, function() {
  console.log('\n🎵 SpotifyClone Server avviato!');
  console.log('   → http://localhost:' + PORT);
  console.log('   → DB: ' + DB_PATH + '\n');
});
