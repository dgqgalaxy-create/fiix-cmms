/**
 * Aplica el diccionario `en-app.ts` a los .tsx indicados (o a todos con --all):
 * reemplaza texto JSX y atributos visibles por `t('texto en español')` cuando
 * la cadena exacta existe en el diccionario.
 *
 *   node scripts/i18n-apply.cjs src/components/common/DataTable.tsx
 *   node scripts/i18n-apply.cjs --all
 *   node scripts/i18n-apply.cjs --report        (solo reporte de cobertura)
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const VISIBLE_ATTRS = new Set(['placeholder', 'title', 'label', 'aria-label', 'alt']);

// Carga el diccionario desde en-app.ts con una evaluación simple del objeto.
function loadDictionary() {
  const read = (name) => {
    const code = fs.readFileSync(path.join(SRC, 'i18n', name), 'utf8');
    const start = code.indexOf('{', code.indexOf('export const'));
    const body = code.slice(start).replace(/\.\.\.enApp[23],/g, '').replace(/;\s*$/, '');
    return new Function(`return (${body});`)();
  };
  return { ...read('en-app.ts'), ...read('en-app-2.ts'), ...read('en-app-3.ts') };
}
const dict = loadDictionary();
const dictKeys = new Set(Object.keys(dict));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function analyze(file) {
  const code = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  let total = 0;

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(source).replace(/\s+/g, ' ').trim();
      if (text) {
        total += 1;
        if (dictKeys.has(text)) edits.push({ start: node.getStart(source), end: node.getEnd(), text });
      }
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(source);
      if (VISIBLE_ATTRS.has(name)) {
        const text = node.initializer.text.trim();
        if (text) {
          total += 1;
          if (dictKeys.has(text)) edits.push({ start: node.initializer.getStart(source), end: node.initializer.getEnd(), text });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return { code, source, edits, total };
}

function ensureHook(code, source) {
  if (code.includes('useI18n()')) return code;
  let insertAt = -1;
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      insertAt = statement.body.getStart(source) + 1;
      break;
    }
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
          && decl.initializer.body && ts.isBlock(decl.initializer.body)) {
          insertAt = decl.initializer.body.getStart(source) + 1;
          break;
        }
      }
      if (insertAt >= 0) break;
    }
  }
  if (insertAt < 0) return code;
  return code.slice(0, insertAt) + "\n  const { t } = useI18n();" + code.slice(insertAt);
}

function ensureImport(code) {
  if (code.includes("from '../i18n/I18nProvider'") || code.includes("from './i18n/I18nProvider'") || code.includes("from '../../i18n/I18nProvider'")) {
    return code;
  }
  const depth = 0; // se calcula por archivo
  return code;
}

const run = (files, apply) => {
  let changedFiles = 0;
  let translated = 0;
  let totalStrings = 0;

  for (const file of files) {
    const { code, source, edits, total } = analyze(file);
    totalStrings += total;
    if (!apply || edits.length === 0) {
      if (edits.length) console.log(`${String(edits.length).padStart(3)}/${String(total).padStart(3)}  ${path.relative(SRC, file)}`);
      continue;
    }

    // aplicar de atrás hacia adelante para conservar offsets
    let next = code;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      const key = edit.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      next = next.slice(0, edit.start) + `{t('${key}')}` + next.slice(edit.end);
    }

    // hook e import
    const nextSource = ts.createSourceFile(file, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    next = ensureHook(next, nextSource);
    if (!next.includes('useI18n')) {
      console.log('SIN COMPONENTE para hook:', path.relative(SRC, file));
      continue;
    }
    const rel = path.relative(path.dirname(file), path.join(SRC, 'i18n', 'I18nProvider')).replace(/\\/g, '/');
    const importLine = `import { useI18n } from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
    const lastImport = next.lastIndexOf('\nimport ');
    const importAt = lastImport >= 0 ? next.indexOf('\n', lastImport + 1) + 1 : next.indexOf('\n') + 1;
    next = next.slice(0, importAt) + importLine + next.slice(importAt);

    fs.writeFileSync(file, next, 'utf8');
    changedFiles += 1;
    translated += edits.length;
    console.log(`${String(edits.length).padStart(3)}/${String(total).padStart(3)}  ${path.relative(SRC, file)}  (aplicado)`);
  }

  console.log(`\narchivos modificados: ${changedFiles} | cadenas traducidas: ${translated} de ${totalStrings} visibles`);
};

const args = process.argv.slice(2);

if (args.includes('--complete')) {
  // Aplica solo a los archivos cuya cobertura es total (evita mezclar idiomas).
  const all = walk(SRC);
  const ready = [];
  for (const file of all) {
    const { edits, total } = analyze(file);
    const missing = total - edits.length;
    if (total > 0 && missing === 0) ready.push(file);
  }
  console.log(`archivos 100% traducidos: ${ready.length}`);
  run(ready, true);
  process.exit(0);
}
if (args.includes('--all')) {
  run(walk(SRC), args.includes('--apply'));
} else if (args.includes('--report')) {
  run(walk(SRC), false);
} else {
  const files = args.filter((a) => a.endsWith('.tsx')).map((a) => path.resolve(a));
  run(files, true);
}
