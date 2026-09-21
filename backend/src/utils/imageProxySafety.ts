import dns from 'dns';
import net from 'net';
import type { LookupFunction } from 'net';

export const IMAGE_PROXY_LIMITS = { maxBytes: 8 * 1024 * 1024, timeoutMs: 10_000, maxRedirects: 3 };
const denied4 = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],
  ['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3],
] as const) denied4.addSubnet(address, prefix, 'ipv4');
const global6 = new net.BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
const denied6 = new net.BlockList();
for (const [address, prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const) {
  denied6.addSubnet(address, prefix, 'ipv6');
}
/** Solo unicast público; rechaza también IPv4 mapeada y formas IPv6 equivalentes. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) return denied4.check(ip, 'ipv4');
  if (net.isIP(ip) === 6) return !global6.check(ip, 'ipv6') || denied6.check(ip, 'ipv6');
  return true;
}
type Address = { address: string; family: number };
export type UrlCheck = { ok: true; url: URL; addresses: Address[] } | { ok: false; error: string };
export async function assertSafeRemoteUrl(raw: string): Promise<UrlCheck> {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, error: 'URL inválida' }; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return { ok: false, error: 'Solo se permiten URLs http/https sin credenciales' };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || /\.(localhost|local|internal)$/.test(host)) {
    return { ok: false, error: 'Destino no permitido' };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses: Address[] = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await Promise.race([
      dns.promises.lookup(host, { all: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), IMAGE_PROXY_LIMITS.timeoutMs); }),
    ]);
    if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) return { ok: false, error: 'Destino no permitido (red privada o reservada)' };
    return { ok: true, url, addresses };
  } catch { return { ok: false, error: 'No se pudo resolver el host de forma segura' }; }
  finally { if (timer) clearTimeout(timer); }
}
/** El socket usa exclusivamente las IP ya verificadas: no realiza una segunda resolución DNS. */
export function pinnedLookup(addresses: Address[]): LookupFunction {
  if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) throw new Error('IP no permitida');
  const pinned = addresses.map(a => ({ ...a }));
  return ((_host: string, options: { all?: boolean; family?: number }, callback: (...args: any[]) => void) => {
    const candidates = options?.family ? pinned.filter(a => a.family === options.family) : pinned;
    if (!candidates.length) { callback(new Error('Familia de IP no disponible')); return; }
    if (options?.all) callback(null, candidates);
    else callback(null, candidates[0].address, candidates[0].family);
  }) as LookupFunction;
}
export function isImageContentType(value: unknown): boolean {
  return typeof value === 'string' && /^image\/(png|jpeg|gif|webp|avif|bmp|x-icon|vnd.microsoft.icon)(?:;|$)/i.test(value.trim());
}
