'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoaderCircle as Loader2, BookOpen, Search } from 'lucide-react'

const MUSCLES = [
  { value: 'all', label: 'Todos los músculos' },
  { value: 'espalda', label: 'Espalda' },
  { value: 'pecho', label: 'Pecho' },
  { value: 'hombros', label: 'Hombros' },
  { value: 'bíceps', label: 'Bíceps' },
  { value: 'tríceps', label: 'Tríceps' },
  { value: 'cuádriceps', label: 'Cuádriceps' },
  { value: 'femoral', label: 'Femoral' },
  { value: 'glúteo', label: 'Glúteo' },
  { value: 'gemelos', label: 'Gemelos' },
  { value: 'abdomen', label: 'Abdomen' },
  { value: 'lumbares', label: 'Lumbares' },
]

const MUSCLE_COLORS = {
  espalda: 'bg-blue-500/20 text-blue-300',
  pecho: 'bg-red-500/20 text-red-300',
  hombros: 'bg-yellow-500/20 text-yellow-300',
  bíceps: 'bg-green-500/20 text-green-300',
  tríceps: 'bg-orange-500/20 text-orange-300',
  cuádriceps: 'bg-amber-500/20 text-amber-300',
  femoral: 'bg-purple-500/20 text-purple-300',
  glúteo: 'bg-pink-500/20 text-pink-300',
  gemelos: 'bg-cyan-500/20 text-cyan-300',
  abdomen: 'bg-lime-500/20 text-lime-300',
  lumbares: 'bg-rose-500/20 text-rose-300',
}

export default function ExerciseCatalogPicker({
  onSelect,
  excludeOnlyMale = false,
  triggerLabel = 'Catálogo',
  triggerVariant = 'outline',
  triggerClassName = 'border-violet-500/30 text-violet-400 hover:bg-violet-500/10 rounded-xl whitespace-nowrap px-3',
  triggerSize = 'sm'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const muscleOptions = excludeOnlyMale
    ? MUSCLES.filter(m => m.value !== 'pecho')
    : MUSCLES

  const search = async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('exercises')
        .select('id, name, muscle_primary, equipment, difficulty, default_sets, default_reps, default_rest_seconds, description, only_male')
        .eq('is_global', true)
        .order('muscle_primary')
        .order('name')
        .limit(80)

      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`)
      if (muscle !== 'all') q = q.eq('muscle_primary', muscle)
      if (excludeOnlyMale) q = q.or('only_male.is.null,only_male.eq.false')

      const { data } = await q
      setResults(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) search()
  }, [open, muscle, excludeOnlyMale])

  useEffect(() => {
    const timer = setTimeout(() => { if (open) search() }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border-violet-500/20 rounded-2xl max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-white/5">
          <DialogTitle className="text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-violet-400" /> Catálogo de Ejercicios
          </DialogTitle>
        </DialogHeader>

        {/* Filtros */}
        <div className="px-5 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="pl-9 bg-black/50 border-violet-500/20 rounded-xl text-white"
            />
          </div>
          <Select value={muscle} onValueChange={setMuscle}>
            <SelectTrigger className="bg-black/50 border-violet-500/20 rounded-xl text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-violet-500/20">
              {muscleOptions.map(m => (
                <SelectItem key={m.value} value={m.value} className="text-white hover:bg-violet-500/10">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No se encontraron ejercicios</p>
          ) : (
            results.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  onSelect(ex)
                  setOpen(false)
                  setQuery('')
                  setMuscle('all')
                }}
                className="w-full text-left p-3 bg-black/30 hover:bg-violet-500/10 border border-white/5 hover:border-violet-500/30 rounded-xl transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white text-sm font-medium leading-snug">{ex.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${MUSCLE_COLORS[ex.muscle_primary] || 'bg-violet-500/20 text-violet-300'}`}>
                    {ex.muscle_primary}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ex.equipment} · {ex.default_sets}×{ex.default_reps} · {ex.default_rest_seconds}s
                </p>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
