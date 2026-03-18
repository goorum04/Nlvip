const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function createDemoFemale() {
    const email = 'demo_chica@nlvip.com'
    const password = '12345678'
    const name = 'Laura (Demo)'

    console.log('Creando cuenta demo...')

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
    })

    let userId;
    if (authError) {
        if (authError.message.includes('already exists')) {
            console.log('El usuario ya existia, obteniendo ID...')
            const { data: existingUser } = await supabase.from('profiles').select('id').eq('email', email).single()
            userId = existingUser.id
        } else {
            console.error('Error creando usuario:', authError)
            return
        }
    } else {
        userId = authData.user.id
    }

    // Update or Upsert profile
    console.log('Actualizando perfil con datos de Bienestar Femenino...')

    // calculate date for 10 days ago
    const dateStr = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        name,
        role: 'member',
        sex: 'female',
        weight_kg: 62,
        height_cm: 165,
        cycle_enabled: true,
        cycle_start_date: dateStr,
        cycle_length_days: 28,
        period_length_days: 5
    })

    if (profileError) {
        console.error('Error actualizando perfil:', profileError)
    }

    // Delete previous activity for today and then insert
    console.log('Añadiendo simulación de actividad (pasos)...')
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('daily_activity').delete().eq('member_id', userId).eq('activity_date', todayStr)

    const { error: activityError } = await supabase.from('daily_activity').insert({
        member_id: userId,
        activity_date: todayStr,
        steps: 11450,
        calories_kcal: 420,
        source: 'manual'
    })

    if (activityError) {
        console.error('Error insertando actividad:', activityError)
    }

    console.log('✅ Cuenta demo creada y configurada con éxito!')
    process.exit(0)
}

createDemoFemale()
