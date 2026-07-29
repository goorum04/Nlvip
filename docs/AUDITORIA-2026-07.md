# Auditoría app + Supabase — Julio 2026

Proyecto Supabase: `qnuzcmdjpafbqnofpzfp` (Postgres 17). App: Next.js + Capacitor.

## Estado general

- RLS habilitado en las 62 tablas (public + storage).
- `service_role` nunca llega al cliente; sin secretos comiteados (`.env*` en `.gitignore`).
- Rutas admin (`admin-delete-user`, `create-trainer`, `admin/apply-migration`,
  `redeem-premium-code`) verifican token → `getUser` → rol en BD.
- Los RPC `SECURITY DEFINER` sensibles (`rpc_create_invitation_code`,
  `rpc_assign_trainer_to_member`, `rpc_find_member`, ...) tienen guardas
  internas `is_admin()`. Las alertas del advisor sobre ellos son de robustez,
  no huecos reales.

## Aplicado en producción (2026-07-29, verificado uno a uno antes de aplicar)

Migración `20260710000001_safe_perf_cleanup.sql` — **ya ejecutada** contra
`qnuzcmdjpafbqnofpzfp`:

1. `search_path = public` en `start_conversation`, `rpc_update_daily_steps`,
   `calculate_activity_metrics` (vía `ALTER FUNCTION`, cuerpo intacto).
   Verificado que ninguna de las 3 usa nada fuera de `public` sin cualificar
   (`auth.uid()` ya iba con esquema explícito) → cero cambio de comportamiento.
2. Borrado de los índices duplicados redundantes, con guarda que impide tocar
   cualquiera que respalde una PK o constraint. Verificados uno a uno contra
   `pg_indexes`/`pg_constraint`: 17 de 19 eran gemelos idénticos reales; 1
   (`idx_member_workouts_unique_member`) ya no existía — el esquema cambió
   con el soporte multi-rutina después de escribirse esta auditoría, la
   guarda `IF EXISTS` lo saltó sin fallar. Confirmado que ninguna tabla se
   quedó sin índice en la columna tras el borrado.

### Hallazgo NO recogido en esta auditoría: IDOR en `rpc_update_daily_steps`

Existía una segunda sobrecarga, `rpc_update_daily_steps(uuid, integer)`, resto
huérfano de `legacy_migrations/CUENTA-PASOS.sql` que ninguna migración había
tocado. A diferencia de la versión en uso (que resuelve el socio vía
`auth.uid()`), esta aceptaba `p_member_id` como parámetro directo sin
comprobar que fuera el del llamante — `SECURITY DEFINER`, con `EXECUTE`
concedido a `anon` y `authenticated`. Cualquiera con la clave pública de la
app podía alterar los pasos de cualquier socio sin haber iniciado sesión.

Verificado (grep) que el cliente solo llama a la firma segura
(`ActivityTracker.jsx`). Se borró en `20260729000002_drop_insecure_steps_overload.sql`
— ya aplicado en producción.

## Pendiente — requiere cambio coordinado o pruebas (NO aplicado)

Ordenado por impacto. Cada uno puede romper una funcionalidad si se aplica
en aislamiento, por eso se deja documentado y no ejecutado.

### 1. Fotos de progreso en bucket público (privacidad)
`progress_photos` es `public: true` con 33 objetos (fotos corporales).
El código ya lee con `getSignedUrls`, así que hacerlo privado **podría** ser
seguro, pero antes hay que verificar TODOS los consumidores
(`MemberPhotosAndForm`, `MemberDetailPanel`, `TrainerDashboard`,
`MemberDashboard`, `DietOnboardingForm`) para confirmar que ninguno usa
`getPublicUrl`. Verificar y probar antes de:

```sql
-- SOLO tras confirmar que todos los consumidores usan URLs firmadas
UPDATE storage.buckets SET public = false WHERE id = 'progress_photos';
```

### 2. Rutas de IA sin autenticación (abuso de coste) — reverificado 2026-07-29
`/api/generate-recipe`, `/api/generate-recipe-plan`, `/api/spoonacular-diet`
no verifican token. Riesgo: cualquiera puede quemar créditos de OpenAI/
Spoonacular y, en `generate-recipe-plan`, sobrescribir planes de cualquier
socio (confía en `memberId` del body con `service_role`).

Revisadas las 8 llamadas reales del cliente a `generate-recipe-plan` +
`generate-recipe`: **solo 1 de 8 manda `Authorization`**
(`AdminAssistant.jsx:771`). Las otras 7 NO lo mandan y se romperían si se
exige el header sin tocarlas antes:
`AdminDashboard.jsx:1070`, `TrainerDashboard.jsx:456`, `TrainerDashboard.jsx:554`,
`RecipesManager.jsx:252`, `RecipePlan.jsx:626`, `MemberDetailPanel.jsx:191`,
`MemberDetailPanel.jsx:213`.
Las llamadas server→server (`diet-onboarding/complete`, `checkin/complete`)
necesitarían un secreto compartido.
Pendiente de aplicar: requiere tocar 7 archivos de cliente + las rutas
servidor a la vez, no es seguro hacerlo por partes.

### 3. Rate-limit en memoria no sirve en serverless
`lib/rateLimit.js` usa un `Map` local. En Vercel cada invocación puede ser
otra instancia → el límite se evade. Migrar a un store compartido
(Upstash/Redis o tabla en Supabase).

### 4. Policy RLS "siempre true" en `notifications`
`Service role manages notifications` es `FOR ALL ... USING true` a rol
`public`. Debería limitarse a `service_role`. Verificar antes que ningún
insert de notificación se hace con el rol `authenticated`/`anon`.

### 5. Config de Auth
Activar "Leaked password protection" (HaveIBeenPwned) en el dashboard.

### 6. Defense-in-depth: `REVOKE EXECUTE` a `anon`
41 funciones `SECURITY DEFINER` son ejecutables por `anon` vía REST. Las
críticas ya validan rol, pero conviene revocar EXECUTE a `anon` en las
`rpc_*` de admin/trainer. Verificar que ninguna se usa en flujos anónimos
(registro) antes.

### 7. Rendimiento (bajo)
- 283 `multiple_permissive_policies`: consolidar policies por tabla+acción.
- 31 índices sin uso, 10 policies con `auth.uid()` por fila
  (envolver en `(SELECT auth.uid())`), 8 FKs sin índice (sobre todo
  `member_checkins`).

### 8. Buckets duplicados/huérfanos
Pares underscore/guion (`progress_photos`/`progress-photos`,
`chat_audios`/`chat-audio`, `feed_images`/`feed-images`). El código usa las
de guion bajo; las de guion están vacías. Limpiar tras confirmar que no se
usan.
