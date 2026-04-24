/**
 * gen-guia-planillas.cjs
 *
 * Genera docs/GUIA_CARGA_PLANILLAS.pdf: guía para usuarios no-programadores
 * sobre cómo cargar planillas en Operaciones Limpieza (Editor de Planillas +
 * Informes Operativos + dependencia crítica entre ambos pasos).
 *
 * Uso:
 *   npm run docs:guia-planillas
 *   (o: node scripts/gen-guia-planillas.cjs)
 *
 * Requisitos: Playwright (ya en deps por Mitrabajo).
 */

'use strict';

const path = require('path');
const fs = require('fs');

const OUT_PATH = path.join(__dirname, '..', 'docs', 'GUIA_CARGA_PLANILLAS.pdf');

// ── Icons (lucide-react SVG paths, MIT) ──────────────────────────────────────

const ICON = (svg, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon ${extra}">${svg}</svg>`;

const icons = {
  settings: ICON(`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`),
  upload: ICON(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`),
  fileText: ICON(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`),
  plus: ICON(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`),
  arrowRight: ICON(`<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`),
  alert: ICON(`<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`),
  check: ICON(`<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>`),
  save: ICON(`<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`),
  trash: ICON(`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`),
  edit: ICON(`<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>`),
  users: ICON(`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`),
  layers: ICON(`<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`),
};

const today = new Date().toLocaleDateString('es-UY', { day: '2-digit', month: 'long', year: 'numeric' });
const version = '1.0';

// ── HTML ─────────────────────────────────────────────────────────────────────

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Guía de carga de planillas — Operaciones Limpieza</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1f2937;
    font-size: 10.5pt;
    line-height: 1.55;
    background: white;
  }
  .page {
    padding: 0 0 24pt;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* ── Colores GSS ───────────────────────────────────────────────────────── */
  .primary { color: #29416b; }
  .accent  { color: #e04951; }
  .muted   { color: #6b7280; }

  h1 { font-size: 22pt; color: #29416b; margin: 0 0 8pt; font-weight: 700; letter-spacing: -0.01em; }
  h2 { font-size: 15pt; color: #29416b; margin: 18pt 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid #e04951; font-weight: 700; }
  h3 { font-size: 12pt; color: #1f2937; margin: 12pt 0 4pt; font-weight: 600; }
  h4 { font-size: 10.5pt; color: #29416b; margin: 10pt 0 2pt; font-weight: 600; }
  p  { margin: 4pt 0; }
  ul, ol { margin: 4pt 0; padding-left: 18pt; }
  li { margin: 2pt 0; }
  code { background: #f3f4f6; padding: 1pt 4pt; border-radius: 2pt; font-family: "Consolas", "SF Mono", Menlo, monospace; font-size: 9.5pt; color: #111827; }
  strong { font-weight: 600; color: #111827; }

  /* ── Icons ─────────────────────────────────────────────────────────────── */
  .icon { width: 14pt; height: 14pt; vertical-align: -3pt; margin-right: 3pt; color: #29416b; }
  .icon-sm { width: 11pt; height: 11pt; }
  .icon-red { color: #e04951; }
  .icon-green { color: #276749; }
  .icon-amber { color: #92400e; }
  .icon-big { width: 22pt; height: 22pt; }

  /* ── Portada ───────────────────────────────────────────────────────────── */
  .cover {
    min-height: 92vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 40pt 30pt;
    background: linear-gradient(180deg, #29416b 0%, #1e3355 100%);
    color: white;
  }
  .cover .logo-box {
    background: white;
    color: #29416b;
    padding: 16pt 28pt;
    font-size: 24pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-bottom: 32pt;
    border-bottom: 4pt solid #e04951;
  }
  .cover h1 { color: white; font-size: 28pt; margin: 8pt 0; }
  .cover .subtitle { font-size: 14pt; opacity: 0.9; margin: 6pt 0; }
  .cover .target { font-size: 11pt; opacity: 0.75; margin-top: 20pt; letter-spacing: 0.02em; text-transform: uppercase; }
  .cover .meta { font-size: 10pt; opacity: 0.7; margin-top: 40pt; }

  /* ── Contenedores con color ────────────────────────────────────────────── */
  .callout {
    border-left: 4pt solid #29416b;
    background: #f0f4fa;
    padding: 10pt 14pt;
    margin: 10pt 0;
    border-radius: 0 4pt 4pt 0;
  }
  .callout.warning { border-left-color: #e04951; background: #fef2f2; }
  .callout.success { border-left-color: #276749; background: #f0fdf4; }
  .callout.amber   { border-left-color: #d97706; background: #fffbeb; }
  .callout p:first-child { margin-top: 0; }
  .callout p:last-child  { margin-bottom: 0; }

  /* ── Pasos numerados ───────────────────────────────────────────────────── */
  .step {
    display: grid;
    grid-template-columns: 30pt 1fr;
    gap: 10pt;
    margin: 10pt 0;
    align-items: start;
  }
  .step-num {
    background: #29416b;
    color: white;
    width: 26pt;
    height: 26pt;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11pt;
  }
  .step-body { padding-top: 2pt; }
  .step-body > p:first-child { margin-top: 0; font-weight: 600; color: #111827; }

  /* ── Botones y UI elements inline ──────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 4pt;
    padding: 2pt 10pt;
    border-radius: 3pt;
    font-size: 9.5pt;
    font-weight: 600;
    line-height: 1.4;
    vertical-align: middle;
  }
  .btn-primary { background: #29416b; color: white; }
  .btn-red     { background: #e04951; color: white; }
  .btn-outline { border: 1pt solid #29416b; color: #29416b; background: white; }
  .btn-ghost   { border: 1pt solid #e5e7eb; color: #374151; background: white; }

  /* ── Diagrama de dependencia ───────────────────────────────────────────── */
  .flow {
    display: grid;
    grid-template-columns: 1fr 32pt 1fr;
    gap: 0;
    align-items: stretch;
    margin: 14pt 0;
  }
  .flow-box {
    border: 2pt solid #29416b;
    border-radius: 4pt;
    padding: 14pt 16pt;
    background: #f0f4fa;
  }
  .flow-box.b2 {
    border-color: #e04951;
    background: #fef2f2;
  }
  .flow-box .num {
    display: inline-block;
    background: #29416b;
    color: white;
    width: 22pt;
    height: 22pt;
    border-radius: 50%;
    text-align: center;
    line-height: 22pt;
    font-weight: 700;
    margin-right: 6pt;
    font-size: 10pt;
  }
  .flow-box.b2 .num { background: #e04951; }
  .flow-box .title { font-weight: 700; color: #29416b; font-size: 12pt; }
  .flow-box.b2 .title { color: #e04951; }
  .flow-box .desc { font-size: 9.5pt; color: #4b5563; margin-top: 4pt; }
  .flow-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #29416b;
  }
  .flow-arrow svg { width: 28pt; height: 28pt; }
  .flow-labels {
    display: grid;
    grid-template-columns: 1fr 32pt 1fr;
    gap: 0;
    margin-top: 6pt;
    font-size: 9pt;
    color: #6b7280;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 600;
  }

  /* ── Tablas ────────────────────────────────────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0;
    font-size: 9.5pt;
  }
  th, td {
    text-align: left;
    padding: 6pt 8pt;
    border-bottom: 1pt solid #e5e7eb;
    vertical-align: top;
  }
  thead th {
    background: #29416b;
    color: white;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-size: 9pt;
    text-transform: uppercase;
  }
  tbody tr:nth-child(even) { background: #f9fafb; }

  /* ── Chips y badges ────────────────────────────────────────────────────── */
  .chip {
    display: inline-block;
    background: #e5e7eb;
    color: #374151;
    padding: 1pt 7pt;
    border-radius: 3pt;
    font-size: 9pt;
    font-weight: 600;
    margin: 1pt 2pt;
  }
  .chip.primary { background: #e0e7f2; color: #29416b; }
  .chip.red { background: #fee2e2; color: #9b2c2c; }

  /* ── Index ────────────────────────────────────────────────────────────── */
  .toc { list-style: none; padding: 0; margin: 10pt 0; }
  .toc li {
    display: flex;
    justify-content: space-between;
    border-bottom: 1pt dotted #d1d5db;
    padding: 4pt 0;
  }
  .toc li span.num { color: #6b7280; margin-right: 6pt; }

  /* ── Footer ────────────────────────────────────────────────────────────── */
  .footer {
    border-top: 2pt solid #29416b;
    padding-top: 8pt;
    margin-top: 22pt;
    font-size: 9pt;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }

  .rule { height: 1pt; background: #e5e7eb; margin: 14pt 0; border: none; }
</style>
</head>
<body>

<!-- ═══ PORTADA ═════════════════════════════════════════════════════════════ -->
<section class="cover page">
  <div class="logo-box">GSS</div>
  <h1>Guía de carga de planillas</h1>
  <p class="subtitle">Operaciones Limpieza</p>
  <p class="target">Para supervisores y responsables de área</p>
  <p class="meta">Versión ${version} · ${today}</p>
</section>

<!-- ═══ ÍNDICE + INTRODUCCIÓN ═══════════════════════════════════════════════ -->
<section class="page" style="padding: 30pt 36pt 0;">

  <h1>Contenido</h1>
  <ul class="toc">
    <li><span><span class="num">1.</span> Panorama general y dependencia entre pasos</span><span>3</span></li>
    <li><span><span class="num">2.</span> Paso 1 — Editor de Planillas (admin)</span><span>4</span></li>
    <li><span><span class="num">3.</span> Paso 2 — Subir planilla al informe operativo</span><span>6</span></li>
    <li><span><span class="num">4.</span> Errores comunes y cómo resolverlos</span><span>8</span></li>
    <li><span><span class="num">5.</span> Roles y permisos</span><span>9</span></li>
    <li><span><span class="num">6.</span> Glosario</span><span>10</span></li>
  </ul>

  <hr class="rule"/>

  <h2>1. Panorama general</h2>

  <p>
    El sistema de <strong>Operaciones Limpieza</strong> maneja la asistencia del personal
    en cada cliente. Para que los <strong>Informes Operativos</strong> diarios
    (esos donde se marca presencia, firma digital y horas) funcionen bien, antes
    hay que decirle al sistema <em>qué clientes existen</em>, <em>qué sectores
    tiene cada cliente</em>, <em>qué turnos hay</em> y <em>qué puestos cubrir</em>.
  </p>

  <p>
    Todo ese "formato" lo carga una única vez un usuario <strong>Administrador</strong>
    desde el <strong>Editor de Planillas</strong>. Recién después, cualquier
    responsable puede subir la planilla Excel del Panel de Mitrabajo al informe
    del día y marcar la asistencia.
  </p>

  <h3>Flujo completo en 2 pasos</h3>

  <div class="flow">
    <div class="flow-box">
      <p><span class="num">1</span> <span class="title">Editor de Planillas</span></p>
      <p class="desc">
        El <strong>Admin</strong> configura <strong>clientes</strong>, <strong>sectores</strong>,
        <strong>turnos</strong> y <strong>puestos</strong>. Por cada puesto define el
        <em>Lugar en sistema</em> — el texto que usa Mitrabajo.
      </p>
    </div>
    <div class="flow-arrow">${icons.arrowRight}</div>
    <div class="flow-box b2">
      <p><span class="num">2</span> <span class="title">Informe Operativo</span></p>
      <p class="desc">
        El <strong>Admin</strong> sube la planilla Excel del Panel de Mitrabajo
        al turno del día, y el supervisor marca la asistencia, hora de entrada
        y firma.
      </p>
    </div>
  </div>
  <div class="flow-labels">
    <div>Prerrequisito</div>
    <div></div>
    <div>Depende del paso 1</div>
  </div>

  <div class="callout warning">
    <p><strong>${icons.alert}Importante:</strong>
      Si el paso 1 <strong>no está completo</strong> para un cliente, el paso 2
      <strong>no funciona</strong>:</p>
    <ul>
      <li>El cliente <strong>no aparece</strong> en el selector de informes.</li>
      <li>Si aparece pero falta el <em>Lugar en sistema</em> de algún puesto, las
          filas del Excel de Mitrabajo <strong>se descartan silenciosamente</strong>
          porque el sistema no puede cruzarlas con un puesto configurado.</li>
    </ul>
  </div>

</section>

<!-- ═══ PASO 1 ════════════════════════════════════════════════════════════ -->
<section class="page" style="padding: 30pt 36pt 0;">
  <h2>2. Paso 1 — Editor de Planillas <span class="muted" style="font-weight: 400; font-size: 11pt;">(admin)</span></h2>

  <h3>Cómo llegar</h3>
  <p>
    Ingresá con tu usuario <strong>admin</strong> →
    En el menú principal <strong>Operaciones Limpieza</strong> →
    Tarjeta <strong>${icons.settings}Editor de Planillas</strong>
    <span class="chip red">solo admin</span>
  </p>
  <p class="muted" style="font-size: 9.5pt;">
    Si tu usuario no es admin, esa tarjeta no aparece. Pedile a alguien con
    rol admin que configure el cliente por vos.
  </p>

  <div class="callout amber">
    <p><strong>${icons.alert}Aviso del sistema que vas a ver:</strong></p>
    <p style="font-style: italic;">
      "Los cambios solo afectan planillas futuras. Los informes ya guardados
      conservan su configuración original. Eliminar un cliente/sector no borra
      los informes históricos — sólo los oculta del selector."
    </p>
    <p>Esto quiere decir que podés hacer cambios tranquilo, los datos viejos
    no se rompen.</p>
  </div>

  <h3>La pantalla tiene 3 bloques, de izquierda a derecha</h3>
  <ol>
    <li><strong>Clientes</strong> (ej: Casmu, Medis…)</li>
    <li><strong>Sectores</strong> del cliente seleccionado (ej: Limpieza, Staff, Seguridad, Tercerizado)</li>
    <li><strong>Turnos y puestos</strong> del sector seleccionado (ej: turno <code>6 A 14</code> con los puestos que lo cubren)</li>
  </ol>

  <h3>Flujo para dar de alta un cliente nuevo</h3>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <p>En el bloque <strong>Clientes</strong>, tipear el nombre (ej: <code>Casmu 2</code>) en el
      input con texto <em>"Nuevo cliente..."</em> y apretar ${icons.plus}.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <p>Hacer click en ese cliente recién creado. El bloque <strong>Sectores</strong>
      se activa a la derecha.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <p>En <strong>Sectores</strong>, tipear el nombre del sector (ej: <code>Limpieza</code>) en
      <em>"Nuevo sector..."</em> y apretar ${icons.plus}. Repetir para cada sector del cliente.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <p>Click en un sector. El bloque <strong>Turnos y puestos</strong> se activa.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">5</div>
    <div class="step-body">
      <p>Agregar un turno: tipear en <em>"Nuevo turno (ej: 6 A 14)..."</em>. Hay
      sugerencias que podés elegir del desplegable:</p>
      <p>
        <span class="chip">6 A 14</span>
        <span class="chip">14 A 22</span>
        <span class="chip">22 A 06</span>
        <span class="chip">12 A 20</span>
        <span class="chip">15 A 23</span>
        <span class="chip">HEMOTERAPIA</span>
      </p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">6</div>
    <div class="step-body">
      <p>Dentro del turno, hacer click en <span class="btn btn-outline">${icons.plus}Puesto</span>
      para agregar cada puesto que se cubre en ese turno. Por cada puesto tenés que
      completar <strong>tres campos</strong>:</p>
      <ul>
        <li><strong>Nombre del puesto</strong> (ej: <code>Asilo</code>) — nombre interno.</li>
        <li><strong>Cantidad</strong> — cuántos funcionarios cubren ese puesto en el turno.</li>
        <li><strong>Lugar en sistema</strong> — <span class="accent"><strong>el campo más importante</strong></span>.
          Es el texto exacto que aparece en el Excel de Mitrabajo (columna <code>Local</code>).
          Ejemplo: <code>Casmu - Asilo - Limpiador</code>.</li>
      </ul>
    </div>
  </div>

  <div class="callout warning">
    <p><strong>${icons.alert}El "Lugar en sistema" tiene que coincidir LITERALMENTE</strong>
    con el texto del Excel de Mitrabajo. Si Mitrabajo escribe <code>"Casmu - Asilo - Limpiador"</code>
    (con espacios a los lados de los guiones) y vos ponés <code>"Casmu-Asilo-Limpiador"</code>
    (sin espacios), el sistema <strong>no los va a cruzar</strong> y esas filas
    se van a descartar cuando subas la planilla.</p>
    <p>Recomendación: abrir el Excel de Mitrabajo, copiar exactamente el valor
    de la columna <code>Local</code>, y pegarlo acá.</p>
  </div>

  <h3>Iconos que vas a ver en esta pantalla</h3>
  <table>
    <thead><tr><th style="width: 80pt;">Ícono</th><th style="width: 120pt;">Qué hace</th><th>Cuándo usarlo</th></tr></thead>
    <tbody>
      <tr><td>${icons.plus}</td><td>Agregar</td><td>Crear un cliente, sector, turno o puesto nuevo</td></tr>
      <tr><td>${icons.edit}</td><td>Editar</td><td>Renombrar un cliente o sector</td></tr>
      <tr><td>${icons.save}</td><td>Guardar</td><td>Confirmar un rename</td></tr>
      <tr><td>${icons.trash}</td><td>Eliminar</td><td>Borrar cliente, sector, turno o puesto. No afecta informes históricos.</td></tr>
    </tbody>
  </table>

  <div class="callout success">
    <p><strong>${icons.check}Cuándo hay que repetir el paso 1:</strong></p>
    <ul>
      <li>Cuando llega un <strong>cliente nuevo</strong>.</li>
      <li>Cuando se abre un <strong>sector nuevo</strong> en un cliente existente.</li>
      <li>Cuando aparece un <strong>puesto nuevo</strong> en Mitrabajo que no tenías mapeado.</li>
      <li>Cuando Mitrabajo <strong>cambia el nombre</strong> del local (hay que actualizar "Lugar en sistema").</li>
    </ul>
  </div>

</section>

<!-- ═══ PASO 2 ═════════════════════════════════════════════════════════════ -->
<section class="page" style="padding: 30pt 36pt 0;">
  <h2>3. Paso 2 — Subir planilla al informe operativo</h2>

  <h3>Cómo llegar</h3>
  <p>
    En el menú <strong>Operaciones Limpieza</strong> →
    Tarjeta <strong>${icons.fileText}Informes Operativos</strong>.
  </p>
  <p class="muted" style="font-size: 9.5pt;">
    Todos los roles de operaciones limpieza entran a esta pantalla. Pero el botón
    de subida de planilla <strong>solo lo ve el admin</strong>.
  </p>

  <h3>Elegir dónde va la planilla</h3>

  <p>Arriba de la pantalla hay 4 selectores. Se rellenan <strong>en cascada</strong>:</p>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <p><strong>Cliente</strong> → elegir de la lista (viene del Editor de Planillas).</p>
      <p class="muted" style="font-size: 9.5pt;">
        Si el cliente que buscás <strong>no aparece</strong>, volvé al paso 1.
      </p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <p><strong>Sector</strong> → la lista se rellena con los sectores del cliente.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <p><strong>Turno</strong> → la lista se rellena con los turnos del sector.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <p><strong>Fecha</strong> → el día al que corresponde el informe.</p>
    </div>
  </div>

  <h3>Subir la planilla Excel (solo admin)</h3>

  <p>
    Con cliente seleccionado, arriba a la derecha aparece el botón
    <span class="btn btn-red">${icons.upload}Subir planilla</span>. Click.
  </p>

  <p>Se abre el modal <strong>"Subir planilla del turno"</strong>:</p>

  <div class="step">
    <div class="step-num">1</div>
    <div class="step-body">
      <p><strong>Archivo del Panel de control (Mitrabajo)</strong> — arrastrar o seleccionar
      el archivo Excel descargado desde Mitrabajo.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">2</div>
    <div class="step-body">
      <p><strong>Categoría por defecto</strong> — elegir una de:</p>
      <p>
        <span class="chip primary">-- Sin categoría --</span>
        <span class="chip primary">LIMPIADOR</span>
        <span class="chip primary">AUXILIAR</span>
        <span class="chip primary">VIDRIERO</span>
        <span class="chip primary">ENCARGADO</span>
      </p>
      <p class="muted" style="font-size: 9.5pt;">Esto categoriza todos los funcionarios que vienen en esta planilla.</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">3</div>
    <div class="step-body">
      <p><strong>Ver preview</strong> — el sistema muestra una previsualización con los stats:</p>
      <p>"Panel de control: <strong>X</strong> filas leídas · <strong>Y</strong> cruzadas · <strong>Z</strong> descartadas"</p>
      <ul>
        <li><strong>Leídas</strong>: total de filas en el Excel.</li>
        <li><strong>Cruzadas</strong>: filas que el sistema pudo matchear con puestos configurados en el editor.</li>
        <li><strong>Descartadas</strong>: filas que <strong>no se van a importar</strong> porque no encontró coincidencia.</li>
      </ul>
    </div>
  </div>

  <div class="step">
    <div class="step-num">4</div>
    <div class="step-body">
      <p><strong>Mapear hoja → Sector destino</strong> si hay más de una hoja en el Excel o si
      el sistema pregunta por el sector, elegí el correcto de la lista (viene del editor).</p>
    </div>
  </div>

  <div class="step">
    <div class="step-num">5</div>
    <div class="step-body">
      <p>Click en <span class="btn btn-primary">${icons.upload}Confirmar importación</span>.
      La tabla del informe se llena con las filas cruzadas.</p>
    </div>
  </div>

  <h3>Columnas que el sistema espera en el Excel de Mitrabajo</h3>
  <table>
    <thead><tr><th>Columna</th><th>Qué es</th></tr></thead>
    <tbody>
      <tr><td><code>Fecha</code></td><td>Día del turno</td></tr>
      <tr><td><code>Local</code></td><td><strong>Clave del cruce</strong> — debe coincidir con "Lugar en sistema" del editor</td></tr>
      <tr><td><code>CI</code></td><td>Cédula del funcionario</td></tr>
      <tr><td><code>Nombre</code></td><td>Nombre del funcionario</td></tr>
      <tr><td><code>Entrada/Salida planificada</code></td><td>Horario planificado</td></tr>
    </tbody>
  </table>

  <div class="callout success">
    <p><strong>${icons.check}Tip:</strong>
    Si ves que <strong>todas las filas están descartadas</strong>, el problema casi seguro
    está en el "Lugar en sistema" del editor — no matchea con la columna <code>Local</code>
    del Excel. Cerrá el modal, volvé al editor, revisá el campo y volvé a intentar.</p>
  </div>

</section>

<!-- ═══ ERRORES COMUNES ════════════════════════════════════════════════════ -->
<section class="page" style="padding: 30pt 36pt 0;">
  <h2>4. Errores comunes y cómo resolverlos</h2>

  <h3>${icons.alert}"No aparece mi cliente en la lista de informes"</h3>
  <p><strong>Causa:</strong> el cliente todavía no está cargado en el <strong>Editor de Planillas</strong>.</p>
  <p><strong>Solución:</strong> pedirle a un admin que siga el <em>Paso 1</em> para ese cliente.
  Mientras no esté en el editor, no vas a poder hacer informes contra ese cliente.</p>

  <h3>${icons.alert}"Todas las filas salieron descartadas"</h3>
  <p><strong>Causa:</strong> el campo <em>"Lugar en sistema"</em> que configuraste en el editor
  NO coincide con la columna <code>Local</code> del Excel de Mitrabajo.</p>
  <p><strong>Solución:</strong></p>
  <ol>
    <li>Abrí el Excel de Mitrabajo en tu compu.</li>
    <li>Copiá un valor cualquiera de la columna <code>Local</code> (ej: <code>Casmu - Asilo - Limpiador</code>).</li>
    <li>Entrá al Editor de Planillas, buscá el puesto correspondiente.</li>
    <li>Pegá <strong>exactamente</strong> ese valor en el campo "Lugar en sistema".</li>
    <li>Guardar y volver a subir la planilla. Ahora debería cruzar.</li>
  </ol>

  <h3>${icons.alert}"No veo el botón Subir planilla"</h3>
  <p><strong>Causa:</strong> tu usuario no es admin. Solo los admin pueden subir la planilla
  inicial que arma el informe.</p>
  <p><strong>Solución:</strong> pedirle a un admin que haga la subida. Después vos sí podés
  marcar asistencia y completar el informe.</p>

  <h3>${icons.alert}"Modifiqué un sector/puesto y los informes viejos cambiaron"</h3>
  <p><strong>Causa:</strong> no pasa — los informes guardados se guardan con "snapshot" de la
  config. Podés cambiar o eliminar clientes y los informes históricos quedan intactos.</p>
  <p><strong>Solución:</strong> ninguna, es el comportamiento esperado. El banner amarillo
  del editor lo aclara.</p>

  <h3>${icons.alert}"El preview dice X filas leídas pero cero cruzadas"</h3>
  <p><strong>Causa probable:</strong> el Excel está bien leído pero <em>ningún</em> puesto del editor
  matchea con los "Local" del Excel. Probablemente el cliente recién se dio de alta y falta
  configurar los puestos completos (nombres + Lugar en sistema).</p>
  <p><strong>Solución:</strong> volver al Editor de Planillas, terminar de cargar todos los
  puestos con su "Lugar en sistema" correcto.</p>

</section>

<!-- ═══ ROLES ═════════════════════════════════════════════════════════════ -->
<section class="page" style="padding: 30pt 36pt 0;">
  <h2>5. Roles y permisos</h2>

  <p>Qué puede hacer cada rol en este flujo:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 34%;">Acción</th>
        <th>Roles que la pueden hacer</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Crear / editar / eliminar clientes, sectores, turnos y puestos (<strong>Editor de Planillas</strong>)</td>
        <td><span class="chip red">admin</span></td>
      </tr>
      <tr>
        <td>Ver el Editor de Planillas</td>
        <td><span class="chip red">admin</span></td>
      </tr>
      <tr>
        <td>Ver los informes operativos</td>
        <td>
          <span class="chip primary">admin</span>
          <span class="chip primary">jefe</span>
          <span class="chip primary">supervisor</span>
          <span class="chip primary">encargado_limpieza</span>
        </td>
      </tr>
      <tr>
        <td>Subir planilla Excel al informe (botón rojo)</td>
        <td><span class="chip red">admin</span></td>
      </tr>
      <tr>
        <td>Marcar asistencia, hora de entrada, firma en el informe</td>
        <td>
          <span class="chip primary">admin</span>
          <span class="chip primary">jefe</span>
          <span class="chip primary">supervisor</span>
          <span class="chip primary">encargado_limpieza</span>
        </td>
      </tr>
      <tr>
        <td>Exportar informe a Excel</td>
        <td>
          <span class="chip primary">admin</span>
          <span class="chip primary">jefe</span>
          <span class="chip primary">supervisor</span>
          <span class="chip primary">encargado_limpieza</span>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="callout">
    <p><strong>${icons.users}Encargado de limpieza:</strong>
    si tu rol es <em>encargado_limpieza</em>, al entrar a Informes Operativos ya ves el
    cliente y sector pre-seleccionados y bloqueados. Solo podés trabajar con el cliente
    que tenés asignado.</p>
  </div>

</section>

<!-- ═══ GLOSARIO ═══════════════════════════════════════════════════════════ -->
<section class="page" style="padding: 30pt 36pt 0;">
  <h2>6. Glosario</h2>

  <table>
    <tbody>
      <tr>
        <td style="width: 140pt; font-weight: 600; color: #29416b;">Cliente</td>
        <td>Empresa donde GSS presta servicio (ej: Casmu 2, Medis).</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Sector</td>
        <td>Área interna del cliente (ej: Limpieza, Staff, Seguridad, Tercerizado).</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Turno</td>
        <td>Franja horaria de trabajo (ej: 6 A 14, 14 A 22, 22 A 06).</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Puesto</td>
        <td>Rol específico dentro de un turno+sector+cliente (ej: Asilo, Hemoterapia).
            Incluye un nombre interno, la cantidad de personas y el "Lugar en sistema".</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Lugar en sistema</td>
        <td>Texto que se usa para cruzar con la columna <code>Local</code> del Excel de Mitrabajo.
            Debe copiarse <em>literal</em> del Excel. Es el campo más frágil y más importante.</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Informe Operativo</td>
        <td>Planilla del día de un turno concreto donde se marca asistencia, firma,
            horas de entrada y notas.</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Panel de control (Mitrabajo)</td>
        <td>Exportación en Excel del sistema externo Mitrabajo que arma la planificación
            del turno. Es el Excel que se sube al informe.</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Categoría</td>
        <td>Agrupación del funcionario en el informe (LIMPIADOR, AUXILIAR, VIDRIERO,
            ENCARGADO). Se asigna por defecto al importar y puede ajustarse fila por fila.</td>
      </tr>
      <tr>
        <td style="font-weight: 600; color: #29416b;">Cruzadas / Descartadas</td>
        <td><strong>Cruzadas</strong>: filas del Excel que matchearon con un puesto del editor.
            <strong>Descartadas</strong>: filas que no encontraron match y quedan afuera
            (generalmente porque falta o no coincide el "Lugar en sistema").</td>
      </tr>
    </tbody>
  </table>

  <hr class="rule"/>

  <div class="footer">
    <span>Guía de carga de planillas — Operaciones Limpieza</span>
    <span>Versión ${version} · ${today}</span>
  </div>

</section>

</body>
</html>`;

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // Import dinámico para no forzar que playwright se instale en entornos donde
  // no corre este script (es solo para dev/docs).
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (err) {
    console.error('[gen-guia-planillas] Error: playwright no está instalado.');
    console.error('  → Ejecutá: npm install');
    process.exit(1);
  }

  // Asegurar docs/ existe
  const docsDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  console.log('[gen-guia-planillas] Iniciando Playwright...');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: OUT_PATH,
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '0', bottom: '1cm', left: '0' },
    });
    console.log(`[gen-guia-planillas] PDF generado: ${OUT_PATH}`);
    const stat = fs.statSync(OUT_PATH);
    console.log(`[gen-guia-planillas] Tamaño: ${(stat.size / 1024).toFixed(1)} KB`);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('[gen-guia-planillas] ERROR:', err);
  process.exit(1);
});
