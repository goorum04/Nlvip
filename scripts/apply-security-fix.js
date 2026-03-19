const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Función manual para cargar .env.local sin 'dotenv'
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      env[match[1]] = value.replace(/\\n/g, '\n');
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: No se encontraron las variables de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const queries = [
  // 1. FUNCIONES DE SEGURIDAD
  `CREATE OR REPLACE FUNCTION public.is_admin()
   RETURNS boolean AS $$
   BEGIN
     RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;`,
   
  `CREATE OR REPLACE FUNCTION public.is_premium()
   RETURNS boolean AS $$
   BEGIN
     RETURN EXISTS (
       SELECT 1 FROM public.profiles 
       WHERE id = auth.uid() AND (has_premium = true OR is_premium = true OR role = 'admin')
     );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;`,

  `CREATE OR REPLACE FUNCTION public.is_trainer()
   RETURNS boolean AS $$
   BEGIN
     RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'trainer');
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;`,

  `CREATE OR REPLACE FUNCTION public.is_staff()
   RETURNS boolean AS $$
   BEGIN
     RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'trainer' OR role = 'admin'));
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;`,

  `CREATE OR REPLACE FUNCTION public.is_participant(p_conversation_id uuid)
   RETURNS boolean AS $$
   BEGIN
     RETURN EXISTS (
       SELECT 1 FROM public.conversation_participants
       WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
     );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;`
];

async function apply() {
  console.log('Aplicando funciones de seguridad...');
  
  // Como no podemos ejecutar SQL arbitrario sin una función RPC previa, 
  // intentaremos crear el bucket al menos, que sí tiene API de JS.
  
  const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('chat_images', {
    public: true
  });
  
  if (bucketError && bucketError.message !== 'Bucket already exists') {
    console.error('Error al crear bucket:', bucketError.message);
  } else {
    console.log('Bucket chat_images configurado.');
  }

  console.log('\n--- ATENCIÓN ---');
  console.log('La ejecución de SQL (DDL) requiere privilegios que no están expuestos vía API estándar.');
  console.log('Por favor, ejecute el contenido de final_supabase_fix.sql en el Dashboard.');
}

apply();
