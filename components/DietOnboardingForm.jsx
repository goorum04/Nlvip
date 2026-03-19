'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Apple, ChefHat, Loader2, CheckCircle2, UtensilsCrossed, Clock, Target, AlertCircle, Heart
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
    id: 'num_comidas',
    title: '¿Cuántas comidas al día prefieres?',
    icon: UtensilsCrossed,
    color: 'from-orange-500 to-amber-500',
    options: [
      { value: '3', label: '3 comidas', desc: 'Desayuno, comida y cena' },
      { value: '4', label: '4 comidas', desc: 'Desayuno, comida, merienda y cena' },
      { value: '5', label: '5 comidas', desc: 'Las 3 principales + 2 tentempiés' },
      { value: '6', label: '6 comidas', desc: 'Alta frecuencia, cada 2-3h' },
    ]
  },
  {
    id: 'horario_entreno',
    title: '¿Cuándo entrenas habitualmente?',
    icon: Clock,
    color: 'from-green-500 to-emerald-500',
    options: [
      { value: 'ayunas', label: '🌅 En ayunas', desc: 'Primera hora, antes del desayuno' },
      { value: 'manana', label: '☀️ Mañana', desc: 'Entre 8:00 y 13:00' },
      { value: 'tarde', label: '🌤️ Tarde', desc: 'Entre 13:00 y 18:00' },
      { value: 'noche', label: '🌙 Noche', desc: 'Después de las 18:00' },
    ]
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
      { value: 'keto', label: '🥑 Bajo en carbos', desc: 'Prefiero pocos carbohidratos' },
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
      { value: 'ninguna', label: '✅ Ninguna' },
    ]
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
  const [extras, setExtras] = useState({ favoritos: '', no_me_gusta: '', condicion_medica: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

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
    } else {
      setMultiChecks(prev => {
        const without = prev.filter(v => v !== 'ninguna')
        return without.includes(value) ? without.filter(v => v !== value) : [...without, value]
      })
    }
  }

  const handleMultiNext = () => {
    const val = multiChecks.length > 0 ? multiChecks.join(', ') : 'ninguna'
    setAnswers(prev => ({ ...prev, [currentStep.id]: val }))
    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const allAnswers = {
        ...answers,
        restricciones: multiChecks.join(', ') || 'ninguna',
        ...extras
      }

      const res = await fetch('/api/diet-onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, memberId, responses: allAnswers })
      })
      const result = await res.json()

      if (!res.ok) throw new Error(result.error || 'Error al procesar')

      setDone(true)
      toast({ title: '¡Plan creado!', description: result.message })
      setTimeout(() => onComplete?.(), 3000)
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-white text-xl font-bold">¡Plan Nutricional Generado!</h3>
        <p className="text-gray-400 max-w-sm">Tu programa nutricional personalizado ha sido creado y asignado. Puedes verlo en la pestaña de Dieta.</p>
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
          <Button onClick={handleMultiNext} className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white">
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

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold py-3 text-base"
          >
            {submitting
              ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Generando tu plan nutricional...</>
              : <><ChefHat className="w-5 h-5 mr-2" />¡Generar mi plan personalizado!</>
            }
          </Button>
          {submitting && (
            <p className="text-center text-gray-500 text-xs">
              Estamos diseñando tu programa con comidas específicas y cantidades exactas. Puede tardar 15-20 segundos...
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
export function DietOnboardingBanner({ requestId, memberId, onCompleted }) {
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
              Responde un breve cuestionario (2 min) y se generará automáticamente tu programa nutricional personalizado con comidas específicas y cantidades exactas.
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
