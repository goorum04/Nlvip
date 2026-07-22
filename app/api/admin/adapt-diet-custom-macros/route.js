import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { refineDietDraft } from '@/lib/dietGeneration'

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
    const { memberId, calories, protein_g, carbs_g, fat_g } = await req.json()
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
      .select('name')
      .eq('id', memberId)
      .single()

    const oldMacros = {
      calories: currentDiet.diet_templates.calories,
      protein_g: currentDiet.diet_templates.protein_g,
      carbs_g: currentDiet.diet_templates.carbs_g,
      fat_g: currentDiet.diet_templates.fat_g,
    }

    const newMacros = { calories, protein_g, carbs_g, fat_g }
    const correction = `Ajusta los macros a: ${calories} kcal | P: ${protein_g}g | HC: ${carbs_g}g | G: ${fat_g}g. Mantén la estructura y genera 4 opciones nuevas por comida.`

    // Usar refineDietDraft para adaptar con nuevos macros
    const { content, macros, changeSummary } = await refineDietDraft({
      currentContent: currentDiet.diet_templates.content,
      currentMacros: oldMacros,
      correction,
    })

    // Guardar nueva plantilla
    const { data: template, error: tError } = await supabase
      .from('diet_templates')
      .insert({
        trainer_id: 'admin',
        name: `${profile.name} — Macros ajustados (${new Date().toLocaleDateString('es-ES')})`,
        content,
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
      message: `Dieta de ${profile.name} adaptada con nuevos macros`,
      oldMacros,
      newMacros: macros,
      changeSummary,
    })
  } catch (error) {
    console.error('adapt-diet-custom-macros error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
