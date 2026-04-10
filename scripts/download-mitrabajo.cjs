/**
 * download-mitrabajo.cjs
 *
 * Descarga automática del Excel del panel supervisor de mitrabajo.uy.
 * Usa Playwright (Chromium headless) para manejar login con CSRF y sesión.
 *
 * Uso manual:
 *   node scripts/download-mitrabajo.cjs              → descarga fecha de ayer
 *   node scripts/download-mitrabajo.cjs 2026-04-08   → descarga fecha específica
 *
 * Variables de entorno requeridas (en .env.local):
 *   MITRABAJO_USER     → usuario del portal
 *   MITRABAJO_PASS     → contraseña del portal
 *   MITRABAJO_DOWNLOAD_DIR → carpeta destino (opcional, default: downloads/mitrabajo)
 */

'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Cargar .env.local manualmente (no tenemos dotenv garantizado)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const BASE_URL = 'http://www2.mitrabajo.uy';
const LOGIN_URL = `${BASE_URL}/index.php?r=site%2Flogin`;
const PANEL_URL = `${BASE_URL}/index.php?r=monitor%2Fmonitor%2Fpanelsupervisor`;

function getYesterday(targetDate) {
  if (targetDate) return targetDate;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDateForSite(isoDate) {
  // Convierte YYYY-MM-DD → DD/MM/YYYY (formato uruguayo)
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function convertirXlsAXlsx(srcPath, destPath, fecha) {
  const workbook = XLSX.readFile(srcPath);

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Eliminar fila 2 (índice 1, base 0) — fila vacía por bug del sitio
    // Desplazar todas las celdas de fila 3 en adelante una posición hacia arriba
    for (let row = 1; row < range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const nextCell = XLSX.utils.encode_cell({ r: row + 1, c: col });
        const currCell = XLSX.utils.encode_cell({ r: row,     c: col });
        if (ws[nextCell]) {
          ws[currCell] = ws[nextCell];
        } else {
          delete ws[currCell];
        }
      }
    }
    // Limpiar última fila que quedó duplicada
    for (let col = range.s.c; col <= range.e.c; col++) {
      delete ws[XLSX.utils.encode_cell({ r: range.e.r, c: col })];
    }
    // Actualizar rango
    ws['!ref'] = XLSX.utils.encode_range({ ...range, e: { ...range.e, r: range.e.r - 1 } });
  }

  XLSX.writeFile(workbook, destPath, { bookType: 'xlsx' });
}

async function downloadMitrabajo(targetDate) {
  const user = process.env.MITRABAJO_USER;
  const pass = process.env.MITRABAJO_PASS;

  if (!user || !pass) {
    console.error('[mitrabajo] ERROR: faltan MITRABAJO_USER o MITRABAJO_PASS en .env.local');
    process.exit(1);
  }

  const fecha = getYesterday(targetDate);
  const fechaSite = formatDateForSite(fecha);

  // Carpeta destino
  const downloadDir = process.env.MITRABAJO_DOWNLOAD_DIR
    ? path.resolve(process.env.MITRABAJO_DOWNLOAD_DIR)
    : path.join(__dirname, '..', 'downloads', 'mitrabajo');

  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  console.log(`[mitrabajo] Iniciando descarga para fecha: ${fecha}`);

  const debug = process.argv.includes('--debug');
  const browser = await chromium.launch({ headless: !debug, slowMo: debug ? 200 : 0 });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('[mitrabajo] Navegando al login...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    await page.fill('#loginform-username', user);
    await page.fill('#loginform-password', pass);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);

    // Verificar login exitoso
    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      const errorMsg = await page.locator('.alert, .error, .help-block').first().textContent().catch(() => 'desconocido');
      throw new Error(`Login fallido. Error del sitio: ${errorMsg}`);
    }
    console.log('[mitrabajo] Login exitoso.');

    // 2. Navegar al panel supervisor
    console.log('[mitrabajo] Navegando al panel supervisor...');
    await page.goto(PANEL_URL, { waitUntil: 'networkidle' });

    // 3. Setear fechaDesde y fechaHasta al día anterior (formato DD/MM/YYYY)
    console.log(`[mitrabajo] Seteando filtro de fecha a ${fechaSite}...`);

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
      const actual = await input.inputValue();
      console.log(`[mitrabajo] ${fieldId} → "${actual}"`);
    }

    // Clickear botón de filtro del formulario #panel
    const filterBtn = page.locator('#panel button[type="submit"], #panel input[type="submit"]').first();
    console.log('[mitrabajo] Aplicando filtro...');
    await Promise.all([
      page.waitForLoadState('networkidle'),
      filterBtn.click(),
    ]);

    // 4. Descargar el Excel
    // Busca links de export Excel con selectores comunes
    const excelSelectors = [
      'a[href*="excel"]',
      'a[href*="export"]',
      'a[href*="xls"]',
      'a:has-text("Excel")',
      'a:has-text("Exportar")',
      'a:has-text("Descargar")',
      '[class*="excel"] a',
      '[class*="export"] a',
    ];

    let downloadTriggered = false;

    for (const selector of excelSelectors) {
      const el = page.locator(selector).first();
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;

      const href = await el.getAttribute('href').catch(() => null);
      console.log(`[mitrabajo] Botón de descarga encontrado: "${selector}" → href="${href}"`);

      if (href) {
        // Construir URL completa
        const fullUrl = href.startsWith('http')
          ? href
          : href.startsWith('/')
            ? `${BASE_URL}${href}`
            : `${BASE_URL}/${href}`;

        console.log(`[mitrabajo] Descargando via request directo: ${fullUrl}`);

        // Usar page.request para aprovechar las cookies de sesión ya establecidas
        const response = await page.request.get(fullUrl, { timeout: 90_000 });

        if (!response.ok()) {
          throw new Error(`HTTP ${response.status()} al descargar el archivo`);
        }

        const contentType = response.headers()['content-type'] || '';
        const contentDisp = response.headers()['content-disposition'] || '';
        console.log(`[mitrabajo] Content-Type: ${contentType}`);
        console.log(`[mitrabajo] Content-Disposition: ${contentDisp}`);

        // Detectar extensión por content-type o content-disposition
        let ext = '.xls';
        if (contentType.includes('spreadsheetml')) ext = '.xlsx';
        else if (contentDisp.includes('.xlsx')) ext = '.xlsx';

        const tempPath = path.join(downloadDir, `_tmp_mitrabajo_${fecha}${ext}`);
        const buffer = await response.body();
        fs.writeFileSync(tempPath, buffer);
        console.log(`[mitrabajo] Archivo temporal descargado: ${tempPath} (${buffer.length} bytes)`);

        // Convertir a .xlsx y eliminar fila 2 vacía
        const destPath = path.join(downloadDir, `mitrabajo_${fecha}.xlsx`);
        convertirXlsAXlsx(tempPath, destPath, fecha);
        fs.unlinkSync(tempPath);
        console.log(`[mitrabajo] Archivo convertido y guardado en: ${destPath}`);
        downloadTriggered = true;
        break;
      } else {
        // Sin href — intentar con evento download (fallback para botones JS)
        console.log(`[mitrabajo] Sin href, intentando con evento download (fallback)...`);
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 60_000 }),
          el.click(),
        ]);
        const suggestedName = download.suggestedFilename() || `mitrabajo_${fecha}.xls`;
        const ext = path.extname(suggestedName) || '.xls';
        const tempPath = path.join(downloadDir, `_tmp_mitrabajo_${fecha}${ext}`);
        await download.saveAs(tempPath);
        console.log(`[mitrabajo] Archivo temporal descargado: ${tempPath}`);
        const destPath = path.join(downloadDir, `mitrabajo_${fecha}.xlsx`);
        convertirXlsAXlsx(tempPath, destPath, fecha);
        fs.unlinkSync(tempPath);
        console.log(`[mitrabajo] Archivo convertido y guardado en: ${destPath}`);
        downloadTriggered = true;
        break;
      }
    }

    if (!downloadTriggered) {
      // Listar todos los links como ayuda de diagnóstico
      const allLinks = await page.locator('a[href]').evaluateAll(els =>
        els.map(el => ({ text: el.textContent?.trim(), href: el.getAttribute('href') }))
           .filter(l => l.text || l.href)
      );
      console.warn('[mitrabajo] No se encontró botón de Excel. Links disponibles en la página:');
      allLinks.forEach(l => console.warn(`  - "${l.text}" → ${l.href}`));
    }

  } finally {
    await browser.close();
  }
}

// Punto de entrada — ignorar flags como --debug al parsear la fecha
const targetDate = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || null;
downloadMitrabajo(targetDate).catch(err => {
  console.error('[mitrabajo] ERROR:', err.message);
  process.exit(1);
});
