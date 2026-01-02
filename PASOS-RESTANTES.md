# ✅ PASO 1 COMPLETADO - CREDENCIALES CONFIGURADAS

La aplicación ya está conectada a Supabase y funcionando. 

## 🎯 SIGUIENTES PASOS (10 minutos):

### PASO 2: Crear las Tablas en Supabase

1. **Abre tu proyecto de Supabase**: https://supabase.com/dashboard/project/qnuzcmdjpafbqnofpzfp

2. **Ve a SQL Editor** (icono de base de datos en el menú lateral)

3. **Click en "New query"**

4. **Abre el archivo** `/app/supabase-schema.sql` en tu editor

5. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)

6. **Pégalo en el SQL Editor** de Supabase

7. **Click en "RUN"** (botón verde abajo a la derecha)

8. **Espera 5-10 segundos**. Verás: ✅ **"Success. No rows returned"**

Esto creará:
- ✅ 18 tablas
- ✅ Todas las políticas de seguridad (RLS)
- ✅ Índices para optimización
- ✅ Triggers automáticos

---

### PASO 3: Crear Usuarios Demo en Supabase

1. **En Supabase, ve a**: **Authentication** → **Users** (menú lateral)

2. **Crea 3 usuarios**:

#### Usuario 1: Admin
- Click "Add user" → "Create new user"
- Email: `admin@demo.com`
- Password: `Demo1234!`
- ✅ Click "Create user"

#### Usuario 2: Entrenador  
- Click "Add user" → "Create new user"
- Email: `entrenador@demo.com`
- Password: `Demo1234!`
- ✅ Click "Create user"

#### Usuario 3: Socio
- Click "Add user" → "Create new user"
- Email: `socio@demo.com`
- Password: `Demo1234!`
- ✅ Click "Create user"

---

### PASO 4: Insertar Datos Demo

1. **Vuelve a SQL Editor** en Supabase

2. **Click en "New query"**

3. **Abre el archivo** `/app/supabase-seed.sql`

4. **Copia TODO el contenido**

5. **Pégalo en el SQL Editor**

6. **Click en "RUN"**

7. **Verás**: ✅ **"Success"**

Esto creará:
- ✅ Perfiles para las 3 cuentas
- ✅ Asignación socio → entrenador
- ✅ 2 rutinas de ejemplo
- ✅ 2 dietas de ejemplo (con macros)
- ✅ 3 registros de progreso
- ✅ 2 avisos del entrenador
- ✅ 2 posts en el feed
- ✅ 2 códigos de invitación activos

---

## 🎮 PROBAR LA APLICACIÓN

Una vez completados los pasos 2, 3 y 4:

1. **Abre tu aplicación** en el navegador

2. **Verás la pantalla de login premium** con diseño Black & Gold

3. **Verás 3 BOTONES DEMO**:

   🔹 **"Entrar como Socio Demo"**
   - Click aquí para ver:
     - Feed social con posts
     - Rutina "Full Body - Principiante" asignada
     - Dieta 2000 kcal con macros
     - 3 registros de progreso
     - 2 avisos del entrenador
     - Calculadora de macros

   🔹 **"Entrar como Entrenador Demo"**
   - Click aquí para ver:
     - 1 socio asignado (Juan Socio)
     - 2 rutinas creadas
     - 2 dietas creadas
     - Progreso del socio
     - Panel para crear avisos

   🔹 **"Entrar como Admin Demo"**
   - Click aquí para ver:
     - Lista de entrenadores
     - Generador de códigos
     - Lista de socios
     - Moderación del feed

---

## 🎯 FLUJO COMPLETO DE REGISTRO REAL

Para probar el registro de un socio nuevo:

1. **Como Admin**:
   - Entra con botón "Admin Demo"
   - Ve a pestaña "Códigos"
   - Genera un código nuevo (selecciona "Carlos Trainer")
   - Copia el código generado (ej: NLVIP-ABCD1234)

2. **Cierra sesión** (botón "Salir")

3. **En el login**:
   - Ve a pestaña "Registro"
   - Completa el formulario
   - Usa el código que copiaste
   - Click "Crear Cuenta"

4. **¡Listo!** El nuevo socio:
   - Queda automáticamente asignado a "Carlos Trainer"
   - Puede recibir rutinas y dietas
   - Puede usar el feed social
   - Puede registrar progreso

---

## ✅ VERIFICACIÓN

Para verificar que todo funciona:

### En Supabase → Table Editor:
- ✅ Ver tabla `profiles` → 3 usuarios
- ✅ Ver tabla `workout_templates` → 2 rutinas
- ✅ Ver tabla `diet_templates` → 2 dietas
- ✅ Ver tabla `feed_posts` → 2 posts
- ✅ Ver tabla `trainer_members` → 1 asignación

### En la App:
- ✅ Los 3 botones demo funcionan
- ✅ Cada rol ve solo su información
- ✅ Feed social funciona (likes, comentarios)
- ✅ Calculadora de macros funciona
- ✅ Registro con código funciona

---

## 🚨 SI ALGO NO FUNCIONA

### No puedo entrar con cuentas demo:
- ✅ Verifica que creaste los 3 usuarios en Supabase Auth
- ✅ Verifica que el password sea exactamente: `Demo1234!`
- ✅ Verifica que ejecutaste `supabase-seed.sql`

### Error de base de datos:
- ✅ Verifica que ejecutaste `supabase-schema.sql` completo
- ✅ Ve a Supabase → Table Editor y confirma que hay 18 tablas
- ✅ Verifica que las políticas RLS están activas

### No veo datos:
- ✅ Verifica que ejecutaste `supabase-seed.sql`
- ✅ Ve a Supabase → Table Editor → `feed_posts`
- ✅ Debe haber 2 posts

---

## 📂 ARCHIVOS IMPORTANTES

- ✅ `/app/.env.local` - **YA CONFIGURADO** con tus credenciales
- ✅ `/app/supabase-schema.sql` - Ejecutar en SQL Editor (PASO 2)
- ✅ `/app/supabase-seed.sql` - Ejecutar en SQL Editor (PASO 4)
- ✅ `/app/README.md` - Documentación completa
- ✅ `/app/INSTRUCCIONES-FINALES.md` - Guía detallada

---

## 🎉 TIEMPO ESTIMADO

- ✅ Paso 1 (Credenciales): **COMPLETADO** ✨
- ⏱️ Paso 2 (SQL Schema): **3 minutos**
- ⏱️ Paso 3 (Crear usuarios): **3 minutos**
- ⏱️ Paso 4 (SQL Seed): **2 minutos**

**TOTAL: ~8 minutos más** y tendrás la app 100% funcional 🚀

---

**🖤✨ ¡Estás muy cerca! Solo faltan los pasos 2, 3 y 4 en Supabase! ✨🖤**
