// Imágenes "para compartir" (Mi semana, Mi evolución) en formato story
// 1080x1920. Todo en canvas, sin dependencias. Estética: fondo negro con
// grano, un panel de neón en diagonal (violeta → cian) con el dato estrella
// en tipografía enorme, y la marca NL VIP siempre presente.

export const BRAND = {
  violet: '#7c3aed',
  violetLight: '#a78bfa',
  cyan: '#22d3ee',
  lime: '#a3e635',
  text: '#ffffff',
  ink: '#07070c',
  muted: 'rgba(255,255,255,0.55)',
  dim: 'rgba(255,255,255,0.22)',
}

export const font = (weight, size) => `${weight} ${size}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`

export function loadImage(url, { crossOrigin = 'anonymous' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar una imagen'))
    img.src = url
  })
}

export function brandGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, BRAND.violet)
  g.addColorStop(0.55, '#5b6cf0')
  g.addColorStop(1, BRAND.cyan)
  return g
}

export function drawBackground(ctx, W, H) {
  ctx.fillStyle = BRAND.ink
  ctx.fillRect(0, 0, W, H)
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  glow(W * 0.9, H * 0.08, W * 0.7, 'rgba(124,58,237,0.35)')
  glow(W * 0.05, H * 0.95, W * 0.8, 'rgba(34,211,238,0.16)')
}

// Grano fino: da textura "impresa" y quita el aspecto plano del degradado.
export function drawGrain(ctx, W, H, amount = 0.06) {
  const step = 3
  ctx.save()
  ctx.globalAlpha = amount
  ctx.fillStyle = '#ffffff'
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (rnd() > 0.72) ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.restore()
}

// Panel de neón en diagonal (paralelogramo) con degradado y resplandor.
export function drawNeonPanel(ctx, { x, y, w, h, skew = 70 }) {
  ctx.save()
  ctx.shadowColor = 'rgba(124,58,237,0.55)'
  ctx.shadowBlur = 90
  ctx.fillStyle = brandGradient(ctx, x, y, x + w, y + h)
  ctx.beginPath()
  ctx.moveTo(x, y + skew)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - skew)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function text(ctx, str, x, y, { size = 40, weight = '900', color = BRAND.text, align = 'left', spacing = 0, shadow = null } = {}) {
  ctx.save()
  ctx.font = font(weight, size)
  ctx.textAlign = align
  ctx.fillStyle = color
  try { ctx.letterSpacing = `${spacing}px` } catch {}
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = 40 }
  ctx.fillText(str, x, y)
  ctx.restore()
}

export function measure(ctx, str, size, weight = '900', spacing = 0) {
  ctx.save()
  ctx.font = font(weight, size)
  try { ctx.letterSpacing = `${spacing}px` } catch {}
  const w = ctx.measureText(str).width
  ctx.restore()
  return w
}

export function drawChip(ctx, str, x, y, { size = 28, color = BRAND.ink, fill = BRAND.lime, align = 'left' } = {}) {
  const padX = 26
  const w = measure(ctx, str, size, '900', 2) + padX * 2
  const h = size * 1.9
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.save()
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x0, y - h * 0.68, w, h, h / 2)
  ctx.fill()
  ctx.restore()
  text(ctx, str, x0 + padX, y, { size, weight: '900', color, spacing: 2 })
  return w
}

export function drawCheck(ctx, cx, cy, size = 20, color = BRAND.ink) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.36
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.85, cy + size * 0.05)
  ctx.lineTo(cx - size * 0.2, cy + size * 0.7)
  ctx.lineTo(cx + size * 0.95, cy - size * 0.65)
  ctx.stroke()
  ctx.restore()
}

export function drawCoverImage(ctx, img, x, y, w, h, radius) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

// Pie: logo NL grande (la marca blanca del icono, fundiendo su fondo negro
// con "screen"), wordmark y nombre del socio.
export async function drawFooter(ctx, W, H, { memberName = '' } = {}) {
  let logo = null
  try { logo = await loadImage('/icons/icon-512x512.png', { crossOrigin: null }) } catch {}
  const y = H - 120
  const logoSize = 190
  if (logo) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(logo, 60, y - logoSize / 2 - 10, logoSize, logoSize)
    ctx.restore()
  }
  const x = logo ? 60 + logoSize - 6 : 80
  text(ctx, 'NL VIP TEAM', x, y - 4, { size: 46, weight: '900', spacing: 3 })
  text(ctx, 'ENTRENAMIENTO · NUTRICIÓN', x, y + 36, { size: 22, weight: '800', color: BRAND.muted, spacing: 4 })
  if (memberName) {
    text(ctx, memberName.toUpperCase(), W - 80, y + 14, { size: 34, weight: '900', color: BRAND.text, align: 'right', spacing: 2 })
  }
}

// ---------- Mi semana ----------
// days: [{ label, date, isToday, day: {day_number} | null, trained, mealsLogged, steps }]
export async function renderWeekCard(canvas, { days, stepsGoal = 8000, memberName = '' }) {
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  drawBackground(ctx, W, H)

  const trainedCount = days.filter(d => d.trained).length
  const plannedCount = days.filter(d => d.day).length || trainedCount
  const stepsDaysOk = days.filter(d => d.steps != null && d.steps >= stepsGoal).length
  const mealsTotal = days.reduce((n, d) => n + d.mealsLogged, 0)
  const allTrained = plannedCount > 0 && trainedCount >= plannedCount
  const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')

  // Panel de neón con el dato estrella
  drawNeonPanel(ctx, { x: -40, y: 150, w: W + 80, h: 760, skew: 90 })
  text(ctx, 'MI SEMANA', 80, 330, { size: 52, weight: '900', color: BRAND.ink, spacing: 6 })
  text(ctx, `${fmt(days[0].date)} – ${fmt(days[6].date)}`.toUpperCase(), 80, 380, { size: 28, weight: '800', color: 'rgba(7,7,12,0.65)', spacing: 3 })

  const hero = `${trainedCount}`
  const heroSize = 420
  text(ctx, hero, 72, 790, { size: heroSize, weight: '900', color: BRAND.ink, spacing: -24 })
  const heroW = measure(ctx, hero, heroSize, '900', -24)
  text(ctx, `/${plannedCount}`, 72 + heroW + 10, 790, { size: 150, weight: '900', color: 'rgba(7,7,12,0.55)', spacing: -6 })
  text(ctx, 'ENTRENOS', 86, 850, { size: 40, weight: '900', color: BRAND.ink, spacing: 10 })
  if (allTrained) drawChip(ctx, 'SEMANA COMPLETA', W - 80, 850, { align: 'right', size: 28 })

  // Fila de días: letras grandes con disco de check
  const rowY = 1110
  const colW = (W - 160) / 7
  days.forEach((d, i) => {
    const cx = 80 + colW * i + colW / 2
    text(ctx, d.label, cx, rowY, { size: 48, weight: '900', color: d.trained ? BRAND.text : BRAND.dim, align: 'center' })
    const cy = rowY + 80
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 40, 0, Math.PI * 2)
    if (d.trained) {
      ctx.fillStyle = BRAND.lime
      ctx.shadowColor = 'rgba(163,230,53,0.7)'
      ctx.shadowBlur = 30
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
    }
    ctx.fill()
    ctx.restore()
    if (d.trained) drawCheck(ctx, cx, cy, 17)
    else text(ctx, d.day ? `D${d.day.day_number}` : '–', cx, cy + 10, { size: 24, weight: '900', color: BRAND.dim, align: 'center' })
    if (d.isToday) {
      ctx.save()
      ctx.strokeStyle = BRAND.cyan
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(cx, cy, 52, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  })
  text(ctx, 'DÍAS ENTRENADOS', W / 2, rowY + 180, { size: 22, weight: '800', color: BRAND.muted, align: 'center', spacing: 5 })

  // Dos datos grandes
  const statY = 1500
  const stat = (x, value, label, color, align) => {
    text(ctx, value, x, statY, { size: 150, weight: '900', color, align, spacing: -8, shadow: color === BRAND.cyan ? 'rgba(34,211,238,0.45)' : null })
    text(ctx, label, x, statY + 56, { size: 24, weight: '800', color: BRAND.muted, align, spacing: 5 })
  }
  stat(80, `${mealsTotal}`, 'COMIDAS MARCADAS', BRAND.text, 'left')
  stat(W - 80, `${stepsDaysOk}/7`, 'DÍAS DE PASOS', BRAND.cyan, 'right')

  drawGrain(ctx, W, H)
  await drawFooter(ctx, W, H, { memberName })
}

// ---------- Mi evolución ----------
export async function renderEvolutionCard(canvas, { imgA, imgB, dateA, dateB, weeks, recFirst, recLast, memberName = '' }) {
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  drawBackground(ctx, W, H)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '').toUpperCase()

  // Panel de neón detrás de las fotos
  drawNeonPanel(ctx, { x: -40, y: 430, w: W + 80, h: 900, skew: 110 })

  text(ctx, 'MI EVOLUCIÓN', 80, 230, { size: 108, weight: '900', spacing: -3 })
  drawChip(ctx, `${weeks} SEMANA${weeks === 1 ? '' : 'S'}`, 80, 310, { size: 30 })

  // Fotos: AHORA grande e inclinada, ANTES pequeña superpuesta
  const photo = (img, x, y, w, h, angle, label, big) => {
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate(angle)
    ctx.translate(-(x + w / 2), -(y + h / 2))
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 60
    ctx.shadowOffsetY = 30
    ctx.fillStyle = '#0b0b12'
    ctx.beginPath()
    ctx.roundRect(x - 14, y - 14, w + 28, h + 28, 34)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    drawCoverImage(ctx, img, x, y, w, h, 24)
    drawChip(ctx, label, x + 28, y + 70, { size: big ? 30 : 24, fill: big ? BRAND.lime : '#ffffff' })
    ctx.restore()
  }
  photo(imgB, 310, 440, 690, 920, -0.035, 'AHORA', true)
  photo(imgA, 70, 930, 370, 490, 0.07, 'ANTES', false)

  text(ctx, fmtDate(dateA), 255, 1500, { size: 24, weight: '800', color: BRAND.muted, align: 'center', spacing: 4 })
  text(ctx, fmtDate(dateB), 655, 1500, { size: 24, weight: '800', color: BRAND.text, align: 'center', spacing: 4 })

  // Datos: deltas enormes
  if (recFirst && recLast) {
    const dw = Number(recLast.weight_kg) - Number(recFirst.weight_kg)
    const dwStr = `${dw > 0 ? '+' : '−'}${Math.abs(dw).toFixed(1).replace('.', ',')}`
    text(ctx, dwStr, 80, 1655, { size: 140, weight: '900', color: BRAND.cyan, spacing: -8, shadow: 'rgba(34,211,238,0.45)' })
    const wv = measure(ctx, dwStr, 140, '900', -8)
    text(ctx, 'KG', 80 + wv + 14, 1655, { size: 52, weight: '900', color: BRAND.cyan })
    text(ctx, `PESO ${Number(recFirst.weight_kg).toFixed(1).replace('.', ',')} → ${Number(recLast.weight_kg).toFixed(1).replace('.', ',')} KG`, 84, 1700, { size: 24, weight: '800', color: BRAND.muted, spacing: 3 })

    if (recFirst.waist_cm != null && recLast.waist_cm != null) {
      const dc = Number(recLast.waist_cm) - Number(recFirst.waist_cm)
      const dcStr = `${dc > 0 ? '+' : '−'}${Math.abs(dc).toFixed(0)}`
      text(ctx, dcStr, W - 80 - measure(ctx, 'CM', 52) - 14, 1655, { size: 140, weight: '900', color: BRAND.text, spacing: -8, align: 'right' })
      text(ctx, 'CM', W - 80, 1655, { size: 52, weight: '900', color: BRAND.text, align: 'right' })
      text(ctx, `CINTURA ${Number(recFirst.waist_cm).toFixed(0)} → ${Number(recLast.waist_cm).toFixed(0)} CM`, W - 84, 1700, { size: 24, weight: '800', color: BRAND.muted, align: 'right', spacing: 3 })
    }
  }

  drawGrain(ctx, W, H)
  await drawFooter(ctx, W, H, { memberName })
}

// ---------- Nuevo récord ----------
export async function renderPrCard(canvas, { exerciseName, weight, reps, previous, memberName = '' }) {
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  drawBackground(ctx, W, H)

  drawNeonPanel(ctx, { x: -40, y: 330, w: W + 80, h: 900, skew: 100 })
  text(ctx, 'NUEVO', 80, 560, { size: 150, weight: '900', color: BRAND.ink, spacing: -6 })
  text(ctx, 'RÉCORD', 80, 700, { size: 150, weight: '900', color: BRAND.ink, spacing: -6 })

  const name = String(exerciseName || '').toUpperCase()
  let size = 64
  while (size > 30 && measure(ctx, name, size, '900', 2) > W - 160) size -= 4
  text(ctx, name, 80, 800, { size, weight: '900', color: 'rgba(7,7,12,0.75)', spacing: 2 })

  const w = Number(weight)
  const wStr = (Number.isInteger(w) ? `${w}` : w.toFixed(1)).replace('.', ',')
  text(ctx, wStr, 80, 1130, { size: 300, weight: '900', color: BRAND.ink, spacing: -18 })
  const ww = measure(ctx, wStr, 300, '900', -18)
  text(ctx, 'KG', 80 + ww + 18, 1130, { size: 90, weight: '900', color: 'rgba(7,7,12,0.7)' })
  if (reps) text(ctx, `× ${reps} REPS`, 86, 1195, { size: 34, weight: '900', color: BRAND.ink, spacing: 6 })

  if (previous != null && previous > 0) {
    const delta = w - Number(previous)
    const dStr = `+${(Number.isInteger(delta) ? `${delta}` : delta.toFixed(1)).replace('.', ',')} KG`
    drawChip(ctx, dStr, W - 80, 1195, { align: 'right', size: 34 })
    const pStr = `${(Number.isInteger(Number(previous)) ? `${Number(previous)}` : Number(previous).toFixed(1)).replace('.', ',')}`
    text(ctx, `ANTERIOR ${pStr} KG`, W / 2, 1420, { size: 28, weight: '800', color: BRAND.muted, align: 'center', spacing: 5 })
  }

  text(ctx, 'EL PROGRESO NO MIENTE', W / 2, 1520, { size: 36, weight: '900', color: BRAND.lime, align: 'center', spacing: 6 })

  drawGrain(ctx, W, H)
  await drawFooter(ctx, W, H, { memberName })
}
