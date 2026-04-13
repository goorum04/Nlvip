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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function benchmark() {
  console.time('Profile Query');
  // Didax user: ba7b55f8-1beb-46dd-8457-05efdfd1da8c
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', 'ba7b55f8-1beb-46dd-8457-05efdfd1da8c')
    .single();
  console.timeEnd('Profile Query');
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Success, role:', data.role);
  }
}

benchmark();
