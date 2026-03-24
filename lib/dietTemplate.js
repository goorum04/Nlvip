// ============================================
// PLANTILLA BASE DE DIETAS - NL VIP CLUB
// ============================================

export const DIET_TEMPLATE = {
  title: "PROGRAMA NUTRICIONAL",
  
  generalRules: `## REGLAS GENERALES PARA TODAS LAS COMIDAS

• **Verdura o Ensalada:** Se puede utilizar al gusto, pero con moderación.

• **Aliño:**
  - AOVE (Aceite de Oliva Virgen Extra) solo si se especifica en la comida.
  - Si no se especifica AOVE, se puede utilizar: limón, lima, especias, sal, vinagre.

• **Arroces y Pastas:** Se puede utilizar tomate tamizado o rallado, pero no frito.

• **Post-Entrenamiento:** 40gr de proteína inmediatamente al terminar.`,

  supplementation: `## SUPLEMENTACIÓN

• **Omega 3:** 1 en el desayuno
• **Multivitamínico + Mineral:** 1 en el desayuno, 1 en la cena
• **Pre-entreno:** 1 dosis, 15 minutos antes de entrenar
• **Creatina:** 1gr por cada 10kg de peso corporal (todos los días)
• **Post-entrenamiento:** 40gr de proteína

### Suplementos Opcionales:
• **Carbobloker:** Solo cuando te saltes la dieta (2 cápsulas media hora antes)
• **DAA:** 1 en el desayuno, 1 en la cena
• **MACA:** 1 en el desayuno, 1 en la cena
• **MAP + AMILOPEPTINA:** 15gr MAP + 60gr AMILOPEPTINA (intra o post-entreno)`,

  observations: `## OBSERVACIONES GENERALES

• **Sal:** OBLIGATORIO el uso en todas las comidas para dar sabor.
• **Especias:** Para dar sabor a los platos.
• **Salsas y Condimentos:** Permitidos, pero libres de azúcares y grasas, y con moderación.

• **Bebidas:**
  - Edulcoradas y carbonatadas: máximo 1-2 al día (Coca-Cola Zero, Aquarius, etc.)
  - Infusiones y cafés: máximo 2 al día, sin leche, se puede añadir edulcorante.

• **Edulcorantes:** Evitar el azúcar. Preferir Stevia o Sacarina.

• **Comida Libre:** UNA comida libre a la semana (sustituye la comida que toque).`,

  fluids: `## FLUIDOS

• **Agua:** Consumir 4 a 6 litros a lo largo del día.

• **IMPORTANTE:** Evitar líquidos DURANTE la comida.
  - Consumir líquidos 30 minutos antes o después.
  - Razón: Los fluidos diluyen los ácidos del estómago y ralentizan la absorción.`,

  disclaimer: `---
⚠️ DESCARGO DE RESPONSABILIDAD:
"Estos programas son proporcionados con fines informativos y educativos únicamente basados en experiencia como atleta, y no deben considerarse como asesoramiento médico. El usuario asume la responsabilidad total de seguir este programa, comprendiendo que los resultados pueden variar según factores individuales."`,

  // Función para generar dieta completa
  generateFullDiet: function(macros, meals = null) {
    let diet = `# ${this.title}\n\n`;
    
    // Macros calculados
    diet += `## TUS MACROS DIARIOS\n\n`;
    diet += `🔥 **Calorías:** ${macros.calories} kcal\n`;
    diet += `🥩 **Proteína:** ${macros.protein_g}g\n`;
    diet += `🍚 **Carbohidratos:** ${macros.carbs_g}g\n`;
    diet += `🥑 **Grasas:** ${macros.fat_g}g\n\n`;
    
    // Comidas específicas (si las hay)
    if (meals) {
      diet += `## DISTRIBUCIÓN DE COMIDAS\n\n${meals}\n\n`;
    }
    
    // Reglas generales
    diet += `${this.generalRules}\n\n`;
    diet += `${this.supplementation}\n\n`;
    diet += `${this.observations}\n\n`;
    diet += `${this.fluids}\n\n`;
    diet += `${this.disclaimer}`;
    
    return diet;
  },

  // Template para el prompt de generación de dieta
  getSystemPrompt: function() {
    return `Cuando generes una dieta, SIEMPRE incluye esta estructura:

1. MACROS DIARIOS (calculados según objetivo)
2. DISTRIBUCIÓN DE COMIDAS (si se especifica)
3. Las siguientes REGLAS GENERALES del gimnasio NL VIP:

${this.generalRules}

${this.observations}

${this.fluids}

${this.disclaimer}

IMPORTANTE: 
- Calcula los macros según el objetivo (pérdida grasa: -15%, mantenimiento: 0%, volumen: +15%)
- Proteína: 2g por kg de peso
- Grasa: 0.8-1g por kg de peso
- El resto en carbohidratos`;
  }
};

export default DIET_TEMPLATE;
