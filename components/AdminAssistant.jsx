'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Mic, MicOff, Send, Bot, User, Loader2, CheckCircle2, XCircle,
  Volume2, VolumeX, Sparkles, AlertTriangle, Zap, Crown, Wand2,
  ChefHat, Flame, Beef, Wheat, Droplets, Clock, BarChart3, Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Componente de mensaje individual
function ChatMessage({ message, isUser, isLoading }) {
  // Detectar si el mensaje contiene recomendaciones de salud/ejercicios/dieta
  const hasHealthContent = /dieta|ejercicio|peso|calor|proteína|grasa|muscular|entrenamiento|salud|macros/i.test(message);
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 duration-300`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
        isUser 
          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-violet-500/25' 
          : 'bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 shadow-cyan-500/10'
      }`}>
        {isUser ? <User className="w-5 h-5 text-white" /> : <Wand2 className="w-5 h-5 text-cyan-400" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20' 
          : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-200'
      }`}>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
              <span className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
            </div>
            <span className="text-gray-400">Procesando...</span>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
            {hasHealthContent && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-amber-400/80">
                  ℹ️ Esta información es de carácter general. Consulta con un profesional de la salud antes de realizar cambios en tu dieta o rutina de ejercicios. Fuentes: {' '}
                  <a href="https://www.who.int/news-room/fact-sheets/diet-and-physical-activity" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">OMS</a>
                  {' • '}
                  <a href="https://www.acsm.org/get-stay-fit/fitness-basics" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">ACSM</a>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Componente visual para mostrar un plan de dieta generado con IA
function DietCard({ dietData }) {
  const [expanded, setExpanded] = useState(null)
  if (!dietData?.comidas) return null

  const { macros_diarios, tipo_dieta, goal_display, member_name, notas, comidas } = dietData

  const mealOrder = ['desayuno', 'media_manana', 'almuerzo', 'merienda', 'cena']
  const mealEmojis = { desayuno: '🌅', media_manana: '☕', almuerzo: '🍽️', merienda: '🍎', cena: '🌙' }
  const mealColors = {
    desayuno: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
    media_manana: 'from-orange-500/20 to-amber-500/10 border-orange-500/30',
    almuerzo: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
    merienda: 'from-sky-500/20 to-cyan-500/10 border-sky-500/30',
    cena: 'from-violet-500/20 to-purple-500/10 border-violet-500/30',
  }

  return (
    <div className="w-full mt-2 space-y-3 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header del plan */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 opacity-90" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="relative p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ChefHat className="w-5 h-5 text-white" />
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Plan de dieta IA</span>
              </div>
              <h3 className="text-lg font-bold text-white">{member_name || 'Socio'}</h3>
              <p className="text-sm text-white/70">{tipo_dieta} · {goal_display}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white">{macros_diarios?.calorias?.toLocaleString()}</div>
              <div className="text-xs text-white/70">kcal/día</div>
            </div>
          </div>

          {/* Macros bar */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-2 text-center">
              <Beef className="w-4 h-4 text-red-300 mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{macros_diarios?.proteinas_g}g</div>
              <div className="text-[10px] text-white/60">Proteína</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2 text-center">
              <Wheat className="w-4 h-4 text-amber-300 mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{macros_diarios?.carbohidratos_g}g</div>
              <div className="text-[10px] text-white/60">Carbos</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2 text-center">
              <Droplets className="w-4 h-4 text-sky-300 mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{macros_diarios?.grasas_g}g</div>
              <div className="text-[10px] text-white/60">Grasas</div>
            </div>
          </div>

          {notas && (
            <div className="mt-3 flex items-start gap-2 bg-white/10 rounded-xl p-2.5">
              <Info className="w-4 h-4 text-white/70 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-white/80">{notas}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tarjetas de comidas */}
      <div className="space-y-2">
        {mealOrder.map(mealKey => {
          const meal = comidas[mealKey]
          if (!meal) return null
          const isOpen = expanded === mealKey
          const colorClass = mealColors[mealKey] || 'from-white/10 to-white/5 border-white/10'

          return (
            <div key={mealKey} className={`bg-gradient-to-r ${colorClass} backdrop-blur border rounded-2xl overflow-hidden transition-all duration-300`}>
              {/* Meal header - clickable */}
              <button
                onClick={() => setExpanded(isOpen ? null : mealKey)}
                className="w-full p-3 flex items-center gap-3 text-left"
              >
                {/* Foto de la receta */}
                {meal.imagen_url ? (
                  <img
                    src={meal.imagen_url}
                    alt={meal.nombre}
                    className="w-16 h-16 object-cover rounded-xl flex-shrink-0 shadow-lg"
                    onError={e => { e.target.style.display='none' }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{mealEmojis[mealKey]}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{mealEmojis[mealKey]}</span>
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">{meal.categoria_display || mealKey}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">{meal.nombre}</h4>
                  <p className="text-xs text-white/60 truncate">{meal.descripcion}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-base font-black text-white">{meal.macros_por_porcion?.calorias}</div>
                  <div className="text-[10px] text-white/50">kcal</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{isOpen ? '▲' : '▼'}</div>
                </div>
              </button>

              {/* Expandido: ingredientes + pasos */}
              {isOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
                  {/* Info rápida */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-white/60">
                      <Clock className="w-3 h-3" />
                      {meal.tiempo_preparacion}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-white/60">
                      <BarChart3 className="w-3 h-3" />
                      {meal.dificultad}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <Beef className="w-3 h-3" />
                      {meal.macros_por_porcion?.proteinas_g}g prot
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Wheat className="w-3 h-3" />
                      {meal.macros_por_porcion?.carbohidratos_g}g carbos
                    </div>
                    <div className="flex items-center gap-1 text-xs text-sky-400">
                      <Droplets className="w-3 h-3" />
                      {meal.macros_por_porcion?.grasas_g}g grasa
                    </div>
                  </div>

                  {/* Ingredientes */}
                  {meal.ingredientes?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/80 mb-1.5 uppercase tracking-wide">🧺 Ingredientes</p>
                      <div className="grid grid-cols-1 gap-1">
                        {meal.ingredientes.map((ing, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-white/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                            {ing}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instrucciones */}
                  {meal.instrucciones?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/80 mb-1.5 uppercase tracking-wide">👨‍🍳 Preparación</p>
                      <div className="space-y-1.5">
                        {meal.instrucciones.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">{i+1}</span>
                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Consejo */}
                  {meal.consejo && (
                    <div className="bg-white/5 rounded-xl p-2.5 flex items-start gap-2">
                      <span className="text-sm">💡</span>
                      <p className="text-xs text-white/70">{meal.consejo}</p>
                    </div>
                  )}

                  {/* Fuente */}
                  {meal.fuente === 'spoonacular' && meal.fuente_url && (
                    <a
                      href={meal.fuente_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-white/30 hover:text-white/60 transition-colors block text-right"
                    >
                      Receta original →
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer badge */}
      <div className="flex items-center justify-center gap-2 py-1">
        <Sparkles className="w-3 h-3 text-violet-400" />
        <span className="text-[10px] text-gray-600">Generado con IA · {dietData.usa_spoonacular ? 'Recetas de Spoonacular' : 'GPT-4o mini'}</span>
      </div>
    </div>
  )
}

// Componente del plan de ejecución - Premium
function ExecutionPlan({ plan, onConfirm, onCancel, isExecuting }) {
  return (
    <div className="relative overflow-hidden rounded-3xl animate-in slide-in-from-bottom-4 duration-500">
      {/* Gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 opacity-20 blur-xl"></div>
      <div className="relative bg-black/60 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-black" />
          </div>
          <div>
            <h4 className="font-semibold text-white">Confirmación Requerida</h4>
            <p className="text-xs text-amber-400/80">Revisa las acciones antes de ejecutar</p>
          </div>
        </div>
        
        <div className="space-y-2">
          {plan.map((action, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-white/5 backdrop-blur rounded-xl p-3 border border-white/5">
              <span className="text-2xl">{action.icon}</span>
              <div className="flex-1">
                <p className="text-white font-medium">{action.description}</p>
                {action.args && Object.keys(action.args).length > 0 && (
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {Object.entries(action.args).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={onCancel}
            disabled={isExecuting}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl h-12"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isExecuting}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl h-12 shadow-lg shadow-emerald-500/25"
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AdminAssistant({ userId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [pendingPlan, setPendingPlan] = useState(null)
  const [pendingToolCalls, setPendingToolCalls] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const { toast } = useToast()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isSpeechSupported = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  )
  const isIOS = typeof navigator !== 'undefined' && (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )

  useEffect(() => {
    if (
    typeof window !== 'undefined' &&
    (isSpeechSupported && !isIOS)) {
      try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'es-ES'

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
        handleSend(transcript)
      }

      recognitionRef.current.onerror = (e) => {
       setIsListening(false)
       if (e.error === 'not-allowed') {
      toast({ title: 'Permiso denegado', description: 'Activa el micrófono en Ajustes > Safari > Micrófono', variant: 'destructive' })
       } else if (e.error === 'no-speech') {
       toast({ title: 'No se detectó voz', description: 'Inténtalo de nuevo', variant: 'destructive' })
       } else {
       toast({ title: 'Error de voz', description: 'No se pudo reconocer tu voz', variant: 'destructive' })
      }
    }

      recognitionRef.current.onend = () => setIsListening(false)
      } catch (e) {
        console.log('Speech recognition not available')
      }
    }
  }, [])

  const speak = (text) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({ title: 'No disponible', description: 'Tu navegador no soporta reconocimiento de voz', variant: 'destructive' })
      return
    }
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const handleSend = async (textOverride) => {
    const text = textOverride || input
    if (!text.trim() || isLoading) return

    const userMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setPendingPlan(null)
    setPendingToolCalls([])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-assistant', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      if (data.message) {
        let extractedDietData = null
        if (data.toolResults) {
          for (const result of Object.values(data.toolResults)) {
            if (result?.diet_generated && result?.diet_data) {
              extractedDietData = result.diet_data
              break
            }
          }
        }
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          diet_data: extractedDietData
        }])
        speak(data.message)
      }

      if (data.needsConfirmation && data.executionPlan) {
        setPendingPlan(data.executionPlan)
        setPendingToolCalls(data.toolCalls)
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Lo siento, hubo un error: ${error.message}` }])
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!pendingToolCalls.length) return
    setIsExecuting(true)
    try {
      const toolsToExecute = pendingToolCalls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        args: tc.function.arguments
      }))

      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/admin-assistant', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ executeTools: true, toolCallsToExecute: toolsToExecute })
      })

      const data = await response.json()
      const resultMessage = data.success ? '✅ ¡Acciones ejecutadas correctamente!' : '❌ Algunas acciones fallaron'
      setMessages(prev => [...prev, { role: 'assistant', content: resultMessage }])
      speak(data.success ? 'Listo, acciones ejecutadas' : 'Hubo algunos errores')
      setPendingPlan(null)
      setPendingToolCalls([])
      toast({
        title: data.success ? '¡Éxito!' : 'Error',
        description: data.success ? 'Acciones ejecutadas correctamente' : 'Algunas acciones fallaron',
        variant: data.success ? 'default' : 'destructive'
      })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCancel = () => {
    setPendingPlan(null)
    setPendingToolCalls([])
    setMessages(prev => [...prev, { role: 'assistant', content: '❌ Acción cancelada. ¿En qué más puedo ayudarte?' }])
    speak('Acción cancelada')
  }

  const quickCommands = [
    { icon: '📊', text: 'Resumen del gym', command: 'Dime el resumen del gimnasio' },
    { icon: '🔍', text: 'Buscar socio', command: 'Busca al socio Said' },
    { icon: '📢', text: 'Crear aviso', command: 'Crea un aviso para todos' },
    { icon: '👥', text: 'Ver socios', command: 'Lista todos los socios' },
    { icon: '🍽️', text: 'Dieta con IA', command: 'Ponle una dieta alta en proteínas para perder grasa a Said, sin gluten' },
    { icon: '👟', text: 'Ver actividad', command: 'Ver actividad física del socio Said' }
  ]

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* PREMIUM HEADER */}
      <div className="relative overflow-hidden rounded-t-3xl">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 opacity-90"></div>
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-cyan-400/30 rounded-full blur-2xl"></div>
        <div className="relative px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white/30 rounded-2xl blur-lg"></div>
                <div className="relative w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-xl">
                  <Wand2 className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white shadow-lg shadow-emerald-400/50"></div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">NL VIP Assistant</h2>
                  <div className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full">
                    <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wider">Pro</span>
                  </div>
                </div>
                <p className="text-sm text-white/70 mt-0.5">Tu asistente de gestión con IA</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isListening && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-sm rounded-full border border-red-400/30 animate-pulse">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-xs font-medium text-red-200">Escuchando</span>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 backdrop-blur-sm rounded-full border border-cyan-400/30">
                  <Volume2 className="w-3 h-3 text-cyan-300 animate-pulse" />
                  <span className="text-xs font-medium text-cyan-200">Hablando</span>
                </div>
              )}
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  ttsEnabled
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-black/20 text-white/50 hover:bg-black/30'
                }`}
              >
                {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 bg-gradient-to-b from-[#0a0a0a] to-[#111] border-x border-violet-500/10 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full blur-2xl opacity-20"></div>
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-white/10 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-violet-400/50" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">¿En qué puedo ayudarte?</h3>
              <p className="text-gray-500 mb-8 max-w-sm">
                Gestiona socios, crea avisos, genera dietas y más usando comandos de voz o texto.
              </p>
              <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
                {quickCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setInput(cmd.command); handleSend(cmd.command) }}
                    className="group relative overflow-hidden rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 group-hover:from-violet-500/10 group-hover:to-cyan-500/10 transition-all"></div>
                    <div className="absolute inset-0 border border-white/10 group-hover:border-violet-500/30 rounded-2xl transition-all"></div>
                    <div className="relative">
                      <span className="text-2xl mb-2 block">{cmd.icon}</span>
                      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{cmd.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <ChatMessage message={msg.content} isUser={msg.role === 'user'} />
                  {msg.role === 'assistant' && msg.diet_data && (
                    <DietCard dietData={msg.diet_data} />
                  )}
                  {msg.role === 'assistant' && (
                    <p style={{ fontSize: '11px', color: '#888', marginTop: '8px', marginBottom: '8px', paddingLeft: '8px' }}>
                      Información orientativa. Consulte siempre a un profesional de salud.{' '}
                      Fuentes:{' '}
                      <a href="https://www.who.int" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>OMS</a>
                      {' / '}
                      <a href="https://www.nih.gov" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>NIH</a>
                    </p>
                  )}
                </div>
              ))}
              {isLoading && <ChatMessage message="" isUser={false} isLoading={true} />}
              {pendingPlan && (
                <ExecutionPlan
                  plan={pendingPlan}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  isExecuting={isExecuting}
                />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-xl">
          <div className="flex gap-3">
            {isSpeechSupported && !isIOS && (
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10'
                }`}
              >
                {isListening && (
                  <div className="absolute inset-0 rounded-2xl bg-red-500 animate-ping opacity-30"></div>
                )}
                {isListening ? <MicOff className="w-6 h-6 relative" /> : <Mic className="w-6 h-6" />}
              </button>
            )}
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escribe o habla un comando..."
                disabled={isLoading || isListening}
                className="w-full h-14 bg-white/5 border-white/10 rounded-2xl pl-5 pr-14 text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:ring-violet-500/20"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 disabled:opacity-30 disabled:shadow-none"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mt-3">
            Pulsa el micrófono para hablar o escribe tu mensaje
          </p>
        </div>
      </div>

      {/* Bottom rounded border */}
      <div className="h-2 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 rounded-b-3xl"></div>
    </div>
  )
}
