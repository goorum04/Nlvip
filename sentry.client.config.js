import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Solo captura errores en producción para no saturar de ruido en desarrollo
  enabled: process.env.NODE_ENV === 'production',

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
