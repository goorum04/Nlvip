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
  async assign_workout_to_member({ member_id, workout_id }) {
    const { error } = await supabase
      .from('member_workouts')
      .upsert({
        member_id,
        workout_template_id: workout_id,
        assigned_at: new Date().toISOString()
      }, { onConflict: 'member_id' })

    if (error) throw new Error(error.message)
    return { success: true, message: 'Rutina asignada correctamente' }
  },

  async list_workouts() {
    const { data, error } = await supabase
      .from('workout_templates')
      .select('id, name, description, goal_tag')
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
    // Upsert into macro_goals (one row per member)
    const { error } = await supabase
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

  // 🍽️ NUEVA: Generar dieta completa con recetas reales (Spoonacular + GPT)
  async generate_ai_diet_from_recipes({ member_id, member_name, prompt, goal = 'maintain', weight_kg = 75, exclude_ingredients = '', preferences = '' }) {
    // Obtener datos del socio si no se pasaron
    if (!weight_kg || weight_kg === 75) {
      const { data: profile } = await supabase
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

    async save_ai_diet({ member_id, diet_data }) {
      if (!diet_data || !diet_data.comidas) throw new Error('No hay datos de dieta para guardar')

      // 1. Crear las recetas
      const mealKeys = Object.keys(diet_data.comidas)
      const savedRecipes = []

      for (const key of mealKeys) {
        const meal = diet_data.comidas[key]
        
        const { data: recipe, error: rError } = await supabase
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
      const { data: template, error: tError } = await supabase
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
        await supabase.from('diet_recipes').insert({
          diet_template_id: template.id,
          recipe_id: sr.id,
          meal_type: sr.meal_type
        })
      }

      // 4. Asignar al socio
      const { error: aError } = await supabase
        .from('member_diets')
        .upsert({
          member_id,
          diet_template_id: template.id,
          assigned_at: new Date().toISOString()
        }, { onConflict: 'member_id' })

      if (aError) throw new Error(`Error asignando dieta: ${aError.message}`)

      // 5. Actualizar macros (opcional pero recomendado)
      await supabase.from('macro_goals').upsert({
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
      case 'generate_ai_diet_from_recipes':
        icon = '🍽️'
        description = `Generar dieta personalizada con IA para ${args.member_name || 'el socio'}: "${args.prompt || args.goal}"`
        break
      case 'save_ai_diet':
        icon = '💾'
        description = `Guardar y asignar dieta IA al socio`
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
      needsConfirmation: ['apply_full_member_plan', 'assign_trainer_to_member', 'create_invitation_code', 'create_notice', 'hide_post', 'save_ai_diet'].includes(call.function.name)
    }
  })
}
