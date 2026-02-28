# 🟩 Wordle Italiano — Progetto Node.js / Express

Gioco di parole ispirato a Wordle, completamente in italiano.
Sviluppato con Node.js ed Express come progetto didattico.

---

## 📁 Struttura del Progetto

```
wordle-italiano/
├── server.js              ← Server Express principale
├── package.json           ← Dipendenze npm
├── public/                ← File statici (serviti da Express)
│   ├── index.html         ← Pagina home (2 pulsanti: gioca / classifica)
│   ├── game.html          ← Pagina di gioco (setup + gioco + risultato)
│   ├── leaderboard.html   ← Pagina classifica
│   ├── style.css          ← Stili CSS (tema retro/arcade)
│   └── game.js            ← Logica di gioco client-side
├── words/                 ← File di testo con le parole
│   ├── words_5.txt        ← Parole da 5 lettere (Facile)
│   ├── words_6.txt        ← Parole da 6 lettere (Medio)
│   └── words_8.txt        ← Parole da 8 lettere (Difficile)
└── data/
    └── results.json       ← Risultati salvati (generato automaticamente)
```

---

## 🚀 Installazione e avvio

```bash
# 1. Entra nella cartella
cd wordle-italiano

# 2. Installa le dipendenze
npm install

# 3. Avvia il server
npm start

# 4. Apri nel browser
# http://localhost:3000
```

---

## 🔌 API REST (Express Routes)

| Metodo | Route              | Descrizione                            |
|--------|--------------------|----------------------------------------|
| GET    | `/api/word`        | Parola casuale (`?difficulty=5|6|8`)   |
| POST   | `/api/guess`       | Valida un tentativo                    |
| POST   | `/api/results`     | Salva risultato partita                |
| GET    | `/api/leaderboard` | Classifica (`?limit=20`)               |
| GET    | `/api/stats`       | Statistiche globali                    |

---

## 🎯 Concetti Node.js/Express utilizzati

- **Express.js**: Framework web, routing, middleware
- **Middleware**: `express.json()`, `express.urlencoded()`, `express.static()`, logging personalizzato
- **fs (filesystem)**: Lettura file `.txt` con `readFileSync`, lettura/scrittura JSON
- **path**: `path.join()` per percorsi cross-platform
- **Query parameters**: `req.query.difficulty`
- **Request body**: `req.body` con destructuring
- **Status HTTP**: `res.status(400).json(...)`, `res.status(201).json(...)`
- **Error handler**: Middleware a 4 parametri `(err, req, res, next)`
- **`process.env.PORT`**: Variabile d'ambiente per la porta
- **`module.exports`**: Esportazione per testing
- **Algoritmo Wordle**: Doppia passata per correct/present/absent

---

## 🎮 Come si gioca

1. **Home**: Scegli "Gioca" o "Classifica"
2. **Setup**: Inserisci il tuo nome e la difficoltà:
   - 🌱 **Facile**: parole da 5 lettere, 6 tentativi
   - 🔥 **Medio**: parole da 6 lettere, 7 tentativi
   - 💀 **Difficile**: parole da 8 lettere, 8 tentativi
3. **Gioco**: Indovina la parola usando la tastiera virtuale o fisica
   - 🟩 Verde = lettera corretta nella posizione giusta
   - 🟨 Giallo = lettera presente ma posizione errata
   - ⬛ Grigio = lettera non presente
4. **Risultato**: Vedi tempo, tentativi e accedi alla classifica

---

## 📊 Classifica

La classifica si basa sulle **partite vinte**, ordinate per:
1. Meno tentativi usati
2. Meno tempo impiegato (in caso di parità)

I risultati vengono salvati in `data/results.json`.
