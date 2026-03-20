
const { createClient } = require('@supabase/supabase-js');

async function testLogin() {
  const supabaseUrl = "https://qnuzcmdjpafbqnofpzfp.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzM2ODksImV4cCI6MjA4MjkwOTY4OX0.QSC6cnOtOTLqijMbOlvY3wD2wCLIfN6wGyp351Io5gw";
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('Attempting login as admin...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'nacholostao28@gmail.com',
    password: 'nacholostao28'
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }

  console.log('Auth success. User ID:', authData.user.id);

  console.log('Attempting to load profile...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('Profile Load Error:', profileError.message);
  } else {
    console.log('Profile loaded successfully:', profile.name, '(Role:', profile.role + ')');
  }

  console.log('Attempting to load diet requests...');
  const { data: requests, error: requestsError } = await supabase
    .from('diet_onboarding_requests')
    .select('*, member:profiles!diet_onboarding_requests_member_id_fkey(name, email)')
    .eq('status', 'submitted');

  if (requestsError) {
    console.error('Diet Requests Error:', requestsError.message);
  } else {
    console.log('Diet requests loaded:', requests.length);
  }
}

testLogin();
