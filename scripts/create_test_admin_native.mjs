import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim().replace(/"/g, '');
    return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function createAdmin() {
  const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'testadmin@nlvip.com',
    password: 'password123',
    email_confirm: true
  });
  
  if (error) {
    if (error.message.includes('already registered')) {
        const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', 'testadmin@nlvip.com').single();
        if (existing) {
             await supabaseAdmin.from('profiles').update({ role: 'admin' }).eq('id', existing.id);
             console.log('Done updating existing testadmin');
        }
        return;
    }
    console.error('Error creating auth user:', error);
    return;
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: user.user.id,
    email: 'testadmin@nlvip.com',
    name: 'Test Admin',
    role: 'admin',
    is_active: true
  });

  if (profileError) console.error('Error creating profile:', profileError);
  else console.log('Test Admin created successfully!');
}

createAdmin();
