'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('app error boundary:', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#030303] text-white px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-2xl font-semibold">Algo ha fallado</h1>
        <p className="text-white/70 text-sm">
          Se produjo un error inesperado. Puedes intentarlo de nuevo.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-5 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] transition"
          >
            Reintentar
          </button>
          <button
            onClick={() => { window.location.href = '/' }}
            className="px-5 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </main>
  )
}
