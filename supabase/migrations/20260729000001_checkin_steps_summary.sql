-- Cumplimiento REAL de pasos en el periodo que cubre cada revisión.
--
-- progress_records.activity_adherence ya guarda lo que el socio DICE ("¿has
-- cumplido los pasos?"). Esto guarda lo que hizo de verdad, leído de
-- daily_activity, para que el entrenador pueda contrastarlo de un vistazo.
--
-- Se guarda como snapshot en el momento de enviar la revisión, no se calcula
-- al leer: el periodo que cubre la revisión es el que va desde la revisión
-- anterior hasta esa, y esa ventana no debe moverse porque el entrenador
-- revise tres semanas más tarde.
--
-- JSONB en vez de columnas sueltas porque es un informe cerrado (media,
-- objetivo, días cumplidos, tendencia), no datos que vayamos a filtrar ni
-- cruzar en consultas.
--
-- Nullable a propósito: las revisiones ya existentes y los socios que no
-- registran pasos se quedan en NULL y la interfaz simplemente no muestra el
-- bloque.

ALTER TABLE public.member_checkins
  ADD COLUMN IF NOT EXISTS steps_summary JSONB;

COMMENT ON COLUMN public.member_checkins.steps_summary IS
  'Snapshot del cumplimiento de pasos del periodo: { period_days, from_date, avg_steps, steps_goal, days_with_data, days_goal_met, compliance_pct, device_days, reliable }. NULL si el socio no registró pasos.';
