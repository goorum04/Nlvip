# 🖤✨ NL VIP CLUB - FASE 2: Storage, Videos y Fotos

## Instrucciones de Ejecución

Ejecuta los siguientes scripts **EN ORDEN** en el **SQL Editor de Supabase**:

### Paso 1: Tablas y RLS
```
Archivo: FASE2-TABLAS-RLS.sql
```
Este script crea:
- ✅ Tabla `workout_videos` con constraint de máximo 120 segundos
- ✅ RLS para `workout_videos` (admin todo, trainer sus rutinas, member si asignado)
- ✅ Actualización de `progress_photos` con `image_path` y `taken_at`
- ✅ RLS mejorada para `progress_photos` (member, trainer asignado, admin)

### Paso 2: Storage Buckets y Políticas
```
Archivo: FASE2-STORAGE-POLICIES.sql
```
Este script crea:
- ✅ Bucket `workout_videos` (privado, máx 50MB, solo video/mp4,webm,quicktime)
- ✅ Bucket `feed_images` (privado, máx 5MB, solo imágenes)
- ✅ Bucket `progress_photos` (privado, máx 10MB, solo imágenes)
- ✅ Políticas de storage para cada bucket

### Paso 3: Datos Demo
```
Archivo: FASE2-SEED-DEMO.sql
```
Este script inserta:
- ✅ 2 rutinas completas (Push Day, Pull Day)
- ✅ 3 vídeos de demo en las rutinas
- ✅ 4 posts del feed (3 con imágenes)
- ✅ 5 fotos de progreso de Said
- ✅ 4 registros de medidas de progreso

---

## Estructura de Carpetas en Storage

### workout_videos/
```
workouts/{workout_template_id}/{filename}.mp4
```
- Solo admin y trainer (dueño de la rutina) pueden subir
- Member puede ver si tiene la rutina asignada

### feed_images/
```
feed/{user_id}/{filename}.jpg
```
- Cualquier usuario autenticado puede subir en su carpeta
- Todos pueden ver todas las imágenes

### progress_photos/
```
progress/{member_id}/{filename}.jpg
```
- Solo el member puede subir en su carpeta
- Visible para: el member, su trainer asignado, admin

---

## Resumen de RLS

### workout_videos
| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|--------|--------|--------|
| Admin | ✅ Todo | ✅ Todo | ✅ Todo | ✅ Todo |
| Trainer | ✅ Sus rutinas | ✅ Sus rutinas | ✅ Suyos | ✅ Suyos |
| Member | ✅ Si asignado | ❌ | ❌ | ❌ |

### progress_photos
| Rol | SELECT | INSERT | DELETE |
|-----|--------|--------|--------|
| Admin | ✅ Todo | ❌ | ✅ Todo |
| Trainer | ✅ Sus socios | ❌ | ❌ |
| Member | ✅ Suyas | ✅ Suyas | ✅ Suyas (24h) |

### feed_images (Storage)
| Rol | SELECT | INSERT | DELETE |
|-----|--------|--------|--------|
| Todos | ✅ Todo | ✅ Su carpeta | ✅ Su carpeta |
| Admin | ✅ Todo | ✅ Todo | ✅ Todo |

---

## Datos Demo Insertados

### Usuarios
| Nombre | Email | Rol |
|--------|-------|-----|
| Nacho | admin@demo.com | Admin (Dueño) |
| Didac | entrenador@demo.com | Trainer |
| Said | socio@demo.com | Member |

### Vídeos en Rutinas
| Rutina | Vídeo | Duración |
|--------|-------|----------|
| Push Day | Técnica Press Banca | 87s |
| Pull Day | Progresión Dominadas | 112s |
| Pull Day | Remo Barra - Forma Correcta | 65s |

### Posts con Imágenes
- Nacho: Bienvenida NL VIP CLUB
- Didac: PR Peso Muerto 180kg
- Said: Transformación 3 meses

### Progreso de Said
- 4 fotos de progreso (semanas 1, 4, 8, 12)
- 1 foto lateral
- 4 registros de medidas (85kg → 78kg)

---

## Notas Importantes

1. **Los paths en base de datos son relativos** - Las imágenes/videos reales deben subirse al storage con la misma estructura de carpetas.

2. **Signed URLs** - Para acceder a archivos privados, usa `supabase.storage.from('bucket').createSignedUrl(path, expiresIn)`.

3. **No se modificó la UI** - Esta fase es solo backend. La UI se implementará en la siguiente fase.

4. **Constraint de duración** - Los vídeos tienen un máximo de 120 segundos (2 minutos) a nivel de base de datos.
