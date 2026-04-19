import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

const SPOONACULAR_KEY = process.env.SPOONACULAR_API_KEY

const MEAL_SLOTS = {
  breakfast: { percent: 0.25, query: 'desayuno saludable', type: 'breakfast' },
  lunch:     { percent: 0.35, query: 'comida saludable',     type: 'main course' },
  dinner:    { percent: 0.30, query: 'cena saludable',    type: 'main course' },
  snack:     { percent: 0.10, query: 'snack saludable',     type: 'snack' }
}

// Mapeo de preferencias del formulario a parámetros de Spoonacular
const DIET_MAP = {
  'keto': 'ketogenic',
  'paleo': 'paleo',
  'vegetariano': 'vegetarian',
  'vegano': 'vegan',
  'mediterraneo': 'whole30',
  'sin_gluten': 'gluten free',
  'equilibrada': '',
  'ninguna': ''
}

const INTOLERANCE_MAP = {
  'gluten': 'gluten',
  'lactosa': 'dairy',
  'frutos_secos': 'tree nut',
  'huevo': 'egg',
  'marisco': 'seafood',
  'soja': 'soy',
  'ninguna': ''
}

// Buscar recetas en Spoonacular para un slot específico
async function searchSpoonacular(slot, config, diet, macros, intolerances, excludeIngredients) {
  const targetCals = Math.round(macros.calories * config.percent)
  const targetProtein = Math.round(macros.protein * config.percent)
  
  let url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_KEY}`
  url += `&addRecipeInformation=true&addRecipeNutrition=true&fillIngredients=true&language=es&instructionsRequired=true`
  url += `&number=10&sort=random`
  url += `&query=${encodeURIComponent(config.query)}`
  url += `&type=${encodeURIComponent(config.type)}`
  url += `&maxCalories=${Math.round(targetCals * 1.3)}`
  url += `&minCalories=${Math.round(targetCals * 0.5)}`
  url += `&minProtein=${Math.round(targetProtein * 0.5)}`
  
  if (diet) url += `&diet=${encodeURIComponent(diet)}`
  if (intolerances) url += `&intolerances=${encodeURIComponent(intolerances)}`
  if (excludeIngredients) url += `&excludeIngredients=${encodeURIComponent(excludeIngredients)}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`Spoonacular error for ${slot}:`, res.status, await res.text())
      return []
    }
    const data = await res.json()
    return (data.results || []).map(r => {
      const nut = r.nutrition?.nutrients || []
      return {
        spoonacular_id: r.id,
        title: r.title,
        image: r.image,
        readyInMinutes: r.readyInMinutes,
        servings: r.servings,
        calories: Math.round(nut.find(n => n.name === 'Calories')?.amount || 0),
        protein_g: Math.round(nut.find(n => n.name === 'Protein')?.amount || 0),
        carbs_g: Math.round(nut.find(n => n.name === 'Carbohydrates')?.amount || 0),
        fats_g: Math.round(nut.find(n => n.name === 'Fat')?.amount || 0),
        ingredients: (r.extendedIngredients || []).map(i => i.original).join('\n'),
        instructions: r.instructions || (r.analyzedInstructions?.[0]?.steps || []).map(s => `${s.number}. ${s.step}`).join('\n'),
        category: slot
      }
    })
  } catch (err) {
    console.error(`Spoonacular fetch error for ${slot}:`, err.message)
    return []
  }
}


// Guardar receta en recipe_catalog (FK de member_recipe_plan_items) y devolver el ID
async function saveRecipeToDB(recipe, supabase) {
  // Primero intentar buscar si ya existe por título
  const { data: existing } = await supabase
    .from('recipe_catalog')
    .select('id')
    .eq('title', recipe.title)
    .maybeSingle()

  if (existing) return existing.id

  const { data, error } = await supabase
    .from('recipe_catalog')
    .insert({
      title: recipe.title,
      description: `Receta personalizada: ${recipe.title}`,
      ingredients: recipe.ingredients ? recipe.ingredients.split('\n') : [],
      instructions: recipe.instructions ? recipe.instructions.split('\n') : [],
      calories: recipe.calories,
      protein_g: recipe.protein_g,
      carbs_g: recipe.carbs_g,
      fat_g: recipe.fats_g,
      prep_time_min: recipe.readyInMinutes || 30,
      image_url: recipe.image,
      dietary_tags: [recipe.category],
      is_public: true
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving recipe to catalog:', error.message)
    return null
  }
  return data.id
}

export async function POST(req) {
  const supabase = getSupabase()
  try {
    const { memberId, dietId, trainerId } = await req.json()

    if (!memberId || !dietId) {
      return NextResponse.json({ error: 'Faltan datos (memberId, dietId)' }, { status: 400 })
    }

    if (!SPOONACULAR_KEY) {
      return NextResponse.json({ error: 'Falta la API key de Spoonacular' }, { status: 500 })
    }

    // 1. Obtener macros de la dieta
    const { data: diet, error: dietError } = await supabase
      .from('diet_templates')
      .select('*')
      .eq('id', dietId)
      .single()

    if (dietError || !diet) throw new Error('No se encontró la dieta')

    // 2. Obtener preferencias del formulario de onboarding
    const { data: onboarding } = await supabase
      .from('diet_onboarding_requests')
      .select('responses')
      .eq('member_id', memberId)
      .in('status', ['submitted', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const responses = onboarding?.responses || {}
    
    // Mapear preferencias a filtros de Spoonacular
    const spoonDiet = DIET_MAP[responses.preferencias] || ''
    const spoonIntolerances = Object.entries(INTOLERANCE_MAP)
      .filter(([key]) => (responses.restricciones || '').toLowerCase().includes(key))
      .map(([, val]) => val)
      .filter(Boolean)
      .join(',')
    const excludeIngredients = responses.no_me_gusta || ''

    const macros = {
      calories: diet.calories,
      protein: diet.protein_g,
      carbs: diet.carbs_g,
      fat: diet.fat_g
    }

    console.log(`[Recipe Plan] Generating for member ${memberId}`)
    console.log(`[Recipe Plan] Diet: ${diet.calories}kcal | Pref: ${spoonDiet || 'none'} | Intol: ${spoonIntolerances || 'none'} | Exclude: ${excludeIngredients || 'none'}`)

    // 3. Buscar recetas en Spoonacular para cada slot (en paralelo)
    const slotResults = {}
    await Promise.all(
      Object.entries(MEAL_SLOTS).map(async ([slot, config]) => {
        const recipes = await searchSpoonacular(slot, config, spoonDiet, macros, spoonIntolerances, excludeIngredients)
        slotResults[slot] = recipes
      })
    )

    // 4. Crear/actualizar plan semanal
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    let { data: plan } = await supabase
      .from('member_recipe_plans')
      .select('id')
      .eq('member_id', memberId)
      .eq('week_start_date', weekStartStr)
      .maybeSingle()

    const planData = {
      member_id: memberId,
      week_start_date: weekStartStr,
      goal: `${diet.name} - ${diet.calories}kcal`
    }

    if (plan) {
      const { data: updatedPlan, error: updateError } = await supabase
        .from('member_recipe_plans')
        .update(planData)
        .eq('id', plan.id)
        .select()
        .single()
      if (updateError) throw new Error('Error actualizando el plan: ' + updateError.message)
      plan = updatedPlan
    } else {
      const { data: newPlan, error: insertError } = await supabase
        .from('member_recipe_plans')
        .insert(planData)
        .select()
        .single()
      if (insertError) throw new Error('Error creando nuevo plan: ' + insertError.message)
      plan = newPlan
    }

    // 5. Recopilar todas las recetas únicas necesarias y guardarlas en batch
    const selectedBySlotDay = []
    for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
      for (const [slot] of Object.entries(MEAL_SLOTS)) {
        const candidates = slotResults[slot] || []
        if (candidates.length === 0) continue
        const selected = candidates[Math.floor(Math.random() * candidates.length)]
        selectedBySlotDay.push({ dayIndex, slot, recipe: selected })
      }
    }

    // Batch-check which recipes already exist
    const uniqueTitles = [...new Set(selectedBySlotDay.map(s => s.recipe.title))]
    const { data: existingRecipes } = await supabase
      .from('recipe_catalog')
      .select('id, title')
      .in('title', uniqueTitles)

    const titleToId = {}
    for (const r of (existingRecipes || [])) titleToId[r.title] = r.id

    // Batch-insert only the missing recipes
    const missingRecipes = selectedBySlotDay
      .map(s => s.recipe)
      .filter((r, idx, arr) => arr.findIndex(x => x.title === r.title) === idx) // unique
      .filter(r => !titleToId[r.title])

    if (missingRecipes.length > 0) {
      const toInsert = missingRecipes.map(r => ({
        title: r.title,
        description: `Receta personalizada: ${r.title}`,
        ingredients: r.ingredients ? r.ingredients.split('\n') : [],
        instructions: r.instructions ? r.instructions.split('\n') : [],
        calories: r.calories,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fats_g,
        prep_time_min: r.readyInMinutes || 30,
        image_url: r.image,
        dietary_tags: [r.category],
        is_public: true
      }))
      const { data: inserted } = await supabase
        .from('recipe_catalog')
        .insert(toInsert)
        .select('id, title')
      for (const r of (inserted || [])) titleToId[r.title] = r.id
    }

    // Build plan items using the pre-fetched IDs (no more per-item queries)
    const planItems = []
    for (const { dayIndex, slot, recipe } of selectedBySlotDay) {
      const recipeId = titleToId[recipe.title]
      if (!recipeId) continue
      planItems.push({
        plan_id: plan.id,
        day_of_week: dayIndex,
        meal_type: slot,
        recipe_id: recipeId
      })
    }

    // 6. Insertar items (limpiar anteriores)
    await supabase.from('member_recipe_plan_items').delete().eq('plan_id', plan.id)
    
    if (planItems.length > 0) {
      const { error: itemsError } = await supabase.from('member_recipe_plan_items').insert(planItems)
      if (itemsError) throw new Error('Error al insertar las recetas en el plan: ' + itemsError.message)
    }

    console.log(`[Recipe Plan] Generated ${planItems.length} items for member ${memberId}`)

    return NextResponse.json({ 
      success: true, 
      message: `Plan de recetas personalizado generado con ${planItems.length} comidas`,
      planId: plan.id,
      itemsCount: planItems.length,
      preferences: {
        diet: spoonDiet || 'sin preferencia',
        intolerances: spoonIntolerances || 'ninguna',
        excluded: excludeIngredients || 'ninguno'
      }
    })

  } catch (error) {
    console.error('Error in generate-recipe-plan:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
