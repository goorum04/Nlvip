// ============================================
// Admin Assistant Tools - Catálogo de Acciones
// ============================================

import { supabase } from './supabase'
import { DIET_TEMPLATE } from './dietTemplate'

// Definición de todas las herramientas disponibles para el asistente
export const TOOLS_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "find_member",
      description: "Buscar un socio/miembro por nombre o email. Usa esto cuando el admin mencione un nombre de socio.",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Nombre o email del socio a buscar"
          }
        },
        required: ["search"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_member_summary",
      description: "Obtener resumen completo de un socio: su entrenador, dieta, rutina, peso, checkins, etc.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          }
        },
        required: ["member_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "apply_full_member_plan",
      description: "Aplicar un plan completo a un socio: calcular macros según objetivo (pérdida de grasa, mantener, ganar músculo) y asignar dieta y rutina automáticamente.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          goal: {
            type: "string",
            enum: ["fat_loss", "maintain", "muscle_gain"],
            description: "Objetivo: fat_loss (pérdida de grasa), maintain (mantener), muscle_gain (ganar músculo)"
          },
          weight_kg: {
            type: "number",
            description: "Peso del socio en kg (opcional, se usa el último registrado si no se proporciona)"
          }
        },
        required: ["member_id", "goal"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_trainer_to_member",
      description: "Asignar un entrenador a un socio",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          trainer_id: {
            type: "string",
            description: "UUID del entrenador"
          }
        },
        required: ["member_id", "trainer_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_invitation_code",
      description: "Crear un código de invitación para que nuevos socios se registren con un entrenador específico",
      parameters: {
        type: "object",
        properties: {
          trainer_id: {
            type: "string",
            description: "UUID del entrenador al que se asignarán los nuevos socios"
          },
          max_uses: {
            type: "integer",
            description: "Número máximo de usos del código (por defecto 10)"
          },
          expire_days: {
            type: "integer",
            description: "Días hasta que expire el código (por defecto 30)"
          }
        },
        required: ["trainer_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_notice",
      description: "Crear y enviar un aviso/notificación. Puede ser para todos los socios o para uno específico.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Título del aviso"
          },
          message: {
            type: "string",
            description: "Contenido del mensaje"
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high"],
            description: "Prioridad del aviso"
          },
          member_id: {
            type: "string",
            description: "UUID del socio específico (si es null, va para todos)"
          }
        },
        required: ["title", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "hide_post",
      description: "Ocultar/moderar un post del feed social",
      parameters: {
        type: "object",
        properties: {
          post_id: {
            type: "string",
            description: "UUID del post a ocultar"
          }
        },
        required: ["post_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_gym_dashboard",
      description: "Obtener resumen general del gimnasio: total socios, entrenadores, altas del mes, checkins, etc.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_trainers",
      description: "Listar todos los entrenadores disponibles con su número de socios asignados",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_recent_posts",
      description: "Listar los posts más recientes del feed para moderación",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Número de posts a mostrar (por defecto 5)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_diet_plan",
      description: "Generar un plan de dieta personalizado para un socio basado en su objetivo y peso. Incluye macros calculados y las reglas del gimnasio NL VIP.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          goal: {
            type: "string",
            enum: ["fat_loss", "maintain", "muscle_gain"],
            description: "Objetivo: fat_loss, maintain, muscle_gain"
          },
          weight_kg: {
            type: "number",
            description: "Peso del socio en kg"
          }
        },
        required: ["member_id", "goal"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_workout_to_member",
      description: "Asignar una rutina de entrenamiento a un socio. Primero lista las rutinas disponibles si no se especifica.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          workout_id: {
            type: "string",
            description: "UUID de la rutina a asignar"
          }
        },
        required: ["member_id", "workout_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_workouts",
      description: "Listar todas las rutinas de entrenamiento disponibles",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "unhide_post",
      description: "Restaurar/mostrar un post que había sido ocultado",
      parameters: {
        type: "object",
        properties: {
          post_id: {
            type: "string",
            description: "UUID del post a mostrar"
          }
        },
        required: ["post_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_member_activity",
      description: "Ver la actividad física de un socio: pasos, distancia, calorías quemadas de los últimos días",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          days: {
            type: "integer",
            description: "Número de días a consultar (por defecto 7)"
          }
        },
        required: ["member_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_member_macros",
      description: "Actualizar los macros diarios de un socio (calorías, proteína, carbohidratos, grasas)",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          calories: {
            type: "integer",
            description: "Calorías diarias"
          },
          protein_g: {
            type: "integer",
            description: "Gramos de proteína"
          },
          carbs_g: {
            type: "integer",
            description: "Gramos de carbohidratos"
          },
          fat_g: {
            type: "integer",
            description: "Gramos de grasa"
          }
        },
        required: ["member_id", "calories", "protein_g", "carbs_g", "fat_g"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_members",
      description: "Listar todos los socios del gimnasio con información básica",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Número máximo de socios a mostrar (por defecto 20)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_recipe_ideas",
      description: "Buscar recetas (ideas) en la API de Spoonacular ingresando parámetros de macros o dietas. Usa esta herramienta para obtener ideas de recetas con sus macros e instrucciones.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Término de búsqueda (ej: 'chicken', 'pasta', 'healthy dinner')" },
          max_calories: { type: "integer", description: "Opcional: límite máximo de calorías" },
          min_protein: { type: "integer", description: "Opcional: mínimo de proteínas en gramos" },
          max_carbs: { type: "integer", description: "Opcional: máximo de carbohidratos en gramos" },
          diet: { type: "string", description: "Opcional: dieta (ej: 'vegetarian', 'vegan', 'paleo', 'ketogenic')" },
          limit: { type: "integer", description: "Opcional: número de recetas a obtener (por defecto 5, máximo 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_custom_recipe",
      description: "Guarda una nueva receta en el catálogo de los socios (base de datos 'recipes'). DEBES traducir todo al ESPAÑOL (título, descripción, ingredientes, instrucciones) antes de guardarla.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nombre de la receta (EN ESPAÑOL)" },
          description: { type: "string", description: "Breve descripción apetecible (EN ESPAÑOL)" },
          ingredients: { type: "string", description: "Lista de ingredientes en texto plano, separados por saltos de línea (EN ESPAÑOL)" },
          steps: { type: "string", description: "Instrucciones de preparación paso a paso (EN ESPAÑOL)" },
          category: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Categoría de la comida" },
          prep_time_min: { type: "integer", description: "Minutos de preparación (tiempo total)" },
          calories: { type: "integer", description: "Calorías por porción" },
          protein_g: { type: "number", description: "Gramos de proteína" },
          carbs_g: { type: "number", description: "Gramos de carbohidratos" },
          fats_g: { type: "number", description: "Gramos de grasa" },
          image_path: { type: "string", description: "URL de la imagen de la receta (proporcionada por Spoonacular)" }
        },
        required: ["title", "ingredients", "steps", "category", "calories", "protein_g", "carbs_g", "fats_g"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "link_recipe_to_diet",
      description: "Asigna/Vincula una receta del catálogo a un plan de dieta (template). Esto permite que el socio vea recetas recomendadas para cada comida.",
      parameters: {
        type: "object",
        properties: {
          diet_template_id: { type: "string", description: "ID del template de dieta (UUID)" },
          recipe_id: { type: "string", description: "ID de la receta del catálogo (UUID)" },
          meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Momento del día sugerido para esta receta" }
        },
        required: ["diet_template_id", "recipe_id", "meal_slot"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_catalog_recipes",
      description: "Lista las recetas que ya están guardadas en el catálogo del gimnasio.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Filtrar por categoría" },
          limit: { type: "integer", description: "Límite de resultados (defecto 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_import_recipes",
      description: "Importa masivamente recetas de Spoonacular al catálogo local (ej: para 'keto', 'vegan', 'high-protein'). Esto pre-pobla el sistema con contenido premium.",
      parameters: {
        type: "object",
        properties: {
          queries: { type: "array", items: { type: "string" }, description: "Lista de términos de búsqueda (ej: ['keto', 'vegan breakfast', 'chicken dinner'])" },
          limit_per_query: { type: "integer", description: "Límite de recetas por cada término (defecto 5)" }
        },
        required: ["queries"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_recipes_for_macros",
      description: "Busca recetas en el CATÁLOGO LOCAL que se ajusten a unos macros específicos (+/- 15% de margen). Usa esto para recomendar comidas exactas a un socio.",
      parameters: {
        type: "object",
        properties: {
          calories: { type: "integer", description: "Calorías objetivo" },
          min_protein: { type: "integer", description: "Proteína mínima" },
          category: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Categoría de comida" },
          limit: { type: "integer", description: "Límite de resultados (defecto 5)" }
        },
        required: ["calories"]
      }
    }
  }
]

// Ejecutores de cada herramienta
export const toolExecutors = {
  async find_member({ search }) {
    const { data, error } = await supabase.rpc('rpc_find_member', { p_search: search })
    if (error) throw new Error(error.message)
    return {
      success: true,
      members: data || [],
      count: data?.length || 0,
      message: data?.length ? `Encontré ${data.length} socio(s)` : 'No encontré ningún socio con ese nombre'
    }
  },

  async get_member_summary({ member_id }) {
    const { data, error } = await supabase.rpc('rpc_get_member_summary', { p_member_id: member_id })
    if (error) throw new Error(error.message)
    return { success: true, summary: data }
  },

  async apply_full_member_plan({ member_id, goal, weight_kg }) {
    const { data, error } = await supabase.rpc('rpc_apply_full_member_plan', {
      p_member_id: member_id,
      p_goal: goal,
      p_weight_kg: weight_kg || null
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async assign_trainer_to_member({ member_id, trainer_id }) {
    const { data, error } = await supabase.rpc('rpc_assign_trainer_to_member', {
      p_member_id: member_id,
      p_trainer_id: trainer_id
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async create_invitation_code({ trainer_id, max_uses = 10, expire_days = 30 }) {
    const { data, error } = await supabase.rpc('rpc_create_invitation_code', {
      p_trainer_id: trainer_id,
      p_max_uses: max_uses,
      p_expire_days: expire_days
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async create_notice({ title, message, priority = 'normal', member_id = null }) {
    const { data, error } = await supabase.rpc('rpc_create_notice', {
      p_title: title,
      p_message: message,
      p_priority: priority,
      p_member_id: member_id
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async hide_post({ post_id }) {
    const { data, error } = await supabase.rpc('rpc_hide_post', { p_post_id: post_id })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async get_gym_dashboard() {
    const { data, error } = await supabase.rpc('rpc_get_gym_dashboard')
    if (error) throw new Error(error.message)
    return { success: true, dashboard: data }
  },

  async list_trainers() {
    const { data, error } = await supabase.rpc('rpc_list_trainers')
    if (error) throw new Error(error.message)
    return { success: true, trainers: data || [] }
  },

  async list_recent_posts({ limit = 5 }) {
    const { data, error } = await supabase
      .from('feed_posts')
      .select('id, content, created_at, is_hidden, author:profiles!feed_posts_author_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw new Error(error.message)
    return { success: true, posts: data || [] }
  },

  async generate_diet_plan({ member_id, goal, weight_kg }) {
    // Obtener datos del socio
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, weight_kg, height_cm, birth_date, sex')
      .eq('id', member_id)
      .single()
    
    const weight = weight_kg || profile?.weight_kg || 70
    const height = profile?.height_cm || 170
    const sex = profile?.sex || 'male'
    
    // Calcular edad si hay fecha de nacimiento
    let age = 30
    if (profile?.birth_date) {
      const birth = new Date(profile.birth_date)
      const today = new Date()
      age = today.getFullYear() - birth.getFullYear()
    }
    
    // Calcular BMR usando Harris-Benedict
    let bmr
    if (sex === 'female') {
      bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
    } else {
      bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    }
    
    // TDEE con factor de actividad moderado (1.55)
    const tdee = Math.round(bmr * 1.55)
    let calories, multiplier
    
    switch(goal) {
      case 'fat_loss':
        multiplier = 0.85 // -15%
        break
      case 'muscle_gain':
        multiplier = 1.15 // +15%
        break
      default:
        multiplier = 1.0 // mantenimiento
    }
    
    calories = Math.round(tdee * multiplier)
    const protein_g = Math.round(weight * 2) // 2g por kg
    const fat_g = Math.round(weight * 0.9) // 0.9g por kg
    const carbs_g = Math.round((calories - (protein_g * 4) - (fat_g * 9)) / 4)
    
    const goalNames = {
      fat_loss: 'Pérdida de grasa',
      maintain: 'Mantenimiento',
      muscle_gain: 'Ganancia muscular'
    }
    
    // Calcular creatina según peso
    const creatine_g = Math.round(weight / 10)
    
    const macros = { calories, protein_g, carbs_g, fat_g }
    
    // Usar la plantilla oficial del gimnasio
    const dietPlan = DIET_TEMPLATE.generateFullDiet(macros, `
**Objetivo:** ${goalNames[goal]}
**Creatina diaria:** ${creatine_g}g (basado en tu peso)

### Distribución sugerida de macros por comida:

| Comida | Calorías | Proteína | Carbos | Grasas |
|--------|----------|----------|--------|--------|
| Desayuno | ${Math.round(calories * 0.25)} | ${Math.round(protein_g * 0.25)}g | ${Math.round(carbs_g * 0.25)}g | ${Math.round(fat_g * 0.25)}g |
| Media Mañana | ${Math.round(calories * 0.15)} | ${Math.round(protein_g * 0.15)}g | ${Math.round(carbs_g * 0.15)}g | ${Math.round(fat_g * 0.15)}g |
| Almuerzo | ${Math.round(calories * 0.30)} | ${Math.round(protein_g * 0.30)}g | ${Math.round(carbs_g * 0.30)}g | ${Math.round(fat_g * 0.30)}g |
| Merienda | ${Math.round(calories * 0.10)} | ${Math.round(protein_g * 0.10)}g | ${Math.round(carbs_g * 0.10)}g | ${Math.round(fat_g * 0.10)}g |
| Cena | ${Math.round(calories * 0.20)} | ${Math.round(protein_g * 0.20)}g | ${Math.round(carbs_g * 0.20)}g | ${Math.round(fat_g * 0.20)}g |
`)
    
    return { 
      success: true, 
      diet_plan: dietPlan,
      macros,
      member_name: profile?.name,
      goal: goalNames[goal],
      profile_data: { weight, height, age, sex }
    }
  },

  // Nuevas herramientas
  async assign_workout_to_member({ member_id, workout_id }) {
    const { data, error } = await supabase
      .from('workout_assignments')
      .upsert({
        member_id,
        workout_id,
        assigned_at: new Date().toISOString()
      }, { onConflict: 'member_id' })
    
    if (error) throw new Error(error.message)
    return { success: true, message: 'Rutina asignada correctamente' }
  },

  async list_workouts() {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, name, description, difficulty, created_by')
      .order('name')
    
    if (error) throw new Error(error.message)
    return { success: true, workouts: data || [] }
  },

  async unhide_post({ post_id }) {
    const { data, error } = await supabase
      .from('feed_posts')
      .update({ is_hidden: false })
      .eq('id', post_id)
    
    if (error) throw new Error(error.message)
    return { success: true, message: 'Post restaurado y visible' }
  },

  async get_member_activity({ member_id, days = 7 }) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('daily_activity')
      .select('activity_date, steps, distance_km, calories_kcal')
      .eq('member_id', member_id)
      .gte('activity_date', startDate.toISOString().split('T')[0])
      .order('activity_date', { ascending: false })
    
    if (error) throw new Error(error.message)
    
    const totalSteps = data?.reduce((sum, d) => sum + (d.steps || 0), 0) || 0
    const totalDistance = data?.reduce((sum, d) => sum + (d.distance_km || 0), 0) || 0
    const totalCalories = data?.reduce((sum, d) => sum + (d.calories_kcal || 0), 0) || 0
    const avgSteps = data?.length ? Math.round(totalSteps / data.length) : 0
    
    return { 
      success: true, 
      activity: data || [],
      summary: {
        total_steps: totalSteps,
        total_distance_km: Math.round(totalDistance * 100) / 100,
        total_calories: Math.round(totalCalories),
        avg_steps_per_day: avgSteps,
        days_tracked: data?.length || 0
      }
    }
  },

  async update_member_macros({ member_id, calories, protein_g, carbs_g, fat_g }) {
    // Buscar si ya existe una dieta asignada
    const { data: existing } = await supabase
      .from('diet_assignments')
      .select('id')
      .eq('member_id', member_id)
      .single()
    
    if (existing) {
      // Actualizar la dieta existente
      const { error } = await supabase
        .from('diet_assignments')
        .update({ calories, protein_g, carbs_g, fat_g })
        .eq('member_id', member_id)
      
      if (error) throw new Error(error.message)
    } else {
      // Crear nueva asignación de dieta
      const { error } = await supabase
        .from('diet_assignments')
        .insert({ member_id, calories, protein_g, carbs_g, fat_g })
      
      if (error) throw new Error(error.message)
    }
    
    return { 
      success: true, 
      message: 'Macros actualizados correctamente',
      macros: { calories, protein_g, carbs_g, fat_g }
    }
  },

  async list_members({ limit = 20 }) {
    // Usar el RPC que ya existe para buscar socios
    const { data, error } = await supabase.rpc('rpc_find_member', { p_search: '' })
    
    if (error) {
      // Fallback: buscar en profiles directamente
      const { data: profiles, error: err2 } = await supabase
        .from('profiles')
        .select('id, name, email, role, has_premium, created_at')
        .order('name')
        .limit(limit)
      
      if (err2) throw new Error(err2.message)
      return { success: true, members: profiles || [], count: profiles?.length || 0 }
    }
    
    return { success: true, members: data || [], count: data?.length || 0 }
  },

  async search_recipe_ideas({ query = '', max_calories, min_protein, max_carbs, diet, limit = 5 }) {
    try {
      if (!process.env.SPOONACULAR_API_KEY) throw new Error("Falta la API key de Spoonacular en .env.local");
      let url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${process.env.SPOONACULAR_API_KEY}&addRecipeInformation=true&addRecipeNutrition=true&instructionsRequired=true&fillIngredients=true&number=${limit}`;
      if (query) url += `&query=${encodeURIComponent(query)}`;
      if (max_calories) url += `&maxCalories=${max_calories}`;
      if (min_protein) url += `&minProtein=${min_protein}`;
      if (max_carbs) url += `&maxCarbs=${max_carbs}`;
      if (diet) url += `&diet=${encodeURIComponent(diet)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Spoonacular error: ${res.statusText}`);
      const data = await res.json();
      
      const recipes = (data.results || []).map(r => {
        const nut = r.nutrition?.nutrients || [];
        const cal = nut.find(n => n.name === 'Calories')?.amount || 0;
        const prot = nut.find(n => n.name === 'Protein')?.amount || 0;
        const carbs = nut.find(n => n.name === 'Carbohydrates')?.amount || 0;
        const fat = nut.find(n => n.name === 'Fat')?.amount || 0;
        
        let instructions = r.instructions || "";
        if (!instructions && r.analyzedInstructions?.length > 0) {
          instructions = r.analyzedInstructions[0].steps.map(s => `${s.number}. ${s.step}`).join('\\n');
        }

        const ingredients = (r.extendedIngredients || []).map(i => i.original).join('\\n');

        return {
          id: r.id,
          title: r.title,
          image: r.image,
          readyInMinutes: r.readyInMinutes,
          servings: r.servings,
          sourceUrl: r.sourceUrl,
          macros: { calories: cal, protein: prot, carbs, fat },
          ingredients,
          instructions
        };
      });

      return { success: true, count: recipes.length, recipes };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async save_custom_recipe(params) {
    const { title, description, ingredients, steps, category, prep_time_min, calories, protein_g, carbs_g, fats_g, image_path } = params;
    
    // Obtener un admin aleatorio o el creador por defecto
    const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
    
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        title,
        description,
        steps,
        ingredients,
        category,
        prep_time_min,
        calories,
        protein_g,
        carbs_g,
        fats_g,
        image_path,
        created_by: admin?.id || null
      })
      .select('id')
      .single()
    
    if (error) throw new Error(error.message)
    return { success: true, message: `Receta '${title}' guardada correctamente en el catálogo.`, id: data.id }
  },

  async link_recipe_to_diet({ diet_template_id, recipe_id, meal_slot }) {
    const { error } = await supabase
      .from('diet_recipes')
      .upsert({
        diet_template_id,
        recipe_id,
        meal_slot
      }, { onConflict: 'diet_template_id, recipe_id' })
    
    if (error) throw new Error(error.message)
    return { success: true, message: 'Receta vinculada al plan de dieta correctamente.' }
  },

  async list_catalog_recipes({ category, limit = 20 }) {
    let query = supabase.from('recipes').select('*').order('created_at', { ascending: false }).limit(limit)
    if (category) query = query.eq('category', category)
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return { success: true, recipes: data || [], count: data?.length || 0 }
  },

  async bulk_import_recipes({ queries, limit_per_query = 5 }) {
    let totalImported = 0;
    const errors = [];

    for (const q of queries) {
      try {
        const result = await toolExecutors.search_recipe_ideas({ query: q, limit: limit_per_query });
        if (result.success && result.recipes?.length > 0) {
          for (const r of result.recipes) {
            // Traducir categoría si viene en la query o por defecto
            let category = 'snack';
            if (q.toLowerCase().includes('desayuno') || q.toLowerCase().includes('breakfast')) category = 'breakfast';
            else if (q.toLowerCase().includes('almuerzo') || q.toLowerCase().includes('lunch')) category = 'lunch';
            else if (q.toLowerCase().includes('cena') || q.toLowerCase().includes('dinner')) category = 'dinner';

            await toolExecutors.save_custom_recipe({
              title: r.title,
              description: `Receta saludable: ${r.title}`,
              ingredients: r.ingredients,
              steps: r.instructions,
              category,
              prep_time_min: r.readyInMinutes || 30,
              calories: Math.round(r.macros.calories),
              protein_g: Math.round(r.macros.protein),
              carbs_g: Math.round(r.macros.carbs),
              fats_g: Math.round(r.macros.fat),
              image_path: r.image
            });
            totalImported++;
          }
        }
      } catch (e) {
        errors.push(`Error en query '${q}': ${e.message}`);
      }
    }
    return { success: true, imported: totalImported, errors: errors.length > 0 ? errors : undefined };
  },

  async find_recipes_for_macros({ calories, min_protein, category, limit = 5 }) {
    const margin = 0.15; // 15% de margen
    const minCal = calories * (1 - margin);
    const maxCal = calories * (1 + margin);

    let query = supabase.from('recipes')
      .select('*')
      .gte('calories', minCal)
      .lte('calories', maxCal);
    
    if (min_protein) query = query.gte('protein_g', min_protein);
    if (category) query = query.eq('category', category);
    
    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);

    // Mapeo para el frontend por si acaso el assistant quiere mostrarlas
    const mapped = (data || []).map(r => ({
      ...r,
      name: r.title || r.name,
      instructions: r.steps || r.instructions,
      prep_time_minutes: r.prep_time_min || r.prep_time_minutes,
      fat_g: r.fats_g || r.fat_g,
      image_url: r.image_path || r.image_url
    }));

    return { success: true, count: mapped.length, recipes: mapped };
  }
}

// Ejecutar una herramienta por nombre
export async function executeTool(toolName, params) {
  const executor = toolExecutors[toolName]
  if (!executor) {
    throw new Error(`Herramienta desconocida: ${toolName}`)
  }
  return await executor(params)
}

// Generar plan de ejecución legible para el usuario
export function generateExecutionPlan(toolCalls, toolResults = {}) {
  return toolCalls.map(call => {
    const args = JSON.parse(call.function.arguments || '{}')
    const result = toolResults[call.id]
    
    let description = ''
    let icon = '🔧'
    
    switch (call.function.name) {
      case 'find_member':
        icon = '🔍'
        description = `Buscar socio: "${args.search}"`
        break
      case 'get_member_summary':
        icon = '📋'
        description = `Ver resumen del socio`
        break
      case 'apply_full_member_plan':
        icon = '🎯'
        const goalText = { fat_loss: 'pérdida de grasa', maintain: 'mantenimiento', muscle_gain: 'ganar músculo' }
        description = `Aplicar plan de ${goalText[args.goal] || args.goal} al socio`
        break
      case 'assign_trainer_to_member':
        icon = '👥'
        description = `Asignar entrenador al socio`
        break
      case 'create_invitation_code':
        icon = '🎟️'
        description = `Crear código de invitación (${args.max_uses || 10} usos, ${args.expire_days || 30} días)`
        break
      case 'create_notice':
        icon = '📢'
        description = `Crear aviso: "${args.title}"` + (args.member_id ? ' (para un socio)' : ' (para todos)')
        break
      case 'hide_post':
        icon = '🚫'
        description = `Ocultar post del feed`
        break
      case 'get_gym_dashboard':
        icon = '📊'
        description = `Ver resumen del gimnasio`
        break
      case 'list_trainers':
        icon = '👨‍🏫'
        description = `Listar entrenadores`
        break
      case 'list_recent_posts':
        icon = '📝'
        description = `Ver posts recientes`
        break
      case 'generate_diet_plan':
        icon = '🥗'
        const dietGoalText = { fat_loss: 'pérdida de grasa', maintain: 'mantenimiento', muscle_gain: 'ganancia muscular' }
        description = `Generar plan de dieta (${dietGoalText[args.goal] || args.goal})`
        break
      case 'assign_workout_to_member':
        icon = '🏋️'
        description = `Asignar rutina al socio`
        break
      case 'list_workouts':
        icon = '📚'
        description = `Listar rutinas disponibles`
        break
      case 'unhide_post':
        icon = '👁️'
        description = `Restaurar post del feed`
        break
      case 'get_member_activity':
        icon = '👟'
        description = `Ver actividad física del socio (${args.days || 7} días)`
        break
      case 'update_member_macros':
        icon = '🎯'
        description = `Actualizar macros: ${args.calories}kcal, P:${args.protein_g}g, C:${args.carbs_g}g, G:${args.fat_g}g`
        break
      case 'list_members':
        icon = '👥'
        description = `Listar socios del gimnasio`
        break
      case 'search_recipe_ideas':
        icon = '🔍🥗'
        description = `Buscar recetas en Spoonacular (${args.query || 'fitness'})`
        break
      case 'save_custom_recipe':
        icon = '💾'
        description = `Guardar receta en el catálogo: "${args.title}"`
        break
      case 'link_recipe_to_diet':
        icon = '🔗'
        description = `Vincular receta al plan de dieta`
        break
      case 'list_catalog_recipes':
        icon = '📖'
        description = `Listar recetas del catálogo`
        break
      case 'bulk_import_recipes':
        icon = '🚀🥗'
        description = `Importar masivamente recetas (${args.queries?.join(', ')})`
        break
      case 'find_recipes_for_macros':
        icon = '🎯🥗'
        description = `Buscar recetas por macros: ~${args.calories}kcal`
        break
      default:
        description = `${call.function.name}`
    }
    
    return {
      id: call.id,
      name: call.function.name,
      icon,
      description,
      args,
      result,
      needsConfirmation: ['apply_full_member_plan', 'assign_trainer_to_member', 'create_invitation_code', 'create_notice', 'hide_post', 'save_custom_recipe'].includes(call.function.name)
    }
  })
}
