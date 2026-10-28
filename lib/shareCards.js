// Piezas de diseño compartidas por las imágenes "para compartir" (Mi semana,
// Mi evolución): fondo de marca con brillos, titulares en degradado, anillo
// de progreso, fichas y logo NL VIP. Todo en canvas, sin dependencias.

export const BRAND = {
  violet: '#8b5cf6',
  cyan: '#22d3ee',
  green: '#10b981',
  amber: '#f59e0b',
  text: '#ffffff',
  muted: '#9ca3af',
  dim: '#4b5563',
}

export const font = (weight, size) => `${weight} ${size}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`

export function drawBrandBackground(ctx, W, H) {
  const base = ctx.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, '#07070c')
  base.addColorStop(0.55, '#0e0b1c')
  base.addColorStop(1, '#070a12')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  glow(W * 0.15, H * 0.12, W * 0.75, 'rgba(139,92,246,0.42)')
  glow(W * 0.95, H * 0.42, W * 0.6, 'rgba(34,211,238,0.22)')
  glow(W * 0.5, H * 1.02, W * 0.8, 'rgba(139,92,246,0.30)')

  // Rayas diagonales muy sutiles: dan energía sin ensuciar.
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  for (let x = -H; x < W + H; x += 56) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + H * 0.45, H)
    ctx.stroke()
  }
  ctx.restore()

  // Viñeta para que el centro respire y los bordes se oscurezcan.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}

export function brandGradient(ctx, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, BRAND.violet)
  g.addColorStop(1, BRAND.cyan)
  return g
}

export function drawGradientText(ctx, text, x, y, size, { align = 'left', weight = '900' } = {}) {
  ctx.save()
  ctx.font = font(weight, size)
  ctx.textAlign = align
  const w = ctx.measureText(text).width
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.shadowColor = 'rgba(139,92,246,0.55)'
  ctx.shadowBlur = 40
  ctx.fillStyle = brandGradient(ctx, x0, x0 + w)
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function drawRing(ctx, cx, cy, r, pct, { width = 26 } = {}) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  if (pct > 0) {
    const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
    g.addColorStop(0, BRAND.violet)
    g.addColorStop(1, BRAND.cyan)
    ctx.strokeStyle = g
    ctx.shadowColor = 'rgba(34,211,238,0.6)'
    ctx.shadowBlur = 30
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pct))
    ctx.stroke()
  }
  ctx.restore()
}

export function drawCheck(ctx, cx, cy, size = 20, color = '#ffffff') {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.38
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.9, cy + size * 0.05)
  ctx.lineTo(cx - size * 0.25, cy + size * 0.7)
  ctx.lineTo(cx + size * 1.0, cy - size * 0.65)
  ctx.stroke()
  ctx.restore()
}

export function drawPill(ctx, x, y, w, h, { fill = 'rgba(255,255,255,0.06)', stroke = 'rgba(255,255,255,0.10)', radius = 32 } = {}) {
  ctx.save()
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.fill()
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

export function loadImage(url, { crossOrigin = 'anonymous' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar una imagen'))
    img.src = url
  })
}

// Pie de marca: logo NL (la marca blanca del icono, fundiendo el fondo negro
// con modo "screen") + wordmark en degradado + nombre del socio a la izquierda.
export async function drawBrandFooter(ctx, W, H, { memberName = '', y = H - 150 } = {}) {
  let logo = null
  try { logo = await loadImage('/icons/icon-512x512.png', { crossOrigin: null }) } catch {}

  ctx.save()
  ctx.textAlign = 'left'
  ctx.fillStyle = BRAND.text
  ctx.font = font('800', 44)
  if (memberName) ctx.fillText(memberName, 80, y + 16)
  ctx.restore()

  const logoSize = 150
  const wordW = 330
  const gap = 24
  const totalW = logoSize + gap + wordW
  const x0 = W - 80 - totalW
  if (logo) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(logo, x0, y - logoSize / 2 - 8, logoSize, logoSize)
    ctx.restore()
  }
  ctx.save()
  ctx.font = font('900', 46)
  ctx.textAlign = 'left'
  ctx.fillStyle = brandGradient(ctx, x0 + logoSize + gap, x0 + totalW)
  ctx.shadowColor = 'rgba(139,92,246,0.5)'
  ctx.shadowBlur = 30
  ctx.fillText('NL VIP', x0 + logoSize + gap, y - 6)
  ctx.font = font('700', 30)
  ctx.fillStyle = BRAND.muted
  ctx.shadowBlur = 0
  ctx.fillText('TEAM', x0 + logoSize + gap, y + 34)
  ctx.restore()
}

// ---------- Tarjeta "Mi semana" (story 1080x1920) ----------
// days: [{ label, date, isToday, day: {day_number} | null, trained, mealsLogged, steps }]
export async function renderWeekCard(canvas, { days, stepsGoal = 8000, memberName = '' }) {
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  drawBrandBackground(ctx, W, H)

  const trainedCount = days.filter(d => d.trained).length
  const plannedCount = days.filter(d => d.day).length
  const stepsDaysOk = days.filter(d => d.steps != null && d.steps >= stepsGoal).length
  const mealsTotal = days.reduce((n, d) => n + d.mealsLogged, 0)
  const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const allTrained = plannedCount > 0 && trainedCount >= plannedCount
  const pct = plannedCount > 0 ? trainedCount / plannedCount : trainedCount > 0 ? 1 : 0

  ctx.textAlign = 'left'
  ctx.fillStyle = BRAND.muted
  ctx.font = font('700', 30)
  ctx.fillText(`${fmt(days[0].date)} – ${fmt(days[6].date)}`.toUpperCase(), 80, 190)
  drawGradientText(ctx, 'MI SEMANA', 80, 290, 112)

  const ringCx = W / 2
  const ringCy = 640
  drawRing(ctx, ringCx, ringCy, 230, pct, { width: 30 })
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND.text
  ctx.font = font('900', 150)
  ctx.fillText(`${trainedCount}`, ringCx, ringCy + 30)
  ctx.fillStyle = BRAND.muted
  ctx.font = font('700', 34)
  ctx.fillText(`DE ${plannedCount || trainedCount || 0} ENTRENOS`, ringCx, ringCy + 100)

  if (allTrained) {
    const label = 'SEMANA COMPLETA'
    ctx.font = font('900', 32)
    const w = ctx.measureText(label).width + 80
    drawPill(ctx, ringCx - w / 2, ringCy + 300, w, 70, { fill: 'rgba(16,185,129,0.18)', stroke: 'rgba(16,185,129,0.6)', radius: 35 })
    ctx.fillStyle = BRAND.green
    ctx.textAlign = 'center'
    ctx.fillText(label, ringCx, ringCy + 347)
  }

  const top = 1090
  const gap = 14
  const colW = (W - 160 - gap * 6) / 7
  days.forEach((d, i) => {
    const x = 80 + i * (colW + gap)
    const cx = x + colW / 2
    drawPill(ctx, x, top, colW, 250, {
      fill: d.trained ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.05)',
      stroke: d.trained ? 'rgba(167,139,250,0.9)' : d.isToday ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)',
      radius: 30,
    })
    ctx.textAlign = 'center'
    ctx.fillStyle = d.trained ? BRAND.text : BRAND.muted
    ctx.font = font('800', 34)
    ctx.fillText(d.label, cx, top + 52)

    const cy = top + 118
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 34, 0, Math.PI * 2)
    if (d.trained) {
      ctx.fillStyle = brandGradient(ctx, cx - 34, cx + 34)
      ctx.shadowColor = 'rgba(34,211,238,0.7)'
      ctx.shadowBlur = 24
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
    }
    ctx.fill()
    ctx.restore()
    if (d.trained) {
      drawCheck(ctx, cx, cy, 16)
    } else {
      ctx.fillStyle = d.day ? BRAND.dim : 'rgba(255,255,255,0.12)'
      ctx.font = font('800', 26)
      ctx.fillText(d.day ? `D${d.day.day_number}` : '–', cx, cy + 9)
    }

    const ok = d.steps != null && d.steps >= stepsGoal
    const dot = (y, color) => { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx - 34, y - 9, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    ctx.textAlign = 'center'
    ctx.font = font('800', 28)
    ctx.fillStyle = d.mealsLogged > 0 ? BRAND.text : BRAND.dim
    ctx.fillText(d.mealsLogged > 0 ? `${d.mealsLogged}` : '–', cx + 6, top + 190)
    dot(top + 190, d.mealsLogged > 0 ? BRAND.violet : 'rgba(255,255,255,0.12)')
    ctx.font = font('800', 26)
    ctx.fillStyle = d.steps == null ? BRAND.dim : ok ? BRAND.cyan : BRAND.amber
    ctx.fillText(d.steps == null ? '–' : d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : `${d.steps}`, cx + 6, top + 228)
    dot(top + 228, d.steps == null ? 'rgba(255,255,255,0.12)' : ok ? BRAND.cyan : BRAND.amber)
  })

  // Leyenda
  ctx.textAlign = 'left'
  ctx.font = font('700', 24)
  const legend = [[BRAND.violet, 'COMIDAS MARCADAS'], [BRAND.cyan, 'PASOS'], [BRAND.amber, 'PASOS POR DEBAJO DEL OBJETIVO']]
  let lx = 80
  legend.forEach(([color, text]) => {
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(lx + 8, top + 275, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = BRAND.muted
    ctx.fillText(text, lx + 28, top + 284)
    lx += 28 + ctx.measureText(text).width + 36
  })

  const boxes = [
    { label: 'COMIDAS MARCADAS', value: `${mealsTotal}`, color: BRAND.text },
    { label: 'DÍAS DE PASOS', value: `${stepsDaysOk}/7`, color: BRAND.cyan },
  ]
  const by = top + 330
  const bw = (W - 160 - 20) / 2
  boxes.forEach((b, i) => {
    const x = 80 + i * (bw + 20)
    drawPill(ctx, x, by, bw, 170, { radius: 34 })
    ctx.textAlign = 'center'
    ctx.fillStyle = b.color
    ctx.font = font('900', 64)
    ctx.fillText(b.value, x + bw / 2, by + 88)
    ctx.fillStyle = BRAND.muted
    ctx.font = font('700', 24)
    ctx.fillText(b.label, x + bw / 2, by + 136)
  })

  await drawBrandFooter(ctx, W, H, { memberName, y: H - 150 })
}

// ---------- Tarjeta "Mi evolución" (story 1080x1920) ----------
export async function renderEvolutionCard(canvas, { imgA, imgB, dateA, dateB, weeks, recFirst, recLast, memberName = '' }) {
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  drawBrandBackground(ctx, W, H)
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

  ctx.textAlign = 'left'
  ctx.fillStyle = BRAND.muted
  ctx.font = font('700', 30)
  ctx.fillText(`${weeks} SEMANA${weeks === 1 ? '' : 'S'} DE PROCESO`, 80, 190)
  drawGradientText(ctx, 'MI EVOLUCIÓN', 80, 290, 104)

  const gap = 24
  const pw = (W - 160 - gap) / 2
  const ph = Math.round(pw * 1.62)
  const py = 350
  const frame = (x, img, glow) => {
    ctx.save()
    if (glow) { ctx.shadowColor = 'rgba(139,92,246,0.7)'; ctx.shadowBlur = 50 }
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.roundRect(x, py, pw, ph, 40)
    ctx.fill()
    ctx.restore()
    drawCoverImage(ctx, img, x, py, pw, ph, 40)
    if (glow) {
      ctx.save()
      ctx.strokeStyle = brandGradient(ctx, x, x + pw)
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.roundRect(x + 4, py + 4, pw - 8, ph - 8, 36)
      ctx.stroke()
      ctx.restore()
    }
  }
  frame(80, imgA, false)
  frame(80 + pw + gap, imgB, true)

  const tag = (text, x, fill, color) => {
    ctx.font = font('900', 28)
    const tw = ctx.measureText(text).width + 44
    drawPill(ctx, x + 22, py + 22, tw, 54, { fill, stroke: 'rgba(255,255,255,0.15)', radius: 27 })
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    ctx.fillText(text, x + 44, py + 59)
  }
  tag('ANTES', 80, 'rgba(0,0,0,0.7)', BRAND.muted)
  tag('AHORA', 80 + pw + gap, 'rgba(139,92,246,0.9)', BRAND.text)

  ctx.font = font('700', 26)
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND.muted
  ctx.fillText(fmtDate(dateA), 80 + pw / 2, py + ph + 46)
  ctx.fillStyle = BRAND.text
  ctx.fillText(fmtDate(dateB), 80 + pw + gap + pw / 2, py + ph + 46)

  const stats = []
  if (recFirst && recLast) {
    const dw = Number(recLast.weight_kg) - Number(recFirst.weight_kg)
    stats.push({ label: 'PESO', from: `${Number(recFirst.weight_kg).toFixed(1)} kg`, to: `${Number(recLast.weight_kg).toFixed(1)} kg`, delta: `${dw > 0 ? '+' : ''}${dw.toFixed(1)} kg` })
    if (recFirst.waist_cm != null && recLast.waist_cm != null) {
      const dc = Number(recLast.waist_cm) - Number(recFirst.waist_cm)
      stats.push({ label: 'CINTURA', from: `${Number(recFirst.waist_cm).toFixed(0)} cm`, to: `${Number(recLast.waist_cm).toFixed(0)} cm`, delta: `${dc > 0 ? '+' : ''}${dc.toFixed(0)} cm` })
    }
  }
  const sy = py + ph + 100
  const bw = stats.length > 1 ? (W - 160 - 20) / 2 : W - 160
  stats.forEach((s, i) => {
    const x = 80 + i * (bw + 20)
    drawPill(ctx, x, sy, bw, 250, { radius: 40 })
    ctx.textAlign = 'center'
    ctx.fillStyle = BRAND.muted
    ctx.font = font('700', 26)
    ctx.fillText(s.label, x + bw / 2, sy + 54)
    ctx.fillStyle = BRAND.text
    ctx.font = font('900', 44)
    ctx.fillText(`${s.from}  →  ${s.to}`, x + bw / 2, sy + 128)
    ctx.font = font('900', 60)
    ctx.fillStyle = brandGradient(ctx, x + bw / 2 - 120, x + bw / 2 + 120)
    ctx.shadowColor = 'rgba(34,211,238,0.5)'
    ctx.shadowBlur = 24
    ctx.fillText(s.delta, x + bw / 2, sy + 210)
    ctx.shadowBlur = 0
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND.muted
  ctx.font = font('700', 32)
  ctx.fillText('CONSTANCIA QUE SE VE', W / 2, Math.min(H - 260, sy + 250 + 110))

  await drawBrandFooter(ctx, W, H, { memberName, y: H - 150 })
}
