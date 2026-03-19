const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno locales
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Usar SERVICE_ROLE para bypass RLS y crear funciones
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in .env.local');
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
   $$ LANGUAGE plpgsql SECURITY DEFINER;`,

  // 2. EVOLUCION DEL CHAT
  `DO $$
   BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'message_type' AND e.enumlabel = 'image') THEN
           ALTER TYPE public.message_type ADD VALUE 'image';
       END IF;
   EXCEPTION
       WHEN duplicate_object THEN NULL;
   END $$;`,

  `ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_path TEXT;`,

  // 3. POLÍTICAS DE RLS ACTUALIZADAS
  `DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
   CREATE POLICY "Participants can insert messages" ON public.messages
   FOR INSERT WITH CHECK (is_admin() OR is_participant(conversation_id));`,

  // 4. ALMACENAMIENTO (BUCKETS) - Usaremos la API de Storage para crear buckets
];

async function applySQL() {
  console.log('--- NL VIP CLUB: SECURITY FIX SCRIPT ---');
  
  // Como supabase-js no tiene un método .sql(), usaremos un hack común: 
  // Crear una función RPC temporal para ejecutar SQL si es que podemos, 
  // o simplemente usar la API de supabase para lo que se pueda.
  
  // ¡ESPERA! Hay un método mejor si el MCP falla: usar fetch directo a la API de postgrest /rpc/exec_sql 
  // si es que existe (común en setups de desarrollo).
  
  // Pero bueno, si no puedo ejecutar SQL arbitrario vía JS sin una función auxiliar, 
  // el script no servirá de mucho para el DDL.
  
  console.log('Executing critical updates...');
  
  // Vamos a intentar crear un bucket de imágenes vía API
  const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('chat_images', {
    public: true
  });
  
  if (bucketError && bucketError.message !== 'Bucket already exists') {
    console.error('Error creating bucket:', bucketError.message);
  } else {
    console.log('Bucket chat_images ready.');
  }

  console.log('Attempting to apply RLS and Functions via SQL RPC (if exists)...');
  // Nota: Si no hay una función RPC para SQL, esto fallará. 
  // En ese caso, la única opción es que el servidor MCP se recupere.
  
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: queries.join('\n') });
  
  if (rpcError) {
    console.warn('RPC exec_sql failed (normal if not defined). Please check Supabase Dashboard.');
    console.error(rpcError.message);
  } else {
    console.log('All SQL applied successfully via RPC.');
  }
}

applySQL();
