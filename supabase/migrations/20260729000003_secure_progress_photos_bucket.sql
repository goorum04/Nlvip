-- El bucket progress_photos (guion bajo, el que usa la app de verdad —
-- distinto del huérfano "progress-photos" con guion) estaba marcado como
-- público en Supabase Storage. Verificado (grep) que ningún archivo del
-- código pide getPublicUrl para este bucket: todo pasa por
-- createSignedUrl/createSignedUrls (hooks/useStorage.js), así que cerrarlo
-- no cambia nada del comportamiento de la app.
UPDATE storage.buckets SET public = false WHERE id = 'progress_photos';

-- Además del bucket público, existían 3 políticas RLS en storage.objects sin
-- ninguna restricción de propiedad real:
--   progress_photos_storage_select  (SELECT)  qual: solo bucket_id = 'progress_photos'
--   progress_photos_storage_insert  (INSERT)  qual: bucket_id + estar autenticado
--   progress_photos_storage_delete  (DELETE)  qual: bucket_id + estar autenticado
-- Como las políticas permisivas de Postgres se combinan con OR, estas hacían
-- inútiles a las políticas correctas que YA existen en paralelo
-- (progress_photos_member_read/upload/delete, progress_photos_staff_upload/
-- delete — mismo patrón ownership+trainer+admin que el resto de la app):
-- cualquier socio con sesión iniciada podía leer/borrar/sobrescribir las
-- fotos corporales de CUALQUIER otro socio llamando directamente al Storage
-- API, sin pasar por la UI de la app ni por el bucket público.
--
-- Verificado antes de borrar que las políticas restrictivas cubren el 100%
-- de los patrones reales de subida de la app: los paths siempre son
-- memberId/checkins/... o memberId/onboarding/..., con el ID del propio
-- socio o del socio que el admin/entrenador gestiona desde su ficha
-- (MemberDetailPanel) — exactamente lo que member_upload/staff_upload
-- comprueban.
DROP POLICY IF EXISTS "progress_photos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "progress_photos_storage_delete" ON storage.objects;

-- Ya aplicado directamente en producción (proyecto qnuzcmdjpafbqnofpzfp) el
-- 2026-07-29; este archivo deja el cambio documentado en el repo.
