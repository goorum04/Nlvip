const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
const url = content.match(/NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\s\n\r]+)["']?/)[1];
const anon = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=["']?([^"'\s\n\r]+)["']?/)[1];

const supabase = createClient(url, anon);

async function main() {
  const { data, error } = await supabase
    .from('recipes')
    .select('title, category, calories')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

main();
