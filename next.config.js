const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // URL de la organización y proyecto en Sentry (opcional, para source maps)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Subir source maps solo en producción
  silent: true,

  // Deshabilitar tunnel route (no necesario para este proyecto)
  tunnelRoute: undefined,

  // No añadir el banner de Sentry a los bundles del cliente
  disableLogger: true,

  // Evitar que Sentry bloquee el build si no hay DSN configurado
  errorHandler: (err) => {
    console.warn('[Sentry] Build warning:', err.message)
  },
})
