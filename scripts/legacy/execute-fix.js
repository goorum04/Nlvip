const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://qnuzcmdjpafbqnofpzfp.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.HIDDEN_KEY'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function executeSql() {
    console.log('🚀 Intentando ejecutar FIX-DB-PROBLEMS.sql...')

    try {
        const sqlPath = path.join(__dirname, 'FIX-DB-PROBLEMS.sql')
        const sql = fs.readFileSync(sqlPath, 'utf8')

        // Intentar usar la función rpc 'exec_sql' que parece existir según setup-supabase.js
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

        if (error) {
            console.error('❌ Error ejecutando SQL via RPC (exec_sql):', error.message)
            console.log('💡 Intentando con parámetro "sql" en lugar de "sql_query"...')

            const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql: sql })

            if (error2) {
                throw new Error('No se pudo ejecutar el SQL. Asegúrate de que la función "exec_sql" existe en Supabase.\nError: ' + error2.message)
            }
            console.log('✅ SQL ejecutado exitosamente con parámetro "sql"')
        } else {
            console.log('✅ SQL ejecutado exitosamente')
        }
    } catch (err) {
        console.error('💥 Fallo crítico:', err.message)
        process.exit(1)
    }
}

executeSql()
