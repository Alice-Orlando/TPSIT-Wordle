//TODO
// ============================================================
//  WORDLE ITALIANO — game.js
//  Logica di gioco lato client
//  Comunica con il server Express tramite fetch() (API REST)
// ============================================================

// --- Layout della tastiera virtuale ---
const RIGHE_TASTIERA = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['INVIO','Z','X','C','V','B','N','M','⌫']
];

// --- Configurazione per ogni difficoltà ---
// Un oggetto è più leggibile di un ternario annidato
const CONFIG = {
  5: { maxTentativi: 6, label: '🌱 FACILE' },
  6: { maxTentativi: 7, label: '🔥 MEDIO'  },
  8: { maxTentativi: 8, label: '💀 DIFFICILE' }
};

// --- Variabili di gioco ---
// Variabili separate invece di un unico oggetto "state" annidato: più facili da leggere
let parolaSegreta   = '';
let nomeGiocatore   = '';
let difficolta      = null;  // 5, 6 o 8
let maxTentativi    = 0;
let rigaCorrente    = 0;     // indice della riga su cui sta giocando
let colonnaCorrente = 0;     // indice della colonna (lettera) corrente
let tentativo       = [];    // array di lettere del tentativo in corso
let colorTasti      = {};    // mappa lettera → 'correct'|'present'|'absent'
let storicoRighe    = [];    // risultati di ogni riga (per la mini-griglia finale)
let partitaFinita   = false;
let timerId         = null;  // ID dell'intervallo del timer
let secondiPassati  = 0;

// --- Riferimenti alle 3 schermate ---
const schermate = {
  setup:     document.getElementById('setupScreen'),
  gioco:     document.getElementById('gameScreen'),
  risultato: document.getElementById('resultScreen')
};

// ============================================================
//  NAVIGAZIONE FRA SCHERMATE
// ============================================================
function mostraSchermata(nome) {
  // Nasconde tutte le schermate, poi mostra quella richiesta
  Object.values(schermate).forEach(s => s.classList.remove('active'));
  schermate[nome].classList.add('active');
}

// ============================================================
//  SETUP — selezione difficoltà
// ============================================================
document.querySelectorAll('.diff-card').forEach(card => {
  card.addEventListener('click', () => {
    // Deseleziona tutte le card, poi seleziona quella cliccata
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    difficolta = parseInt(card.dataset.length);
  });
});

// ============================================================
//  AVVIO PARTITA
// ============================================================
document.getElementById('startBtn').addEventListener('click', avviaPartita);

async function avviaPartita() {
  const nome = document.getElementById('playerName').value.trim();

  // Validazione: nome e difficoltà obbligatori
  if (!nome) {
    mostraErroreSetup('Inserisci il tuo nome!');
    return;
  }
  if (!difficolta) {
    mostraErroreSetup('Seleziona una difficoltà!');
    return;
  }

  document.getElementById('setupError').classList.add('hidden');
  nomeGiocatore = nome;
  maxTentativi  = CONFIG[difficolta].maxTentativi;

  try {
    // GET /api/word?difficulty=5|6|8 → il server legge il file .txt e risponde con una parola
    const risposta = await fetch(`/api/word?difficulty=${difficolta}`);
    const dati     = await risposta.json();

    if (!risposta.ok) throw new Error(dati.error || 'Errore server');

    parolaSegreta = dati.word;

    // Resetta le variabili di gioco per una nuova partita
    rigaCorrente    = 0;
    colonnaCorrente = 0;
    tentativo       = [];
    colorTasti      = {};
    storicoRighe    = [];
    partitaFinita   = false;
    secondiPassati  = 0;

    // Costruisce la griglia e la tastiera nel DOM
    costruisciGriglia();
    costruisciTastiera();

    // Aggiorna le info nell'header di gioco
    document.getElementById('diffBadge').textContent    = CONFIG[difficolta].label;
    document.getElementById('playerDisplay').textContent = nomeGiocatore;
    document.getElementById('attemptsDisplay').textContent = `0/${maxTentativi}`;

    avviaTimer();
    mostraSchermata('gioco');

  } catch (errore) {
    mostraErroreSetup('Errore: ' + errore.message);
  }
}

function mostraErroreSetup(messaggio) {
  const el = document.getElementById('setupError');
  el.textContent = messaggio;
  el.classList.remove('hidden');
}

// ============================================================
//  COSTRUZIONE GRIGLIA (DOM)
// ============================================================
function costruisciGriglia() {
  const griglia = document.getElementById('grid');
  griglia.innerHTML = '';

  // Tile più piccole per le parole da 8 lettere
  document.documentElement.style.setProperty('--tile-size', difficolta >= 8 ? '44px' : '58px');

  for (let r = 0; r < maxTentativi; r++) {
    const riga = document.createElement('div');
    riga.className = 'grid-row';
    riga.id = `row-${r}`;

    for (let c = 0; c < difficolta; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;
      riga.appendChild(tile);
    }
    griglia.appendChild(riga);
  }
}

// ============================================================
//  COSTRUZIONE TASTIERA VIRTUALE (DOM)
// ============================================================
function costruisciTastiera() {
  const tastiera = document.getElementById('keyboard');
  tastiera.innerHTML = '';

  RIGHE_TASTIERA.forEach(riga => {
    const rigaDiv = document.createElement('div');
    rigaDiv.className = 'kb-row';

    riga.forEach(tasto => {
      const btn = document.createElement('button');
      btn.className  = 'kb-key';
      btn.textContent = tasto;
      btn.dataset.key = tasto;

      if (tasto === 'INVIO' || tasto === '⌫') btn.classList.add('wide');

      btn.addEventListener('click', () => gestisciTasto(tasto));
      rigaDiv.appendChild(btn);
    });

    tastiera.appendChild(rigaDiv);
  });
}

// ============================================================
//  TIMER
// ============================================================
function avviaTimer() {
  if (timerId) clearInterval(timerId);  // Ferma un eventuale timer precedente

  const inizio = Date.now();
  timerId = setInterval(() => {
    secondiPassati = Math.floor((Date.now() - inizio) / 1000);
    const m = Math.floor(secondiPassati / 60);
    const s = secondiPassati % 60;
    document.getElementById('timerDisplay').textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function fermaTimer() {
  clearInterval(timerId);
  timerId = null;
}

// ============================================================
//  INPUT — tastiera fisica
// ============================================================
document.addEventListener('keydown', e => {
  // Accetta input solo se la schermata di gioco è attiva
  if (!schermate.gioco.classList.contains('active')) return;

  if (e.key === 'Enter')      gestisciTasto('INVIO');
  else if (e.key === 'Backspace') gestisciTasto('⌫');
  else if (/^[a-zA-Z]$/.test(e.key)) gestisciTasto(e.key.toUpperCase());
});

// Funzione centrale: smista ogni tasto all'azione corretta
function gestisciTasto(tasto) {
  if (partitaFinita) return;

  if (tasto === '⌫')     cancellaLettera();
  else if (tasto === 'INVIO') inviaTentativo();
  else if (/^[A-Z]$/.test(tasto)) aggiungiLettera(tasto);
}

// ============================================================
//  AGGIUNTA / CANCELLAZIONE LETTERE
// ============================================================
function aggiungiLettera(lettera) {
  if (colonnaCorrente >= difficolta) return;  // Riga già piena

  tentativo.push(lettera);

  const tile = getTile(rigaCorrente, colonnaCorrente);
  tile.textContent = lettera;
  tile.classList.add('filled', 'pop');
  tile.addEventListener('animationend', () => tile.classList.remove('pop'), { once: true });

  colonnaCorrente++;
}

function cancellaLettera() {
  if (colonnaCorrente <= 0) return;  // Riga già vuota

  colonnaCorrente--;
  tentativo.pop();

  const tile = getTile(rigaCorrente, colonnaCorrente);
  tile.textContent = '';
  tile.classList.remove('filled');
}

// ============================================================
//  INVIO TENTATIVO → POST /api/guess
// ============================================================
async function inviaTentativo() {
  if (colonnaCorrente < difficolta) {
    mostraMessaggio('Parola troppo corta!');
    scuotiRiga(rigaCorrente);
    return;
  }

  const parola = tentativo.join('');

  try {
    // POST /api/guess → il server confronta la parola tentata con quella segreta
    // e risponde con un array tipo: ['correct', 'absent', 'present', ...]
    const risposta = await fetch('/api/guess', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ guess: parola, target: parolaSegreta })
    });
    const dati = await risposta.json();

    // Anima la rivelazione delle tile (aspettiamo che finisca prima di andare avanti)
    await rivelaRiga(rigaCorrente, dati.result, dati.guess);

    storicoRighe.push(dati.result);            // Salva per la mini-griglia finale
    aggiornaTastiera(dati.guess, dati.result); // Colora i tasti usati

    rigaCorrente++;
    colonnaCorrente = 0;
    tentativo       = [];
    document.getElementById('attemptsDisplay').textContent = `${rigaCorrente}/${maxTentativi}`;

    // Controlla se ha vinto (tutte le lettere 'correct')
    const haVinto = dati.result.every(r => r === 'correct');

    if (haVinto) {
      partitaFinita = true;
      fermaTimer();
      mostraMessaggio('🎉 Hai indovinato!');
      setTimeout(() => mostraRisultato(true), 1600);
      salvaRisultato(true);

    } else if (rigaCorrente >= maxTentativi) {
      partitaFinita = true;
      fermaTimer();
      mostraMessaggio(`La parola era: ${parolaSegreta}`);
      setTimeout(() => mostraRisultato(false), 1800);
      salvaRisultato(false);
    }

  } catch (errore) {
    mostraMessaggio('Errore di rete.');
    console.error(errore);
  }
}

// ============================================================
//  ANIMAZIONE RIVELAZIONE RIGA
//  Ogni tile si gira con un ritardo a cascata (300ms l'una)
// ============================================================
function rivelaRiga(riga, risultati, parola) {
  return new Promise(resolve => {
    risultati.forEach((esito, col) => {
      setTimeout(() => {
        const tile = getTile(riga, col);
        tile.classList.add('flip');

        // Applica il colore a metà animazione, quando la tile è "girata di lato"
        setTimeout(() => {
          tile.classList.remove('filled');
          tile.classList.add(esito);  // 'correct', 'present' o 'absent'
        }, 150);

        // Dopo l'ultima tile, risolviamo la Promise per sbloccare il codice che la aspetta
        if (col === risultati.length - 1) setTimeout(resolve, 300);

      }, col * 300);
    });
  });
}

// ============================================================
//  AGGIORNAMENTO COLORI TASTIERA
// ============================================================
function aggiornaTastiera(parola, risultati) {
  risultati.forEach((esito, i) => {
    const lettera = parola[i];
    const colorePrecedente = colorTasti[lettera];

    // Regola di priorità: correct > present > absent
    // Non sovrascriviamo mai uno stato "migliore" con uno peggiore
    if (esito === 'correct'
      || (esito === 'present' && colorePrecedente !== 'correct')
      || !colorePrecedente) {
      colorTasti[lettera] = esito;
    }
  });

  // Applica i colori ai tasti nel DOM
  Object.entries(colorTasti).forEach(([lettera, esito]) => {
    const tasto = document.querySelector(`[data-key="${lettera}"]`);
    if (tasto) {
      tasto.classList.remove('correct', 'present', 'absent');
      tasto.classList.add(esito);
    }
  });
}

// ============================================================
//  SALVATAGGIO RISULTATO → POST /api/results
// ============================================================
async function salvaRisultato(haVinto) {
  try {
    // POST /api/results → il server salva la partita nel file results.json
    await fetch('/api/results', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player:     nomeGiocatore,
        word:       parolaSegreta,
        attempts:   rigaCorrente,
        time:       secondiPassati,
        difficulty: difficolta,
        won:        haVinto
      })
    });
  } catch (errore) {
    console.warn('Risultato non salvato:', errore);
  }
}

// ============================================================
//  SCHERMATA RISULTATO
// ============================================================
function mostraRisultato(haVinto) {
  document.getElementById('resultEmoji').textContent    = haVinto ? '🎉' : '😔';
  document.getElementById('resultTitle').textContent    = haVinto ? 'HAI VINTO!' : 'HAI PERSO';
  document.getElementById('resultSubtitle').textContent = haVinto
    ? `Complimenti ${nomeGiocatore}!`
    : `La parola era: ${parolaSegreta}`;

  const m = Math.floor(secondiPassati / 60);
  const s = secondiPassati % 60;
  document.getElementById('resTime').textContent     = `${m}:${s.toString().padStart(2, '0')}`;
  document.getElementById('resAttempts').textContent = `${rigaCorrente}/${maxTentativi}`;
  document.getElementById('resWord').textContent     = parolaSegreta;

  // Costruisce la mini-griglia colorata con lo storico dei tentativi
  const miniGrid = document.getElementById('miniGrid');
  miniGrid.innerHTML = '';
  storicoRighe.forEach(risultatiRiga => {
    const riga = document.createElement('div');
    riga.className = 'mini-row';
    risultatiRiga.forEach(esito => {
      const tile = document.createElement('div');
      tile.className = `mini-tile ${esito}`;
      riga.appendChild(tile);
    });
    miniGrid.appendChild(riga);
  });

  mostraSchermata('risultato');
}

// ============================================================
//  GIOCA ANCORA
// ============================================================
document.getElementById('playAgainBtn').addEventListener('click', () => {
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  difficolta = null;
  document.getElementById('playerName').value = nomeGiocatore; // Mantiene il nome
  mostraSchermata('setup');
});

// ============================================================
//  FUNZIONI DI SUPPORTO
// ============================================================

// Restituisce l'elemento DOM di una tile specifica
function getTile(riga, col) {
  return document.getElementById(`tile-${riga}-${col}`);
}

// Mostra un messaggio temporaneo nella schermata di gioco
function mostraMessaggio(testo) {
  const msg = document.getElementById('gameMessage');
  msg.textContent = testo;
  msg.classList.remove('hidden');
  // Trick: reset forzato dell'animazione CSS per poterla rieseguire
  msg.style.animation = 'none';
  msg.offsetHeight;        // forza il browser a "ridisegnare" (reflow)
  msg.style.animation = '';
  setTimeout(() => msg.classList.add('hidden'), 2600);
}

// Fa scuotere la riga corrente in caso di parola incompleta
function scuotiRiga(indiceRiga) {
  const riga = document.getElementById(`row-${indiceRiga}`);
  riga.classList.add('shake');
  riga.addEventListener('animationend', () => riga.classList.remove('shake'), { once: true });
}