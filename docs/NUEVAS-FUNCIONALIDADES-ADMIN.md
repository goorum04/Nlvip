# 🎯 NUEVAS FUNCIONALIDADES DEL ADMINISTRADOR

He agregado todas las funcionalidades solicitadas para el Admin. Para que funcionen correctamente, sigue estos pasos:

## 📋 PASO 1: Crear Tabla de Videos en Supabase

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard/project/qnuzcmdjpafbqnofpzfp/sql/new

2. Copia y pega el siguiente SQL:

```sql
-- Crear tabla para videos de entrenamientos
CREATE TABLE IF NOT EXISTS training_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_training_videos_uploaded ON training_videos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_training_videos_approved ON training_videos(is_approved);

-- Habilitar RLS
ALTER TABLE training_videos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios ven videos aprobados" 
  ON training_videos FOR SELECT 
  TO authenticated 
  USING (is_approved = true OR uploaded_by = auth.uid() OR 
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin y trainers suben videos" 
  ON training_videos FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

CREATE POLICY "Admin aprueba videos" 
  ON training_videos FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin elimina videos" 
  ON training_videos FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

3. Click en **RUN**

4. Verás: ✅ "Success"

---

## ✨ NUEVAS FUNCIONALIDADES IMPLEMENTADAS:

### 1. **Progreso Global** 📊
- El admin puede ver el progreso de TODOS los socios
- Muestra peso, medidas y notas de todos
- Ordenado por fecha (más recientes primero)

### 2. **Rutinas y Dietas Asignadas** 📋
- El admin ve TODAS las rutinas asignadas a cada socio
- Ve TODAS las dietas asignadas con macros completos
- Muestra quién las asignó y cuándo

### 3. **Videos de Entrenamiento** 🎥
**Admin:**
- Puede publicar videos (YouTube, Vimeo, etc.)
- Sus videos se aprueban automáticamente
- Puede aprobar videos de entrenadores
- Puede eliminar cualquier video

**Trainers:**
- Pueden subir videos
- Necesitan aprobación del admin
- Solo ven sus propios videos pendientes

**Socios:**
- Solo ven videos aprobados
- No pueden subir videos

### 4. **Dashboard Admin Actualizado** 🎯
Nuevas pestañas en el panel de admin:
- ✅ **Entrenadores** (existente)
- ✅ **Códigos** (existente)
- ✅ **Socios** (existente)
- 🆕 **Progreso Global** - Ver progreso de todos
- 🆕 **Rutinas/Dietas** - Ver todas las asignaciones
- 🆕 **Videos** - Gestionar videos de entrenamiento
- ✅ **Moderación** (existente)

---

## 🎮 CÓMO USAR:

### Como Admin:

1. **Ver Progreso Global:**
   - Ve a la pestaña "Progreso Global"
   - Verás todos los registros de progreso de todos los socios
   - Ordenados por fecha más reciente

2. **Ver Asignaciones:**
   - Ve a "Rutinas/Dietas"
   - Verás todas las rutinas asignadas por cada trainer
   - Verás todas las dietas con macros completos

3. **Publicar Videos:**
   - Ve a "Videos"
   - Completa el formulario:
     - Título del video
     - Descripción
     - URL del video (YouTube/Vimeo)
     - Miniatura (opcional)
   - Click "Publicar Video"
   - Tu video se publica inmediatamente (aprobado automáticamente)

4. **Aprobar Videos de Trainers:**
   - En "Videos" verás videos pendientes de aprobación
   - Click en "Aprobar" para publicarlos
   - Click en "Eliminar" para rechazarlos

---

## 🔒 PERMISOS Y SEGURIDAD:

### Admin:
- ✅ Ve TODO el progreso de todos los socios
- ✅ Ve TODAS las rutinas y dietas asignadas
- ✅ Publica videos sin aprobación
- ✅ Aprueba/rechaza videos de trainers
- ✅ Elimina cualquier video

### Trainer:
- ✅ Ve solo el progreso de SUS socios
- ✅ Ve solo las rutinas/dietas de SUS socios
- ✅ Puede subir videos (necesitan aprobación)
- ❌ No puede aprobar videos

### Member (Socio):
- ✅ Ve solo SU progreso
- ✅ Ve solo SU rutina y SU dieta
- ✅ Ve videos aprobados
- ❌ No puede subir videos

---

## ⚡ DESPUÉS DE CREAR LA TABLA:

1. Reinicia el navegador con `Ctrl + Shift + R`
2. Inicia sesión como Admin Demo
3. Verás las nuevas pestañas en el dashboard
4. Todas las funcionalidades estarán activas

---

**🎉 ¡El administrador ahora tiene control total del gimnasio!**
