'use strict';

/**
 * lib/mitrabajo-mailer.cjs
 *
 * Envía el Excel descargado de mitrabajo.uy como adjunto a los destinatarios
 * configurados en la tabla mitrabajo_config. Se llama desde saveToDb tanto en
 * scripts/download-mitrabajo.cjs (cron) como en lib/mitrabajo-download.js
 * (trigger API). Falla silenciosamente para no romper la descarga.
 */

const nodemailer = require('nodemailer');

function formatDateDMY(isoDate) {
  const [y, m, d] = String(isoDate).split('-');
  return `${d}/${m}/${y}`;
}

async function readConfig(ctx) {
  if (ctx.type === 'pg') {
    const res = await ctx.pool.query(
      'SELECT email_recipients, email_enabled FROM mitrabajo_config WHERE id = 1'
    );
    return res.rows[0] || null;
  }
  return ctx.sqlite
    .prepare('SELECT email_recipients, email_enabled FROM mitrabajo_config WHERE id = 1')
    .get();
}

async function ensureTable(ctx) {
  if (ctx.type === 'pg') {
    await ctx.pool.query(`
      CREATE TABLE IF NOT EXISTS mitrabajo_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        email_recipients TEXT,
        email_enabled INTEGER DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = 1)
      )
    `);
    await ctx.pool.query(`INSERT INTO mitrabajo_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  } else {
    ctx.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mitrabajo_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        email_recipients TEXT,
        email_enabled INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    ctx.sqlite.exec(`INSERT OR IGNORE INTO mitrabajo_config (id) VALUES (1)`);
  }
}

async function sendMitrabajoEmail({ ctx, fecha, filename, buffer }) {
  console.log(`[mitrabajo-mail] inicio — fecha=${fecha} filename=${filename} bytes=${buffer?.length}`);
  try {
    await ensureTable(ctx);
    const config = await readConfig(ctx);
    if (!config) {
      console.warn('[mitrabajo-mail] no hay fila en mitrabajo_config — saltando envio');
      return { sent: false, reason: 'no config' };
    }
    console.log(`[mitrabajo-mail] config leida — enabled=${config.email_enabled} recipients="${config.email_recipients || ''}"`);
    if (!config.email_enabled) {
      console.warn('[mitrabajo-mail] envio desactivado (email_enabled=0) — saltando envio');
      return { sent: false, reason: 'disabled' };
    }
    const recipients = (config.email_recipients || '')
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!recipients.length) {
      console.warn('[mitrabajo-mail] sin destinatarios configurados — saltando envio');
      return { sent: false, reason: 'sin destinatarios' };
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      console.warn(`[mitrabajo-mail] SMTP no configurado — host=${!!host} user=${!!user} pass=${!!pass}`);
      return { sent: false, reason: 'smtp no configurado' };
    }
    console.log(`[mitrabajo-mail] SMTP host=${host} port=${port} user=${user}`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const fechaDMY = formatDateDMY(fecha);
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to: recipients.join(', '),
      subject: `Mitrabajo ${fechaDMY} - reporte diario`,
      html: `<p>Se adjunta el reporte del panel supervisor de mitrabajo.uy correspondiente al <strong>${fechaDMY}</strong>.</p>
<p style="color:#64748b;font-size:12px;margin-top:16px">Enviado automaticamente por el sistema GSS tras la descarga programada. Para cambiar los destinatarios, ingresa a la seccion Mitrabajo del portal.</p>`,
      text: `Se adjunta el reporte del panel supervisor de mitrabajo.uy correspondiente al ${fechaDMY}.`,
      attachments: [{ filename, content: buffer }],
    });
    console.log(`[mitrabajo-mail] enviado a ${recipients.join(', ')}: ${info.response}`);
    return { sent: true, recipients };
  } catch (err) {
    console.error(`[mitrabajo-mail] error enviando:`, err && err.message ? err.message : err);
    return { sent: false, error: err && err.message };
  }
}

module.exports = { sendMitrabajoEmail };
