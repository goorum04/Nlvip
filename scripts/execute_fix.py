import requests
import json
import os

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k"
URL = "https://qnuzcmdjpafbqnofpzfp.supabase.co"

def run_sql(sql_content):
    rpc_url = f"{URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Intento 1: parámetro sql_query
    print("🚀 Intentando ejecutar rpc/exec_sql (parámetro sql_query)...")
    response = requests.post(rpc_url, headers=headers, json={"sql_query": sql_content})
    
    if response.status_code != 200 and response.status_code != 204:
        print(f"⚠️  RPC falló (Status {response.status_code}): {response.text}")
        print("💡 Intentando con parámetro 'sql'...")
        response = requests.post(rpc_url, headers=headers, json={"sql": sql_content})

    if response.status_code == 200 or response.status_code == 204:
        print("✅ SQL ejecutado exitosamente!")
    else:
        print(f"❌ Error final (Status {response.status_code}): {response.text}")
        print("\n💡 Si recibes un 404, es que la función 'exec_sql' no existe en tu Supabase.")
        print("   Tendrás que copiar el contenido de FIX-DB-PROBLEMS.sql manualmente en el SQL Editor.")

if __name__ == "__main__":
    sql_file = "FIX-DB-PROBLEMS.sql"
    if os.path.exists(sql_file):
        with open(sql_file, "r", encoding="utf-8") as f:
            content = f.read()
            run_sql(content)
    else:
        print(f"❌ No se encontró el archivo {sql_file}")
