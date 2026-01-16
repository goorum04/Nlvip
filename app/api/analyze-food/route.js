import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request) {
  try {
    const { imageBase64, imageUrl } = await request.json()

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'Se requiere una imagen' }, { status: 400 })
    }

    // Prepare the image for the API
    const imageContent = imageBase64 
      ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: 'image_url', image_url: { url: imageUrl } }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un nutricionista experto. Analiza fotos de comida y estima los macronutrientes.
          
IMPORTANTE:
- Responde SOLO con JSON válido, sin texto adicional
- Estima las cantidades basándote en el tamaño típico de las porciones
- Si no puedes identificar la comida, indica "No identificado"
- Sé conservador con las estimaciones

Formato de respuesta (JSON):
{
  "food_name": "Nombre del plato/comida",
  "description": "Descripción breve de los ingredientes visibles",
  "calories": número,
  "protein_g": número,
  "carbs_g": número,
  "fat_g": número,
  "confidence": "high" | "medium" | "low",
  "notes": "Notas adicionales si las hay"
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza esta comida y estima sus macronutrientes. Responde solo con JSON.' },
            imageContent
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    })

    const content = response.choices[0]?.message?.content || ''
    
    // Parse the JSON response
    let analysis
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', content)
      // Return a default response if parsing fails
      analysis = {
        food_name: 'Comida no identificada',
        description: 'No se pudo analizar la imagen correctamente',
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        confidence: 'low',
        notes: 'Por favor, introduce los valores manualmente'
      }
    }

    return NextResponse.json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('Food analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al analizar la imagen' },
      { status: 500 }
    )
  }
}
