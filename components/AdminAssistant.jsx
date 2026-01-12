'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Mic, MicOff, Send, Bot, User, Loader2, CheckCircle2, XCircle,
  Volume2, VolumeX, Sparkles, AlertTriangle, ChevronDown
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Componente de mensaje individual
function ChatMessage({ message, isUser, isLoading }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
        isUser 
          ? 'bg-gradient-to-br from-violet-500 to-cyan-500 text-black' 
          : 'bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-400'
      }`}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-gradient-to-br from-violet-600 to-cyan-600 text-white' 
          : 'bg-white/5 border border-white/10 text-gray-200'
      }`}>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Pensando...</span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message}</p>
        )}
      </div>
    </div>
  )
}

// Componente del plan de ejecución
function ExecutionPlan({ plan, onConfirm, onCancel, isExecuting }) {
  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 text-amber-400">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-semibold">Plan de Ejecución</span>
      </div>
      
      <div className="space-y-2">
        {plan.map((action, idx) => (
          <div key={idx} className="flex items-start gap-3 bg-black/20 rounded-xl p-3">
            <span className="text-2xl">{action.icon}</span>
            <div className="flex-1">
              <p className="text-white font-medium">{action.description}</p>
              {action.args && Object.keys(action.args).length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {Object.entries(action.args).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onCancel}
          disabled={isExecuting}
          variant="outline"
          className="flex-1 border-white/20 text-gray-300 hover:bg-white/10 rounded-xl"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isExecuting}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90 rounded-xl"
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
  )
}

// Resultado de ejecución
function ExecutionResult({ result, success }) {
  return (
    <div className={`rounded-2xl p-4 border ${
      success 
        ? 'bg-green-500/10 border-green-500/30' 
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {success ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400" />
        )}
        <span className={`font-semibold ${success ? 'text-green-400' : 'text-red-400'}`}>
          {success ? '¡Ejecutado con éxito!' : 'Error en la ejecución'}
        </span>
      </div>
      {result && (
        <pre className="text-xs text-gray-400 bg-black/30 rounded-lg p-2 overflow-x-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
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

  // Auto-scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Inicializar Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'es-ES'

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
        // Auto-enviar después de transcribir
        handleSend(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        toast({ title: 'Error de voz', description: 'No se pudo reconocer tu voz', variant: 'destructive' })
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [])

  // Text-to-Speech
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

  // Toggle escucha
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

  // Enviar mensaje
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
      const response = await fetch('/api/admin-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Añadir respuesta del asistente
      if (data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
        speak(data.message)
      }

      // Si necesita confirmación, mostrar el plan
      if (data.needsConfirmation && data.executionPlan) {
        setPendingPlan(data.executionPlan)
        setPendingToolCalls(data.toolCalls)
      }

    } catch (error) {
      console.error('Error:', error)
      const errorMessage = `Lo siento, hubo un error: ${error.message}`
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }])
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  // Confirmar ejecución
  const handleConfirm = async () => {
    if (!pendingToolCalls.length) return
    
    setIsExecuting(true)
    try {
      const toolsToExecute = pendingToolCalls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        args: tc.function.arguments
      }))

      const response = await fetch('/api/admin-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executeTools: true,
          toolCallsToExecute: toolsToExecute
        })
      })

      const data = await response.json()

      // Mostrar resultado
      const resultMessage = data.success 
        ? '✅ ¡Acciones ejecutadas correctamente!' 
        : '❌ Algunas acciones fallaron'
      
      setMessages(prev => [...prev, { role: 'assistant', content: resultMessage }])
      speak(data.success ? 'Listo, acciones ejecutadas' : 'Hubo algunos errores')

      // Limpiar plan pendiente
      setPendingPlan(null)
      setPendingToolCalls([])

      toast({
        title: data.success ? '¡Éxito!' : 'Error',
        description: data.success ? 'Acciones ejecutadas correctamente' : 'Algunas acciones fallaron',
        variant: data.success ? 'default' : 'destructive'
      })

    } catch (error) {
      console.error('Execution error:', error)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setIsExecuting(false)
    }
  }

  // Cancelar ejecución
  const handleCancel = () => {
    setPendingPlan(null)
    setPendingToolCalls([])
    setMessages(prev => [...prev, { role: 'assistant', content: '❌ Acción cancelada. ¿En qué más puedo ayudarte?' }])
    speak('Acción cancelada')
  }

  // Ejemplos rápidos
  const quickExamples = [
    '🔍 "Dime el resumen del gimnasio"',
    '👤 "Busca al socio Said"',
    '🎯 "Aplica pérdida de grasa a Said"',
    '📢 "Crea aviso: Mañana cerramos a las 20h"'
  ]

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-violet-500/20 rounded-3xl h-[calc(100vh-200px)] flex flex-col">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                Asistente IA
                {isListening && <span className="text-xs bg-red-500 px-2 py-0.5 rounded-full animate-pulse">🎤 Escuchando...</span>}
                {isSpeaking && <span className="text-xs bg-violet-500 px-2 py-0.5 rounded-full">🔊 Hablando...</span>}
              </CardTitle>
              <p className="text-sm text-gray-500">Habla o escribe para gestionar el gimnasio</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`rounded-xl ${ttsEnabled ? 'text-violet-400' : 'text-gray-500'}`}
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Área de mensajes */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Bot className="w-16 h-16 text-violet-400/30 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">¡Hola! Soy tu asistente</h3>
              <p className="text-gray-500 mb-6 max-w-md">
                Puedo ayudarte a gestionar socios, crear avisos, moderar el feed y más. 
                Habla o escribe lo que necesites.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {quickExamples.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(example.substring(2))}
                    className="text-left text-sm p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage key={idx} message={msg.content} isUser={msg.role === 'user'} />
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

        {/* Input área */}
        <div className="pt-4 border-t border-white/10 mt-4">
          <div className="flex gap-2">
            <Button
              onClick={toggleListening}
              disabled={isLoading}
              className={`rounded-2xl px-4 py-6 transition-all ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Escribe o habla tu mensaje..."
              disabled={isLoading || isListening}
              className="flex-1 bg-white/5 border-white/10 rounded-2xl px-4 py-6 text-white placeholder:text-gray-500 focus:border-violet-500"
            />
            <Button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="rounded-2xl px-6 py-6 bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:opacity-90"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Pulsa el micrófono para hablar o escribe tu mensaje
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
