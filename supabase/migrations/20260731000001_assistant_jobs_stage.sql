-- Permite mostrar en qué paso va un job del asistente mientras sigue en
-- 'processing' (buscando socio, leyendo datos, generando...) en vez de un
-- spinner genérico durante los 15-30s que puede tardar la cadena de
-- llamadas a OpenAI.
ALTER TABLE public.assistant_jobs
  ADD COLUMN IF NOT EXISTS stage TEXT;

COMMENT ON COLUMN public.assistant_jobs.stage IS
  'Paso actual mientras status=processing (ej. "Buscando información...", "Generando..."). NULL cuando no aplica o el job ya terminó.';
