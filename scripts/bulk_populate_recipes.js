// Script para poblar masivamente el catálogo de recetas
// Para ejecutarlo: NODE_OPTIONS='--max-old-space-size=2048' node scripts/bulk_populate_recipes.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SPOONACULAR_KEY = process.env.SPOONACULAR_API_KEY;

const QUERIES = [
  { q: 'healthy breakfast', cat: 'breakfast' },
  { q: 'oatmeal recipes', cat: 'breakfast' },
  { q: 'mediterranean lunch', cat: 'lunch' },
  { q: 'high protein chicken dinner', cat: 'dinner' },
  { q: 'keto salmon', cat: 'dinner' },
  { q: 'vegan bowl', cat: 'lunch' },
  { q: 'low carb snack', cat: 'snack' },
  { q: 'smoothie fitness', cat: 'snack' }
];

async function populate() {
  console.log('🚀 Iniciando carga masiva de recetas...');
  let total = 0;

  for (const item of QUERIES) {
    console.log(`🔍 Buscando: ${item.q}...`);
    try {
      const url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_KEY}&query=${encodeURIComponent(item.q)}&addRecipeInformation=true&addRecipeNutrition=true&instructionsRequired=true&fillIngredients=true&number=5`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.results) {
        for (const r of data.results) {
          const nut = r.nutrition?.nutrients || [];
          const cal = nut.find(n => n.name === 'Calories')?.amount || 0;
          const prot = nut.find(n => n.name === 'Protein')?.amount || 0;
          const carbs = nut.find(n => n.name === 'Carbohydrates')?.amount || 0;
          const fat = nut.find(n => n.name === 'Fat')?.amount || 0;
          
          let steps = r.instructions || "";
          if (!steps && r.analyzedInstructions?.length > 0) {
            steps = r.analyzedInstructions[0].steps.map(s => `${s.number}. ${s.step}`).join('\n');
          }
          const ingredients = (r.extendedIngredients || []).map(i => i.original).join('\n');

          const { error } = await supabase.from('recipes').insert([{
            title: r.title,
            description: `Receta de ${item.cat}: ${r.title}`,
            steps,
            ingredients,
            category: item.cat,
            prep_time_min: r.readyInMinutes || 30,
            calories: Math.round(cal),
            protein_g: Math.round(prot),
            carbs_g: Math.round(carbs),
            fats_g: Math.round(fat),
            image_path: r.image
          }]);

          if (error) console.error(`❌ Error guardando ${r.title}:`, error.message);
          else {
            console.log(`✅ Guardada: ${r.title}`);
            total++;
          }
        }
      }
    } catch (e) {
      console.error(`❌ Error en query ${item.q}:`, e.message);
    }
  }

  console.log(`\n🎉 Carga finalizada. Total recetas añadidas: ${total}`);
}

populate();
