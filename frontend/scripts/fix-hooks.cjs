const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = 'C:/Proyectos/fiix-cmms/frontend/src';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = walk(SRC);
let touched = 0;

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('useI18n')) continue;

  let source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // 1) quitar todas las declaraciones del hook
  const hookRanges = [];
  const collect = (node) => {
    if (ts.isVariableStatement(node) && node.getText(source).includes('useI18n()')) {
      hookRanges.push([node.getStart(source), node.getEnd()]);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  for (const [start, end] of hookRanges.sort((a, b) => b[0] - a[0])) {
    code = code.slice(0, start) + code.slice(end);
  }

  source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // 2) localizar funciones que usan t(...) y marcarlas
  const insertPoints = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
      let parent = node.parent;
      while (parent && !(ts.isFunctionLike(parent) && parent.body && ts.isBlock(parent.body))) {
        parent = parent.parent;
      }
      if (parent && parent.body) insertPoints.add(parent.body.getStart(source) + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (insertPoints.size === 0) {
    // sin usos: quitar import si sobra
    if (!code.includes('useI18n(')) {
      code = code.replace(/^import \{ useI18n \} from .*;\n/m, '');
      fs.writeFileSync(file, code, 'utf8');
      touched += 1;
      console.log('limpiado:', path.relative(SRC, file));
    }
    continue;
  }

  const points = [...insertPoints].sort((a, b) => b - a);
  for (const point of points) {
    code = code.slice(0, point) + "\n  const { t } = useI18n();" + code.slice(point);
  }

  fs.writeFileSync(file, code, 'utf8');
  touched += 1;
  console.log('hook reinsertado:', path.relative(SRC, file), `(${points.length} componente/s)`);
}

console.log('archivos ajustados:', touched);
