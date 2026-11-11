/**
 * Extrae textos en español de los .tsx (texto JSX y atributos visibles),
 * los deduplica y reporta cuántos hay por archivo.
 *
 *   node scripts/i18n-extract.js            -> reporte
 *   node scripts/i18n-extract.js --json     -> vuelca i18n-strings.json
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src');
const SPANISH = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/;
const VISIBLE_ATTRS = new Set(['placeholder', 'title', 'label', 'aria-label', 'alt']);
const SKIP_WORDS = /^(http|https|mailto|\/|#)/;
const SKIP_TEXT = /^[\s\d\W]*$/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

function isSpanish(value) {
  const text = String(value).trim();
  if (!text || text.length < 2) return false;
  if (SKIP_TEXT.test(text)) return false;
  if (SKIP_WORDS.test(text)) return false;
  // textos solo técnicos (clases, rutas) no interesan
  if (/^[a-z0-9:_\-\/\.\[\]#%]+$/i.test(text) && !SPANISH.test(text)) return false;
  return SPANISH.test(text) || /[a-z]/.test(text);
}

const files = walk(SRC);
const entries = [];
const byFile = {};

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const found = [];

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(source).replace(/\s+/g, ' ').trim();
      if (text && isSpanish(text) && text.length > 2) found.push({ kind: 'jsx', text });
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(source);
      if (VISIBLE_ATTRS.has(name)) {
        const text = node.initializer.text.trim();
        if (text && isSpanish(text)) found.push({ kind: 'attr', text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (found.length) {
    byFile[rel] = found.length;
    entries.push(...found.map((f) => ({ ...f, file: rel })));
  }
}

const unique = new Map();
for (const entry of entries) {
  const key = entry.text;
  if (!unique.has(key)) unique.set(key, { text: key, count: 0, files: new Set(), kinds: new Set() });
  const record = unique.get(key);
  record.count += 1;
  record.files.add(entry.file);
  record.kinds.add(entry.kind);
}

const ranked = [...unique.values()].sort((a, b) => b.count - a.count);

if (process.argv.includes('--json')) {
  const out = ranked.map((r) => ({
    es: r.text,
    count: r.count,
    files: [...r.files],
    kinds: [...r.kinds],
  }));
  fs.writeFileSync(path.join(__dirname, '..', 'i18n-strings.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log('escrito i18n-strings.json:', out.length, 'cadenas unicas');
} else {
  const total = entries.length;
  console.log('archivos con texto:', Object.keys(byFile).length, 'de', files.length);
  console.log('ocurrencias:', total, '| cadenas unicas:', ranked.length);
  console.log('\nTop 25 cadenas por uso:');
  ranked.slice(0, 25).forEach((r) => console.log(String(r.count).padStart(4), r.text.slice(0, 80)));
  console.log('\nArchivos con más texto:');
  Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([f, n]) => console.log(String(n).padStart(5), f));
  const cumulative = (n) => ranked.slice(0, n).reduce((acc, r) => acc + r.count, 0);
  console.log('\nCobertura por top N cadenas:');
  for (const n of [100, 200, 300, 500, 800]) {
    if (n <= ranked.length) console.log(`  top ${n}: ${Math.round(cumulative(n) / total * 100)}% de las ocurrencias`);
  }
}
