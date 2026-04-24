/**
 * Autenticación simple para endpoints disparados por el worker de cron.
 *
 * El worker agrega el header `X-Cron-Secret` con el valor de la env var
 * `CRON_SECRET`. El endpoint verifica que coincida. Si no hay secret
 * configurado en el servidor, devuelve 503 (mejor que dejar abierto).
 */

import { NextRequest } from 'next/server';

export function isValidCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = request.headers.get('x-cron-secret') || '';
  // Comparación en tiempo constante no es necesaria acá porque el header
  // viaja solo por la red privada de Railway, pero usamos igualdad estricta.
  return got.length > 0 && got === expected;
}
