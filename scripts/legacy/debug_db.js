const { toolExecutors } = require('./lib/adminAssistantTools');
const fs = require('fs');
const path = require('path');

// Carga manual de .env.local
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

async function check() {
  try {
    console.log('--- Checking Recipes ---');
    const res = await toolExecutors.list_catalog_recipes({});
    console.log('Recipes result:', JSON.stringify(res, null, 2));

    console.log('\n--- Checking Members ---');
    const { data: profiles } = await require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ).from('profiles').select('*');
    console.log('Profiles in DB:', JSON.stringify(profiles, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

check();
