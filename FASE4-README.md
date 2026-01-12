# 🍽️ FASE 4: Recetas Activas - Planes Semanales

## 📋 Instrucciones de Instalación

### Paso 1: Ejecutar estructura de base de datos
Ve a Supabase → SQL Editor y ejecuta:
```
FASE4-RECETAS-ACTIVAS.sql
```

Este script crea:
- ✅ Tabla `recipes` - Catálogo de recetas
- ✅ Tabla `diet_recipes` - Recetas vinculadas a dietas
- ✅ Tabla `member_recipe_plans` - Planes semanales por socio
- ✅ Tabla `member_recipe_plan_items` - Items del plan (día × comida)
- ✅ Políticas RLS completas

### Paso 2: Ejecutar datos demo
```
FASE4-SEED-RECETAS.sql
```

Este script crea:
- ✅ 15 recetas demo (desayunos, comidas, cenas, snacks)
- ✅ Vinculación de recetas a dieta demo
- ✅ Plan semanal generado para el socio Said

---

## 🆕 Nuevas Funcionalidades

### Para el SOCIO:
En la pestaña "Dieta" verá:
1. Sus macros y dieta asignada
2. **Plan de Recetas Semanal** con:
   - Vista de 7 días (Lun-Dom)
   - 4 slots por día: Desayuno, Comida, Cena, Snack
   - Calorías y proteínas de cada receta
   - Notas especiales del entrenador

### Para el ENTRENADOR:
En el perfil de cada socio podrá:
1. **Generar Plan Semanal** - Crea automáticamente basado en la dieta
2. **Editar recetas** - Cambiar cualquier receta por otra
3. **Añadir notas** - Instrucciones especiales por comida
4. **Regenerar** - Crear nuevo plan (archiva el anterior)

---

## 📊 Estructura de Datos

### member_recipe_plans
```sql
- member_id: socio
- trainer_id: entrenador que lo creó
- diet_template_id: dieta base
- week_start: lunes de la semana
- target_calories/protein_g/carbs_g/fat_g: objetivos
- status: active | archived
```

### member_recipe_plan_items
```sql
- plan_id: plan al que pertenece
- day_index: 1-7 (Lun-Dom)
- meal_slot: breakfast | lunch | dinner | snack
- recipe_id: receta asignada
- notes: notas del entrenador
```

---

## 🔒 Seguridad RLS

| Acción | Admin | Trainer | Member |
|--------|-------|---------|--------|
| Ver planes | ✅ Todos | ✅ Sus socios | ✅ Solo el suyo |
| Crear plan | ✅ | ✅ Sus socios | ❌ |
| Editar plan | ✅ | ✅ Sus socios | ❌ |
| Eliminar plan | ✅ | ✅ Propios | ❌ |

---

## 🍽️ Recetas Demo

| Categoría | Recetas |
|-----------|---------|
| Desayuno | Tortilla de Claras, Avena con Plátano, Tostadas con Aguacate, Yogur Griego, Batido de Proteína |
| Comida | Pollo a la Plancha, Arroz con Salmón, Ensalada César, Bowl de Quinoa, Tacos de Carne |
| Cena | Merluza al Horno, Pavo con Verduras, Tortilla Francesa |
| Snack | Batido de Caseína, Mix de Frutos Secos |

---

## ✅ Verificación

1. **Login como Socio** → Ir a "Dieta" → Ver plan semanal con recetas
2. **Login como Entrenador** → Ver socio → Generar/Editar plan de recetas
