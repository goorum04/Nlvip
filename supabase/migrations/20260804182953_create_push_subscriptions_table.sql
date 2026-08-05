-- El archivo 20260403000200_push_subscriptions.sql nunca se aplicó a
-- producción (confirmado vía list_migrations: esa versión no aparece en el
-- historial real de Supabase), lo que significaba que las notificaciones
-- push nunca funcionaron. Esta es la migración que sí se aplicó hoy,
-- reflejando el esquema real ya en producción: mismo patrón que
-- device_tokens (RLS activado, sin políticas — acceso solo vía service
-- role desde /api/notifications/subscribe y /api/notifications/unsubscribe).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
