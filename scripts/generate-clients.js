#!/usr/bin/env node
/**
 * Generates app/config/clients.ts from CLIENTS_DATA env var (JSON).
 * Falls back to example data if env var is not set.
 * Run before build: node scripts/generate-clients.js
 */

const fs = require('fs');
const path = require('path');

const EXAMPLE_DATA = {
    'Cliente Ejemplo A': ['Sede Central', 'Sucursal Norte'],
    'Cliente Ejemplo B': ['Planta', 'Oficina'],
    'Cliente Ejemplo C': [],
};

let clientMap;

if (process.env.CLIENTS_DATA) {
    try {
        clientMap = JSON.parse(process.env.CLIENTS_DATA);
        console.log(`✓ clients.ts: loaded ${Object.keys(clientMap).length} clients from CLIENTS_DATA`);
    } catch (e) {
        console.error('✗ CLIENTS_DATA is not valid JSON, falling back to example data');
        clientMap = EXAMPLE_DATA;
    }
} else {
    console.warn('⚠  CLIENTS_DATA not set, using example data');
    clientMap = EXAMPLE_DATA;
}

const lines = [
    '// AUTO-GENERATED — do not edit. See scripts/generate-clients.js',
    'export const CLIENT_SECTOR_MAP: Record<string, string[]> = ' + JSON.stringify(clientMap, null, 4) + ';',
    '',
    'export const getAvailableClients = () => Object.keys(CLIENT_SECTOR_MAP).sort();',
    'export const getSectorsForClient = (client: string): string[] => {',
    '    if (!client) return [];',
    '    const sectors = CLIENT_SECTOR_MAP[client];',
    '    if (!sectors || sectors.length === 0) return [\'Sector Único\'];',
    '    return sectors;',
    '};',
    '',
];

const outPath = path.join(__dirname, '..', 'app', 'config', 'clients.ts');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ Written: ${outPath}`);
