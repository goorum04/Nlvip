import { NextResponse } from 'next/server'
import { generateSpoonacularDietPlan } from '@/lib/spoonacularDiet'

export async function POST(request) {
  try {
    const body = await request.json()
    const result = await generateSpoonacularDietPlan(body)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Spoonacular Diet Error:', error)
    return NextResponse.json({ error: error.message || 'Error generando la dieta' }, { status: 500 })
  }
}
