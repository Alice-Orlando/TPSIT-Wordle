// ============================================================
//  SPOTIFYCLONE - Server Node.js + Express
//  Progetto didattico: dimostra le principali funzionalità di
//  Node.js ed Express acquisite a lezione.
// ============================================================

// ── 1. IMPORTAZIONE MODULI ──────────────────────────────────
// Node.js ha un sistema di moduli built-in (CommonJS require)
const express = require('express');       // Framework web per Node.js
const path    = require('path');          // Gestione dei percorsi file (cross-platform)
const fs      = require('fs');            // File System: lettura/scrittura file
const crypto  = require('crypto');        // Modulo crittografico built-in (generare ID univoci)

// ── 2. INIZIALIZZAZIONE APP EXPRESS ─────────────────────────
const app  = express();   // Crea l'istanza dell'applicazione Express
const PORT = 3000;        // Porta su cui il server resta in ascolto

// ── 3. PERCORSI FILE ─────────────────────────────────────────
// path.join costruisce percorsi compatibili su tutti i SO (/, \)
const DB_PATH     = path.join(__dirname, 'data', 'db.json');
const PUBLIC_PATH = path.join(__dirname, 'public');

// ── 4. MIDDLEWARE GLOBALI ────────────────────────────────────
// I middleware sono funzioni che intercettano req/res PRIMA del handler finale.
// express.json() è un middleware built-in che parsa il body JSON delle richieste
app.use(express.json());

// express.urlencoded() parsa i dati inviati da form HTML (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// express.static() serve automaticamente i file nella cartella 'public'
// (HTML, CSS, JS client-side, immagini…) senza bisogno di route manuali
app.use(express.static(PUBLIC_PATH));

// ── 5. MIDDLEWARE PERSONALIZZATO (Custom Middleware) ─────────
// Ogni middleware riceve (req, res, next) e deve chiamare next() per passare al successivo
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  // Log di ogni richiesta in entrata (metodo HTTP + URL + timestamp)
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next(); // Passa il controllo al prossimo middleware/route handler
});

// ── 6. HELPER: lettura e scrittura del database JSON ─────────
// Funzioni di utilità per astrarre l'I/O su file

/** Legge il file JSON e restituisce l'oggetto parsato */
function readDB() {
  // fs.readFileSync → lettura sincrona (blocca il thread, ok per piccoli file)
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

/** Sovrascrive il file JSON con i nuovi dati serializzati */
function writeDB(data) {
  // JSON.stringify con indentazione 2 per leggibilità del file
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** Genera un ID univoco usando crypto (UUID-like) */
function generateId() {
  return crypto.randomBytes(8).toString('hex'); // 16 caratteri esadecimali
}

// ── 7. ROUTER EXPRESS ────────────────────────────────────────
// express.Router() crea un mini-router modulare; utile per organizzare le route per dominio
const authRouter      = express.Router();
const playlistRouter  = express.Router();
const songRouter      = express.Router();
const usersRouter     = express.Router();

// ── 8. ROUTE: AUTENTICAZIONE (/api/auth) ─────────────────────
// POST /api/auth/register → crea nuovo utente
authRouter.post('/register', (req, res) => {
  // Destructuring del body (Express lo popola grazie a express.json())
  const { username, password, avatar, bio } = req.body;

  // Validazione: campo obbligatorio
  if (!username || !password) {
    // res.status() imposta il codice HTTP, .json() invia la risposta JSON
    return res.status(400).json({ error: 'Username e password sono obbligatori' });
  }

  const db = readDB();

  // Controllo duplicati (Array.find = ricerca lineare)
  const exists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'Username già in uso' });
  }

  // Crea il nuovo utente
  const newUser = {
    id: generateId(),
    username: username.trim(),
    password,             // ⚠️ In produzione usare bcrypt per hashing!
    avatar: avatar || '🎵',
    bio: bio || '',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  // 201 Created: convenzione REST per risorse create con successo
  res.status(201).json({ message: 'Registrazione avvenuta', user: sanitizeUser(newUser) });
});

// POST /api/auth/login → verifica credenziali
authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Credenziali mancanti' });
  }

  const db   = readDB();
  const user = db.users.find(u => u.username === username && u.password === password);

  if (!user) {
    // 401 Unauthorized: credenziali non valide
    return res.status(401).json({ error: 'Username o password errati' });
  }

  // In questa demo restituiamo direttamente i dati utente (no sessioni server-side).
  // In produzione si userebbero JWT o express-session.
  res.json({ message: 'Login ok', user: sanitizeUser(user) });
});

/** Rimuove la password prima di inviare i dati al client */
function sanitizeUser(user) {
  const { password, ...safe } = user; // Object destructuring con rest operator
  return safe;
}

// ── 9. MIDDLEWARE DI AUTENTICAZIONE ──────────────────────────
// Middleware che protegge le route private: controlla l'header Authorization
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id']; // Header custom per identificare l'utente
  if (!userId) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  const db   = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Utente non trovato' });
  }
  // Attacca l'utente all'oggetto req: i middleware successivi lo trovano lì
  req.currentUser = user;
  next();
}

// ── 10. ROUTE: PLAYLIST (/api/playlists) ─────────────────────

// GET /api/playlists → tutte le playlist (pubbliche, per la sezione "Scopri")
playlistRouter.get('/', (req, res) => {
  const db = readDB();
  // Map per arricchire ogni playlist con le info dell'autore
  const enriched = db.playlists.map(pl => ({
    ...pl,
    author: sanitizeUser(db.users.find(u => u.id === pl.userId) || {})
  }));
  res.json(enriched);
});

// GET /api/playlists/mine → solo le playlist dell'utente loggato (route protetta)
playlistRouter.get('/mine', requireAuth, (req, res) => {
  const db = readDB();
  const mine = db.playlists.filter(pl => pl.userId === req.currentUser.id);
  res.json(mine);
});

// GET /api/playlists/:id → singola playlist (route parametrica con :id)
playlistRouter.get('/:id', (req, res) => {
  // req.params contiene i parametri di percorso (es. :id)
  const { id } = req.params;
  const db = readDB();
  const pl = db.playlists.find(p => p.id === id);
  if (!pl) {
    // 404 Not Found: risorsa inesistente
    return res.status(404).json({ error: 'Playlist non trovata' });
  }
  const author = sanitizeUser(db.users.find(u => u.id === pl.userId) || {});
  res.json({ ...pl, author });
});

// POST /api/playlists → crea nuova playlist (protetta)
playlistRouter.post('/', requireAuth, (req, res) => {
  const { name, subtitle, cover } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Il nome è obbligatorio' });
  }
  const db = readDB();
  const newPlaylist = {
    id:        generateId(),
    userId:    req.currentUser.id,
    name:      name.trim(),
    subtitle:  subtitle?.trim() || '',
    cover:     cover || '🎵',
    songs:     [],            // Array vuoto: le canzoni si aggiungono dopo
    createdAt: new Date().toISOString()
  };
  db.playlists.push(newPlaylist);
  writeDB(db);
  res.status(201).json(newPlaylist);
});

// PUT /api/playlists/:id → modifica playlist (protetta + proprietà verificata)
playlistRouter.put('/:id', requireAuth, (req, res) => {
  const { id }               = req.params;
  const { name, subtitle, cover } = req.body;
  const db = readDB();
  const idx = db.playlists.findIndex(p => p.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Playlist non trovata' });

  // Verifica proprietà: solo il creatore può modificarla
  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' }); // 403 Forbidden
  }

  // Aggiorna solo i campi forniti (Object spread per immutabilità logica)
  db.playlists[idx] = {
    ...db.playlists[idx],
    name:     name     || db.playlists[idx].name,
    subtitle: subtitle !== undefined ? subtitle : db.playlists[idx].subtitle,
    cover:    cover    || db.playlists[idx].cover,
  };

  writeDB(db);
  res.json(db.playlists[idx]);
});

// DELETE /api/playlists/:id → elimina playlist (protetta)
playlistRouter.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const db     = readDB();
  const idx    = db.playlists.findIndex(p => p.id === id);

  if (idx === -1) return res.status(404).json({ error: 'Playlist non trovata' });
  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  db.playlists.splice(idx, 1); // Rimuove 1 elemento all'indice idx
  writeDB(db);
  res.json({ message: 'Playlist eliminata' });
});

// ── 11. ROUTE: CANZONI (/api/playlists/:playlistId/songs) ────

// POST → aggiunge canzone a una playlist
songRouter.post('/', requireAuth, (req, res) => {
  const { playlistId }               = req.params;
  const { title, artist, album, duration, genre } = req.body;

  if (!title || !artist) {
    return res.status(400).json({ error: 'Titolo e artista sono obbligatori' });
  }

  const db  = readDB();
  const idx = db.playlists.findIndex(p => p.id === playlistId);
  if (idx === -1) return res.status(404).json({ error: 'Playlist non trovata' });
  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const newSong = {
    id:       generateId(),
    title:    title.trim(),
    artist:   artist.trim(),
    album:    album?.trim()    || '',
    duration: duration?.trim() || '0:00',
    genre:    genre?.trim()    || 'Altro'
  };

  db.playlists[idx].songs.push(newSong);
  writeDB(db);
  res.status(201).json(newSong);
});

// DELETE → rimuove canzone da una playlist
songRouter.delete('/:songId', requireAuth, (req, res) => {
  const { playlistId, songId } = req.params;
  const db  = readDB();
  const idx = db.playlists.findIndex(p => p.id === playlistId);

  if (idx === -1) return res.status(404).json({ error: 'Playlist non trovata' });
  if (db.playlists[idx].userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const before = db.playlists[idx].songs.length;
  // filter: crea un nuovo array escludendo la canzone da eliminare
  db.playlists[idx].songs = db.playlists[idx].songs.filter(s => s.id !== songId);

  if (db.playlists[idx].songs.length === before) {
    return res.status(404).json({ error: 'Canzone non trovata' });
  }

  writeDB(db);
  res.json({ message: 'Canzone rimossa' });
});

// ── 12. ROUTE: UTENTI (/api/users) ───────────────────────────

// GET /api/users → lista utenti pubblici (senza password)
usersRouter.get('/', (req, res) => {
  const db = readDB();
  // req.query contiene i parametri della query string (?search=...)
  const { search } = req.query;
  let users = db.users.map(sanitizeUser);

  if (search) {
    // Ricerca case-insensitive tramite RegExp
    const re = new RegExp(search, 'i');
    users = users.filter(u => re.test(u.username) || re.test(u.bio));
  }

  res.json(users);
});

// GET /api/users/:userId/playlists → playlist pubbliche di un utente
usersRouter.get('/:userId/playlists', (req, res) => {
  const { userId } = req.params;
  const db = readDB();
  const playlists = db.playlists.filter(p => p.userId === userId);
  res.json(playlists);
});

// ── 13. COLLEGAMENTO DEI ROUTER ALL'APP ──────────────────────
// app.use() monta i router su un prefisso di percorso
app.use('/api/auth',     authRouter);
app.use('/api/playlists', playlistRouter);
// Percorso annidato per le canzoni (express.Router con mergeParams=true per ereditare :playlistId)
app.use('/api/playlists/:playlistId/songs', express.Router({ mergeParams: true }).use('/', songRouter));
app.use('/api/users',    usersRouter);

// ── 14. ROUTE CATCH-ALL ──────────────────────────────────────
// Gestisce tutte le route non definite (404 personalizzato per le API)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.url} non trovato` });
});

// ── 15. ERROR HANDLER GLOBALE ─────────────────────────────────
// Middleware con 4 parametri: Express lo riconosce come error handler
// Viene invocato quando un middleware chiama next(err)
app.use((err, req, res, next) => {
  console.error('[ERRORE]', err.stack);
  res.status(500).json({ error: 'Errore interno del server' });
});

// ── 16. AVVIO DEL SERVER ─────────────────────────────────────
// app.listen() avvia il server HTTP sulla porta specificata
app.listen(PORT, () => {
  console.log(`\n🎵 SpotifyClone Server avviato!`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → DB: ${DB_PATH}\n`);
});
