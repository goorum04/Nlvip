# 🎯 FASE 3: Retos, Badges y Gráficas Avanzadas

## 📋 Instrucciones de Instalación

### Paso 1: Ejecutar el script de estructura
Ve a tu proyecto de Supabase → SQL Editor y ejecuta el contenido de:
```
FASE3-RETOS-BADGES.sql
```

Este script crea:
- ✅ Tablas: `challenges`, `challenge_participants`, `badges`, `user_badges`, `workout_checkins`
- ✅ Políticas RLS para cada tabla
- ✅ Índices de rendimiento

### Paso 2: Ejecutar el script de datos demo
Después de ejecutar el primer script, ejecuta:
```
FASE3-SEED-DEMO.sql
```

Este script crea:
- ✅ 7 badges diferentes (Primer Paso, En Racha, Dedicación, Imparable, Leyenda, Retador, Campeón)
- ✅ 4 retos (3 activos + 1 completado)
- ✅ Participaciones del socio demo en los retos
- ✅ 4 badges asignados al socio demo
- ✅ 16 check-ins de entrenamientos para las gráficas

---

## 🆕 Nuevas Funcionalidades

### Para el SOCIO (Said):
1. **Pestaña "Retos"** - Ver retos activos, unirse, ver progreso
2. **Pestaña "Logros"** - Galería de badges desbloqueados y por desbloquear
3. **Pestaña "Estadísticas"** - Gráficas avanzadas:
   - Evolución de peso (línea)
   - Entrenamientos por semana (barras)
   - Adherencia al plan (circular)
   - Comparativa mensual

### Para el ENTRENADOR (Didac):
- Crear y gestionar retos
- Ver progreso de socios en retos
- Ver estadísticas de cada socio

### Para el ADMIN (Nacho):
- Gestión completa de retos
- Gestión de badges
- Vista global de progreso

---

## 🔒 Permisos RLS

| Tabla | Admin | Trainer | Member |
|-------|-------|---------|--------|
| challenges | CRUD | CRUD (propios) | SELECT activos |
| challenge_participants | CRUD | CRUD | INSERT/UPDATE (solo propios) |
| badges | CRUD | SELECT | SELECT |
| user_badges | CRUD | SELECT | SELECT (propios) |
| workout_checkins | SELECT | SELECT | INSERT/SELECT (propios) |

---

## 📊 Datos Demo Incluidos

### Badges:
| Badge | Icono | Condición |
|-------|-------|-----------|
| Primer Paso | 👣 | 1 entrenamiento |
| En Racha | 🔥 | 7 días seguidos |
| Dedicación | 🏋️ | 10 entrenos |
| Imparable | 🏆 | 25 entrenos |
| Leyenda | 👑 | 50 entrenos |
| Retador | 🎯 | 1 reto completado |
| Campeón | 🥇 | 5 retos completados |

### Retos:
1. **💪 Desafío de Fuerza** - 10 entrenos en 2 semanas (activo)
2. **🔥 Racha de Fuego** - 14 días consecutivos (activo)
3. **⚖️ Transformación Total** - Perder 3kg (activo)
4. **🏆 Desafío del Mes Pasado** - Completado por el socio demo

---

## ✅ Verificación

Después de ejecutar los scripts, verifica que todo funciona:

1. **Login como Socio** (`socio@demo.com` / `Demo1234!`)
   - Ir a pestaña "Retos" → Debe mostrar 3 retos activos
   - Ir a pestaña "Logros" → Debe mostrar 4 badges desbloqueados
   - Ir a pestaña "Estadísticas" → Debe mostrar gráficas con datos

2. **Login como Entrenador** (`entrenador@demo.com` / `Demo1234!`)
   - Debe poder crear nuevos retos

¡Listo! 🎉
