import { toolExecutors } from './lib/adminAssistantTools.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load .env.local manually without dotenv package
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  }
}

const { bulk_import_recipes } = toolExecutors;

async function run() {
  console.log('--- Iniciando importación masiva de Spoonacular ---');
  try {
    const result = await bulk_import_recipes({
      queries: [
        'mediterranean fresh summer',
        'healthy greek salad',
        'baked fish mediterranean',
        'healthy chicken lemon breast'
      ],
      limit_per_query: 5
    });
    console.log('Resultado:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error fatal:', err);
    process.exit(1);
  }
}

run();
