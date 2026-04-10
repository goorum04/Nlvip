import { NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no está configurada')
  return new OpenAI({ apiKey })
}

// Mapear categoría de comida a meal type de Spoonacular
function getMealType(category) {
  const map = {
    desayuno: 'breakfast',
    almuerzo: 'main course',
    cena: 'main course',
    merienda: 'snack',
    snack: 'snack',
    postre: 'dessert',
  }
  return map[category?.toLowerCase()] || 'main course'
}

// Buscar recetas en Spoonacular por tipo de comida y filtros nutricionales
async function searchSpoonacularRecipes({ 
  mealType, 
  maxCalories, 
  minProtein, 
  maxFat,
  minCarbs,
  maxCarbs,
  query = '',
  excludeIngredients = '',
  number = 3
}) {
  const apiKey = process.env.SPOONACULAR_API_KEY
  if (!apiKey) return null

  const params = new URLSearchParams({
    apiKey,
    type: mealType,
    addRecipeNutrition: 'true',
    addRecipeInformation: 'true',
    fillIngredients: 'true',
    number: String(number),
    language: 'es',
    instructionsRequired: 'true',
    sort: 'popularity',
  })

  if (maxCalories) params.append('maxCalories', String(maxCalories))
  if (minProtein) params.append('minProtein', String(minProtein))
  if (maxFat) params.append('maxFat', String(maxFat))
  if (minCarbs) params.append('minCarbs', String(minCarbs))
  if (maxCarbs) params.append('maxCarbs', String(maxCarbs))
  if (query) params.append('query', query)
  if (excludeIngredients) params.append('excludeIngredients', excludeIngredients)

  try {
    const res = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`
    )
    if (!res.ok) {
      console.error('Spoonacular error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    return data.results || []
  } catch (err) {
    console.error('Spoonacular fetch error:', err)
    return null
  }
}

// Traducir y adaptar una receta de Spoonacular al español usando GPT
async function translateAndAdaptRecipe(openai, recipe, targetCategory) {
  const ingredients = recipe.extendedIngredients?.map(i => 
    `${i.amount} ${i.unit} de ${i.nameClean || i.name}`
  ).join(', ') || ''

  const instructions = recipe.analyzedInstructions?.[0]?.steps?.map(
    (s, i) => `${i + 1}. ${s.step}`
  ).join('\n') || recipe.instructions || ''

  const macros = recipe.nutrition?.nutrients
  const calories = macros?.find(n => n.name === 'Calories')?.amount || 0
  const protein = macros?.find(n => n.name === 'Protein')?.amount || 0
  const carbs = macros?.find(n => n.name === 'Carbohydrates')?.amount || 0
  const fat = macros?.find(n => n.name === 'Fat')?.amount || 0
  const fiber = macros?.find(n => n.name === 'Fiber')?.amount || 0

  const prompt = `Traduce esta receta al español natural (España) y adapta el nombre para un gimnasio fitness. 
Receta original: "${recipe.title}"
Ingredientes: ${ingredients}
Instrucciones: ${instructions}
Categoría objetivo: ${targetCategory}

Responde SOLO con JSON válido:
{
  "nombre": "nombre de la receta en español",
  "descripcion": "descripción apetitosa de 1-2 frases en español",  
  "ingredientes": ["ingrediente 1 con cantidad", "ingrediente 2 con cantidad"],
  "instrucciones": ["Paso 1: ...", "Paso 2: ...", "Paso 3: ..."],
  "consejo": "consejo opcional de preparación o variación"
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.4
  })

  const content = res.choices[0]?.message?.content || ''
  let translated = {}

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) translated = JSON.parse(jsonMatch[0])
  } catch {
    translated = {
      nombre: recipe.title,
      descripcion: 'Receta saludable para deportistas',
      ingredientes: [ingredients],
      instrucciones: ['Preparar según indicaciones'],
    }
  }

  return {
    nombre: translated.nombre || recipe.title,
    descripcion: translated.descripcion || '',
    categoria: targetCategory,
    tiempo_preparacion: recipe.readyInMinutes ? `${recipe.readyInMinutes} minutos` : '30 minutos',
    porciones: recipe.servings || 1,
    dificultad: recipe.readyInMinutes > 45 ? 'difícil' : recipe.readyInMinutes > 20 ? 'media' : 'fácil',
    ingredientes: translated.ingredientes || [ingredients],
    instrucciones: translated.instrucciones || ['Preparar los ingredientes', 'Cocinar según indicaciones', 'Servir caliente'],
    macros_por_porcion: {
      calorias: Math.round(calories / (recipe.servings || 1)),
      proteinas_g: Math.round(protein / (recipe.servings || 1)),
      carbohidratos_g: Math.round(carbs / (recipe.servings || 1)),
      grasas_g: Math.round(fat / (recipe.servings || 1)),
      fibra_g: Math.round(fiber / (recipe.servings || 1)),
    },
    imagen_url: recipe.image || null,
    spoonacular_id: recipe.id,
    fuente_url: recipe.sourceUrl || null,
    consejo: translated.consejo || null,
  }
}

// POST: Generar plan de dieta completo con recetas de Spoonacular
export async function POST(request) {
  try {
    const {
      // Descripción en lenguaje natural del admin
      prompt,
      // Datos del socio (para calcular macros)
      member_id,
      member_name,
      weight_kg = 75,
      goal = 'maintain', // fat_loss, maintain, muscle_gain
      // Restricciones alimenticias
      exclude_ingredients = '',
      preferences = '',
      sex = 'male',
      height_cm = 170,
      age = 30,
    } = await request.json()

    const openai = getOpenAIClient()

    // ---- PASO 1: Calcular macros con Harris-Benedict ----
    let bmr
    if (sex === 'female') {
      bmr = 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age)
    } else {
      bmr = 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age)
    }
    const tdee = Math.round(bmr * 1.55)
    const multiplier = goal === 'fat_loss' ? 0.85 : goal === 'muscle_gain' ? 1.15 : 1.0
    const totalCalories = Math.round(tdee * multiplier)
    const protein_g = Math.round(weight_kg * 2)
    const fat_g = Math.round(weight_kg * 0.9)
    const carbs_g = Math.round((totalCalories - protein_g * 4 - fat_g * 9) / 4)

    // ---- PASO 2: Interpretar el prompt con GPT para extraer restricciones concretas ----
    const interpretRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `El dietista del gimnasio dice: "${prompt || `dieta para ${goal}, peso ${weight_kg}kg`}"
Preferencias adicionales: "${preferences}"
Ingredientes a excluir: "${exclude_ingredients}"

Responde SOLO con JSON: 
{
  "tipo_dieta": "descripción breve (ej: baja en carbos, alta en proteínas...)",
  "keywords_desayuno": "palabras clave en inglés para buscar receta de desayuno (1-3 palabras)",
  "keywords_media_manana": "palabras clave en inglés para buscar receta de media mañana/snack",
  "keywords_almuerzo": "palabras clave en inglés para buscar receta de almuerzo/comida",
  "keywords_merienda": "palabras clave en inglés para buscar receta de merienda",
  "keywords_cena": "palabras clave en inglés para buscar receta de cena",
  "exclusiones_ingles": "ingredientes a excluir en inglés separados por coma",
  "notas_dieta": "notas importantes sobre la dieta en español"
}`
      }],
      max_tokens: 400,
      temperature: 0.3
    })

    let dietInterpretation = {}
    try {
      const m = interpretRes.choices[0].message.content.match(/\{[\s\S]*\}/)
      if (m) dietInterpretation = JSON.parse(m[0])
    } catch {
      dietInterpretation = {
        keywords_desayuno: 'healthy breakfast protein',
        keywords_almuerzo: 'healthy chicken rice',
        keywords_cena: 'healthy grilled fish',
        keywords_media_manana: 'protein snack',
        keywords_merienda: 'healthy snack',
        exclusiones_ingles: exclude_ingredients,
        notas_dieta: '',
      }
    }

    const excludeStr = dietInterpretation.exclusiones_ingles || exclude_ingredients

    // ---- PASO 3: Buscar recetas en Spoonacular por cada comida ----
    const hasSpoonacular = !!process.env.SPOONACULAR_API_KEY

    // Distribución calórica por comida
    const meals = [
      { key: 'desayuno', label: 'Desayuno', fraction: 0.25, mealType: 'breakfast', keywords: dietInterpretation.keywords_desayuno },
      { key: 'media_manana', label: 'Media Mañana', fraction: 0.15, mealType: 'snack', keywords: dietInterpretation.keywords_media_manana },
      { key: 'almuerzo', label: 'Almuerzo', fraction: 0.30, mealType: 'main course', keywords: dietInterpretation.keywords_almuerzo },
      { key: 'merienda', label: 'Merienda', fraction: 0.10, mealType: 'snack', keywords: dietInterpretation.keywords_merienda },
      { key: 'cena', label: 'Cena', fraction: 0.20, mealType: 'main course', keywords: dietInterpretation.keywords_cena },
    ]

    const dietPlan = {}

    for (const meal of meals) {
      const mealCalories = Math.round(totalCalories * meal.fraction)
      const mealProtein = Math.round(protein_g * meal.fraction)
      const mealCarbs = Math.round(carbs_g * meal.fraction)
      const mealFat = Math.round(fat_g * meal.fraction)

      let spoonacularRecipes = null
      if (hasSpoonacular) {
        spoonacularRecipes = await searchSpoonacularRecipes({
          mealType: meal.mealType,
          maxCalories: Math.round(mealCalories * 1.3),
          minProtein: Math.round(mealProtein * 0.7),
          maxFat: Math.round(mealFat * 1.5),
          query: meal.keywords || '',
          excludeIngredients: excludeStr,
          number: 1,
        })
      }

      if (spoonacularRecipes && spoonacularRecipes.length > 0) {
        // Tenemos receta real de Spoonacular, traducirla
        const translated = await translateAndAdaptRecipe(openai, spoonacularRecipes[0], meal.key)
        dietPlan[meal.key] = {
          ...translated,
          categoria_display: meal.label,
          calorias_objetivo: mealCalories,
          fuente: 'spoonacular',
        }
      } else {
        // Fallback: generar receta con GPT directamente
        const fallbackRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Crea UNA receta de ${meal.label.toLowerCase()} en español para un deportista.
Requisitos: ${dietInterpretation.tipo_dieta || 'saludable y equilibrada'}
Macros objetivo: ~${mealCalories} kcal, ~${mealProtein}g proteína, ~${mealCarbs}g carbos, ~${mealFat}g grasa
${excludeStr ? `Evitar: ${exclude_ingredients}` : ''}

Responde SOLO con JSON:
{
  "nombre": "...",
  "descripcion": "...",
  "ingredientes": ["100g de...", "..."],
  "instrucciones": ["Paso 1: ...", "Paso 2: ..."],
  "macros_por_porcion": { "calorias": ${mealCalories}, "proteinas_g": ${mealProtein}, "carbohidratos_g": ${mealCarbs}, "grasas_g": ${mealFat}, "fibra_g": 5 },
  "tiempo_preparacion": "20 minutos",
  "dificultad": "fácil",
  "consejo": "..."
}`
          }],
          max_tokens: 600,
          temperature: 0.6
        })

        let recipeData = {}
        try {
          const m = fallbackRes.choices[0].message.content.match(/\{[\s\S]*\}/)
          if (m) recipeData = JSON.parse(m[0])
        } catch {
          recipeData = {
            nombre: `${meal.label} saludable`,
            descripcion: 'Comida equilibrada para deportistas',
            ingredientes: ['Ingredientes según disponibilidad'],
            instrucciones: ['Preparar y cocinar al gusto'],
            macros_por_porcion: { calorias: mealCalories, proteinas_g: mealProtein, carbohidratos_g: mealCarbs, grasas_g: mealFat, fibra_g: 5 },
          }
        }

        dietPlan[meal.key] = {
          nombre: recipeData.nombre,
          descripcion: recipeData.descripcion,
          categoria: meal.key,
          categoria_display: meal.label,
          tiempo_preparacion: recipeData.tiempo_preparacion || '20 minutos',
          porciones: 1,
          dificultad: recipeData.dificultad || 'fácil',
          ingredientes: recipeData.ingredientes || [],
          instrucciones: recipeData.instrucciones || [],
          macros_por_porcion: recipeData.macros_por_porcion,
          imagen_url: null,
          consejo: recipeData.consejo || null,
          calorias_objetivo: mealCalories,
          fuente: 'openai',
        }
      }
    }

    const goalNames = {
      fat_loss: 'Pérdida de Grasa',
      maintain: 'Mantenimiento',
      muscle_gain: 'Ganancia Muscular',
    }

    return NextResponse.json({
      success: true,
      member_id,
      member_name,
      goal,
      goal_display: goalNames[goal] || goal,
      tipo_dieta: dietInterpretation.tipo_dieta || 'Dieta equilibrada',
      notas: dietInterpretation.notas_dieta || '',
      macros_diarios: {
        calorias: totalCalories,
        proteinas_g: protein_g,
        carbohidratos_g: carbs_g,
        grasas_g: fat_g,
      },
      comidas: dietPlan,
      usa_spoonacular: hasSpoonacular,
      generado_en: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Spoonacular Diet Error:', error)
    return NextResponse.json({ error: error.message || 'Error generando la dieta' }, { status: 500 })
  }
}
