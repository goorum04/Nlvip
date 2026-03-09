process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzM2ODksImV4cCI6MjA4MjkwOTY4OX0.QSC6cnOtOTLqijMbOlvY3wD2wCLIfN6wGyp351Io5gw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateMariaProfile() {
  // First check if profile exists
  const { data: existing, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'maria@demo.com')
    .single();

  console.log('Existing profile:', existing);

  if (!existing) {
    console.log('Profile not found, creating...');
    return;
  }

    const { data, error } = await supabase
    .from('profiles')
    .update({
      sex: 'female',
      cycle_enabled: true,
      cycle_start_date: '2026-03-01',
      cycle_length_days: 28,
      period_length_days: 5
    })
    .eq('email', 'maria@demo.com');

  console.log('Update result - data:', data, 'error:', error);

  // Verify
  const { data: verify } = await supabase
    .from('profiles')
    .select('sex, cycle_enabled, cycle_start_date, cycle_length_days, period_length_days')
    .eq('email', 'maria@demo.com')
    .single();
  
  console.log('Verificación:', verify);
}

updateMariaProfile();
