const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src');
const VISIBLE = new Set(['placeholder', 'title', 'label', 'aria-label', 'alt']);

function read(name) {
  const file = path.join(SRC, 'i18n', name);
  if (!fs.existsSync(file)) return {};
  const code = fs.readFileSync(file, 'utf8');
  const start = code.indexOf('{', code.indexOf('export const'));
  const body = code.slice(start).replace(/\.\.\.enApp\w*,/g, '').replace(/;\s*$/, '');
  return new Function(`return (${body});`)();
}
const dict = ['en-app.ts', 'en-app-2.ts', 'en-app-3.ts', 'en-app-4.ts', 'en-app-5.ts']
  .reduce((acc, name) => ({ ...acc, ...read(name) }), {});
const keys = new Set(Object.keys(dict));

const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = targets.length
  ? targets.map((t) => path.join(SRC, t))
  : (function walk(dir, out = []) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, out);
        else if (e.name.endsWith('.tsx')) out.push(full);
      }
      return out;
    })(SRC);

let missingTotal = 0;
const globalMissing = new Set();
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const missing = [];
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(source).replace(/\s+/g, ' ').trim();
      if (text && !keys.has(text) && !missing.includes(text)) missing.push(text);
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (VISIBLE.has(node.name.getText(source))) {
        const text = node.initializer.text.trim();
        if (text && !keys.has(text) && !missing.includes(text)) missing.push(text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  missingTotal += missing.length;
  missing.forEach((m) => globalMissing.add(m));
  if (missing.length) {
    console.log(`### ${path.relative(SRC, file).replace(/\\/g, '/')} (${missing.length})`);
    missing.forEach((m) => console.log(m));
  }
}
console.log(`\nTOTAL pendientes: ${missingTotal} ocurrencias | ${globalMissing.size} unicas | diccionario: ${keys.size}`);