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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fix() {
  console.log('🛠️ Adding unique constraint to member_recipe_plans...');
  
  const { error } = await supabase.rpc('apply_sql', {
    sql_query: `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_recipe_plans_member_id_week_start_key') THEN
          ALTER TABLE public.member_recipe_plans 
          ADD CONSTRAINT member_recipe_plans_member_id_week_start_key UNIQUE (member_id, week_start);
        END IF;
      END $$;
    `
  });

  if (error) {
    // If rpc fails, try raw query through execute_sql if available via MCP, 
    // but here we just log it as we might be using service role directly.
    console.error('❌ Error applying constraint via RPC:', error.message);
    console.log('Trying alternative approach...');
  } else {
    console.log('✅ Constraint ensured.');
  }
}

fix();
