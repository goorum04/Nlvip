'use client'

import { useState } from 'react'
import { WandSparkles as Wand2, Sparkles } from 'lucide-react'
import AdminAssistant from './AdminAssistant'

export default function FloatingAdminAssistant({ userId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [voiceTrigger, setVoiceTrigger] = useState(0)

  return (
    <>
      {/* Floating trigger button - bottom left, only when closed */}
      {!isOpen && (
        <div className="fixed bottom-6 left-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-xl shadow-violet-500/40 hover:scale-110 hover:shadow-violet-500/60 transition-all duration-200"
            title="Abrir Asistente IA"
          >
            {/* Glow pulse */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 animate-pulse opacity-50 blur-md -z-10"></div>
            <Wand2 className="w-7 h-7 text-white" />
            {/* IA badge */}
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center text-[10px] font-bold text-black shadow-lg shadow-cyan-400/50">
              IA
            </span>
          </button>
        </div>
      )}

      {/* Floating panel - independent fixed element */}
      {isOpen && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-6 lg:right-auto lg:translate-x-0 w-[92%] max-w-[400px] h-[600px] max-h-[85vh] bg-[#0A0A0A] rounded-[2rem] shadow-2xl shadow-black border border-white/10 flex flex-col overflow-hidden z-50"
          style={{ animation: 'slideUpFade 0.2s ease-out' }}
        >
          <AdminAssistant
            userId={userId}
            voiceTrigger={voiceTrigger}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
