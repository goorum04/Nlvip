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

async function testConnection() {
  console.log('Testing connection with SERVICE_ROLE_KEY...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .limit(1);
  
  if (error) {
    console.error('❌ Error testing connection:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Connection successful!');
  console.log('Sample profile:', data);
}

testConnection();
