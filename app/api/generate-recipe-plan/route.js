import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const MEAL_SLOTS = {
  breakfast: { percent: 0.25 },
  lunch: { percent: 0.35 },
  dinner: { percent: 0.30 },
  snack: { percent: 0.10 }
}

export async function POST(req) {
  try {
    const { memberId, dietId, trainerId } = await req.json()

    if (!memberId || !dietId) {
      return NextResponse.json({ error: 'Faltan datos (memberId, dietId)' }, { status: 400 })
    }

    // 1. Obtener macros de la dieta
    const { data: diet, error: dietError } = await supabase
      .from('diet_templates')
      .select('*')
      .eq('id', dietId)
      .single()

    if (dietError || !diet) throw new Error('No se encontró la dieta')

    // 2. Obtener TODAS las recetas del catálogo
    const { data: allRecipes, error: recipesError } = await supabase
      .from('recipes')
      .select('*')

    if (recipesError) throw new Error('Error cargando recetas')

    // 3. Obtener o crear el plan semanal para este socio
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    // Buscar si ya existe un plan para esta semana
    let { data: plan, error: findError } = await supabase
      .from('member_recipe_plans')
      .select('id')
      .eq('member_id', memberId)
      .eq('week_start', weekStartStr)
      .maybeSingle()

    const planData = {
      member_id: memberId,
      diet_template_id: dietId,
      week_start: weekStartStr,
      status: 'active',
      target_calories: diet.calories,
      target_protein_g: diet.protein_g,
      target_carbs_g: diet.carbs_g,
      target_fat_g: diet.fat_g,
      created_by: trainerId
    }

    if (plan) {
      // Actualizar
      const { data: updatedPlan, error: updateError } = await supabase
        .from('member_recipe_plans')
        .update(planData)
        .eq('id', plan.id)
        .select()
        .single()
      if (updateError) throw new Error('Error actualizando el plan: ' + updateError.message)
      plan = updatedPlan
    } else {
      // Insertar
      const { data: newPlan, error: insertError } = await supabase
        .from('member_recipe_plans')
        .insert(planData)
        .select()
        .single()
      if (insertError) throw new Error('Error creando nuevo plan: ' + insertError.message)
      plan = newPlan
    }

    // 4. Generar items para cada día (1-7) y cada slot
    const planItems = []
    
    for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
      for (const [slot, config] of Object.entries(MEAL_SLOTS)) {
        const targetCals = diet.calories * config.percent
        
        // Encontrar mejores candidatos (misma categoría y calorias cercanas)
        const candidates = allRecipes.filter(r => r.category === slot || r.category === 'any')
        
        if (candidates.length > 0) {
          // Ordenar por cercanía a calorías objetivo
          candidates.sort((a, b) => Math.abs(a.calories - targetCals) - Math.abs(b.calories - targetCals))
          
          // Elegir una de las 3 mejores (aleatorio para variedad)
          const bestMatches = candidates.slice(0, 3)
          const selected = bestMatches[Math.floor(Math.random() * bestMatches.length)]

          planItems.push({
            plan_id: plan.id,
            day_index: dayIndex,
            meal_slot: slot,
            recipe_id: selected.id,
            notes: 'Asignado automáticamente por el club basándose en tus macros.'
          })
        }
      }
    }

    // 5. Insertar items (limpiar anteriores si existen para este plan)
    await supabase.from('member_recipe_plan_items').delete().eq('plan_id', plan.id)
    const { error: itemsError } = await supabase.from('member_recipe_plan_items').insert(planItems)

    if (itemsError) throw new Error('Error al insertar las recetas en el plan')

    return NextResponse.json({ 
      success: true, 
      message: 'Plan de recetas generado automáticamente con éxito',
      planId: plan.id,
      itemsCount: planItems.length
    })

  } catch (error) {
    console.error('Error in generate-recipe-plan:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
