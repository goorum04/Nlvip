'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCcw } from 'lucide-react'

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body className="bg-[#030303] text-white flex items-center justify-center p-6 text-center min-h-screen">
        <div className="max-w-md space-y-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full scale-150 animate-pulse" />
            <img 
              src="/logo-nl-vip.jpg" 
              alt="NL VIP TEAM" 
              className="w-24 h-24 object-contain rounded-2xl relative z-10 shadow-xl border border-white/10 mx-auto"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-red-500">Error Crítico de Sistema</h2>
            <p className="text-gray-400 text-sm">
              Se ha detectado una excepción global en la carga del cliente.
            </p>
          </div>
          <div className="text-left bg-red-900/10 p-4 rounded-xl border border-red-900/20 overflow-auto max-h-48">
            <p className="text-xs text-red-400 font-mono mb-2">
              MSJ: {error?.message || 'Error Desconocido'}
            </p>
            <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap">
              {error?.stack?.split('\n').slice(0, 5).join('\n')}
            </pre>
          </div>
          <Button 
            onClick={() => reset()}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-2xl"
          >
            <RefreshCcw className="w-5 h-5 mr-2" />
            Reiniciar Aplicación
          </Button>
        </div>
      </body>
    </html>
  )
}
