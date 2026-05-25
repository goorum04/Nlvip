// ============================================
// PLANTILLA BASE DE DIETAS - NL VIP TEAM
// ============================================

export const DIET_TEMPLATE = {
  title: "PROGRAMA NUTRICIONAL",
  
  generalRules: `## REGLAS GENERALES PARA TODAS LAS COMIDAS

• **Pesos en crudo:** Todos los alimentos se pesan en crudo, excepto fruta y lácteos que se consumen tal cual.

• **Aliño:**
  - AOVE (Aceite de Oliva Virgen Extra) solo si se especifica en la comida.
  - Si no se especifica AOVE, se puede utilizar: limón, lima, especias, sal, vinagre.

• **Arroces y Pastas:** Se puede utilizar tomate tamizado o rallado, pero no frito.

• **Post-Entrenamiento:** Proteína ISO inmediatamente al terminar las pesas (35g mujeres / 45g hombres).`,

  supplementation: `## SUPLEMENTACIÓN

**DESPUÉS DEL DESAYUNO — HOMBRES:**
• Omega 3 → 2 perlas
• Multivitamínico → 1 dosis
• Vitamina D3K2 → 1 dosis
• Androbull → dosis dividida en 2 tomas (desayuno y cena)

**DESPUÉS DEL DESAYUNO — MUJERES:**
• Omega 3 → 3 cápsulas
• Multivitamínico → 1 dosis
• Vitamina D3K2 → 1 dosis
• Maca → 1 dosis

**PRE-ENTRENO:** Opcional según objetivo y tolerancia.

**INTRA-ENTRENO:**
• Cell Pro → 1 cazo colmado
• Creatina → 1g por cada 10kg de peso corporal (TODOS los días, aunque no entrene)
• BCAA + Glutamina → 10g

**POST-ENTRENO:** Proteína ISO inmediatamente al terminar pesas.

**PRE-CAMA:**
• Ashwagandha + Magnesio bisglicinato
• ZMA si el sueño es muy malo

### Suplementos Situacionales:
• **Termogénico + Diurético (definición):** En ayunas — máximo 2 meses seguidos
• **Carblocker:** 30 min antes de comida libre
• **Probiótico + Enzimas digestivas:** Si hay hinchazón o digestiones malas`,

  observations: `## OBSERVACIONES GENERALES

• **Sal:** OBLIGATORIO el uso en todas las comidas, así como especias para dar sabor.
• **Salsas y condimentos:** Permitidos, libres de azúcares y grasas, con moderación.

• **Bebidas:**
  - Edulcoradas y carbonatadas (Coca-Cola Zero, Nestea sin azúcar, Aquarius…): máximo 1-2 al día.
  - Infusiones: permitidas.
  - Café: máximo 2 al día, preferiblemente sin leche.

• **Edulcorantes:** Evitar en gran medida. Prioridad a Stevia y si no, Sacarina.

• **Comida Libre:** UNA comida libre a la semana, sustituyendo la que toque en ese momento.

• **Para arroces y pastas:** Puedes usar tomate tamizado o rallado, pero no frito.`,

  fluids: `## FLUIDOS

• **Agua:** Consumir entre 4 y 6 litros al día.

• **IMPORTANTE:** Para mejorar la absorción de nutrientes, evita tomar muchos líquidos durante las comidas.
  - Intenta consumirlos 30 minutos antes o después.
  - Los fluidos durante la comida pueden generar distensión abdominal y ralentizar la digestión.`,

  disclaimer: `---
⚠️ DESCARGO DE RESPONSABILIDAD:
"Estos programas son proporcionados con fines informativos y educativos únicamente basados en mi experiencia como atleta y no deben considerarse asesoramiento médico. El usuario asume la responsabilidad total de seguir este programa comprendiendo que los resultados pueden variar según factores individuales."`,

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
- Proteína: 2.2-2.4g por kg de peso (dependiendo de la masa muscular)
- Grasa: 0.8-1g por kg de peso
- El resto en carbohidratos`;
  }
};

export default DIET_TEMPLATE;
