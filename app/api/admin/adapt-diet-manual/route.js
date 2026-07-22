import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { adaptExistingDiet } from '@/lib/dietGeneration'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req) {
  const supabase = getSupabase()
  try {
    const { memberId } = await req.json()
    if (!memberId) return NextResponse.json({ error: 'memberId requerido' }, { status: 400 })

    // Obtener dieta actual
    const { data: currentDiet } = await supabase
      .from('member_diets')
      .select('diet_template_id, diet_templates(id, content, calories, protein_g, carbs_g, fat_g)')
      .eq('member_id', memberId)
      .maybeSingle()

    if (!currentDiet?.diet_templates) {
      return NextResponse.json({ error: 'Sin dieta actual' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, weight_kg')
      .eq('id', memberId)
      .single()

    // Adaptar con opciones nuevas
    const { adaptedContent, macros, changeSummary } = await adaptExistingDiet({
      supabase,
      memberId,
      currentDietContent: currentDiet.diet_templates.content,
      currentMacros: {
        calories: currentDiet.diet_templates.calories,
        protein_g: currentDiet.diet_templates.protein_g,
        carbs_g: currentDiet.diet_templates.carbs_g,
        fat_g: currentDiet.diet_templates.fat_g,
      },
      goalTag: '',
      checkinNotes: 'Adaptación manual: generar opciones nuevas según prompt maestro',
      photoAnalysis: '',
    })

    // Guardar nueva plantilla
    const { data: template, error: tError } = await supabase
      .from('diet_templates')
      .insert({
        trainer_id: 'admin',
        name: `${profile.name} — Con opciones (${new Date().toLocaleDateString('es-ES')})`,
        content: adaptedContent,
        calories: macros.calories,
        protein_g: macros.protein_g,
        carbs_g: macros.carbs_g,
        fat_g: macros.fat_g,
      })
      .select()
      .single()

    if (tError) throw new Error(`Error creando plantilla: ${tError.message}`)

    // Asignar al socio
    const { error: aError } = await supabase
      .from('member_diets')
      .upsert({
        member_id: memberId,
        diet_template_id: template.id,
        assigned_by: 'admin',
        assigned_at: new Date().toISOString(),
      }, { onConflict: 'member_id' })

    if (aError) throw new Error(`Error asignando: ${aError.message}`)

    return NextResponse.json({
      success: true,
      message: `Dieta de ${profile.name} adaptada con opciones nuevas`,
      newMacros: macros,
      changeSummary,
    })
  } catch (error) {
    console.error('adapt-diet-manual error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
