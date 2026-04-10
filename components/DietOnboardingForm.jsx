'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Apple,
  ChefHat,
  Loader2,
  CheckCircle2,
  UtensilsCrossed,
  Clock,
  Target,
  AlertCircle,
  Heart,
  Briefcase,
  Scale,
  Ruler,
  RulerIcon,
  Scissors,
  Zap,
  Star,
  Camera,
  X,
  Footprints
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Steps of the questionnaire
const STEPS = [
  {
    id: 'objetivo',
    title: '¿Cuál es tu objetivo?',
    icon: Target,
    color: 'from-violet-500 to-cyan-500',
    options: [
      { value: 'perder_grasa', label: '🔥 Perder grasa', desc: 'Quiero reducir porcentaje graso' },
      { value: 'mantenimiento', label: '⚖️ Mantenimiento', desc: 'Quiero mantener mi composición actual' },
      { value: 'ganar_masa', label: '💪 Ganar masa', desc: 'Quiero aumentar músculo' },
    ]
  },
  {
    id: 'estilo_vida',
    title: 'Estilo de Vida y Trabajo',
    icon: Briefcase,
    color: 'from-amber-500 to-orange-500',
    type: 'lifestyle'
  },
  {
    id: 'habito_comidas',
    title: 'Hábitos y Horarios de Comida',
    icon: UtensilsCrossed,
    color: 'from-orange-500 to-amber-500',
    type: 'meals'
  },
  {
    id: 'horario_entreno',
    title: '¿Cuándo entrenas habitualmente?',
    icon: Clock,
    color: 'from-green-500 to-emerald-500',
    type: 'training'
  },
  {
    id: 'preferencias',
    title: '¿Tienes preferencias alimentarias?',
    icon: Apple,
    color: 'from-blue-500 to-indigo-500',
    options: [
      { value: 'omnivoro', label: '🍖 Omnívoro', desc: 'Como de todo' },
      { value: 'vegetariano', label: '🥗 Vegetariano', desc: 'Sin carne ni pescado' },
      { value: 'vegano', label: '🌱 Vegano', desc: 'Sin ningún producto animal' },
    ]
  },
  {
    id: 'restricciones',
    title: 'Alergias o intolerancias',
    icon: AlertCircle,
    color: 'from-red-500 to-pink-500',
    type: 'multicheck',
    options: [
      { value: 'lactosa', label: '🥛 Lactosa' },
      { value: 'gluten', label: '🌾 Gluten / Celiaquía' },
      { value: 'frutos_secos', label: '🥜 Frutos secos' },
      { value: 'mariscos', label: '🦐 Mariscos' },
      { value: 'huevos', label: '🥚 Huevos' },
      { value: 'otra', label: '➕ Otra (especificar)' },
      { value: 'ninguna', label: '✅ Ninguna' },
    ]
  },
  {
    id: 'medidas',
    title: 'Medidas Iniciales',
    icon: Scale,
    color: 'from-cyan-500 to-blue-500',
    type: 'measurements'
  },
  {
    id: 'extras',
    title: 'Cuéntanos más (opcional)',
    icon: Heart,
    color: 'from-pink-500 to-rose-500',
    type: 'textarea_group'
  }
]

export function DietOnboardingForm({ requestId, memberId, onComplete }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [multiChecks, setMultiChecks] = useState([])
  const [otraAlergia, setOtraAlergia] = useState('')
  const [lifestyle, setLifestyle] = useState({ horario_trabajo: '', intensidad_trabajo: 'normal' })
  const [meals, setMeals] = useState({ num_comidas: '5', horario_comidas: '' })
  const [training, setTraining] = useState({ momento: 'tarde', horario_especifico: '' })
  const [measurements, setMeasurements] = useState({ 
    peso: '', altura: '', cintura: '', pecho: '', biceps: '', cadera: '', muslo: '', gluteo: '', gemelo: ''
  })
  const [extras, setExtras] = useState({ favoritos: '', no_me_gusta: '', condicion_medica: '' })
  const [photos, setPhotos] = useState({ front: null, side: null, back: null })
  const [photoPreviews, setPhotoPreviews] = useState({ front: null, side: null, back: null })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  const handlePhotoSelect = (type, file) => {
    if (!file) return
    setPhotos(prev => ({ ...prev, [type]: file }))
    const url = URL.createObjectURL(file)
    setPhotoPreviews(prev => ({ ...prev, [type]: url }))
  }

  const removePhoto = (type) => {
    if (photoPreviews[type]) URL.revokeObjectURL(photoPreviews[type])
    setPhotos(prev => ({ ...prev, [type]: null }))
    setPhotoPreviews(prev => ({ ...prev, [type]: null }))
  }

  const currentStep = STEPS[step]
  const isLastStep = step === STEPS.length - 1

  const handleSelect = (value) => {
    setAnswers(prev => ({ ...prev, [currentStep.id]: value }))
    if (!isLastStep) {
      setTimeout(() => setStep(s => s + 1), 200)
    }
  }

  const toggleCheck = (value) => {
    if (value === 'ninguna') {
      setMultiChecks(['ninguna'])
      setOtraAlergia('')
    } else {
      setMultiChecks(prev => {
        const without = prev.filter(v => v !== 'ninguna')
        return without.includes(value) ? without.filter(v => v !== value) : [...without, value]
      })
    }
  }

  const handleMultiNext = () => {
    let val = multiChecks.length > 0 ? multiChecks.join(', ') : 'ninguna'
    if (multiChecks.includes('otra') && otraAlergia) {
      val = val.replace('otra', `Otra: ${otraAlergia}`)
    }
    setAnswers(prev => ({ ...prev, [currentStep.id]: val }))
    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Upload photos to Supabase storage if provided
      const groupId = crypto.randomUUID()
      const photoTypes = ['front', 'side', 'back']
      for (const type of photoTypes) {
        const file = photos[type]
        if (!file) continue
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${memberId}/onboarding/${groupId}_${type}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('progress_photos')
          .upload(path, file, { upsert: true })
        if (!uploadError) {
          await supabase.from('progress_photos').insert({
            member_id: memberId,
            photo_url: path,
            photo_type: type,
            group_id: groupId,
            date: new Date().toISOString().split('T')[0],
            notes: 'Foto inicial cuestionario nutricional'
          })
        }
      }

      const allAnswers = {
        ...answers,
        'Trabajo - Horario': lifestyle.horario_trabajo,
        'Trabajo - Intensidad': lifestyle.intensidad_trabajo,
        'Comidas - Horario': meals.horario_comidas,
        'Comidas - Número': meals.num_comidas,
        'Entreno - Momento': training.momento,
        'Entreno - Horario Detalle': training.horario_especifico,
        'Medida - Peso': measurements.peso,
        'Medida - Altura': measurements.altura,
        'Medida - Cintura': measurements.cintura,
        'Medida - Pecho': measurements.pecho,
        'Medida - Bíceps': measurements.biceps,
        'Medida - Cadera': measurements.cadera,
        'Medida - Muslo': measurements.muslo,
        'Medida - Glúteo': measurements.gluteo,
        'Medida - Gemelo': measurements.gemelo,
        restricciones: (multiChecks.includes('otra') && otraAlergia)
          ? (multiChecks.join(', ').replace('otra', `Otra: ${otraAlergia}`))
          : (multiChecks.join(', ') || 'ninguna'),
        ...extras
      }

      const res = await fetch('/api/diet-onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, memberId, responses: allAnswers })
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || 'Error al procesar')

      setDone(true)
      toast({ title: '¡Recibido! Me pongo con ello', description: 'He recibido tus respuestas. Voy a revisarlas y a prepararte tu plan personalizado.' })
      setTimeout(() => onComplete?.(), 5000)
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 text-balance">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-white text-xl font-bold">¡Recibido! Me pongo con ello</h3>
        <p className="text-gray-400 max-w-sm">
          Tus respuestas me han llegado correctamente. Voy a revisarlas personalmente y a prepararte tu plan nutricional a medida en breve. 
          <br/><br/>
          Te avisaré en cuanto esté disponible en tu sección de Dieta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex gap-1.5 mb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-violet-500' : 'bg-white/10'}`} />
        ))}
      </div>

      {/* Step card */}
      <div className={`p-5 rounded-2xl bg-gradient-to-br ${currentStep.color} bg-opacity-10 border border-white/5`}>
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentStep.color} flex items-center justify-center`}>
            <currentStep.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Paso {step + 1} de {STEPS.length}</p>
            <h3 className="text-white font-bold text-base">{currentStep.title}</h3>
          </div>
        </div>
      </div>

      {/* Options */}
      {currentStep.type === 'lifestyle' && (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-xs">⏰ Horario de trabajo</Label>
            <Textarea
              placeholder="Ej: Turno de mañana (7:00 a 15:00), partido..."
              value={lifestyle.horario_trabajo}
              onChange={e => setLifestyle(p => ({ ...p, horario_trabajo: e.target.value }))}
              className="bg-white/5 border-white/10 text-white mt-1 text-sm"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs text-balance">⚡ Intensidad o exigencia física del trabajo</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { v: 'sedentaria', l: 'Sedentaria', d: 'Oficina, sentado' },
                { v: 'leve', l: 'Leve', d: 'De pie, poco movimiento' },
                { v: 'normal', l: 'Normal', d: 'Movimiento constante' },
                { v: 'moderada', l: 'Moderada', d: 'Esfuerzo físico alto' }
              ].map(opt => (
                <div
                  key={opt.v}
                  onClick={() => setLifestyle(p => ({ ...p, intensidad_trabajo: opt.v }))}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    lifestyle.intensidad_trabajo === opt.v
                      ? 'bg-violet-600/30 border-violet-500/50 text-white'
                      : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <p className="text-sm font-bold">{opt.l}</p>
                  <p className="text-[10px] text-gray-400">{opt.d}</p>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={() => setStep(s => s + 1)} className="w-full bg-violet-600 text-white">Continuar →</Button>
        </div>
      )}

      {currentStep.type === 'meals' && (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-xs">🍽️ Número de comidas al día</Label>
            <Select value={meals.num_comidas} onValueChange={v => setMeals(p => ({ ...p, num_comidas: v }))}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 comidas</SelectItem>
                <SelectItem value="4">4 comidas</SelectItem>
                <SelectItem value="5">5 comidas</SelectItem>
                <SelectItem value="6">6 comidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-400 text-xs">⏰ Horario aproximado de tus comidas</Label>
            <Textarea
              placeholder="Ej: Desayuno 8h, Comida 14h, Cena 21h..."
              value={meals.horario_comidas}
              onChange={e => setMeals(p => ({ ...p, horario_comidas: e.target.value }))}
              className="bg-white/5 border-white/10 text-white mt-1 text-sm"
              rows={2}
            />
          </div>
          <Button onClick={() => setStep(s => s + 1)} className="w-full bg-violet-600 text-white">Continuar →</Button>
        </div>
      )}

      {currentStep.type === 'training' && (
        <div className="space-y-4">
          <Label className="text-gray-400 text-xs">⏰ ¿Cuándo sueles entrenar?</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'ayunas', l: 'En ayunas', i: '🌅' },
              { v: 'manana', l: 'Mañana', i: '☀️' },
              { v: 'tarde', l: 'Tarde', i: '🌤️' },
              { v: 'noche', l: 'Noche', i: '🌙' }
            ].map(opt => (
              <div
                key={opt.v}
                onClick={() => setTraining(p => ({ ...p, momento: opt.v }))}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  training.momento === opt.v
                    ? 'bg-violet-600/30 border-violet-500/50 text-white'
                    : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <p className="text-sm font-bold">{opt.i} {opt.l}</p>
              </div>
            ))}
          </div>
          <div>
            <Label className="text-gray-400 text-[10px] uppercase font-bold px-1">Horario exacto (si lo tienes):</Label>
            <input
              type="text"
              placeholder="Ej: 18:30 a 20:00"
              value={training.horario_especifico}
              onChange={e => setTraining(p => ({ ...p, horario_especifico: e.target.value }))}
              className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2 text-white mt-1 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <Button onClick={() => setStep(s => s + 1)} className="w-full bg-violet-600 text-white">Continuar →</Button>
        </div>
      )}

      {currentStep.type === 'measurements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'peso', label: 'Peso (kg)', icon: Scale },
              { id: 'altura', label: 'Altura (cm)', icon: Ruler },
              { id: 'cintura', label: 'Cintura (cm)', icon: Scissors },
              { id: 'pecho', label: 'Pecho (cm)', icon: Heart },
              { id: 'biceps', label: 'Bíceps contr. (cm)', icon: Zap },
              { id: 'cadera', label: 'Cadera (cm)', icon: Star },
              { id: 'muslo', label: 'Muslo (cm)', icon: RulerIcon },
              { id: 'gluteo', label: 'Glúteo (cm)', icon: Star },
              { id: 'gemelo', label: 'Gemelo (cm)', icon: Footprints },
            ].map(m => (
              <div key={m.id} className="space-y-1">
                <Label className="text-gray-500 text-[10px] ml-1 uppercase">{m.label}</Label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={measurements[m.id]}
                    onChange={e => setMeasurements(p => ({ ...p, [m.id]: e.target.value }))}
                    className="w-full bg-white/5 border-white/10 rounded-xl pl-8 pr-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                  <m.icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => setStep(s => s + 1)} className="w-full bg-violet-600 text-white">Continuar →</Button>
        </div>
      )}

      {currentStep.type === 'multicheck' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {currentStep.options.map(opt => (
              <div
                key={opt.value}
                onClick={() => toggleCheck(opt.value)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  multiChecks.includes(opt.value)
                    ? 'bg-violet-600/30 border-violet-500/50 text-white'
                    : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
              </div>
            ))}
          </div>
          
          {multiChecks.includes('otra') && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label className="text-gray-400 text-[10px] uppercase font-bold px-1">Especifica tu otra alergia:</Label>
              <Textarea
                placeholder="Ej: Fresas, polen de pino, aditivos específicos..."
                value={otraAlergia}
                onChange={e => setOtraAlergia(e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1 text-sm h-20"
              />
            </div>
          )}
          
          <Button onClick={handleMultiNext} className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white mt-4">
            Continuar →
          </Button>
        </div>
      )}

      {currentStep.type === 'textarea_group' && (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-400 text-xs">🍗 Alimentos que te encantan (opcional)</Label>
            <Textarea
              placeholder="Ej: pollo, arroz, aguacate, chocolate negro..."
              value={extras.favoritos}
              onChange={e => setExtras(p => ({ ...p, favoritos: e.target.value }))}
              className="bg-white/5 border-white/10 text-white mt-1 text-sm"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">🚫 Alimentos que NO quieres ver en tu dieta</Label>
            <Textarea
              placeholder="Ej: hígado, sardinas, brócoli..."
              value={extras.no_me_gusta}
              onChange={e => setExtras(p => ({ ...p, no_me_gusta: e.target.value }))}
              className="bg-white/5 border-white/10 text-white mt-1 text-sm"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs">🏥 Condición médica relevante (diabetes, tiroides, etc.)</Label>
            <Textarea
              placeholder="Escribe 'ninguna' si no tienes ninguna..."
              value={extras.condicion_medica}
              onChange={e => setExtras(p => ({ ...p, condicion_medica: e.target.value }))}
              className="bg-white/5 border-white/10 text-white mt-1 text-sm"
              rows={2}
            />
          </div>

          {/* Optional body photos */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <Label className="text-cyan-300 text-sm font-semibold">Fotos corporales <span className="text-gray-500 font-normal">(opcional)</span></Label>
            </div>
            <p className="text-gray-500 text-[11px] leading-relaxed">
              Subir fotos ayuda a personalizar mejor tu plan. Son privadas y solo las verá tu entrenador. Si no quieres, déjalo en blanco y pulsa solicitar.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'front', label: 'Frente' },
                { key: 'side', label: 'Lateral' },
                { key: 'back', label: 'Espalda' }
              ].map(({ key, label }) => (
                <div key={key} className="relative">
                  {photoPreviews[key] ? (
                    <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-black/30">
                      <img src={photoPreviews[key]} alt={label} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(key)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <span className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-white/80 font-medium">{label}</span>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center aspect-[3/4] rounded-xl border border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors gap-1">
                      <Camera className="w-5 h-5 text-gray-500" />
                      <span className="text-[10px] text-gray-500">{label}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoSelect(key, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold py-3 text-base"
          >
            {submitting
              ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Enviándome tus datos...</>
              : <><ChefHat className="w-5 h-5 mr-2" />¡Solicitar mi plan!</>
            }
          </Button>
          {submitting && (
            <p className="text-center text-gray-500 text-xs text-balance px-4 leading-relaxed">
              Estoy recibiendo tu información para prepararte tu programa personalizado con comidas específicas y cantidades exactas. Por favor, espera unos segundos...
            </p>
          )}
        </div>
      )}

      {!currentStep.type && (
        <div className="grid gap-3">
          {currentStep.options.map(opt => (
            <div
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all group ${
                answers[currentStep.id] === opt.value
                  ? 'bg-violet-600/30 border-violet-500/50'
                  : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
              }`}
            >
              <p className="text-white font-semibold">{opt.label}</p>
              <p className="text-gray-400 text-sm mt-0.5">{opt.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Banner component to show when member has a pending onboarding
export function DietOnboardingBanner({ requestId, memberId, memberName, onCompleted }) {
  const [showForm, setShowForm] = useState(false)

  if (showForm) {
    return (
      <Card className="bg-gradient-to-br from-violet-900/30 to-cyan-900/20 border-violet-500/30 rounded-3xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <ChefHat className="w-5 h-5 text-violet-400" />
            Cuestionario Nutricional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DietOnboardingForm requestId={requestId} memberId={memberId} onComplete={onCompleted} />
        </CardContent>
      </Card>
    )
  }

  const firstName = memberName?.split(' ')[0] || ''

  return (
    <Card className="bg-gradient-to-br from-violet-900/40 to-cyan-900/20 border-violet-500/40 rounded-3xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg mb-1">
              ¡Tu entrenador quiere crear tu plan de nutrición! 🎉
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              {firstName} relléname este formulario lo antes posible para que pueda crearte un programa nutricional adaptado a tus necesidades con comidas específicas y cantidades exactas.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['Comidas específicas con gramos', 'Adaptado a tus objetivos', 'Según tus preferencias', 'Formato NL VIP Club'].map(tag => (
                <span key={tag} className="px-2 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full text-xs text-violet-300">
                  ✓ {tag}
                </span>
              ))}
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700 text-white font-bold px-6"
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Completar cuestionario
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default DietOnboardingForm
