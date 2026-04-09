/**
 * Rate limiting en memoria usando ventana deslizante.
 * Key = `${ip}:${endpoint}`, value = array de timestamps en ms.
 *
 * Nota: el store es in-process. Válido para Railway con instancia única.
 * Si se escala a múltiples instancias, migrar a Redis.
 */

interface RateLimitConfig {
    windowMs: number; // ventana en milisegundos
    max: number;      // máximo de intentos dentro de la ventana
}

interface RateLimitResult {
    success: boolean;
    retryAfter?: number; // segundos hasta que expire el intento más antiguo
}

const store = new Map<string, number[]>();

// Limpiar entradas expiradas cada 5 minutos para evitar memory leaks
setInterval(() => {
    const now = Date.now();
    const maxWindow = 15 * 60 * 1000; // ventana máxima que usamos
    for (const [key, timestamps] of store.entries()) {
        const hasRecent = timestamps.some(ts => now - ts < maxWindow);
        if (!hasRecent) store.delete(key);
    }
}, 5 * 60 * 1000);

export function rateLimit(ip: string, endpoint: string, config: RateLimitConfig): RateLimitResult {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const timestamps = (store.get(key) ?? []).filter(ts => ts > windowStart);

    if (timestamps.length >= config.max) {
        const oldestInWindow = Math.min(...timestamps);
        const retryAfter = Math.ceil((oldestInWindow + config.windowMs - now) / 1000);
        return { success: false, retryAfter };
    }

    timestamps.push(now);
    store.set(key, timestamps);
    return { success: true };
}

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
    return '127.0.0.1';
}
