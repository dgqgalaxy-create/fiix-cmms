import { BACKEND_URL } from '../api/axios';

/**
 * URL absoluta para /uploads (y otros paths relativos).
 * Añade access_token para que el backend pueda proteger archivos estáticos
 * (las <img> no envían Authorization).
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const rel = path.startsWith('/') ? path : `/${path}`;
  let absolute = `${BACKEND_URL}${rel}`;
  if (!rel.startsWith('/uploads')) return absolute;

  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      const sep = absolute.includes('?') ? '&' : '?';
      absolute = `${absolute}${sep}access_token=${encodeURIComponent(token)}`;
    }
  } catch {
    /* ignore */
  }
  return absolute;
}
