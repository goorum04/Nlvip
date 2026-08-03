// Detecta qué datos le faltan a un socio de su cuestionario nutricional
// inicial (campos de texto + fotos), para poder pedírselos sueltos sin que
// tenga que rehacer el cuestionario de 8 pasos entero. Se usa tanto en el
// banner del socio como (potencialmente) en el panel de admin.

export const ONBOARDING_PHOTO_TYPES = [
  { key: 'front', label: 'Foto de frente' },
  { key: 'side', label: 'Foto de lado izquierdo' },
  { key: 'side_right', label: 'Foto de lado derecho' },
  { key: 'back', label: 'Foto de espalda' },
]

// Campos de texto/medida que consideramos "importantes" para poder hacer
// bien una dieta, aunque alguno esté marcado como opcional en el formulario
// (favoritos, por ejemplo, es opcional en el form pero crítico para que el
// socio realmente siga la dieta).
export const ONBOARDING_FIELD_CHECKS = [
  { key: 'Medida - Edad', label: 'Tu edad', type: 'number', placeholder: 'Ej: 28' },
  { key: 'Medida - Peso', label: 'Tu peso (kg)', type: 'number', placeholder: 'Ej: 72' },
  { key: 'Medida - Altura', label: 'Tu altura (cm)', type: 'number', placeholder: 'Ej: 175' },
  { key: 'favoritos', label: 'Alimentos que te encantan', type: 'text', placeholder: 'Ej: pollo, arroz, aguacate...' },
  { key: 'lesion', label: '¿Alguna lesión que te limite al hacer ejercicio?', type: 'text', placeholder: "Escribe 'ninguna' si no tienes ninguna" },
]

// `responses` = diet_onboarding_requests.responses (jsonb)
// `photoTypesPresent` = array de photo_type ya subidos para este socio (ej. ['front','back'])
export function getMissingOnboardingItems(responses, photoTypesPresent = []) {
  const missing = []
  const r = responses || {}

  for (const field of ONBOARDING_FIELD_CHECKS) {
    const value = r[field.key]
    const isEmpty = value === undefined || value === null || String(value).trim() === ''
    if (isEmpty) missing.push({ kind: 'field', ...field })
  }

  const presentSet = new Set(photoTypesPresent)
  for (const photo of ONBOARDING_PHOTO_TYPES) {
    if (!presentSet.has(photo.key)) missing.push({ kind: 'photo', ...photo })
  }

  return missing
}
