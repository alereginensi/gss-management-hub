'use strict';
/**
 * lib/mitrabajo-download.js
 * Lógica de descarga del Excel de mitrabajo.uy.
 * Usable tanto desde el trigger API route (Next.js) como desde el script CLI.
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

/** Crashpad en contenedores necesita HOME + XDG_* escribibles; adduser --system a veces deja HOME inválido. */
function pushWritableChromiumEnv() {
  const pwHome = path.join(os.tmpdir(), 'pw-mitrabajo');
  fs.mkdirSync(pwHome, { recursive: true });
  const xdgCfg   = path.join(pwHome, '.config');
  const xdgCache = path.join(pwHome, '.cache');
  fs.mkdirSync(xdgCfg, { recursive: true });
  fs.mkdirSync(xdgCache, { recursive: true });
  const bak = {
    HOME: process.env.HOME,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
  };
  process.env.HOME = pwHome;
  process.env.XDG_CONFIG_HOME = xdgCfg;
  process.env.XDG_CACHE_HOME = xdgCache;
  return () => {
    for (const k of ['HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME']) {
      if (bak[k] !== undefined) process.env[k] = bak[k];
      else delete process.env[k];
    }
  };
}

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

/** El sitio redirige a https; usar la misma origen evita cookies / sesión raros. Override: MITRABAJO_BASE_URL */
const BASE_URL =
  (process.env.MITRABAJO_BASE_URL || 'https://www2.mitrabajo.uy').replace(/\/$/, '');
const LOGIN_URL = `${BASE_URL}/index.php?r=site%2Flogin`;
const PANEL_URL = `${BASE_URL}/index.php?r=monitor%2Fmonitor%2Fpanelsupervisor`;

/** networkidle en sitios Yii + AJAX suele no cumplirse nunca; 30s es corto para Railway. */
const NAVIGATION_TIMEOUT_MS = 120000;
const ACTION_TIMEOUT_MS     = 120000;

/** Variantes id/name por Yii / cambios en el sitio; el input puede estar en iframe o no ser "visible" para Playwright. */
const FECHA_DESDE_SELECTORS = [
  '#monitor-fechadesde',
  'input[name="Monitor[fechaDesde]"]',
  'input[name="monitor-fecha_desde"]',
  'input[name*="fechaDesde"]',
  'input[name*="fecha_desde"]',
  '[id*="fechadesde"]',
  '[id*="fecha_desde"]',
];
const FECHA_HASTA_SELECTORS = [
  '#monitor-fechahasta',
  'input[name="Monitor[fechaHasta]"]',
  'input[name="monitor-fecha_hasta"]',
  'input[name*="fechaHasta"]',
  'input[name*="fecha_hasta"]',
  '[id*="fechahasta"]',
  '[id*="fecha_hasta"]',
];

function locatorFromIdOrName(frame, ref) {
  if (!ref) return null;
  if (ref.id) {
    return frame.locator(`[id="${String(ref.id).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
  }
  if (ref.name) {
    return frame.locator(`input[name="${String(ref.name).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
  }
  return null;
}

/**
 * Si no hay #monitor-fechadesde, el Yii puede usar otros name/id o el form no es #panel.
 * Escanea inputs de texto visibles y empareja por texto / orden.
 */
async function tryDomScanPair(frame) {
  const data = await frame.evaluate(() => {
    const root =
      document.querySelector('#panel') ||
      document.querySelector('#w0') ||
      document.querySelector('form') ||
      document.querySelector('.panel-body') ||
      document.body;
    const raw = Array.from(root.querySelectorAll('input'));
    const okType = (t) => {
      const x = (t || 'text').toLowerCase();
      return x === 'text' || x === 'date' || x === '' || x === 'datetime-local';
    };
    const visible = (el) => {
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const inputs = raw.filter((i) => okType(i.type) && visible(i));
    const txt = (el) => `${el.name} ${el.id} ${el.placeholder || ''} ${el.className || ''}`;
    if (inputs.length < 2) {
      return {
        ok: false,
        sample: inputs.map((i) => ({ id: i.id, name: i.name, type: i.type })),
      };
    }
    let desde = inputs.find((el) => /desde|inicio/i.test(txt(el)));
    let hasta = inputs.find((el) => /hasta|fin/i.test(txt(el)) && el !== desde);
    if (!desde || !hasta) {
      const fecha = inputs.filter((el) => /fecha/i.test(txt(el)));
      if (fecha.length >= 2) {
        desde = fecha[0];
        hasta = fecha[1];
      } else {
        desde = inputs[0];
        hasta = inputs[1];
      }
    }
    if (desde === hasta) {
      return { ok: false, sample: inputs.slice(0, 10).map((i) => ({ id: i.id, name: i.name })) };
    }
    const pack = (el) => ({ id: el.id || '', name: el.name || '' });
    return { ok: true, desde: pack(desde), hasta: pack(hasta) };
  });
  if (!data || !data.ok) return { fail: data };
  const desde = locatorFromIdOrName(frame, data.desde);
  const hasta = locatorFromIdOrName(frame, data.hasta);
  if (!desde || !hasta) return { fail: data };
  return { desde, hasta };
}

/**
 * Encuentra los dos inputs de fecha en la página principal o en un iframe (poll hasta timeout).
 * @returns {{ frame: import('playwright').Frame, desde: import('playwright').Locator, hasta: import('playwright').Locator }}
 */
async function waitForFechaInputs(page) {
  let lastFail = null;
  const deadline = Date.now() + NAVIGATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const ld = frame.getByLabel(/desde|fecha\s*desde|inicio/i).first();
        const lh = frame.getByLabel(/hasta|fecha\s*hasta|fin/i).first();
        if ((await ld.count()) > 0 && (await lh.count()) > 0) {
          await ld.waitFor({ state: 'attached', timeout: 15000 });
          await lh.waitFor({ state: 'attached', timeout: 15000 });
          return { frame, desde: ld, hasta: lh };
        }
      } catch (_) {
        /* getByLabel no aplica en este frame */
      }

      let desde = null;
      let hasta = null;
      for (const sel of FECHA_DESDE_SELECTORS) {
        const loc = frame.locator(sel).first();
        const n = await loc.count().catch(() => 0);
        if (n > 0) {
          desde = loc;
          break;
        }
      }
      for (const sel of FECHA_HASTA_SELECTORS) {
        const loc = frame.locator(sel).first();
        const n = await loc.count().catch(() => 0);
        if (n > 0) {
          hasta = loc;
          break;
        }
      }
      if (desde && hasta) {
        await desde.waitFor({ state: 'attached', timeout: 15000 });
        await hasta.waitFor({ state: 'attached', timeout: 15000 });
        return { frame, desde, hasta };
      }

      const scanned = await tryDomScanPair(frame);
      if (scanned && !scanned.fail) {
        await scanned.desde.waitFor({ state: 'attached', timeout: 15000 });
        await scanned.hasta.waitFor({ state: 'attached', timeout: 15000 });
        return { frame, desde: scanned.desde, hasta: scanned.hasta };
      }
      if (scanned && scanned.fail) lastFail = scanned.fail;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  const title = await page.title().catch(() => '?');
  const hint = lastFail ? ` diag=${JSON.stringify(lastFail).slice(0, 700)}` : '';
  throw new Error(
    `No se encontraron campos de fecha (panel cambió o sin permiso). URL=${page.url()} título=${title}${hint}`
  );
}

async function setFechaInput(loc, val) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ clickCount: 3, force: true }).catch(() => {});
  await loc.fill(val, { force: true }).catch(async () => {
    await loc.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (window.jQuery) window.jQuery(el).trigger('change');
    }, val);
  });
  await loc.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) window.jQuery(el).trigger('change');
  }, val);
}

function getYesterday(targetDate) {
  if (targetDate) return targetDate;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatDateForSite(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function convertirXlsAXlsx(srcPath, destPath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(srcPath);
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = 1; row < range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const nextCell = XLSX.utils.encode_cell({ r: row + 1, c: col });
        const currCell = XLSX.utils.encode_cell({ r: row,     c: col });
        if (ws[nextCell]) { ws[currCell] = ws[nextCell]; } else { delete ws[currCell]; }
      }
    }
    for (let col = range.s.c; col <= range.e.c; col++) {
      delete ws[XLSX.utils.encode_cell({ r: range.e.r, c: col })];
    }
    ws['!ref'] = XLSX.utils.encode_range({ ...range, e: { ...range.e, r: range.e.r - 1 } });
  }
  XLSX.writeFile(workbook, destPath, { bookType: 'xlsx' });
}

async function downloadMitrabajo(targetDate, options = {}) {
  loadEnv();

  const user = process.env.MITRABAJO_USER;
  const pass = process.env.MITRABAJO_PASS;
  if (!user || !pass) throw new Error('Faltan MITRABAJO_USER o MITRABAJO_PASS en variables de entorno');

  const fecha     = getYesterday(targetDate);
  const fechaSite = formatDateForSite(fecha);

  const downloadDir = process.env.MITRABAJO_DOWNLOAD_DIR
    ? path.resolve(process.env.MITRABAJO_DOWNLOAD_DIR)
    : path.join(process.cwd(), 'downloads', 'mitrabajo');

  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  console.log(`[mitrabajo] Descargando datos del ${fecha}...`);

  const debug = options.debug || false;

  // Forzar path del browser ANTES de cargar playwright para que lo use en runtime
  // (las variables de nixpacks solo aplican en build, no en runtime de Railway)
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/app/.playwright-browsers';
  }

  const { chromium } = require('playwright');

  const popChromiumEnv = pushWritableChromiumEnv();

  // channel 'chromium' = nuevo headless con Chromium completo (Chrome for Testing).
  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chromium',
      headless: !debug,
      slowMo: debug ? 200 : 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--disable-gpu',
        '--disable-crash-reporter',
        '--disable-breakpad',
      ],
    });
    const context = await browser.newContext({ acceptDownloads: true });
    const page    = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

    // 1. Login
    await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    await page.fill('#loginform-username', user);
    await page.fill('#loginform-password', pass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);
    if (page.url().includes('login')) {
      const msg = await page.locator('.alert, .error, .help-block').first().textContent().catch(() => 'desconocido');
      throw new Error(`Login fallido: ${msg}`);
    }
    console.log('[mitrabajo] Login exitoso.');

    // 2. Panel supervisor (evitar networkidle: muchas páginas nunca quedan "idle")
    await page.goto(PANEL_URL, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    if (page.url().includes('login')) {
      throw new Error('El panel supervisor redirigió al login (sesión o permisos).');
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    // 3–4. Campos de fecha: varios selectores + iframes (visible !== attached en muchos form Yii)
    console.log(`[mitrabajo] Buscando campos de fecha en ${page.url()}...`);
    const { frame, desde, hasta } = await waitForFechaInputs(page);
    console.log(`[mitrabajo] Campos OK (frame url=${frame.url().slice(0, 120)}...)`);

    console.log(`[mitrabajo] Seteando filtro a ${fechaSite}...`);
    await setFechaInput(desde, fechaSite);
    await setFechaInput(hasta, fechaSite);

    // 5. Aplicar filtro (mismo frame que los inputs si aplica)
    let filterBtn = frame
      .locator(
        '#panel button[type="submit"], #panel input[type="submit"], form#panel button[type="submit"], form button[type="submit"]'
      )
      .first();
    if ((await filterBtn.count().catch(() => 0)) === 0) {
      filterBtn = page.locator('#panel button[type="submit"], form button[type="submit"]').first();
    }
    await filterBtn.click({ force: true });
    await page.waitForLoadState('load').catch(() => {});

    // 6. Descargar Excel (mismo iframe que el formulario si existe)
    const excelSelectors = [
      'a[href*="excel"]', 'a[href*="export"]', 'a[href*="xls"]',
      'button:has-text("Excel")', 'button:has-text("Exportar")',
      'a:has-text("Excel")', 'a:has-text("Exportar")',
      '[class*="excel"]', '[class*="export"]',
    ];

    let destPath = null;
    for (const selector of excelSelectors) {
      let el = frame.locator(selector).first();
      if (!(await el.isVisible().catch(() => false))) {
        el = page.locator(selector).first();
      }
      if (!(await el.isVisible().catch(() => false))) continue;
      console.log(`[mitrabajo] Botón encontrado: "${selector}"`);
      const [download] = await Promise.all([page.waitForEvent('download'), el.click()]);
      const suggested = download.suggestedFilename() || `mitrabajo_${fecha}.xls`;
      const ext       = path.extname(suggested) || '.xls';
      const tempPath  = path.join(downloadDir, `_tmp_${fecha}${ext}`);
      await download.saveAs(tempPath);
      destPath = path.join(downloadDir, `mitrabajo_${fecha}.xlsx`);
      convertirXlsAXlsx(tempPath, destPath);
      fs.unlinkSync(tempPath);
      console.log(`[mitrabajo] Guardado: ${destPath}`);
      break;
    }

    if (!destPath) {
      const links = await page.locator('a[href]').evaluateAll(els =>
        els.map(el => ({ text: el.textContent?.trim(), href: el.getAttribute('href') })).filter(l => l.text || l.href)
      );
      console.warn('[mitrabajo] No se encontró botón de Excel. Links:', JSON.stringify(links));
      throw new Error('No se encontró el botón de descarga Excel en la página.');
    }

    return destPath;
  } finally {
    if (browser) await browser.close();
    popChromiumEnv();
  }
}

module.exports = { downloadMitrabajo };
