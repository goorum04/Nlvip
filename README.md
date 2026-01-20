# 🖤✨ NL VIP CLUB - Gimnasio Premium ✨🖤

Aplicación PWA profesional para la gestión integral de un gimnasio premium con socios, entrenadores y administradores.

## 🚀 Características Principales

### 👤 Roles y Funcionalidades

#### **ADMIN**
- Crear entrenadores
- Generar códigos de invitación
- Asignar socios a entrenadores
- Moderar contenido del feed
- Vista completa del sistema

#### **TRAINER (Entrenador)**
- Gestionar socios asignados
- Crear rutinas de entrenamiento
- Crear planes de dieta
- Asignar rutinas y dietas
- Ver progreso de socios
- Crear avisos y notificaciones

#### **MEMBER (Socio)**
- Feed social privado
- Ver rutina asignada
- Ver dieta asignada
- Registrar progreso físico
- Subir fotos de progreso (privadas)
- Calculadora de macros
- Recibir avisos del entrenador

## 🛠️ Stack Tecnológico

- **Frontend**: React + Next.js 14
- **Backend**: Supabase (Auth, Database, Storage)
- **UI**: shadcn/ui + Tailwind CSS
- **Diseño**: Premium Black & Gold (#0B0B0B + #C9A24D)

## 📋 Configuración Inicial

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Espera a que el proyecto se inicialice (2-3 minutos)

### 2. Obtener Credenciales

1. En tu proyecto de Supabase, ve a **Settings → API**
2. Copia las siguientes credenciales:
   - **Project URL** (ej: `https://xxxxxxxxxxx.supabase.co`)
   - **anon public key** (clave pública que empieza con `eyJhbGc...`)

### 3. Configurar Variables de Entorno

1. Edita el archivo `/app/.env.local`
2. Reemplaza las credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...[tu-clave-completa]
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Crear las Tablas en Supabase

1. En Supabase, ve a **SQL Editor**
2. Abre el archivo `/app/supabase-schema.sql`
3. Copia TODO el contenido del archivo
4. Pégalo en el SQL Editor de Supabase
5. Click en **RUN** (esto creará todas las tablas con RLS)

### 5. Crear Cuentas Demo

En Supabase, ve a **Authentication → Users** y crea 3 usuarios:

#### Admin Demo:
- Email: `admin@demo.com`
- Password: `Demo1234!`
- Después de crear, ejecuta en SQL Editor:
```sql
INSERT INTO profiles (id, email, name, role)
SELECT id, 'admin@demo.com', 'Admin Demo', 'admin'
FROM auth.users
WHERE email = 'admin@demo.com';
```

#### Entrenador Demo:
- Email: `entrenador@demo.com`
- Password: `Demo1234!`
- Después de crear, ejecuta en SQL Editor:
```sql
INSERT INTO profiles (id, email, name, role)
SELECT id, 'entrenador@demo.com', 'Carlos Trainer', 'trainer'
FROM auth.users
WHERE email = 'entrenador@demo.com';
```

#### Socio Demo:
- Email: `socio@demo.com`
- Password: `Demo1234!`
- Después de crear, ejecuta en SQL Editor:
```sql
INSERT INTO profiles (id, email, name, role)
SELECT id, 'socio@demo.com', 'Juan Socio', 'member'
FROM auth.users
WHERE email = 'socio@demo.com';

-- Asignar socio al entrenador
INSERT INTO trainer_members (trainer_id, member_id)
SELECT 
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  (SELECT id FROM profiles WHERE email = 'socio@demo.com');
```

### 6. Reiniciar la Aplicación

```bash
sudo supervisorctl restart nextjs
```

## 🎮 Usar la Aplicación

### Acceso Demo

En la pantalla de login, verás 3 botones para acceder como:
- **Socio Demo** (ver feed, rutina, dieta, progreso)
- **Entrenador Demo** (gestionar socios, crear rutinas/dietas)
- **Admin Demo** (control total del sistema)

### Flujo de Registro Normal

1. **Admin** crea un código de invitación asociado a un entrenador
2. **Socio** usa el código para registrarse
3. **Socio** queda automáticamente asignado al entrenador
4. **Entrenador** puede asignar rutinas y dietas
5. **Socio** ve su rutina/dieta y registra progreso

## 📊 Modelo de Datos

### Tablas Principales:

- `profiles` - Usuarios del sistema (admin, trainer, member)
- `invitation_codes` - Códigos de registro
- `trainer_members` - Asignación trainer → socio (inmutable)
- `feed_posts`, `feed_comments`, `feed_likes` - Feed social
- `workout_templates`, `diet_templates` - Plantillas reutilizables
- `member_workouts`, `member_diets` - Asignaciones
- `progress_records` - Progreso físico del socio
- `trainer_notices` - Avisos del entrenador

### Seguridad (RLS):

Todas las tablas tienen Row Level Security (RLS) configurado:
- **Socios**: Solo ven SU información y el feed
- **Trainers**: Solo ven SUS socios
- **Admin**: Ve todo

## 🎨 Diseño Premium

- **Colores**: Negro (#0B0B0B) + Dorado (#C9A24D)
- **Estilo**: Minimalista, elegante, high-end
- **UX**: Mobile-first, PWA ready
- **Imagen Hero**: Solo en login y home del socio

## 📱 Características del Feed Social

- Solo socios pueden publicar
- Posts con texto e imágenes
- Likes y comentarios
- Sistema de reportes
- Admin puede ocultar contenido

## 💪 Sistema de Rutinas

- Trainers crean plantillas reutilizables
- Organizadas por días
- Ejercicios con series, reps y notas
- Asignación a socios

## 🍎 Sistema de Dietas

- Calorías y distribución de macros
- Contenido libre (plan de comidas)
- Asignación a socios
- Socios solo ven SU dieta asignada

## 📈 Progreso del Socio

- Registro de peso
- Medidas corporales (pecho, cintura, cadera, brazos, piernas)
- Fotos de progreso (PRIVADAS)
- Notas personales
- Solo visible para el socio y su entrenador

## 🔔 Sistema de Avisos

- Trainers envían avisos a socios
- Puede ser a un socio específico o a todos
- Prioridad: baja, normal, alta
- Socios marcan como leídos

## 🧮 Calculadora de Macros

- Fórmula Mifflin-St Jeor
- Inputs: sexo, edad, altura, peso, actividad, objetivo
- Calcula: calorías, proteína, carbos, grasas
- Socios pueden guardar como objetivos

## 🐛 Troubleshooting

### Error: "Invalid supabaseUrl"
- Verifica que `.env.local` tenga las URLs correctas
- Reinicia el servidor: `sudo supervisorctl restart nextjs`

### No puedo iniciar sesión con cuentas demo
- Verifica que creaste los usuarios en Supabase Auth
- Verifica que insertaste los profiles en la tabla
- Verifica que las contraseñas sean exactamente `Demo1234!`

### Las políticas RLS bloquean operaciones
- Verifica que ejecutaste TODO el script SQL
- Las políticas están diseñadas para máxima seguridad
- Cada rol solo ve lo que debe ver

## 📞 Soporte

Si necesitas ayuda:
1. Revisa que todas las tablas se crearon correctamente en Supabase
2. Verifica los logs de la aplicación
3. Comprueba que las políticas RLS están activas

## 🎯 Próximos Pasos

1. Configurar Supabase Storage para fotos de progreso
2. Agregar más datos demo (posts, rutinas, dietas)
3. Configurar notificaciones push
4. Empaquetar como app móvil

## 📄 Licencia

Proyecto privado - NL VIP CLUB © 2025

---

**¡Bienvenido al club más exclusivo! 🖤✨**
