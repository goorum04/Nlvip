// Script para crear la tabla de onboarding de dietas
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;
      const firstEq = trimmedLine.indexOf('=');
      if (firstEq !== -1) {
        const key = trimmedLine.substring(0, firstEq).trim();
        let value = trimmedLine.substring(firstEq + 1).trim();
        if (value.length > 1 && ((value[0] === '"' && value[value.length-1] === '"') || (value[0] === "'" && value[value.length-1] === "'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrate() {
  console.log('🔨 Creando tabla diet_onboarding_requests...');

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
  `;

  // Use raw SQL via execute_sql approach
  const { error } = await supabase.from('diet_onboarding_requests').select('id').limit(1);
  
  if (!error || error.code === 'PGRST116') {
    console.log('✅ Tabla ya existe o accesible.');
  } else if (error.code === '42P01') {
    console.log('Tabla no existe, necesita ser creada via Supabase Dashboard.');
    console.log('SQL a ejecutar:\n', sql);
  } else {
    console.log('Status:', error.message);
  }
}

migrate();
