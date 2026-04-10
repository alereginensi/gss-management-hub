import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'standalone',

  // Don't bundle native modules — let Node.js require() them at runtime
  serverExternalPackages: ['pg', 'pg-native', 'better-sqlite3', 'playwright', 'xlsx'],

  // Incluir scripts en el output standalone (Railway no los copia automáticamente)
  outputFileTracingIncludes: {
    '/api/mitrabajo/trigger': ['./scripts/download-mitrabajo.cjs'],
  },

  async headers() {
    const securityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
      // HSTS: solo en producción (Railway ya usa HTTPS). En dev con HTTP, un HSTS cacheado rompería el acceso.
      ...(isProd ? [{
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      }] : []),
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // Next.js necesita unsafe-inline para hydration chunks en el cliente
          // En dev, react-refresh usa eval() — requiere unsafe-eval
          `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
          // ~2600 style={} en JSX requieren unsafe-inline en style-src
          "style-src 'self' 'unsafe-inline'",
          // next/font/google auto-hostea fuentes en producción; data: para fuentes embebidas
          "font-src 'self' data:",
          // data: para firmas base64 (SignaturePad), blob: para previews de archivos
          "img-src 'self' data: blob:",
          // Solo llamadas same-origin (sin APIs externas desde el cliente)
          "connect-src 'self'",
          // Service Worker
          "worker-src 'self' blob:",
          "frame-src 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ];

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    // Only enable file-system polling in development (not needed in production)
    if (!isProd) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
