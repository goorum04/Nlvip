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
      name: "generate_ai_diet_from_recipes",
      description: "Generar una dieta COMPLETA personalizada para un socio usando IA y recetas reales (con fotos). El admin puede describir en lenguaje natural qué tipo de dieta quiere: 'baja en calorías y rica en proteínas', 'sin gluten', 'que no le guste el pescado', etc. Genera un plan con desayuno, media mañana, almuerzo, merienda y cena con ingredientes, pasos e imágenes.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio al que se va a asignar la dieta"
          },
          member_name: {
            type: "string",
            description: "Nombre del socio para personalizar la dieta"
          },
          prompt: {
            type: "string",
            description: "Descripción en lenguaje natural de la dieta: tipo, restricciones, preferencias. Ejemplo: 'alta en proteínas y baja en carbos, sin lácteos, le encanta el pollo'"
          },
          goal: {
            type: "string",
            enum: ["fat_loss", "maintain", "muscle_gain"],
            description: "Objetivo: fat_loss (bajar grasa), maintain (mantener), muscle_gain (ganar músculo)"
          },
          weight_kg: {
            type: "number",
            description: "Peso del socio en kg. Si no se sabe, usar 75"
          },
          exclude_ingredients: {
            type: "string",
            description: "Ingredientes a excluir separados por comas (alergias, intolerancias, aversiones)"
          },
          preferences: {
            type: "string",
            description: "Preferencias alimenticias adicionales del socio"
          }
        },
        required: ["member_id", "goal", "prompt"]
      }
    }
  },
  {
      type: "function",
      function: {
        name: "save_ai_diet",
        description: "Guardar y asignar una dieta generada por IA que el admin acaba de revisar. Usa esto cuando el admin diga 'asígnala', 'guárdala' o 'confirmar'.",
        parameters: {
          type: "object",
          properties: {
            member_id: {
              type: "string",
              description: "UUID del socio"
            },
            diet_data: {
              type: "object",
              description: "Todo el objeto JSON de la dieta devuelto por generate_ai_diet_from_recipes"
            }
          },
          required: ["member_id", "diet_data"]
        }
      }
    },
  {
    type: "function",
    function: {
      name: "generate_member_routine",
      description: "Generar una rutina de entrenamiento PERSONALIZADA para un socio usando IA. Tiene en cuenta automáticamente el formulario de onboarding del socio (objetivo, lesiones, restricciones, sexo) y el catálogo oficial de ejercicios del gimnasio. Es solo una previsualización: NO la guarda ni la asigna; eso lo hace save_member_routine después de la confirmación del admin. Sé lo más específico posible con los parámetros: usa el objetivo y nivel del onboarding cuando estén disponibles.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          goal: {
            type: "string",
            description: "Objetivo de la rutina en lenguaje natural: 'hipertrofia', 'fuerza', 'definición', 'pérdida de grasa', 'resistencia', etc."
          },
          days_per_week: {
            type: "integer",
            description: "Días de entrenamiento por semana (1-7). Por defecto 4 si el admin no lo especifica."
          },
          level: {
            type: "string",
            enum: ["principiante", "intermedio", "avanzado"],
            description: "Nivel del socio. Por defecto 'intermedio'."
          },
          session_duration_min: {
            type: "integer",
            description: "Duración aproximada de cada sesión en minutos. Por defecto 60."
          },
          notes: {
            type: "string",
            description: "Indicaciones adicionales del admin (lesiones extra, énfasis en grupos musculares, etc.)"
          },
          allow_supersets: {
            type: "boolean",
            description: "Permitir bi-series / tri-series. Por defecto true."
          },
          equipment: {
            type: "array",
            items: { type: "string" },
            description: "Equipamiento disponible. Vacío = todo el catálogo."
          }
        },
        required: ["member_id", "goal"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_member_routine",
      description: "Guardar la rutina generada por IA como plantilla y ASIGNARLA al socio. Usa esto SOLO cuando el admin confirme con 'asígnala', 'guárdala', 'confirmar', 'dale', etc.",
      parameters: {
        type: "object",
        properties: {
          member_id: {
            type: "string",
            description: "UUID del socio"
          },
          trainer_id: {
            type: "string",
            description: "UUID del entrenador propietario de la plantilla (opcional)"
          },
          routine_data: {
            type: "object",
            description: "Objeto JSON completo de la rutina devuelto por generate_member_routine (incluye routine_name, days, etc.)"
          }
        },
        required: ["member_id", "routine_data"]
      }
    }
  }
  ]

// Helper para obtener el cliente correcto (autenticado si está disponible)
const getSupabaseClient = (params) => params?._supabaseClient || supabase

// Ejecutores de cada herramienta
export const toolExecutors = {
  async find_member(params) {
    const { search, _supabaseClient } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_find_member', { p_search: search })
    if (error) throw new Error(error.message)
    return {
      success: true,
      members: data || [],
      count: data?.length || 0,
      message: data?.length ? `Encontré ${data.length} socio(s)` : 'No encontré ningún socio con ese nombre'
    }
  },

  async get_member_summary(params) {
    const { member_id } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_get_member_summary', { p_member_id: member_id })
    if (error) throw new Error(error.message)
    return { success: true, summary: data }
  },

  async apply_full_member_plan(params) {
    const { member_id, goal, weight_kg } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_apply_full_member_plan', {
      p_member_id: member_id,
      p_goal: goal,
      p_weight_kg: weight_kg || null
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async assign_trainer_to_member(params) {
    const { member_id, trainer_id } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_assign_trainer_to_member', {
      p_member_id: member_id,
      p_trainer_id: trainer_id
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async create_invitation_code(params) {
    const { trainer_id, max_uses = 10, expire_days = 30 } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_create_invitation_code', {
      p_trainer_id: trainer_id,
      p_max_uses: max_uses,
      p_expire_days: expire_days
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async create_notice(params) {
    const { title, message, priority = 'normal', member_id = null } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_create_notice', {
      p_title: title,
      p_message: message,
      p_priority: priority,
      p_member_id: member_id
    })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async hide_post(params) {
    const { post_id } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_hide_post', { p_post_id: post_id })
    if (error) throw new Error(error.message)
    return { success: true, result: data }
  },

  async get_gym_dashboard(params) {
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_get_gym_dashboard')
    if (error) throw new Error(error.message)
    return { success: true, dashboard: data }
  },

  async list_trainers(params) {
    const client = getSupabaseClient(params)
    const { data, error } = await client.rpc('rpc_list_trainers')
    if (error) throw new Error(error.message)
    return { success: true, trainers: data || [] }
  },

  async list_recent_posts(params) {
    const { limit = 5 } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client
      .from('feed_posts')
      .select('id, content, created_at, is_hidden, author:profiles!feed_posts_author_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw new Error(error.message)
    return { success: true, posts: data || [] }
  },

  async generate_diet_plan(params) {
    const { member_id, goal, weight_kg } = params
    const client = getSupabaseClient(params)
    // Obtener datos del socio
    const { data: profile } = await client
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
    const proteinFactor = (goal === 'muscle_gain') ? 2.4 : 2.2
    const protein_g = Math.round(weight * proteinFactor) // 2.2-2.4g por kg
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
  async assign_workout_to_member(params) {
    const { member_id, workout_id } = params
    const client = getSupabaseClient(params)
    const { error } = await client
      .from('member_workouts')
      .upsert({
        member_id,
        workout_template_id: workout_id,
        assigned_at: new Date().toISOString()
      }, { onConflict: 'member_id' })

    if (error) throw new Error(error.message)
    return { success: true, message: 'Rutina asignada correctamente' }
  },

  async list_workouts(params) {
    const client = getSupabaseClient(params)
    const { data, error } = await client
      .from('workout_templates')
      .select('id, name, description, goal_tag')
      .order('name')

    if (error) throw new Error(error.message)
    return { success: true, workouts: data || [] }
  },

  async unhide_post(params) {
    const { post_id } = params
    const client = getSupabaseClient(params)
    const { data, error } = await client
      .from('feed_posts')
      .update({ is_hidden: false })
      .eq('id', post_id)
    
    if (error) throw new Error(error.message)
    return { success: true, message: 'Post restaurado y visible' }
  },

  async get_member_activity(params) {
    const { member_id, days = 7 } = params
    const client = getSupabaseClient(params)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await client
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

  async update_member_macros(params) {
    const { member_id, calories, protein_g, carbs_g, fat_g } = params
    const client = getSupabaseClient(params)
    // Upsert into macro_goals (one row per member)
    const { error } = await client
      .from('macro_goals')
      .upsert(
        { member_id, calories, protein_g, carbs_g, fat_g, updated_at: new Date().toISOString() },
        { onConflict: 'member_id' }
      )

    if (error) throw new Error(error.message)
    return {
      success: true,
      message: 'Macros actualizados correctamente',
      macros: { calories, protein_g, carbs_g, fat_g }
    }
  },

  async list_members(params) {
    const { limit = 20 } = params
    const client = getSupabaseClient(params)
    // Usar el RPC que ya existe para buscar socios
    const { data, error } = await client.rpc('rpc_find_member', { p_search: '' })

    if (error) {
      // Fallback: buscar en profiles directamente
      const { data: profiles, error: err2 } = await client
        .from('profiles')
        .select('id, name, email, role, has_premium, created_at')
        .order('name')
        .limit(limit)
      
      if (err2) throw new Error(err2.message)
      return { success: true, members: profiles || [], count: profiles?.length || 0 }
    }
    
    return { success: true, members: data || [], count: data?.length || 0 }
  },

  async search_recipe_ideas(params) {
    const { query = '', max_calories, min_protein, max_carbs, diet, limit = 5 } = params
    try {
      let url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${process.env.SPOONACULAR_API_KEY}&addRecipeInformation=true&addRecipeNutrition=true&fillIngredients=true&language=es&instructionsRequired=true&number=${limit}`;
      if (query) url += `&query=${encodeURIComponent(query)}`;
      if (max_calories) url += `&maxCalories=${max_calories}`;
      if (min_protein) url += `&minProtein=${min_protein}`;
      if (max_carbs) url += `&maxCarbs=${max_carbs}`;
      if (diet) url += `&diet=${encodeURIComponent(diet)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Spoonacular error: ${res.status}`);
      const data = await res.json();
      console.log(`Spoonacular result for '${query}': ${data.totalResults} found. Body: ${JSON.stringify(data).substring(0, 100)}...`);
      
      const recipes = (data.results || []).map(r => {
        const nut = r.nutrition?.nutrients || [];
        const cal = nut.find(n => n.name === 'Calories')?.amount || 0;
        const prot = nut.find(n => n.name === 'Protein')?.amount || 0;
        const carbs = nut.find(n => n.name === 'Carbohydrates')?.amount || 0;
        const fat = nut.find(n => n.name === 'Fat')?.amount || 0;
        
        let instructions = r.instructions || "";
        if (!instructions && r.analyzedInstructions?.length > 0) {
          instructions = r.analyzedInstructions[0].steps.map(s => `${s.number}. ${s.step}`).join('\n');
        }

        const ingredients = (r.extendedIngredients || []).map(i => i.original).join('\n');

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

  async link_recipe_to_diet(params) {
    const { diet_template_id, recipe_id, meal_slot } = params
    const client = getSupabaseClient(params)
    const { error } = await client
      .from('diet_recipes')
      .upsert({
        diet_template_id,
        recipe_id,
        meal_slot
      }, { onConflict: 'diet_template_id, recipe_id' })
    
    if (error) throw new Error(error.message)
    return { success: true, message: 'Receta vinculada al plan de dieta correctamente.' }
  },

  async list_catalog_recipes(params) {
    const { category, limit = 20 } = params
    const client = getSupabaseClient(params)
    let query = client.from('recipes').select('*').order('created_at', { ascending: false }).limit(limit)
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return { success: true, recipes: data || [], count: data?.length || 0 }
  },

  async bulk_import_recipes(params) {
    const { queries, limit_per_query = 5 } = params
    let totalImported = 0;
    const errors = [];
    const openaiKey = process.env.OPENAI_API_KEY;

    for (const q of queries) {
      try {
        console.log(`Searching Spoonacular for: ${q}`);
        const result = await toolExecutors.search_recipe_ideas({ query: q, limit: limit_per_query });
        console.log(`Result from search_recipe_ideas for '${q}': success=${result.success}, count=${result.count}`);
        
        if (result.success && result.recipes?.length > 0) {
          console.log(`Processing ${result.recipes.length} recipes for '${q}'`);
          for (const r of result.recipes) {
            console.log(`Attempting to save recipe: ${r.title}`);
            let translated = r;
            
            // Traducir con OpenAI si hay API Key
            if (openaiKey) {
              try {
                console.log(`Translating recipe: ${r.title}`);
                const prompt = `Translate the following recipe to SPANISH. Keep it professional and appetizing. Return ONLY valid JSON.
                Recipe to translate:
                {
                  "title": "${r.title}",
                  "ingredients": "${r.ingredients.replace(/\n/g, '\\n')}",
                  "instructions": "${r.instructions.replace(/\n/g, '\\n')}"
                }`;

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" }
                  })
                });
                const responseData = await response.json();

                console.log(`Translation received for: ${r.title}`);
                const resJson = typeof responseData.choices[0].message.content === 'string'
                  ? JSON.parse(responseData.choices[0].message.content)
                  : responseData.choices[0].message.content;
                translated.title = resJson.title;
                translated.ingredients = resJson.ingredients;
                translated.instructions = resJson.instructions;
              } catch (errTranslate) {
                console.warn(`Translation failed for ${r.title}, using English: ${errTranslate.message}`);
              }
            }

            // Mapear categoría
            let category = 'snack';
            const qLower = q.toLowerCase();
            if (qLower.includes('desayuno') || qLower.includes('breakfast')) category = 'breakfast';
            else if (qLower.includes('almuerzo') || qLower.includes('lunch') || qLower.includes('comida')) category = 'lunch';
            else if (qLower.includes('cena') || qLower.includes('dinner')) category = 'dinner';

            console.log(`Saving to database: ${translated.title}`);
            const saveResult = await toolExecutors.save_custom_recipe({
              title: translated.title,
              description: `Receta saludable de ${category}: ${translated.title}`,
              ingredients: translated.ingredients,
              steps: translated.instructions,
              category,
              prep_time_min: r.readyInMinutes || 30,
              calories: Math.round(r.macros.calories),
              protein_g: Math.round(r.macros.protein),
              carbs_g: Math.round(r.macros.carbs),
              fats_g: Math.round(r.macros.fat),
              image_path: r.image
            });
            console.log(`Saved successfully: ${translated.title} -> ID: ${saveResult.id}`);
            totalImported++;
          }
        }
      } catch (e) {
        console.error(`Unhandled error in query '${q}':`, e);
        errors.push(`Error en query '${q}': ${e.message}`);
      }
    }
    return { success: true, count: totalImported, errors };
  },

  // 🍽️ NUEVA: Generar dieta completa con recetas reales (Spoonacular + GPT)
  async generate_ai_diet_from_recipes(params) {
    let { member_id, member_name, prompt, goal = 'maintain', weight_kg = 75, exclude_ingredients = '', preferences = '' } = params
    const client = getSupabaseClient(params)
    // Obtener datos del socio si no se pasaron
    if (!weight_kg || weight_kg === 75) {
      const { data: profile } = await client
        .from('profiles')
        .select('weight_kg, height_cm, birth_date, sex, name')
        .eq('id', member_id)
        .single()
      
      if (profile) {
        weight_kg = profile.weight_kg || 75
        if (!member_name) member_name = profile.name
      }
    }

    // Llamar a nuestra API de generación de dieta con Spoonacular
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/spoonacular-diet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id,
        member_name,
        prompt,
        goal,
        weight_kg,
        exclude_ingredients,
        preferences,
      })
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Error generando la dieta')
    }

    const dietData = await response.json()
    
      return {
        success: true,
        diet_generated: true,
        diet_data: dietData,
        message: `✅ Dieta generada para ${member_name || 'el socio'}: ${dietData.tipo_dieta}. Macros: ${dietData.macros_diarios.calorias} kcal, ${dietData.macros_diarios.proteinas_g}g proteína, ${dietData.macros_diarios.carbohidratos_g}g carbos, ${dietData.macros_diarios.grasas_g}g grasa.`
      }
    },

    async save_ai_diet(params) {
      const { member_id, diet_data } = params
      const client = getSupabaseClient(params)
      if (!diet_data || !diet_data.comidas) throw new Error('No hay datos de dieta para guardar')

      // 1. Crear las recetas
      const mealKeys = Object.keys(diet_data.comidas)
      const savedRecipes = []

      for (const key of mealKeys) {
        const meal = diet_data.comidas[key]

        const { data: recipe, error: rError } = await client
          .from('recipes')
          .insert({
            title: meal.nombre,
            name: meal.nombre,
            description: meal.descripcion || '',
            ingredients: JSON.stringify(meal.ingredientes || []),
            steps: JSON.stringify(meal.instrucciones || []),
            instructions: (meal.instrucciones || []).join('\n'),
            calories: meal.macros_por_porcion?.calorias || 0,
            protein_g: meal.macros_por_porcion?.proteinas_g || 0,
            carbs_g: meal.macros_por_porcion?.carbohidratos_g || 0,
            fat_g: meal.macros_por_porcion?.grasas_g || 0,
            fats_g: meal.macros_por_porcion?.grasas_g || 0,
            image_url: meal.imagen_url || null,
            category: key,
            is_published: true
          })
          .select()
          .single()

        if (rError) {
          console.error('Error saving recipe:', rError)
          continue
        }
        
        savedRecipes.push({ id: recipe.id, meal_type: key })
      }

      // 2. Crear el template de dieta
      const { data: template, error: tError } = await client
        .from('diet_templates')
        .insert({
          name: `Dieta IA: ${diet_data.tipo_dieta || 'Personalizada'}`,
          calories: diet_data.macros_diarios?.calorias || 2000,
          protein_g: diet_data.macros_diarios?.proteinas_g || 150,
          carbs_g: diet_data.macros_diarios?.carbohidratos_g || 200,
          fat_g: diet_data.macros_diarios?.grasas_g || 60,
          content: diet_data.notas || 'Generada por IA'
        })
        .select()
        .single()

      if (tError) throw new Error(`Error creando plantilla: ${tError.message}`)

      // 3. Vincular recetas al template
      for (const sr of savedRecipes) {
        await client.from('diet_recipes').insert({
          diet_template_id: template.id,
          recipe_id: sr.id,
          meal_type: sr.meal_type
        })
      }

      // 4. Asignar al socio
      const { error: aError } = await client
        .from('member_diets')
        .upsert({
          member_id,
          diet_template_id: template.id,
          assigned_at: new Date().toISOString()
        }, { onConflict: 'member_id' })

      if (aError) throw new Error(`Error asignando dieta: ${aError.message}`)

      // 5. Actualizar macros (opcional pero recomendado)
      await client.from('macro_goals').upsert({
        member_id,
        calories: template.calories,
        protein_g: template.protein_g,
        carbs_g: template.carbs_g,
        fat_g: template.fat_g,
        goal_type: diet_data.goal || 'maintain'
      }, { onConflict: 'member_id' })

      return {
        success: true,
        message: `✅ Dieta guardada y asignada correctamente a ${diet_data.member_name || 'el socio'}.`,
        template_id: template.id
      }
    },

  // 🏋️ Generar una rutina personalizada para un socio (preview, no guarda)
  async generate_member_routine(params) {
    const { member_id, goal, days_per_week = 4, level = 'intermedio', session_duration_min = 60, notes = '', allow_supersets = true, equipment = [] } = params
    const client = getSupabaseClient(params)
    const { generateRoutineForMember } = await import('./routineGeneration')

    const result = await generateRoutineForMember({
      supabase,
      member_id,
      criteria: {
        days_per_week,
        goal,
        level,
        session_duration_min,
        notes,
        allow_supersets,
        equipment
      }
    })

    const memberName = result.member_meta?.name || null
    const goalLabel = (goal || '').trim()
    const personalizedName = memberName
      ? `Rutina ${goalLabel ? goalLabel.charAt(0).toUpperCase() + goalLabel.slice(1) : 'personalizada'} – ${memberName}`
      : (result.routine.routine_name || `Rutina ${goalLabel}`)

    result.routine.routine_name = personalizedName

    return {
      success: true,
      routine_generated: true,
      routine_data: result.routine,
      replaced: result.replaced,
      injuries: result.injuries,
      member_name: memberName,
      member_id,
      message: memberName
        ? `✅ Rutina generada para ${memberName}: "${personalizedName}". Revisa el plan y confírmalo para asignárselo.`
        : `✅ Rutina generada: "${personalizedName}". Revísala y confirma para asignarla.`
    }
  },

  // 💾 Guardar la plantilla y asignarla al socio (acción de escritura, requiere confirmación)
  async save_member_routine(params) {
    const { member_id, trainer_id = null, routine_data } = params
    const client = getSupabaseClient(params)
    if (!routine_data || !Array.isArray(routine_data.days) || routine_data.days.length === 0) {
      throw new Error('No hay datos de rutina para guardar')
    }

    const { persistRoutine } = await import('./routinePersistence')

    let ownerTrainerId = trainer_id
    if (!ownerTrainerId) {
      const { data: admin } = await client
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle()
      ownerTrainerId = admin?.id || null
    }
    if (!ownerTrainerId) {
      throw new Error('No se pudo determinar el entrenador propietario de la plantilla')
    }

    const template = await persistRoutine(client, {
      trainerId: ownerTrainerId,
      routine: routine_data
    })

    const { error: assignError } = await client
      .from('member_workouts')
      .upsert({
        member_id,
        workout_template_id: template.id,
        assigned_at: new Date().toISOString()
      }, { onConflict: 'member_id' })

    if (assignError) throw new Error(`Error asignando la rutina: ${assignError.message}`)

    return {
      success: true,
      message: `✅ Rutina "${template.name}" guardada y asignada al socio.`,
      workout_template_id: template.id
    }
  }
  }

// Ejecutar una herramienta por nombre
export async function executeTool(toolName, params, adminToken) {
  const executor = toolExecutors[toolName]
  if (!executor) {
    throw new Error(`Herramienta desconocida: ${toolName}`)
  }

  // Si hay token de admin, crear un cliente con el JWT en los headers globales.
  // Esto hace que las RPCs vean al admin via auth.uid() (necesario para is_admin()).
  let enhancedParams = params
  if (adminToken) {
    const { createClient } = await import('@supabase/supabase-js')
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${adminToken}` }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
    enhancedParams = { ...params, _supabaseClient: authClient }
  }

  return await executor(enhancedParams)
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
      case 'generate_ai_diet_from_recipes':
        icon = '🍽️'
        description = `Generar dieta personalizada con IA para ${args.member_name || 'el socio'}: "${args.prompt || args.goal}"`
        break
      case 'save_ai_diet':
        icon = '💾'
        description = `Guardar y asignar dieta IA al socio`
        break
      case 'generate_member_routine':
        icon = '🏋️'
        description = `Generar rutina IA para el socio (${args.goal || 'personalizada'}, ${args.days_per_week || 4} días)`
        break
      case 'save_member_routine':
        icon = '💾'
        description = `Guardar y asignar rutina al socio`
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
      needsConfirmation: ['apply_full_member_plan', 'assign_trainer_to_member', 'create_invitation_code', 'create_notice', 'hide_post', 'save_ai_diet', 'save_member_routine'].includes(call.function.name)
    }
  })
}
