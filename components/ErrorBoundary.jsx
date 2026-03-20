'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

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
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="m-4 bg-red-950/50 border-red-500/50">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Error Crítico en el Componente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white">Ha ocurrido un error al cargar esta sección.</p>
            <pre className="bg-black/50 p-4 rounded-lg overflow-auto text-red-200 text-sm">
              {this.state.error?.toString()}
            </pre>
            <details className="text-gray-400 text-xs">
              <summary className="cursor-pointer hover:text-gray-300">Ver Detalles Técnicos (Stack Trace)</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
