#!/usr/bin/env node

// Script para aplicar la migración member_food_aversions directamente
// Uso: node scripts/apply-migration.js

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  try {
    console.log('🚀 Aplicando migración member_food_aversions...')

    // Leer el archivo de migración
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260615000001_member_food_aversions.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // Ejecutar cada statement SQL
    const statements = sql.split(';\n').filter(s => s.trim())

    for (const statement of statements) {
      if (!statement.trim().startsWith('--')) {
        console.log(`Ejecutando: ${statement.substring(0, 60)}...`)
        const { error } = await supabase.rpc('exec', { query: statement })
        if (error && !error.message.includes('already exists')) {
          console.warn(`⚠️  ${error.message}`)
        }
      }
    }

    console.log('✅ Migración aplicada exitosamente')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message)
    process.exit(1)
  }
}

applyMigration()
