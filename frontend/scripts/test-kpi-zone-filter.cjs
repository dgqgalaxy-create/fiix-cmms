/**
 * Verifica en un navegador real que el desplegable de zonas de KPIs vuelve a
 * pedir los indicadores con la zona elegida (no solo con las marcadas).
 *
 *   node scripts/test-kpi-zone-filter.cjs
 */
const { spawn } = require('child_process');
const http = require('http');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://127.0.0.1:3100';
const PORT = 9338;

const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => resolve(data));
  }).on('error', reject);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = 'C:\\Users\\Mantenimiento\\AppData\\Local\\Temp\\edge-kpiz-' + Date.now();
  const browser = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile, '--window-size=1500,1000', 'about:blank',
  ], { stdio: 'ignore' });

  let targets = [];
  for (let i = 0; i < 40; i += 1) {
    try {
      targets = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json/list'));
      if (targets.some((t) => t.type === 'page')) break;
    } catch { /* arrancando */ }
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const kpiRequests = [];

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Network.requestWillBeSent' && msg.params && msg.params.request && msg.params.request.url.indexOf('/api/kpis?') >= 0) {
      kpiRequests.push(msg.params.request.url);
    }
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };

  const zoneIdsFrom = (url) => {
    const value = new URL(url).searchParams.get('zoneIds');
    return value ? value.split(',') : [];
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  await send('Page.navigate', { url: APP + '/login' });
  await sleep(3000);
  const login = await ev(
    '(async () => {'
    + " const r = await fetch('" + APP + "/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@fiix.com', password: 'password123' }) });"
    + ' const d = await r.json();'
    + " if (!d.token) return 'SIN_TOKEN';"
    + " localStorage.setItem('token', d.token);"
    + " return 'OK'; })()"
  );
  console.log('login:', login);
  if (login !== 'OK') throw new Error('no se pudo iniciar sesión');

  await send('Page.navigate', { url: APP + '/stats/kpis' });
  await sleep(8000);

  const baseline = kpiRequests.length ? zoneIdsFrom(kpiRequests[kpiRequests.length - 1]) : [];
  console.log('zonas en la ultima peticion inicial: ' + baseline.length);

  const picked = await ev(
    '(async () => {'
    + " const combo = [...document.querySelectorAll('input')].find((el) => el.placeholder === 'Todas las marcadas');"
    + " if (!combo) return 'SIN_COMBO';"
    + ' combo.click();'
    + ' await new Promise((r) => setTimeout(r, 700));'
    + " const option = [...document.querySelectorAll('button')].find((el) => /^L\\d/.test((el.textContent || '').trim()) && el.offsetParent !== null);"
    + " if (!option) return 'SIN_OPCIONES';"
    + ' const name = option.textContent.trim();'
    + ' option.click();'
    + ' await new Promise((r) => setTimeout(r, 3000));'
    + ' return name; })()'
  );
  console.log('zona elegida en el desplegable:', picked);

  const after = kpiRequests.length ? zoneIdsFrom(kpiRequests[kpiRequests.length - 1]) : [];
  console.log('zonas en la ultima peticion tras elegir: ' + after.length);

  const ok = after.length === 1 && baseline.length !== 1;
  console.log('\nRESULTADO: ' + (ok ? 'SI cambia a una sola zona' : 'NO cambio'));

  ws.close();
  browser.kill();
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(2);
});
