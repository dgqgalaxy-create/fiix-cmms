import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

type VersionPayload = {
  deployed: string;
  github: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  error?: string;
};

let cache: { at: number; payload: VersionPayload } | null = null;
const CACHE_MS = 15 * 60 * 1000; // 15 min

function readDeployedVersion(): string {
  const candidates = [
    path.join(__dirname, '../../package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (pkg?.version) return String(pkg.version);
      }
    } catch {
      /* try next */
    }
  }
  return process.env.APP_VERSION || '0.0.0';
}

/** Compara semver simple a.b.c (mayor = 1, igual = 0, menor = -1). */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

async function fetchGithubFrontendVersion(): Promise<string | null> {
  const repo = (process.env.GITHUB_REPO || 'dgqgalaxy-create/fiix-cmms').trim();
  const branch = (process.env.GITHUB_BRANCH || 'main').trim();
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/frontend/package.json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'fiix-cmms-version-check' },
    });
    if (!res.ok) return null;
    const pkg = (await res.json()) as { version?: string };
    return pkg?.version ? String(pkg.version) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const getVersionStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = Date.now();
    if (cache && now - cache.at < CACHE_MS) {
      res.json(cache.payload);
      return;
    }

    const deployed = readDeployedVersion();
    const github = await fetchGithubFrontendVersion();
    const updateAvailable = github != null && compareSemver(github, deployed) > 0;

    const payload: VersionPayload = {
      deployed,
      github,
      updateAvailable,
      checkedAt: new Date().toISOString(),
      ...(github == null ? { error: 'No se pudo consultar GitHub' } : {}),
    };

    cache = { at: now, payload };
    res.json(payload);
  } catch (error) {
    console.error('version status error:', error);
    res.status(500).json({
      deployed: readDeployedVersion(),
      github: null,
      updateAvailable: false,
      checkedAt: new Date().toISOString(),
      error: 'Error interno',
    });
  }
};
