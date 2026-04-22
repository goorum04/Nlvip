# 🖤✨ NL VIP TEAM — Gimnasio Premium

> Plataforma de gestión integral para gimnasios premium. PWA con roles de Administrador, Entrenador y Socio, impulsada por IA y diseño Black & Gold.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT-412991?logo=openai)
![Capacitor](https://img.shields.io/badge/Capacitor-iOS%2FAndroid-119EFF?logo=capacitor)
![Sentry](https://img.shields.io/badge/Sentry-Monitoring-362D59?logo=sentry)

---

## Índice

1. [Descripción general](#descripción-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Roles y permisos](#roles-y-permisos)
4. [Módulos y funcionalidades](#módulos-y-funcionalidades)
5. [Variables de entorno](#variables-de-entorno)
6. [Instalación y configuración](#instalación-y-configuración)
7. [Esquema de base de datos](#esquema-de-base-de-datos)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Scripts de utilidad](#scripts-de-utilidad)
10. [Build móvil (iOS/Android)](#build-móvil-iosandroid)
11. [Monitoreo y errores](#monitoreo-y-errores)
12. [Troubleshooting](#troubleshooting)

---

## Descripción general

**NL VIP TEAM** es una aplicación web progresiva (PWA) de gestión premium para gimnasios. Ofrece un ecosistema completo donde administradores, entrenadores y socios interactúan en una plataforma privada y exclusiva.

**Propuesta de valor:**
- Gestión de rutinas y dietas personalizadas con generación por IA
- Seguimiento avanzado de progreso físico y salud femenina
- Feed social privado con moderación
- Gamificación con retos y badges
- App nativa iOS/Android via Capacitor
- Diseño premium Black (`#0B0B0B`) & Gold (`#C9A24D`)

---

## Stack tecnológico

| Categoría | Tecnología | Propósito |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Framework principal |
| UI | shadcn/ui + Tailwind CSS | Componentes y estilos |
| Backend/Auth | Supabase | Autenticación, base de datos PostgreSQL, storage |
| IA | OpenAI (GPT) | Generación de rutinas, dietas, recetas y asistente |
| Recetas | Spoonacular API | Catálogo externo de recetas |
| Imágenes | Unsplash API | Fotos de recetas libres de derechos |
| Base de datos adicional | MongoDB | API catch-all (`/api/[[...path]]`) |
| Gráficas | Recharts | Estadísticas y evolución de progreso |
| Formularios | React Hook Form + Zod | Validación de formularios |
| Notificaciones web | Web Push + VAPID | Push notifications en navegador |
| App móvil | Capacitor 5 | Empaquetado nativo iOS y Android |
| Salud nativa | HealthKit (Capacitor) | Integración con salud en iOS |
| Google Fit | Google Stitch SDK | Sincronización de actividad en Android |
| Monitoreo | Sentry | Seguimiento de errores en producción |
| Carouseles | Embla Carousel | Galerías y sliders |
| Tablas | TanStack Table | Tablas de datos avanzadas |

---

## Roles y permisos

| Funcionalidad | Admin | Entrenador | Socio |
|---|:---:|:---:|:---:|
| Crear entrenadores | ✅ | ❌ | ❌ |
| Generar códigos de invitación | ✅ | ❌ | ❌ |
| Asignar socios a entrenadores | ✅ | ❌ | ❌ |
| Ver todos los socios y progreso | ✅ | Solo los suyos | Solo el propio |
| Moderar feed (ocultar posts) | ✅ | ❌ | ❌ |
| Aprobar videos de entrenamiento | ✅ | ❌ | ❌ |
| Asistente IA flotante | ✅ | ❌ | ❌ |
| Crear/asignar rutinas | ✅ | ✅ | ❌ |
| Crear/asignar dietas | ✅ | ✅ | ❌ |
| Crear planes de recetas semanales | ✅ | ✅ | ❌ |
| Enviar avisos a socios | ✅ | ✅ | ❌ |
| Subir videos de entrenamiento | ❌ | ✅ | ❌ |
| Ver feed social | ✅ | ✅ | ✅ |
| Publicar en feed | ❌ | ❌ | ✅ |
| Ver rutina y dieta asignada | — | — | ✅ |
| Registrar progreso físico | — | — | ✅ |
| Subir fotos de progreso | — | — | ✅ |
| Registrar récords personales (PR) | — | — | ✅ |
| Calculadora de macros | — | — | ✅ |
| Tracker de comida diaria | — | — | ✅ |
| Retos y badges | — | — | ✅ |
| Seguimiento de ciclo menstrual | — | — | ✅ (mujeres) |

---

## Módulos y funcionalidades

### 🏋️ Rutinas de entrenamiento

- Entrenadores crean **plantillas reutilizables** de rutinas
- Ejercicios organizados por días con series, repeticiones y notas
- Catálogo de ejercicios con equipamiento
- Asignación directa a socios
- **Generador de rutinas por IA**: crea rutinas personalizadas en segundos basándose en objetivos, nivel y equipamiento disponible
- Socios hacen **check-in diario** para registrar el entrenamiento realizado

### 🥗 Nutrición avanzada

**Dietas personalizadas:**
- Entrenadores asignan planes de dieta con calorías y distribución de macros
- Visualización de macros con barras de progreso

**Calculadora de macros:**
- Fórmula Mifflin-St Jeor
- Inputs: sexo, edad, altura, peso, nivel de actividad, objetivo
- Calcula calorías totales, proteínas, carbohidratos y grasas

**Food Tracker:**
- Registro diario de alimentos consumidos
- Seguimiento de macros en tiempo real
- Historial de comidas

**Análisis de alimentos por IA:**
- Sube una foto o describe un alimento
- La IA analiza el contenido nutricional aproximado
- Se integra con el Food Tracker

**Recetas y planes semanales:**
- Catálogo de más de 15 recetas con macros
- Integración con **Spoonacular API** para recetas externas
- Imágenes de recetas via **Unsplash API**
- **Generación de recetas por IA** según preferencias y objetivos
- **Planes de comidas semanales** (7 días × 4 slots: desayuno, almuerzo, cena, snack)
- Entrenadores asignan y personalizan los planes de recetas de cada socio

**Onboarding de dieta asistido por IA:**
- Flujo multi-paso guiado
- Generación de borrador automático
- Refinamiento interactivo
- Finalización y asignación

### 🤖 Asistente IA y automatización

| Feature | Descripción |
|---|---|
| Generador de rutinas | Crea rutinas completas en base a objetivos y perfil |
| Generador de recetas | Sugiere recetas según preferencias y macros objetivo |
| Generador de planes de comidas | Planifica una semana completa de alimentación |
| Onboarding de dieta | Guía al socio paso a paso para configurar su dieta |
| Análisis de alimentos | Estima macros de cualquier alimento via foto o texto |
| Asistente Admin (flotante) | Chatbot de ayuda para administradores del sistema |

### 👩‍⚕️ Salud femenina y ciclo menstrual

Sistema completo de seguimiento hormonal y adaptación de entrenamiento/nutrición:

**Fases del ciclo:**
- 🔴 Menstrual — recomendaciones de baja intensidad y recuperación
- 🌱 Folicular — fase de fuerza y alto rendimiento
- 🔆 Ovulación — pico de energía y resistencia
- 🌙 Lútea — adaptación de intensidad y gestión del apetito

**Funcionalidades:**
- Configuración de duración del ciclo (por defecto 28 días, período 5 días)
- Recomendaciones de macros adaptadas a cada fase hormonal
- Recomendaciones de entrenamiento según fase
- Registro de síntomas (cólicos, cambios de humor, energía, PMS)
- Historial de ciclos

**Etapas vitales:**
- Ciclo menstrual activo
- Embarazo
- Posparto (0–12 meses)
- Lactancia

Cada etapa ajusta automáticamente las recomendaciones nutricionales y de entrenamiento.

### 🏆 Gamificación

**Retos:**
- 4 plantillas de retos predefinidos
- Participación y seguimiento de progreso
- Fechas de inicio y fin configurables

**Badges (7 tipos de logros):**
- Asignados por el sistema o manualmente por el entrenador
- Visibles en el perfil del socio

**Check-ins de entrenamiento:**
- Registro diario de entrenamientos realizados
- Racha y consistencia

### 📊 Progreso y estadísticas avanzadas

**Registro de progreso:**
- Peso, medidas corporales (pecho, cintura, cadera, brazos, piernas)
- Notas personales
- Visible para el socio y su entrenador asignado

**Gráficas (Recharts):**
- Evolución del peso (línea temporal)
- Entrenamientos semanales (barras)
- Porcentaje de adherencia (circular)
- Comparativas mensuales

**Récords personales (PR Tracker):**
- Registro por ejercicio: peso × repeticiones
- Estimación de 1RM (una repetición máxima)
- Historial con fechas
- Mejor marca por ejercicio

### 📸 Fotos de progreso y videos

**Fotos de progreso:**
- Subida privada de fotos de progreso físico
- Solo visibles para el socio y su entrenador
- Galería con historial

**Videos de entrenamiento:**
- Entrenadores suben videos demostrativos (máx. 120 segundos / 50 MB)
- Flujo de aprobación: entrenador envía → admin aprueba
- Reproductor de video integrado
- Biblioteca de videos aprobados por el admin

### 📲 Notificaciones

**Push web (VAPID):**
- Notificaciones push en navegadores compatibles
- Suscripción y desuscripción por usuario
- Envío desde el backend

**Push nativas (Capacitor):**
- Notificaciones nativas en iOS y Android
- Configuración automática al instalar la app

**Avisos del entrenador:**
- Envío a un socio específico o a todos los socios
- Prioridades: baja, normal, alta
- Socios marcan los avisos como leídos

### 🛡️ Feed social privado

- Solo socios pueden publicar (texto e imágenes)
- Likes y comentarios
- Sistema de reportes
- Admins pueden ocultar contenido inapropiado
- Feed exclusivo para miembros del club

### 👥 Gestión de usuarios (Admin)

- Crear cuentas de entrenador directamente desde el panel
- Generar códigos de invitación vinculados a entrenadores
- Socios se registran con el código y quedan asignados automáticamente
- Eliminar usuarios del sistema
- Vista global del progreso de todos los socios

---

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto. Usa `.env.example` como plantilla.

### Supabase (obligatorio)

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### OpenAI — funciones de IA (obligatorio para IA)

```env
OPENAI_API_KEY=sk-...
```

### Notificaciones push web (obligatorio para push)

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:tu@email.com
```

Generar claves VAPID:
```bash
node scripts/generate-vapid-keys.js
```

### APIs externas (opcional)

```env
SPOONACULAR_API_KEY=...       # Recetas externas
UNSPLASH_ACCESS_KEY=...       # Fotos de recetas
STITCH_API_KEY=...            # Google Fit (Android)
```

### MongoDB (para API catch-all)

```env
MONGO_URL=mongodb+srv://...
DB_NAME=nlvip
```

### URLs de la aplicación

```env
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
CORS_ORIGINS=https://tu-dominio.com
```

### Monitoreo (opcional)

```env
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=tu-organizacion
SENTRY_PROJECT=nlvip
```

---

## Instalación y configuración

### Requisitos previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [OpenAI](https://platform.openai.com) (para funciones de IA)

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/goorum04/nlvip.git
cd nlvip
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales
```

### 3. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo
2. Espera 2–3 minutos a que se inicialice
3. En **Settings → API**, copia:
   - Project URL
   - `anon` public key
   - `service_role` key

### 4. Inicializar el esquema de base de datos

En el **SQL Editor** de Supabase, ejecuta el esquema maestro:

```sql
-- Ejecuta el contenido completo de:
-- sql/master-schema.sql
```

Esto crea todas las tablas, políticas RLS, funciones e índices.

### 5. Crear cuentas demo

En **Authentication → Users** de Supabase, crea los usuarios:

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@demo.com` | `Demo1234!` |
| Entrenador | `entrenador@demo.com` | `Demo1234!` |
| Socio | `socio@demo.com` | `Demo1234!` |

Luego en el SQL Editor:

```sql
-- Admin
INSERT INTO profiles (id, email, name, role)
SELECT id, 'admin@demo.com', 'Admin Demo', 'admin'
FROM auth.users WHERE email = 'admin@demo.com';

-- Entrenador
INSERT INTO profiles (id, email, name, role)
SELECT id, 'entrenador@demo.com', 'Carlos Trainer', 'trainer'
FROM auth.users WHERE email = 'entrenador@demo.com';

-- Socio
INSERT INTO profiles (id, email, name, role)
SELECT id, 'socio@demo.com', 'Juan Socio', 'member'
FROM auth.users WHERE email = 'socio@demo.com';

-- Asignar socio al entrenador
INSERT INTO trainer_members (trainer_id, member_id)
SELECT
  (SELECT id FROM profiles WHERE email = 'entrenador@demo.com'),
  (SELECT id FROM profiles WHERE email = 'socio@demo.com');
```

### 6. Configurar Storage en Supabase

Crea los siguientes buckets en **Storage → New bucket**:

| Bucket | Acceso |
|---|---|
| `progress-photos` | Privado |
| `feed-images` | Público |
| `workout-videos` | Privado |
| `avatars` | Público |

Aplica las políticas de storage ejecutando los scripts en `sql/` con prefijo `FIX-STORAGE`.

### 7. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### 8. Reiniciar en producción

```bash
sudo supervisorctl restart nextjs
```

---

## Esquema de base de datos

El esquema completo está en `sql/master-schema.sql`. Tablas principales:

| Tabla | Descripción |
|---|---|
| `profiles` | Usuarios del sistema con rol, sexo, medidas y campos de ciclo |
| `invitation_codes` | Códigos de registro vinculados a entrenadores |
| `trainer_members` | Relación entrenador–socio (inmutable) |
| `feed_posts` | Posts del feed social |
| `feed_comments` | Comentarios en el feed |
| `feed_likes` | Likes del feed |
| `workout_templates` | Plantillas reutilizables de rutinas |
| `workout_exercises` | Catálogo de ejercicios con equipamiento |
| `member_workouts` | Rutinas asignadas a socios |
| `diet_templates` | Plantillas reutilizables de dietas |
| `member_diets` | Dietas asignadas con macros |
| `progress_records` | Registros de peso y medidas |
| `progress_photos` | Fotos de progreso (privadas) |
| `trainer_notices` | Avisos de entrenadores con prioridad |
| `challenges` | Retos del gimnasio |
| `challenge_participants` | Participantes en retos |
| `badges` | Catálogo de badges (7 tipos) |
| `user_badges` | Badges asignados a socios |
| `workout_checkins` | Check-ins diarios de entrenamiento |
| `recipes` | Catálogo de recetas con macros |
| `member_recipe_plans` | Planes de comidas semanales asignados |
| `member_recipe_plan_items` | Items del plan (día × slot de comida) |
| `workout_videos` | Videos subidos por entrenadores (pendiente aprobación) |
| `training_videos` | Videos aprobados por admin |
| `food_logs` | Registro diario de alimentos |
| `symptoms_log` | Registro de síntomas del ciclo |
| `menstrual_cycles` | Historial y fases del ciclo menstrual |

**Seguridad RLS:**
- **Socios**: solo ven su propia información y el feed
- **Entrenadores**: solo ven sus socios asignados
- **Admins**: acceso total

---

## Estructura del proyecto

```
nlvip/
├── app/                          # Next.js App Router
│   ├── page.js                   # Login y hub principal
│   ├── layout.js                 # Layout raíz
│   ├── profile/                  # Perfil de usuario
│   ├── terms/                    # Términos de servicio
│   ├── privacy/                  # Política de privacidad
│   ├── auth/callback/            # OAuth callback
│   └── api/                      # API Routes
│       ├── [[...path]]/          # Catch-all (MongoDB)
│       ├── admin-assistant/      # Chatbot IA para admin
│       ├── admin-delete-user/    # Borrar usuarios
│       ├── analyze-food/         # Análisis de alimentos IA
│       ├── create-trainer/       # Crear entrenadores
│       ├── diet-onboarding/      # Onboarding de dieta multi-paso
│       ├── generate-recipe/      # Generador de recetas IA
│       ├── generate-recipe-plan/ # Generador de planes IA
│       ├── generate-routine/     # Generador de rutinas IA
│       ├── member-prs/           # Récords personales
│       ├── notifications/        # Push notifications
│       ├── profile/              # CRUD de perfil
│       └── spoonacular-diet/     # Integración Spoonacular
├── components/                   # Componentes React
│   ├── AdminDashboard.jsx
│   ├── TrainerDashboard.jsx
│   ├── MemberDashboard.jsx
│   ├── FeedTab.jsx / FeedSection.jsx
│   ├── WorkoutTab.jsx / WorkoutBuilder.jsx
│   ├── DietTab.jsx / DietBuilder.jsx / DietOnboardingForm.jsx
│   ├── ProgressTab.jsx / ProgressCharts.jsx / ProgressPhotos.jsx
│   ├── NoticesTab.jsx
│   ├── StatsTab.jsx / AdvancedStatsCard.jsx
│   ├── PRTracker.jsx
│   ├── RecipeManager.jsx / RecipePlan.jsx
│   ├── FoodTracker.jsx / FoodAnalyzer/
│   ├── ChallengesBadges.jsx
│   ├── ActivityTracker.jsx
│   ├── WomensWellness.jsx / CycleModule.jsx
│   ├── CycleMacrosRecommendation.jsx / SymptomsTracker.jsx
│   ├── LifeStageModules.jsx
│   ├── AIRoutineGenerator.jsx
│   ├── AdminAssistant.jsx / FloatingAdminAssistant.jsx
│   ├── VideoUploader.jsx / VideoPlayer.jsx
│   ├── ImageUploader.jsx
│   ├── AdminFeedTab.jsx / AdminUsersTab.jsx / AdminCodesTab.jsx
│   ├── MemberDetailPanel.jsx / UserProfile.jsx
│   ├── DashboardHeader.jsx
│   ├── ServiceWorkerInit.jsx / CapacitorPushInit.jsx
│   ├── ErrorBoundary.jsx
│   └── ui/                       # Componentes shadcn/ui
├── lib/                          # Utilidades y helpers
├── hooks/                        # Custom React hooks
├── sql/                          # Esquemas SQL y migraciones (43 archivos)
├── scripts/                      # Scripts de utilidad (31 archivos)
├── docs/                         # Documentación por fases
├── ios/                          # Recursos app iOS
├── public/                       # Assets estáticos
├── capacitor.config.ts           # Config Capacitor
├── next.config.js                # Config Next.js
├── next.config.mobile.js         # Config Next.js para móvil
└── build-mobile.sh               # Script build móvil
```

---

## Scripts de utilidad

```bash
# Configuración inicial de Supabase
node scripts/setup-supabase.js

# Poblar datos de prueba
node scripts/seed-data.js
node scripts/seed-exercises.js

# Generar claves VAPID para push notifications
node scripts/generate-vapid-keys.js

# Crear cuenta admin de prueba
node scripts/create_test_admin.mjs

# Crear cuenta demo femenina (con ciclo)
node scripts/create-demo-female.js

# Verificar tablas y datos
node scripts/check-tables.js
node scripts/check-demo.js

# Poblar catálogo de recetas
node scripts/bulk_populate_recipes.js

# Ejecutar migración SQL
node scripts/run_migration.js
```

---

## Build móvil (iOS/Android)

### Requisitos

- Xcode (para iOS)
- Android Studio (para Android)
- Capacitor CLI: `npm install -g @capacitor/cli`

### Build

```bash
# Build automático
./build-mobile.sh

# O manualmente:
npm run build:mobile
npx cap copy
npx cap open ios      # Abre en Xcode
npx cap open android  # Abre en Android Studio
```

La configuración de Capacitor está en `capacitor.config.ts`.

Para instrucciones detalladas de publicación en App Store y Google Play, consulta:
- `docs/GUIA-PUBLICAR-APP.md`
- `docs/PUBLICAR-APP-STORE.md`

---

## Monitoreo y errores

El proyecto usa **Sentry** para seguimiento de errores en producción.

**Archivos de configuración:**
- `sentry.client.config.js` — errores en cliente (navegador)
- `sentry.server.config.js` — errores en servidor (API routes)
- `sentry.edge.config.js` — errores en Edge functions

Configura las variables `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` y `SENTRY_PROJECT` en `.env.local`.

---

## Troubleshooting

**Error: "Invalid supabaseUrl"**
```bash
# Verifica que .env.local tenga las URLs correctas
# Reinicia el servidor:
sudo supervisorctl restart nextjs
```

**No puedo iniciar sesión con cuentas demo**
- Verifica que creaste los usuarios en Supabase Auth
- Verifica que insertaste los profiles en la tabla `profiles`
- Contraseñas deben ser exactamente `Demo1234!`

**Las políticas RLS bloquean operaciones**
- Ejecuta el script SQL completo de `sql/master-schema.sql`
- Revisa los archivos `sql/FIX-RLS-*.sql` si hay errores específicos

**Storage: error al subir archivos**
- Verifica que los buckets existen en Supabase Storage
- Ejecuta los scripts `sql/FIX-STORAGE-*.sql`

**Push notifications no llegan**
- Verifica que las claves VAPID están configuradas en `.env.local`
- Comprueba que el service worker está registrado (`ServiceWorkerInit`)
- En móvil, verifica permisos de notificaciones

**Funciones de IA no responden**
- Verifica que `OPENAI_API_KEY` es válida y tiene créditos
- Revisa los logs en Sentry o en consola del servidor

---

## Documentación adicional

Los documentos de cada fase de desarrollo se encuentran en `/docs/`:

| Archivo | Contenido |
|---|---|
| `FASE2-README.md` | Storage, videos y fotos |
| `FASE3-README.md` | Retos, badges y estadísticas avanzadas |
| `FASE4-README.md` | Recetas y planes semanales |
| `NUEVAS-FUNCIONALIDADES-ADMIN.md` | Funcionalidades nuevas del admin |
| `INSTRUCCIONES-FINALES.md` | Guía completa de configuración (7 pasos) |
| `GOOGLE-STITCH-GUIDE.md` | Integración Google Fit |
| `GUIA-PUBLICAR-APP.md` | Publicar en App Store |
| `PUBLICAR-APP-STORE.md` | Subir build a App Store Connect |

---

## Flujo de registro de socios

```
Admin genera código de invitación
        │
        ▼
Socio usa el código para registrarse
        │
        ▼
Socio queda asignado automáticamente al entrenador vinculado al código
        │
        ▼
Entrenador asigna rutina, dieta y plan de recetas
        │
        ▼
Socio accede a su panel personalizado
```

---

## Licencia

Proyecto privado — NL VIP TEAM © 2025. Todos los derechos reservados.

---

**🖤✨ Bienvenido al club más exclusivo.**
