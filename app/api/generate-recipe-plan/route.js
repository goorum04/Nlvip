import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no está configurada')
  return new OpenAI({ apiKey })
}

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
  'omnivoro': '',
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

function buildSpoonacularUrl({ slot, config, diet, macros, intolerances, excludeIngredients, includeIngredients }) {
  const targetCals = Math.round(macros.calories * config.percent)
  const targetProtein = Math.round(macros.protein * config.percent)

  let url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_KEY}`
  url += `&addRecipeInformation=true&addRecipeNutrition=true&fillIngredients=true&language=es&instructionsRequired=true`
  url += `&number=20&sort=random`
  url += `&query=${encodeURIComponent(config.query)}`
  url += `&type=${encodeURIComponent(config.type)}`
  url += `&maxCalories=${Math.round(targetCals * 1.3)}`
  url += `&minCalories=${Math.round(targetCals * 0.5)}`
  url += `&minProtein=${Math.round(targetProtein * 0.5)}`

  if (diet) url += `&diet=${encodeURIComponent(diet)}`
  if (intolerances) url += `&intolerances=${encodeURIComponent(intolerances)}`
  if (excludeIngredients) url += `&excludeIngredients=${encodeURIComponent(excludeIngredients)}`
  if (includeIngredients) url += `&includeIngredients=${encodeURIComponent(includeIngredients)}`
  return url
}

// Buscar recetas en Spoonacular para un slot específico
async function searchSpoonacular(slot, config, diet, macros, intolerances, excludeIngredients, includeIngredients = '') {
  const fetchAndParse = async (url) => {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`Spoonacular error for ${slot}:`, res.status, await res.text())
      return null
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
  }

  try {
    let recipes = await fetchAndParse(buildSpoonacularUrl({ slot, config, diet, macros, intolerances, excludeIngredients, includeIngredients }))
    // Fallback: if includeIngredients narrowed the results too much, retry without it
    if (includeIngredients && (!recipes || recipes.length < 4)) {
      const fallback = await fetchAndParse(buildSpoonacularUrl({ slot, config, diet, macros, intolerances, excludeIngredients, includeIngredients: '' }))
      if (fallback && fallback.length > (recipes?.length || 0)) recipes = fallback
    }
    return recipes || []
  } catch (err) {
    console.error(`Spoonacular fetch error for ${slot}:`, err.message)
    return []
  }
}

// Score: weighted absolute distance per macro, normalised by target.
// Lower is better. Protein has 1.5x weight (priority for fitness diets).
function scoreRecipeAgainstTarget(recipe, target) {
  const safe = (v) => Math.max(v, 1)
  return (
    Math.abs((recipe.calories || 0) - target.calories) / safe(target.calories)
    + 1.5 * Math.abs((recipe.protein_g || 0) - target.protein) / safe(target.protein)
    + 1.0 * Math.abs((recipe.carbs_g || 0) - target.carbs) / safe(target.carbs)
    + 1.0 * Math.abs((recipe.fats_g || 0) - target.fat) / safe(target.fat)
  )
}

function pickBestRecipe(candidates, target, recentlyUsed) {
  if (!candidates?.length) return null
  const allowed = candidates.filter(r => !recentlyUsed.has(r.spoonacular_id) && !recentlyUsed.has(r.title))
  const pool = allowed.length > 0 ? allowed : candidates
  return [...pool].sort((a, b) => scoreRecipeAgainstTarget(a, target) - scoreRecipeAgainstTarget(b, target))[0]
}

// Traducir y adaptar una receta de Spoonacular al español usando GPT
async function translateAndAdaptRecipe(openai, recipe) {
  const ingredients = recipe.ingredients || ''
  const instructions = recipe.instructions || ''

  const prompt = `Traduce esta receta al español natural (España) y adapta el nombre para un gimnasio fitness. 
Receta original: "${recipe.title}"
Ingredientes original: ${ingredients}
Instrucciones original: ${instructions}
Categoría objetivo: ${recipe.category}

Responde SOLO con JSON válido:
{
  "nombre": "nombre de la receta en español",
  "descripcion": "descripción apetitosa de 1-2 frases en español",  
  "ingredientes": ["ingrediente 1 con cantidad", "ingrediente 2 con cantidad"],
  "instrucciones": ["Paso 1: ...", "Paso 2: ...", "Paso 3: ..."],
  "consejo": "consejo opcional de preparación o variación"
}`

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.4
    })

    const content = res.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const translated = JSON.parse(jsonMatch[0])
      return {
        ...recipe,
        title: translated.nombre || recipe.title,
        description: translated.descripcion || `Receta personalizada: ${translated.nombre || recipe.title}`,
        ingredients: Array.isArray(translated.ingredientes) ? translated.ingredientes.join('\n') : translated.ingredientes || recipe.ingredients,
        instructions: Array.isArray(translated.instrucciones) ? translated.instrucciones.join('\n') : translated.instrucciones || recipe.instructions,
        consejo: translated.consejo || null
      }
    }
  } catch (err) {
    console.error('Error translating recipe:', err.message)
  }

  // Fallback if translation fails
  return {
    ...recipe,
    description: `Receta personalizada: ${recipe.title}`
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
  const openai = getOpenAIClient()
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

    // restricciones: aceptar string CSV o array; ignorar "ninguna"; matching contra INTOLERANCE_MAP
    const restrictionsText = Array.isArray(responses.restricciones)
      ? responses.restricciones.join(',')
      : (responses.restricciones || '')
    const restrictionsLower = restrictionsText.toLowerCase()
    const spoonIntolerances = Object.entries(INTOLERANCE_MAP)
      .filter(([key]) => key !== 'ninguna' && restrictionsLower.includes(key))
      .map(([, val]) => val)
      .filter(Boolean)
      .join(',')

    const excludeIngredients = (responses.no_me_gusta || '').toString().trim()

    // favoritos: pasarlos como includeIngredients (Spoonacular prioriza recetas con esos ingredientes)
    const favoritesRaw = (responses.favoritos || '').toString().trim()
    const includeIngredients = favoritesRaw
      ? favoritesRaw
          .split(/[,;\n]/)
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 5)
          .join(',')
      : ''

    const macros = {
      calories: diet.calories,
      protein: diet.protein_g,
      carbs: diet.carbs_g,
      fat: diet.fat_g
    }

    console.log(`[Recipe Plan] Generating for member ${memberId}`)
    console.log(`[Recipe Plan] Diet: ${diet.calories}kcal | Pref: ${spoonDiet || 'none'} | Intol: ${spoonIntolerances || 'none'} | Exclude: ${excludeIngredients || 'none'} | Include: ${includeIngredients || 'none'}`)

    // 3. Buscar recetas en Spoonacular para cada slot (en paralelo)
    const slotResults = {}
    await Promise.all(
      Object.entries(MEAL_SLOTS).map(async ([slot, config]) => {
        const recipes = await searchSpoonacular(slot, config, spoonDiet, macros, spoonIntolerances, excludeIngredients, includeIngredients)
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

    // 5. Recopilar las recetas: matching por macros del slot, sin repetir 2 días seguidos
    const selectedBySlotDay = []
    const lastUsedBySlot = {}   // slot → spoonacular_id usado el día anterior
    const dailyTotals = []      // for diagnostic logging

    for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
      const dayTotal = { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
      for (const [slot, config] of Object.entries(MEAL_SLOTS)) {
        const candidates = slotResults[slot] || []
        if (candidates.length === 0) continue
        const target = {
          calories: macros.calories * config.percent,
          protein: macros.protein * config.percent,
          carbs: macros.carbs * config.percent,
          fat: macros.fat * config.percent
        }
        const recent = new Set()
        if (lastUsedBySlot[slot] != null) recent.add(lastUsedBySlot[slot])
        const selected = pickBestRecipe(candidates, target, recent)
        if (!selected) continue
        selectedBySlotDay.push({ dayIndex, slot, recipe: selected })
        lastUsedBySlot[slot] = selected.spoonacular_id ?? selected.title
        dayTotal.calories += selected.calories || 0
        dayTotal.protein_g += selected.protein_g || 0
        dayTotal.carbs_g += selected.carbs_g || 0
        dayTotal.fats_g += selected.fats_g || 0
      }
      dailyTotals.push(dayTotal)
    }

    // --- TRADUCCIÓN ---
    // Traducir solo las recetas únicas seleccionadas para ahorrar tokens y tiempo
    const uniqueRecipesToTranslate = []
    const seenRecipeIds = new Set()
    
    for (const item of selectedBySlotDay) {
      const id = item.recipe.spoonacular_id ?? item.recipe.title
      if (!seenRecipeIds.has(id)) {
        uniqueRecipesToTranslate.push(item.recipe)
        seenRecipeIds.add(id)
      }
    }

    console.log(`[Recipe Plan] Translating ${uniqueRecipesToTranslate.length} unique recipes...`)
    
    // Traducir en paralelo
    const translatedMap = new Map()
    await Promise.all(uniqueRecipesToTranslate.map(async (recipe) => {
      const translated = await translateAndAdaptRecipe(openai, recipe)
      translatedMap.set(recipe.spoonacular_id ?? recipe.title, translated)
    }))

    // Reemplazar recetas en selectedBySlotDay con sus versiones traducidas
    for (const item of selectedBySlotDay) {
      const id = item.recipe.spoonacular_id ?? item.recipe.title
      if (translatedMap.has(id)) {
        item.recipe = translatedMap.get(id)
      }
    }

    // Diagnostic: per-day and weekly macro deviation vs target
    const pct = (actual, target) => target > 0 ? Math.round(((actual - target) / target) * 100) : 0
    for (let i = 0; i < dailyTotals.length; i++) {
      const t = dailyTotals[i]
      console.log(`[Recipe Plan] Day ${i + 1} actual: ${t.calories} kcal / ${t.protein_g} P / ${t.carbs_g} C / ${t.fats_g} F (target ${macros.calories}/${macros.protein}/${macros.carbs}/${macros.fat})`)
    }
    if (dailyTotals.length > 0) {
      const weekAvg = dailyTotals.reduce((a, t) => ({
        calories: a.calories + t.calories,
        protein_g: a.protein_g + t.protein_g,
        carbs_g: a.carbs_g + t.carbs_g,
        fats_g: a.fats_g + t.fats_g
      }), { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 })
      const n = dailyTotals.length
      console.log(`[Recipe Plan] Week deviation: ${pct(weekAvg.calories / n, macros.calories)}% kcal, ${pct(weekAvg.protein_g / n, macros.protein)}% P, ${pct(weekAvg.carbs_g / n, macros.carbs)}% C, ${pct(weekAvg.fats_g / n, macros.fat)}% F`)
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
