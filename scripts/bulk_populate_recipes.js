// Script para poblar masivamente el catálogo de raciones con AI y Fotos
// Autor: Nacho Lostao (64145053-45fd-473c-b2c4-7523d181aad3)

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;
      const firstEq = trimmedLine.indexOf('=');
      if (firstEq !== -1) {
        const key = trimmedLine.substring(0, firstEq).trim();
        let value = trimmedLine.substring(firstEq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SPOONACULAR_KEY = process.env.SPOONACULAR_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ADMIN_ID = '64145053-45fd-473c-b2c4-7523d181aad3';

const QUERIES = [
  { q: 'vegan high protein bowl', cat: 'lunch' },
  { q: 'keto dinner salmon asparagus', cat: 'dinner' },
  { q: 'protein pancakes healthy', cat: 'breakfast' },
  { q: 'healthy protein brownie', cat: 'snack' },
  { q: 'sugar free cheesecake protein', cat: 'snack' },
  { q: 'grilled turkey with roasted vegetables', cat: 'dinner' },
  { q: 'quinoa avocado salad vegan', cat: 'lunch' },
  { q: 'egg white omelette spinach', cat: 'breakfast' },
  { q: 'low carb chicken curry', cat: 'dinner' },
  { q: 'greek yogurt with berries and seeds', cat: 'breakfast' },
  { q: 'zucchini noodles with pesto and shrimp', cat: 'lunch' },
  { q: 'baked cod with lemon and herbs', cat: 'dinner' }
];

async function translate(text, context) {
  if (!OPENAI_KEY || !text) return text || "";
  try {
    const prompt = `Translate to SPANISH (Spain). Tone: Appetite-whetting, professional, gym-focused. Return ONLY the translated string. No quotes.
    Context: ${context}
    Text: ${text}`;
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }]
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }
    });
    return response.data.choices[0].message.content.trim();
  } catch (e) {
    console.warn(`Translation failed for: ${text.substring(0, 20)}... Error: ${e.message}`);
    return text;
  }
}

async function populate() {
  if (!SPOONACULAR_KEY) {
    console.error('❌ Missing SPOONACULAR_API_KEY');
    return;
  }

  console.log('🚀 Iniciando segunda ráfaga de carga masiva (20+ recetas variadas)...');
  let total = 0;

  for (const item of QUERIES) {
    console.log(`🔍 Buscando ${item.q}...`);
    try {
      const res = await axios.get(`https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_KEY}&query=${encodeURIComponent(item.q)}&addRecipeInformation=true&addRecipeNutrition=true&instructionsRequired=true&fillIngredients=true&number=3`);
      
      if (!res.data.results) continue;

      for (const r of res.data.results) {
        console.log(`✨ Procesando: ${r.title}...`);
        
        const [titulo, desc, ingredientes, pasos] = await Promise.all([
          translate(r.title, 'Título de receta'),
          translate(r.summary ? r.summary.replace(/<[^>]*>?/gm, '').substring(0, 150) : r.title, 'Breve descripción'),
          translate((r.extendedIngredients || []).map(i => i.original).join('\n'), 'Lista de ingredientes (uno por línea)'),
          translate(r.instructions ? r.instructions.replace(/<[^>]*>?/gm, '') : 'Seguir pasos estándar.', 'Instrucciones paso a paso')
        ]);

        const nut = r.nutrition?.nutrients || [];
        const cal = Math.round(nut.find(n => n.name === 'Calories')?.amount || 0);
        const prot = Math.round(nut.find(n => n.name === 'Protein')?.amount || 0);
        const carbs = Math.round(nut.find(n => n.name === 'Carbohydrates')?.amount || 0);
        const fat = Math.round(nut.find(n => n.name === 'Fat')?.amount || 0);

        const { error } = await supabase.from('recipes').insert([{
          title: titulo,
          description: desc,
          ingredients: ingredientes,
          steps: pasos,
          category: item.cat,
          prep_time_min: r.readyInMinutes || 30,
          calories: cal,
          protein_g: prot,
          carbs_g: carbs,
          fats_g: fat,
          image_path: r.image,
          created_by: ADMIN_ID
        }]);

        if (error) {
          if (error.code === '23505') console.log(`⏩ Saltando duplicada: ${titulo}`);
          else console.error(`❌ Error guardando ${r.title}:`, error.message);
        } else {
          console.log(`✅ Guardada: ${titulo}`);
          total++;
        }
      }
    } catch (e) {
      console.error(`❌ Error en query ${item.q}:`, e.message);
    }
  }

  console.log(`\n🎉 ¡Carga completa! ${total} recetas nuevas añadidas.`);
}

populate();
