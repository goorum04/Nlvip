import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Verificar que la API key existe
const apiKey = process.env.OPENAI_API_KEY

function getOpenAIClient() {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno')
  }
  return new OpenAI({ apiKey })
}

// Función para buscar imagen de receta en Unsplash
async function searchRecipeImage(recipeName) {
  try {
    // Usar la API de Unsplash para buscar imágenes
    const searchQuery = encodeURIComponent(`${recipeName} food recipe dish`)
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'demo'}`
        }
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      if (data.results && data.results.length > 0) {
        return data.results[0].urls.regular
      }
    }
    
    // Si no hay Unsplash, usar imagen placeholder de comida
    return `https://source.unsplash.com/800x600/?${encodeURIComponent(recipeName)},food,recipe`
  } catch (error) {
    console.error('Error searching image:', error)
    return `https://source.unsplash.com/800x600/?healthy,food,recipe`
  }
}

export async function POST(request) {
  try {
    const { imageBase64, imageUrl } = await request.json()

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'Se requiere una imagen del producto' }, { status: 400 })
    }

    // Prepare the image for the API
    const imageContent = imageBase64 
      ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: 'image_url', image_url: { url: imageUrl } }

    // Paso 1: Analizar el producto con visión
    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un chef nutricionista experto. Analiza fotos de productos alimenticios e ingredientes.

Tu tarea es:
1. Identificar el producto/ingrediente en la foto
2. Crear una receta saludable y deliciosa usando ese producto como ingrediente principal
3. Calcular los macronutrientes de la receta completa

IMPORTANTE:
- Responde SOLO con JSON válido, sin texto adicional
- La receta debe ser saludable y apta para deportistas
- Incluye instrucciones paso a paso claras
- Calcula los macros para 1 porción

Formato de respuesta (JSON):
{
  "producto_detectado": "Nombre del producto en la foto",
  "receta": {
    "nombre": "Nombre creativo de la receta",
    "descripcion": "Breve descripción apetitosa de la receta",
    "categoria": "desayuno" | "almuerzo" | "cena" | "snack" | "postre",
    "tiempo_preparacion": "15 minutos",
    "porciones": 2,
    "dificultad": "fácil" | "media" | "difícil",
    "ingredientes": [
      "200g del producto principal",
      "ingrediente 2 con cantidad",
      "ingrediente 3 con cantidad"
    ],
    "instrucciones": [
      "Paso 1: descripción del paso",
      "Paso 2: descripción del paso",
      "Paso 3: descripción del paso"
    ],
    "macros_por_porcion": {
      "calorias": número,
      "proteinas_g": número,
      "carbohidratos_g": número,
      "grasas_g": número,
      "fibra_g": número
    },
    "consejos": "Consejo opcional para mejorar la receta o variaciones"
  }
}`
        },
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Analiza este producto alimenticio y crea una receta saludable y deliciosa usándolo como ingrediente principal. Responde solo con JSON.' 
            },
            imageContent
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    })

    const content = analysisResponse.choices[0]?.message?.content || ''
    
    // Parse the JSON response
    let recipeData
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        recipeData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content)
      return NextResponse.json({ 
        error: 'No se pudo generar la receta. Intenta con otra imagen.' 
      }, { status: 400 })
    }

    // Paso 2: Buscar imagen de la receta
    const recipeImageUrl = await searchRecipeImage(recipeData.receta.nombre)

    // Combinar todo
    const result = {
      success: true,
      producto_detectado: recipeData.producto_detectado,
      receta: {
        ...recipeData.receta,
        imagen_url: recipeImageUrl
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Recipe generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al generar la receta' },
      { status: 500 }
    )
  }
}
