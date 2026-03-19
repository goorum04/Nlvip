const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0 && !key.startsWith('#')) {
    let val = values.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key.trim()] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS public.diet_onboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  responses JSONB,
  generated_diet_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.diet_onboarding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_own_onboarding" ON public.diet_onboarding_requests;
CREATE POLICY "members_own_onboarding" ON public.diet_onboarding_requests
  FOR ALL USING (member_id = auth.uid());

DROP POLICY IF EXISTS "staff_read_all_onboarding" ON public.diet_onboarding_requests;
CREATE POLICY "staff_read_all_onboarding" ON public.diet_onboarding_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

DROP POLICY IF EXISTS "staff_insert_onboarding" ON public.diet_onboarding_requests;
CREATE POLICY "staff_insert_onboarding" ON public.diet_onboarding_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );
  
DROP POLICY IF EXISTS "staff_update_onboarding" ON public.diet_onboarding_requests;
CREATE POLICY "staff_update_onboarding" ON public.diet_onboarding_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );
`;

async function applyMigration() {
  console.log('Aplicando migración...');
  
  // Como no hay acceso directo a SQL (RPC no encontrado u otros errores), 
  // usaremos el endpoint REST 'pgmeta' o un fetch directo si la RPC falla
  // o insertaremos un registro dummy para forzar la tabla si existiera.
  
  // Vamos a intentar hacer el CREATE usando una inserción que falle 
  // (para ver si la tabla existe)
  const { error: checkError } = await supabase.from('diet_onboarding_requests').select('id').limit(1);
  
  if (!checkError || checkError.code !== '42P01') {
      console.log('La tabla ya existe o hay otro error:', checkError?.message || 'OK');
      return;
  }
  
  console.log('🚨 LA TABLA NO EXISTE Y SE REQUIERE CREARLA MANUALMENTE EN EL DASHBOARD 🚨');
  console.log('Por favor, ejecuta este SQL en el SQL Editor de Supabase:\n');
  console.log(sql);
}

applyMigration();
