// Lê uma cópia do R2 e escreve o SQL que a repõe.
//
//   # tirar a cópia do R2
//   npx wrangler r2 object get gestor-imobiliario/copias/2026-09-01.ndjson.gz \
//     --file copia.ndjson.gz
//
//   # ver o que lá está, sem escrever nada
//   node scripts/restaurar.js copia.ndjson.gz --resumo
//
//   # gerar o SQL e aplicá-lo
//   node scripts/restaurar.js copia.ndjson.gz > repor.sql
//   npx wrangler d1 execute gestor-imobiliario --remote --file repor.sql
//
// Por omissão o SQL só acrescenta o que falta (INSERT OR IGNORE), que é o que
// se quer depois de perder registos. Com --substituir, cada linha da cópia
// passa a mandar sobre a que está na base (INSERT OR REPLACE) — é para repor
// um estado inteiro, e apaga alterações feitas depois da cópia.
//
// Testar primeiro na base de dev:
//   npx wrangler d1 execute gestor-imobiliario-dev --remote --file repor.sql

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const args = process.argv.slice(2);
const ficheiro = args.find((a) => !a.startsWith('--'));
const resumo = args.includes('--resumo');
const substituir = args.includes('--substituir');

if (!ficheiro) {
  console.error('Uso: node scripts/restaurar.js <copia.ndjson.gz> [--resumo] [--substituir]');
  process.exit(1);
}

// Um valor de coluna como literal SQL: NULL, número tal e qual, 0/1 para
// booleanos, X'...' para blobs e texto entre plicas com as plicas dobradas.
// Recebe: v — o valor da coluna (null/undefined, número, booleano, Buffer ou texto).
// Devolve: o literal SQL correspondente (string), pronto a entrar no VALUES.
const cita = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (Buffer.isBuffer(v)) return "X'" + v.toString('hex') + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
};

const entrada = ficheiro.endsWith('.gz')
  ? fs.createReadStream(ficheiro).pipe(zlib.createGunzip())
  : fs.createReadStream(ficheiro);

const contas = {};
let cabecalho = null;
const verbo = substituir ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
const saida = [];

readline.createInterface({ input: entrada, crlfDelay: Infinity })
  .on('line', (linha) => {
    if (!linha.trim()) return;
    let o;
    try { o = JSON.parse(linha); } catch (e) { return; }
    if (o._ === 'gestor-imobiliario') { cabecalho = o; return; }
    if (!o.t || !o.r) return;
    contas[o.t] = (contas[o.t] || 0) + 1;
    if (resumo) return;
    const cols = Object.keys(o.r);
    saida.push(
      verbo + ' INTO "' + o.t + '" (' + cols.map((c) => '"' + c + '"').join(', ') +
      ') VALUES (' + cols.map((c) => cita(o.r[c])).join(', ') + ');'
    );
  })
  .on('close', () => {
    const total = Object.values(contas).reduce((a, b) => a + b, 0);
    if (resumo) {
      console.log('Cópia de ' + ((cabecalho && cabecalho.data) || 'data desconhecida'));
      Object.keys(contas).sort().forEach((t) => {
        console.log('  ' + t.padEnd(18) + String(contas[t]).padStart(7) + ' registos');
      });
      console.log('  ' + 'total'.padEnd(18) + String(total).padStart(7) + ' registos');
      return;
    }
    console.log('-- Reposição a partir de ' + ficheiro);
    console.log('-- Cópia de ' + ((cabecalho && cabecalho.data) || '?') + ', ' + total + ' registos');
    console.log('-- Modo: ' + (substituir ? 'substituir o que existe' : 'só acrescentar o que falta'));
    console.log('PRAGMA defer_foreign_keys = true;');
    saida.forEach((l) => console.log(l));
  })
  .on('error', (e) => { console.error('Não deu para ler: ' + e.message); process.exit(1); });
