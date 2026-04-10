# Imagen de producción con Playwright (Chromium) para Mitrabajo.
# Railway usa este Dockerfile si existe en la raíz (nixpacks.toml NO se aplica en ese caso).
# Chromium oficial de Playwright es Linux glibc — no usar Alpine en el runner.

FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Binarios de browser en ruta fija (misma que runtime + lib/mitrabajo-download.js)
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install --with-deps chromium

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

# Librerías del SO para ejecutar Chromium (runner ≠ builder: hay que repetirlas aquí)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# adduser --system no crea $HOME; Crashpad de Chromium necesita directorio escribible
RUN mkdir -p /home/nextjs/.config /home/nextjs/.cache && chown -R nextjs:nodejs /home/nextjs
ENV HOME=/home/nextjs
ENV XDG_CONFIG_HOME=/home/nextjs/.config
ENV XDG_CACHE_HOME=/home/nextjs/.cache

COPY --from=builder /app/public ./public

RUN mkdir -p .next
RUN chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Script de descarga Mitrabajo (outputFileTracingIncludes no es fiable para .cjs externos)
RUN mkdir -p ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/download-mitrabajo.cjs ./scripts/download-mitrabajo.cjs

# Binarios de Playwright (no vienen en standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.playwright-browsers ./.playwright-browsers

COPY --chown=nextjs:nodejs startup.sh ./startup.sh
RUN chmod +x ./startup.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "./startup.sh"]
