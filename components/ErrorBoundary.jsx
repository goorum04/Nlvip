'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCcw, Sparkles, CircleAlert as AlertCircle } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error("ErrorBoundary caught an error:", error)
    console.error("Component stack:", errorInfo?.componentStack)
    if (typeof window !== 'undefined' && window.Sentry?.captureException) {
      window.Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo?.componentStack } } })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center animate-in fade-in duration-700 bg-[#030303]">
          <div className="relative w-full max-w-md">
            {/* Background Glows */}
            <div className="absolute inset-x-0 -top-20 -z-10 flex justify-center overflow-hidden blur-3xl">
              <div className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-violet-600/20 to-cyan-600/20 opacity-40" />
            </div>

            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-12 h-12 text-violet-500" />
              </div>

              <div className="flex flex-col items-center gap-6">
                {/* Logo or Icon */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-violet-600/20 blur-2xl rounded-full scale-150 animate-pulse" />
                  <img 
                    src="/logo-nl-vip.jpg" 
                    alt="NL VIP TEAM" 
                    className="w-24 h-24 object-contain rounded-2xl relative z-10 shadow-xl border border-white/10"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-violet-500 rounded-full p-1.5 shadow-lg border-2 border-[#030303] z-20">
                    <RefreshCcw className="w-4 h-4 text-black animate-spin-slow" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Sección en Optimización
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Estamos revisando y mejorando esta función para garantizarte la mejor experiencia VIP. Vuelve a intentarlo en unos instantes.
                  </p>
                </div>

                <div className="w-full pt-4">
                  <Button 
                    onClick={this.handleReset}
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold py-6 rounded-2xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] group"
                  >
                    <RefreshCcw className="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                    Reintentar ahora
                  </Button>
                </div>

                {/* Secret debug info (Always show message in diagnostic build) */}
                <div className="pt-6 text-left overflow-auto max-h-52 bg-red-900/10 p-4 rounded-xl border border-red-900/20">
                  <p className="text-xs text-red-400 font-mono mb-2">
                    ERROR: {this.state.error?.message || 'Unknown Exception'}
                  </p>
                  <pre className="text-[10px] text-gray-500 font-mono whitespace-pre-wrap">
                    {this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 text-[10px] text-gray-600 font-mono whitespace-pre-wrap border-t border-red-900/20 pt-2">
                      {this.state.errorInfo.componentStack.split('\n').slice(0, 6).join('\n')}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
