#!/usr/bin/env node
/**
 * Actualiza un bloque en README.md con:
 *  - Tiempo transcurrido desde el primer commit (meses/días/horas).
 *  - Estimación de horas efectivas de trabajo basada en gaps entre commits.
 *
 * Heurística de "horas de trabajo":
 *  - Cada commit marca actividad. Si el commit anterior fue hace <= SESSION_GAP_MIN
 *    minutos, contamos ese intervalo como tiempo trabajado.
 *  - Si fue hace más (arranque de sesión), sumamos SESSION_START_MIN como
 *    tiempo mínimo del primer tramo (warmup de esa sesión).
 *
 * Uso:
 *   node scripts/update-readme-timer.js
 *
 * Lee el historial con `git log` y reemplaza el contenido entre los markers
 * <!-- TIMER-START --> y <!-- TIMER-END --> en README.md.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const README = path.join(process.cwd(), 'README.md');
const MARK_START = '<!-- TIMER-START -->';
const MARK_END = '<!-- TIMER-END -->';

const SESSION_GAP_MIN = 120;   // gap máximo para considerar commits parte de la misma sesión
const SESSION_START_MIN = 30;  // tiempo atribuido al arranque de una sesión nueva

function gitDates() {
    const out = execSync('git log --reverse --format=%aI', { encoding: 'utf8' }).trim();
    if (!out) return [];
    return out.split('\n').map(s => new Date(s));
}

function diffBreakdown(fromMs, toMs) {
    let ms = Math.max(0, toMs - fromMs);
    const msPerHour = 3600 * 1000;
    const msPerDay = 24 * msPerHour;
    // Meses "promedio" (30.44 días). Para un medidor, esta aproximación basta.
    const msPerMonth = Math.floor(30.44 * msPerDay);

    const months = Math.floor(ms / msPerMonth); ms -= months * msPerMonth;
    const days = Math.floor(ms / msPerDay);    ms -= days * msPerDay;
    const hours = Math.floor(ms / msPerHour);
    return { months, days, hours };
}

function workingHours(dates) {
    if (dates.length === 0) return 0;
    const gapMs = SESSION_GAP_MIN * 60 * 1000;
    const startMs = SESSION_START_MIN * 60 * 1000;
    let totalMs = startMs; // primer commit cuenta como arranque de sesión
    for (let i = 1; i < dates.length; i++) {
        const delta = dates[i] - dates[i - 1];
        if (delta <= gapMs) totalMs += delta;
        else totalMs += startMs;
    }
    return totalMs / (3600 * 1000);
}

function fmt(n, unit) {
    return `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
}

function buildBlock() {
    const dates = gitDates();
    if (dates.length === 0) return `${MARK_START}\n_sin commits aún_\n${MARK_END}`;

    const first = dates[0];
    const last = dates[dates.length - 1];
    const now = new Date();
    const elapsedTarget = last > now ? last : now; // por si el runner está desfasado

    const { months, days, hours } = diffBreakdown(first.getTime(), elapsedTarget.getTime());
    const totalElapsedHours = Math.round((elapsedTarget.getTime() - first.getTime()) / (3600 * 1000));
    const workHours = Math.round(workingHours(dates));
    const commitsCount = dates.length;

    const firstLocal = first.toISOString().split('T')[0];
    const lastLocal = last.toISOString().split('T')[0];

    return [
        MARK_START,
        '',
        `**Tiempo en desarrollo**: ${fmt(months, 'meses')} · ${fmt(days, 'días')} · ${fmt(hours, 'horas')}`,
        '',
        `| Métrica | Valor |`,
        `|---------|-------|`,
        `| Primer commit | ${firstLocal} |`,
        `| Último commit | ${lastLocal} |`,
        `| Commits totales | ${commitsCount} |`,
        `| Horas calendario (desde primer commit) | ${totalElapsedHours} h |`,
        `| Horas efectivas estimadas | ${workHours} h |`,
        '',
        `<sub>Horas efectivas = suma de intervalos entre commits con gap ≤ ${SESSION_GAP_MIN} min + ${SESSION_START_MIN} min por arranque de sesión. Aproximación basada en git; no contempla trabajo sin commit.</sub>`,
        '',
        MARK_END,
    ].join('\n');
}

function main() {
    if (!fs.existsSync(README)) {
        console.error('README.md no encontrado');
        process.exit(1);
    }
    const original = fs.readFileSync(README, 'utf8');
    const block = buildBlock();

    let updated;
    if (original.includes(MARK_START) && original.includes(MARK_END)) {
        const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`, 'm');
        updated = original.replace(re, block);
    } else {
        console.error(`Markers ${MARK_START} / ${MARK_END} no encontrados en README.md. Agregalos primero.`);
        process.exit(1);
    }

    if (updated === original) {
        console.log('README sin cambios.');
        return;
    }
    fs.writeFileSync(README, updated);
    console.log('README actualizado.');
}

main();
