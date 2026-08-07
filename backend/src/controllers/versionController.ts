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

/**
 * Lee frontend/package.json desde GitHub.
 * Repo privado: define GITHUB_TOKEN (classic con `repo` o fine-grained Contents: Read).
 */
async function fetchGithubFrontendVersion(): Promise<{ version: string | null; error?: string }> {
  const repo = (process.env.GITHUB_REPO || 'dgqgalaxy-create/fiix-cmms').trim();
  const branch = (process.env.GITHUB_BRANCH || 'main').trim();
  const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'fiix-cmms-version-check',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // API contents (funciona en privados con token; en públicos también)
    const apiUrl = `https://api.github.com/repos/${repo}/contents/frontend/package.json?ref=${encodeURIComponent(branch)}`;
    const apiRes = await fetch(apiUrl, { signal: controller.signal, headers });

    if (apiRes.status === 404 && !token) {
      return {
        version: null,
        error:
          'Repo privado o ruta no encontrada. Añade GITHUB_TOKEN (Contents: Read) en backend/.env',
      };
    }
    if (apiRes.status === 401 || apiRes.status === 403) {
      return {
        version: null,
        error: 'GitHub rechazó el token (401/403). Revisa GITHUB_TOKEN y permisos Contents: Read',
      };
    }
    if (!apiRes.ok) {
      // Fallback raw (públicos o token con raw)
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/frontend/package.json`;
      const rawHeaders: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'fiix-cmms-version-check',
      };
      if (token) rawHeaders.Authorization = `Bearer ${token}`;
      const rawRes = await fetch(rawUrl, { signal: controller.signal, headers: rawHeaders });
      if (!rawRes.ok) {
        return { version: null, error: `GitHub HTTP ${apiRes.status}` };
      }
      const pkg = (await rawRes.json()) as { version?: string };
      return { version: pkg?.version ? String(pkg.version) : null };
    }

    const body = (await apiRes.json()) as { content?: string; encoding?: string };
    if (!body.content) {
      return { version: null, error: 'Respuesta GitHub sin content' };
    }
    const decoded = Buffer.from(body.content, (body.encoding as BufferEncoding) || 'base64').toString(
      'utf8'
    );
    const pkg = JSON.parse(decoded) as { version?: string };
    return { version: pkg?.version ? String(pkg.version) : null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    return { version: null, error: msg };
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
    const { version: github, error: fetchError } = await fetchGithubFrontendVersion();
    const updateAvailable = github != null && compareSemver(github, deployed) > 0;

    const payload: VersionPayload = {
      deployed,
      github,
      updateAvailable,
      checkedAt: new Date().toISOString(),
      ...(github == null ? { error: fetchError || 'No se pudo consultar GitHub' } : {}),
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
