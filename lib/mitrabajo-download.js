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

const BASE_URL  = 'http://www2.mitrabajo.uy';
const LOGIN_URL = `${BASE_URL}/index.php?r=site%2Flogin`;
const PANEL_URL = `${BASE_URL}/index.php?r=monitor%2Fmonitor%2Fpanelsupervisor`;

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

    // 1. Login
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    await page.fill('#loginform-username', user);
    await page.fill('#loginform-password', pass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);
    if (page.url().includes('login')) {
      const msg = await page.locator('.alert, .error, .help-block').first().textContent().catch(() => 'desconocido');
      throw new Error(`Login fallido: ${msg}`);
    }
    console.log('[mitrabajo] Login exitoso.');

    // 2. Panel supervisor
    await page.goto(PANEL_URL, { waitUntil: 'networkidle' });

    // 3. Setear fechaDesde y fechaHasta
    console.log(`[mitrabajo] Seteando filtro a ${fechaSite}...`);
    for (const fieldId of ['#monitor-fechadesde', '#monitor-fechahasta']) {
      const input = page.locator(fieldId);
      await input.click({ clickCount: 3 });
      await input.fill(fechaSite);
      await input.evaluate((el, val) => {
        el.value = val;
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.jQuery) window.jQuery(el).trigger('change');
      }, fechaSite);
    }

    // 4. Aplicar filtro
    const filterBtn = page.locator('#panel button[type="submit"], #panel input[type="submit"]').first();
    await Promise.all([page.waitForLoadState('networkidle'), filterBtn.click()]);

    // 5. Descargar Excel
    const excelSelectors = [
      'a[href*="excel"]', 'a[href*="export"]', 'a[href*="xls"]',
      'button:has-text("Excel")', 'button:has-text("Exportar")',
      'a:has-text("Excel")', 'a:has-text("Exportar")',
      '[class*="excel"]', '[class*="export"]',
    ];

    let destPath = null;
    for (const selector of excelSelectors) {
      const el = page.locator(selector).first();
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
