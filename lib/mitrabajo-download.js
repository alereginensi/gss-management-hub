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
 * Escanea **todos** los `input` del documento (no solo #panel vacío) y relaja visible/tipo.
 */
async function tryDomScanPair(frame) {
  const data = await frame.evaluate(() => {
    /** Todos los input del documento (no solo #panel: a veces #panel está vacío o el form está fuera). */
    const raw = Array.from(document.querySelectorAll('input'));
    const snippet = raw.slice(0, 25).map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type || 'text',
    }));
    const txt = (el) => `${el.name} ${el.id} ${el.placeholder || ''} ${el.className || ''}`;
    const okType = (t) => {
      const x = (t || 'text').toLowerCase();
      return ['text', 'date', '', 'datetime-local', 'search', 'tel', 'month'].includes(x);
    };
    const visible = (el) => {
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      if (st.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const skipType = (t) => {
      const x = (t || 'text').toLowerCase();
      return ['button', 'submit', 'image', 'reset', 'checkbox', 'radio', 'file'].includes(x);
    };

    /** 1) Texto visible (antes fallaba todo si Yii dejaba opacity o tab oculto). */
    let inputs = raw.filter((i) => okType(i.type) && !skipType(i.type) && visible(i));
    /** 2) Mismo pero sin filtro de visibilidad. */
    if (inputs.length < 2) {
      inputs = raw.filter((i) => okType(i.type) && !skipType(i.type));
    }
    /** 3) Cualquier input con nombre/id relacionado a fecha (incl. hidden con name fecha*). */
    if (inputs.length < 2) {
      inputs = raw.filter((i) => {
        if (skipType(i.type)) return false;
        return /fecha|fec|desde|hasta|inicio|fin|monitor|periodo/i.test(txt(i));
      });
    }
    /** 4) Hidden CSRF u otros; si hay dos hidden con fecha en name. */
    if (inputs.length < 2) {
      const hid = raw.filter(
        (i) =>
          (i.type || '').toLowerCase() === 'hidden' &&
          /fecha|desde|hasta|monitor/i.test(`${i.name} ${i.id}`)
      );
      if (hid.length >= 2) inputs = hid;
    }

    if (inputs.length < 2) {
      return {
        ok: false,
        rawCount: raw.length,
        snippet,
        reason: 'few_inputs',
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
      return { ok: false, rawCount: raw.length, snippet, reason: 'duplicate' };
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

/** True si este frame ya tiene el formulario de fechas (no basta con 2 checkboxes de perfil/2FA). */
async function frameHasMonitorForm(frame) {
  return frame
    .evaluate(() => {
      if (document.querySelector('#monitor-fechadesde, #monitor-fechahasta')) return true;
      const inputs = Array.from(document.querySelectorAll('input'));
      const fechaish = (s) => /fecha|desde|hasta|fec|monitor|periodo/i.test(s);
      for (const i of inputs) {
        if (fechaish(`${i.name} ${i.id} ${i.placeholder || ''}`)) return true;
      }
      const textLike = inputs.filter((i) => {
        const t = (i.type || 'text').toLowerCase();
        if (['button', 'submit', 'checkbox', 'radio', 'file', 'image', 'reset'].includes(t)) return false;
        return ['text', 'date', '', 'search', 'tel', 'datetime-local', 'month'].includes(t) || !i.type;
      });
      return textLike.length >= 2;
    })
    .catch(() => false);
}

/**
 * Espera a que el DOM deje de ser solo perfil/2FA y aparezca el monitor (AJAX) o falla con mensaje claro.
 */
async function waitForMonitorFormReady(page) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (await frameHasMonitorForm(frame)) {
        console.log('[mitrabajo] Formulario de monitor / fechas visible en DOM.');
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const detail = await page
    .evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return {
        n: inputs.length,
        snippet: inputs.slice(0, 12).map((i) => ({ id: i.id, name: i.name, type: i.type || 'text' })),
      };
    })
    .catch(() => ({ n: 0, snippet: [] }));
  throw new Error(
    `No apareció el formulario de fechas del panel supervisor (120s). ` +
      `Vi solo ${detail.n} input(s): ${JSON.stringify(detail.snippet).slice(0, 400)}. ` +
      `Causas típicas: usuario **sin rol supervisor** en mitrabajo.uy, o hay que abrir el panel desde otro menú en el sitio. ` +
      `Probá la misma URL en el navegador con el mismo usuario.`
  );
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

/**
 * Guarda el archivo xlsx en la base de datos (PG o SQLite).
 * Mantiene solo los 5 reportes más recientes.
 */
async function saveToDb(fecha, xlsxPath) {
  const { sendMitrabajoEmail } = require('./mitrabajo-mailer.cjs');
  const data = fs.readFileSync(xlsxPath);
  const filename = `mitrabajo_${fecha}.xlsx`;

  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await pool.query(
        `INSERT INTO mitrabajo_files (filename, file_date, data, size)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (file_date) DO UPDATE SET data = EXCLUDED.data, size = EXCLUDED.size, filename = EXCLUDED.filename`,
        [filename, fecha, data, data.length]
      );
      await pool.query(
        `DELETE FROM mitrabajo_files WHERE id NOT IN (
           SELECT id FROM mitrabajo_files ORDER BY file_date DESC LIMIT 5
         )`
      );
      console.log(`[mitrabajo] Guardado en DB (PG): ${filename}`);
      await sendMitrabajoEmail({ ctx: { type: 'pg', pool }, fecha, filename, buffer: data });
    } finally {
      await pool.end();
    }
  } else {
    // SQLite (dev)
    const dbPath = path.join(process.cwd(), 'tickets.db');
    if (fs.existsSync(dbPath)) {
      const Database = require('better-sqlite3');
      const sqlite = new Database(dbPath);
      sqlite.exec(`CREATE TABLE IF NOT EXISTS mitrabajo_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        file_date TEXT NOT NULL UNIQUE,
        data BLOB NOT NULL,
        size INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      sqlite.prepare(
        `INSERT OR REPLACE INTO mitrabajo_files (filename, file_date, data, size) VALUES (?, ?, ?, ?)`
      ).run(filename, fecha, data, data.length);
      sqlite.prepare(
        `DELETE FROM mitrabajo_files WHERE id NOT IN (
           SELECT id FROM mitrabajo_files ORDER BY file_date DESC LIMIT 5
         )`
      ).run();
      console.log(`[mitrabajo] Guardado en DB (SQLite): ${filename}`);
      await sendMitrabajoEmail({ ctx: { type: 'sqlite', sqlite }, fecha, filename, buffer: data });
      sqlite.close();
    }
  }
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

  // Railway/Docker: browsers en /app (ver Dockerfile). En Windows/Mac/Linux local NO forzar
  // esa ruta: si no, Playwright busca \app\... y falla. Solo si existe el directorio en Linux.
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const railBrowsers = '/app/.playwright-browsers';
    try {
      if (process.platform === 'linux' && fs.existsSync(railBrowsers)) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = railBrowsers;
      }
    } catch (_) {
      /* ignore */
    }
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
    console.log('[mitrabajo] Esperando formulario de fechas (AJAX / permisos)...');
    await waitForMonitorFormReady(page);

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

    // 6. Obtener URL de exportación y descargar la respuesta directamente
    // El servidor sirve el XLS como respuesta de navegación (no como "download" del browser)
    // → capturamos la URL del link y hacemos fetch con las cookies de sesión actuales.
    const excelSelectors = [
      'a[href*="export"]', 'a[href*="exportar"]', 'a[href*="excel"]', 'a[href*="xls"]',
      'a:has-text("Excel")', 'a:has-text("Exportar")',
      '[class*="excel"]', '[class*="export"]',
    ];

    let exportUrl = null;
    for (const selector of excelSelectors) {
      let el = frame.locator(selector).first();
      if (!(await el.count().catch(() => 0))) el = page.locator(selector).first();
      if (!(await el.count().catch(() => 0))) continue;
      const href = await el.getAttribute('href').catch(() => null);
      if (href) {
        exportUrl = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`;
        console.log(`[mitrabajo] URL de exportación: ${exportUrl}`);
        break;
      }
    }

    // Fallback: construir URL de exportación conocida (?exportar=1)
    if (!exportUrl) {
      exportUrl = `${PANEL_URL}&exportar=1`;
      console.log(`[mitrabajo] URL de exportación (fallback): ${exportUrl}`);
    }

    // Descargar con las cookies de sesión actuales usando APIRequestContext de Playwright
    const response = await context.request.get(exportUrl, { timeout: ACTION_TIMEOUT_MS });
    if (!response.ok()) {
      throw new Error(`Error al descargar Excel: HTTP ${response.status()} ${response.statusText()}`);
    }
    const buffer = await response.body();
    const tempPath = path.join(downloadDir, `_tmp_${fecha}.xls`);
    fs.writeFileSync(tempPath, buffer);

    const destPath = path.join(downloadDir, `mitrabajo_${fecha}.xlsx`);
    convertirXlsAXlsx(tempPath, destPath);
    fs.unlinkSync(tempPath);
    console.log(`[mitrabajo] Guardado: ${destPath}`);

    // Persist in DB so the file survives container restarts
    await saveToDb(fecha, destPath);

    return destPath;
  } finally {
    if (browser) await browser.close();
    popChromiumEnv();
  }
}

module.exports = { downloadMitrabajo };
