# ⚠️ SCRIPTS HISTÓRICOS — NO EJECUTAR

Esta carpeta contiene scripts SQL que se ejecutaron manualmente en la consola de Supabase durante el desarrollo inicial del proyecto.

**NO son migraciones activas. NO reflejan el estado actual de la base de datos.**

## Fuente de verdad

La única fuente de verdad para el esquema de base de datos es:

```
supabase/migrations/
```

Esos ficheros tienen timestamp, se aplican en orden y Supabase sabe cuáles están aplicados.

## Por qué NO debes ejecutar estos scripts

- Algunos contienen `DROP TABLE CASCADE` que borraría datos de producción.
- Algunos crean políticas RLS permisivas sin filtros (ej. `USING (true)` sin `bucket_id`).
- Pueden contradecir migraciones ya aplicadas y dejar el esquema en estado inconsistente.

## Si necesitas cambiar la BD

Crea un nuevo fichero en `supabase/migrations/` con el formato:

```
YYYYMMDDHHMMSS_descripcion_breve.sql
```

Hazlo idempotente (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`).
