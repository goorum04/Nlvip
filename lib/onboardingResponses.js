// Lectura común del último cuestionario nutricional respondido de un socio.
//
// Antes, la rutina y el guardado de rutinas solo miraban cuestionarios en
// estado 'completed'/'reviewed' (los 'submitted', recién enviados y aún sin
// dieta asignada, quedaban fuera) y buscaban la condición médica en
// responses.extras, que no existe: el formulario guarda los campos en la raíz
// (lesion, condicion_medica, no_me_gusta...). Resultado: las lesiones que el
// socio escribía en el cuestionario nunca llegaban a la rutina.

export const ANSWERED_ONBOARDING_STATUSES = ['submitted', 'completed', 'reviewed']

const meaningful = (v) => {
  if (v == null) return null
  const s = Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v)
  const t = s.trim()
  if (!t || /^(ninguna?|no|nada|-)$/i.test(t)) return null
  return t
}

export async function getLatestOnboardingResponses(supabase, memberId) {
  if (!memberId) return null
  const { data } = await supabase
    .from('diet_onboarding_requests')
    .select('responses')
    .eq('member_id', memberId)
    .in('status', ANSWERED_ONBOARDING_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.responses || null
}

// Lesiones + condición médica declaradas en el cuestionario, en un solo texto
// (o null si no hay nada relevante).
export function onboardingHealthText(responses) {
  if (!responses) return null
  const r = { ...(responses.extras || {}), ...responses }
  const parts = []
  const lesion = meaningful(r.lesion)
  const cond = meaningful(r.condicion_medica)
  if (lesion) parts.push(`Lesión: ${lesion}`)
  if (cond) parts.push(`Condición médica: ${cond}`)
  return parts.length ? parts.join('; ') : null
}

export function onboardingField(responses, key) {
  if (!responses) return null
  return meaningful(responses[key] ?? responses.extras?.[key])
}
