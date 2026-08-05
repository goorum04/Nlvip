-- Auditoría de migraciones huérfanas: se comparó la lista de migraciones
-- de git contra el historial real aplicado en Supabase. La mayoría de los
-- archivos "huérfanos" por timestamp ya estaban aplicados bajo otro nombre/
-- fecha (verificado columna por columna, tabla por tabla, función por
-- función contra la base de datos real). Dos NO lo estaban:
--
-- 1. trainer_notices y diet_onboarding_requests nunca se añadieron a la
--    publicación de Realtime (20260403000100_enable_realtime.sql nunca se
--    ejecutó contra producción — la función setup_nlvip_realtime() ni
--    siquiera existía). Efecto real: el toast de "cuestionario recibido"
--    para admin/trainer y los de "plan listo" / "nuevo aviso" para el
--    socio nunca se disparaban en vivo, solo se veían al recargar la app.
--
-- 2. member_badges seguía teniendo la política insegura USING (true)
--    (permitía a cualquiera enumerar las insignias de cualquier socio).
--    Una migración anterior (20260421000001_security_hardening.sql) ya
--    intentó cerrarla pero tampoco se aplicó nunca. La tabla real que usa
--    la app es user_badges; member_badges está vacía y sin uso (solo se
--    borra de ella al eliminar un usuario), así que no había exposición
--    real de datos, pero se cierra el agujero de todos modos.

ALTER TABLE trainer_notices REPLICA IDENTITY FULL;
ALTER TABLE diet_onboarding_requests REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE trainer_notices';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE diet_onboarding_requests';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "member_badges_select_all" ON member_badges;
