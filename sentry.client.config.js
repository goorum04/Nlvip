import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Desactivado para restauración de estabilidad v1.31
  enabled: false,

  // Porcentaje de transacciones con tracing (0.1 = 10%)
  tracesSampleRate: 0.1,

  // Ignora errores de red esperados del lado del cliente
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^Network Error$/,
    /^Failed to fetch$/,
    /^Load failed$/,
  ],
})
