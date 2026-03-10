const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzM2ODksImV4cCI6MjA4MjkwOTY4OX0.QSC6cnOtOTLqijMbOlvY3wD2wCLIfN6wGyp351Io5gw'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function main() {
    console.log('🧪 Testing Public Profile Access (as Anon)...')

    // Try to select Maria's profile (which I know exists)
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'maria@demo.com')
        .single()

    if (error) {
        console.error('❌ Error accessing profile as Anon:', error.message)
        console.error('Error code:', error.code)
    } else {
        console.log('✅ Success! Accessed Maria profile as Anon.')
    }
}

main().catch(console.error)
