/**
 * Prueba de humo del cambio de idioma con un navegador real (CDP).
 * Inicia sesión, cambia a inglés y comprueba que la app responde en páginas
 * normales y pesadas (no se queda en «Cargando…»).
 *
 *   node scripts/test-i18n-runtime.cjs
 */
const { spawn } = require('child_process');
const http = require('http');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://127.0.0.1:3100';
const PORT = 9333;

const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => resolve(data));
  }).on('error', reject);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = 'C:\\Users\\Mantenimiento\\AppData\\Local\\Temp\\edge-cdp-' + Date.now();
  const browser = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' });

  let targets = [];
  for (let i = 0; i < 40; i += 1) {
    try {
      targets = JSON.parse(await get('http://127.0.0.1:' + PORT + '/json/list'));
      if (targets.some((t) => t.type === 'page')) break;
    } catch { /* aún arrancando */ }
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no se pudo abrir la página');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  const setLanguage = async (language) => evaluate(
    '(async () => {'
    + " const token = localStorage.getItem('token');"
    + " await fetch('" + APP + "/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ language: '" + language + "' }) });"
    + " localStorage.setItem('gtz_language', '" + language + "');"
    + " return 'ok'; })()"
  );

  const check = async (label) => {
    const started = Date.now();
    const text = await evaluate('document.body.innerText.slice(0, 300)');
    const elapsed = Date.now() - started;
    const responsive = elapsed < 3000;
    const loading = /^(Cargando|Loading)/i.test(text.trim()) && text.length < 60;
    console.log('\n[' + label + '] ' + elapsed + ' ms · ' + (responsive ? 'RESPONDE' : 'CONGELADO') + (loading ? ' · EN CARGA' : ''));
    console.log('  ' + text.replace(/\s+/g, ' ').slice(0, 170));
    return { responsive, loading, text, elapsed };
  };

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: APP + '/login' });
  await sleep(3500);

  const login = await evaluate(
    '(async () => {'
    + " const res = await fetch('" + APP + "/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@fiix.com', password: 'password123' }) });"
    + ' const data = await res.json();'
    + " if (!data.token) return 'SIN_TOKEN';"
    + " localStorage.setItem('token', data.token);"
    + " return 'OK'; })()"
  );
  console.log('login:', login);
  if (login !== 'OK') throw new Error('no se pudo iniciar sesión');

  await setLanguage('es');
  await send('Page.navigate', { url: APP + '/dashboard' });
  await sleep(6000);
  await check('español');

  await setLanguage('en');
  await send('Page.navigate', { url: APP + '/dashboard' });
  await sleep(7000);
  const after = await check('inglés');

  const heavy = [];
  for (const path of ['/manual', '/stats/kpis', '/inventory', '/roster']) {
    await send('Page.navigate', { url: APP + path });
    await sleep(6500);
    const result = await check('inglés ' + path);
    heavy.push({ path, responsive: result.responsive });
  }

  await setLanguage('es');
  await send('Page.navigate', { url: APP + '/dashboard' });
  await sleep(6000);
  const back = await check('español de nuevo');

  // flujo real: entrar a Configuración y pulsar la tarjeta «English»
  await send('Page.navigate', { url: APP + '/settings' });
  await sleep(5000);
  const clicked = await evaluate(
    '(async () => {'
    + " const buttons = [...document.querySelectorAll('button')];"
    + " const tab = buttons.find((b) => /^Idioma$/.test(b.innerText.trim()));"
    + " if (tab) { tab.click(); await new Promise((r) => setTimeout(r, 800)); }"
    + " const card = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('English'));"
    + " if (!card) return 'SIN_TARJETA';"
    + ' card.click();'
    + " return 'CLICK'; })()"
  );
  console.log('\n[configuración] clic en English: ' + clicked);
  await sleep(8000);
  const afterClick = await check('tras pulsar English');

  console.log('\nRESULTADO');
  console.log('  inglés responde: ' + (after.responsive ? 'SÍ' : 'NO'));
  console.log('  inglés en carga: ' + (after.loading ? 'SÍ' : 'NO'));
  console.log('  volvió a español: ' + (/Inicio|Órdenes|Cargando/.test(back.text) ? 'SÍ' : 'REVISAR'));
  console.log('  páginas pesadas congeladas: ' + heavy.filter((h) => !h.responsive).length);
  console.log('  tras pulsar English responde: ' + (afterClick.responsive ? 'SÍ' : 'NO') + ' · en carga: ' + (afterClick.loading ? 'SÍ' : 'NO'));

  ws.close();
  browser.kill();
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});
