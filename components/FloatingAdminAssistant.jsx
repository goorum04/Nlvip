'use client'

import { useState } from 'react'
import { Wand2, Sparkles } from 'lucide-react'
import AdminAssistant from './AdminAssistant'

export default function FloatingAdminAssistant({ userId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [voiceTrigger, setVoiceTrigger] = useState(0)

  return (
    <>
      {/* Floating trigger button - bottom left, always visible */}
      <div className="fixed bottom-5 left-5 z-50">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30 hover:scale-110 hover:shadow-violet-500/50 transition-all duration-200"
            title="Abrir Asistente IA"
          >
            {/* Glow pulse */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 animate-pulse opacity-30 blur-md -z-10"></div>
            <Wand2 className="w-5 h-5 text-white" />
            {/* IA badge */}
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center text-[8px] font-bold text-black shadow-md shadow-cyan-400/50">
              IA
            </span>
          </button>
        )}

        {/* Floating panel */}
        {isOpen && (
          <div
            className="absolute bottom-0 left-0 w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[85vh] rounded-2xl shadow-2xl shadow-violet-500/25 flex flex-col overflow-hidden border border-violet-500/20"
            style={{ animation: 'slideUpFade 0.2s ease-out' }}
          >
            <AdminAssistant
              userId={userId}
              voiceTrigger={voiceTrigger}
              onClose={() => setIsOpen(false)}
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
