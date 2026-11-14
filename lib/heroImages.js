// Fotos de ambiente del diseño negro y oro (public/img/v2, sin personas).
// Cada día de la rutina usa la que mejor encaja con su nombre.

export const HERO_IMAGES = {
  pierna: '/img/v2/pierna.webp',
  empuje: '/img/v2/empuje.webp',
  tiron: '/img/v2/tiron.webp',
  fullbody: '/img/v2/fullbody.webp',
  general: '/img/v2/general.webp',
  descanso: '/img/v2/descanso.webp',
  nutricion: '/img/v2/nutricion.webp',
}

export function dayHeroImage(name = '') {
  const n = String(name || '').toLowerCase()
  if (/pierna|gl[uú]te|cu[aá]dri|femoral|sentadilla|lower|tren inferior/.test(n)) return HERO_IMAGES.pierna
  if (/tir[oó]n|espalda|b[ií]ceps|pull|dorsal|remo/.test(n)) return HERO_IMAGES.tiron
  if (/empuje|pecho|hombro|tr[ií]ceps|push|press/.test(n)) return HERO_IMAGES.empuje
  if (/full|cuerpo completo|core|abdom|circuito|hiit|metab|funcional/.test(n)) return HERO_IMAGES.fullbody
  return HERO_IMAGES.general
}

// Capa para que el texto se lea sobre la foto (oscuro a la izquierda y abajo).
export const HERO_SCRIM = 'linear-gradient(90deg, rgba(17,16,14,0.97) 0%, rgba(17,16,14,0.86) 42%, rgba(17,16,14,0.35) 100%), linear-gradient(0deg, rgba(17,16,14,0.92) 0%, rgba(17,16,14,0) 55%)'

export function heroBackground(src) {
  return {
    backgroundImage: `${HERO_SCRIM}, url(${src})`,
    backgroundSize: 'cover, cover, cover',
    backgroundPosition: 'center, center, right center',
    backgroundColor: '#141210',
  }
}
