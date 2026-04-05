'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Trophy, Plus, History, TrendingUp, Dumbbell, 
  Calendar, Trash2, Loader2, Info, ChevronRight
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function PRTracker({ memberId }) {
  const [prs, setPrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    exercise_name: '',
    weight_kg: '',
    reps: '1',
    date: new Date().toISOString().split('T')[0]
  })
  const { toast } = useToast()

  useEffect(() => {
    loadPRs()
  }, [memberId])

  const loadPRs = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/member-prs?memberId=${memberId}`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPrs(data)
    } catch (error) {
      console.error('Error loading PRs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPR = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/member-prs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          ...form,
          weight_kg: parseFloat(form.weight_kg),
          reps: parseInt(form.reps)
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      
      toast({ title: '¡Récord guardado!', description: `Nuevo PR en ${form.exercise_name}` })
      setForm({
        exercise_name: '',
        weight_kg: '',
        reps: '1',
        date: new Date().toISOString().split('T')[0]
      })
      loadPRs()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  // Agrupar PRs por ejercicio (solo el mejor de cada uno)
  const bestPrs = prs.reduce((acc, pr) => {
    if (!acc[pr.exercise_name] || parseFloat(pr.estimated_1rm) > parseFloat(acc[pr.exercise_name].estimated_1rm)) {
      acc[pr.exercise_name] = pr
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Récords Personales
          </h2>
          <p className="text-gray-400">Tus mejores marcas en el club NL VIP</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario para añadir PR */}
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-violet-500/20 rounded-3xl lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Plus className="w-5 h-4 text-violet-400" />
              Nuevo Récord
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPR} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-400">Ejercicio</Label>
                <Input 
                  placeholder="Ej: Press de Banca"
                  value={form.exercise_name}
                  onChange={e => setForm({...form, exercise_name: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400">Peso (kg)</Label>
                  <Input 
                    type="number"
                    step="0.5"
                    value={form.weight_kg}
                    onChange={e => setForm({...form, weight_kg: e.target.value})}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Reps</Label>
                  <Input 
                    type="number"
                    value={form.reps}
                    onChange={e => setForm({...form, reps: e.target.value})}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Fecha</Label>
                <Input 
                  type="date"
                  value={form.date}
                  onChange={e => setForm({...form, date: e.target.value})}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              {form.weight_kg && form.reps && (
                <div className="p-4 bg-violet-500/10 rounded-2xl border border-violet-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">1RM Estimado:</span>
                    <span className="text-violet-400 font-bold text-xl">
                      {(parseFloat(form.weight_kg) / (1.0278 - (0.0278 * parseInt(form.reps || 1)))).toFixed(1)} kg
                    </span>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={adding}
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold py-6 rounded-2xl"
              >
                {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Récord'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listado de mejores PRs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold mb-4">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Tus Mejores Marcas
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : Object.keys(bestPrs).length === 0 ? (
            <div className="text-center p-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aún no has registrado ningún récord personal.</p>
              <p className="text-gray-500 text-sm mt-1">¡Reta a tus límites y anótalos aquí!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(bestPrs).map((pr) => (
                <Card key={pr.id} className="bg-white/5 border-white/10 hover:border-violet-500/30 transition-all rounded-3xl">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-white font-bold uppercase tracking-wider text-sm">{pr.exercise_name}</h3>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                            {pr.weight_kg}
                          </span>
                          <span className="text-gray-500 font-bold">KG</span>
                          <span className="text-violet-400 text-xs font-bold ml-2">x{pr.reps} reps</span>
                        </div>
                      </div>
                      <div className="bg-violet-500/20 p-3 rounded-2xl text-center min-w-[80px]">
                        <p className="text-[10px] text-violet-400 font-bold uppercase">1RM Est.</p>
                        <p className="text-lg font-black text-white">{pr.estimated_1rm} <span className="text-[10px]">kg</span></p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(pr.date).toLocaleDateString()}
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <div className="mt-6 flex items-start gap-3 p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-300 leading-relaxed">
              <strong>Nota sobre el 1RM:</strong> El sistema utiliza la fórmula de Brzycki para estimar tu peso máximo a una repetición. Usa estos datos para progresar con seguridad en tus rutinas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
