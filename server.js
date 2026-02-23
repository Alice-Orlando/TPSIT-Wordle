const fs = require("fs");
const path = require("path");

// === PARAMETRI ===
const lunghezzaDesiderata = 8;
const fileInput = path.join(__dirname, "60000_parole_italiane.txt");
const fileOutput = path.join(__dirname, `parole_${lunghezzaDesiderata}.json`);

// === LETTURA FILE ===
const contenuto = fs.readFileSync(fileInput, "utf8");

// === ELABORAZIONE ===
const parole = contenuto
  .split(/\r?\n/)            // separa per righe
  .map(p => p.trim())        // rimuove spazi
  .filter(p => p.length === lunghezzaDesiderata);

// === SCRITTURA JSON ===
fs.writeFileSync(
  fileOutput,
  JSON.stringify(parole, null, 2),
  "utf8"
);
