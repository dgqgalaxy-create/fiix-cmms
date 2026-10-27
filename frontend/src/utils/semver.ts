/** Compara semver a.b.c[-prerelease] → 1 / 0 / -1 */
function parseSemver(value: string): { core: number[]; pre: string[] } {
  const clean = String(value || '').trim().replace(/^v/i, '').split('+')[0];
  const [corePart, ...preParts] = clean.split('-');
  const core = corePart.split('.').map((n) => parseInt(n, 10) || 0);
  const pre = preParts.length ? preParts.join('-').split('.').filter(Boolean) : [];
  return { core, pre };
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  const len = Math.max(pa.core.length, pb.core.length);
  for (let i = 0; i < len; i++) {
    const x = pa.core[i] || 0;
    const y = pb.core[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }

  // Sin prerelease es mayor que con prerelease (1.72.0 > 1.72.0-preview.1).
  if (!pa.pre.length && !pb.pre.length) return 0;
  if (!pa.pre.length) return 1;
  if (!pb.pre.length) return -1;

  const preLen = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < preLen; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;

    const xNumeric = /^\d+$/.test(x);
    const yNumeric = /^\d+$/.test(y);
    if (xNumeric && yNumeric) {
      const nx = Number(x);
      const ny = Number(y);
      if (nx !== ny) return nx > ny ? 1 : -1;
      continue;
    }
    if (xNumeric) return -1;
    if (yNumeric) return 1;

    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}
