# Archivo histórico de SQL

Este directorio contiene SQL que **NO** debe ejecutarse automáticamente.

## Contenido

- `sql/` — scripts SQL ad-hoc que se ejecutaron manualmente en distintos
  momentos del desarrollo (fases, fixes puntuales, seeds, parches).
- `legacy_migrations/` — migraciones antiguas que ya fueron aplicadas en
  producción antes de adoptar el sistema de migraciones canónicas en
  `supabase/migrations/`.

## Por qué se conservan

Muchas tablas que la app usa hoy (`profiles`, `trainer_members`,
`workout_templates`, `food_logs`, `feed_posts`, etc.) se crearon
originalmente aquí y nunca se portaron a `supabase/migrations/`. Borrarlos
dejaría al repo sin la definición original del schema.

## Reglas de uso

1. **No** los ejecutes contra producción. El schema actual ya está aplicado.
2. **No** los referencies desde la app ni desde scripts de build.
3. Supabase CLI ignora este directorio (solo escanea `supabase/migrations/`).
4. Si necesitas recrear una tabla legacy en una migración nueva,
   **copia** el `CREATE TABLE` aquí guardado a un archivo nuevo en
   `supabase/migrations/` con marca temporal y haz que sea idempotente
   (`IF NOT EXISTS`).

## Siguiente paso recomendado

Cuando haya tiempo, consolidar las definiciones reales (tras introspectar
la DB de producción) en una migración baseline única y, una vez verificada,
borrar este `_archive/`.
