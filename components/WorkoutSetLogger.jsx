'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ClipboardList, ChevronDown, ChevronUp, Sparkles,
  LoaderCircle as Loader2, Check, History, NotebookPen, Trophy, Share2, Download,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWorkoutSetLog, groupExercises } from '@/hooks/useWorkoutSetLog'

/**
 * Registro OPCIONAL de series del socio para el entreno de hoy.
 *
 * Nada es obligatorio: si no rellena nada, no se guarda nada y la app se
 * comporta exactamente igual que antes. Solo se envían las series en las que
 * haya puesto peso y/o repeticiones. La lectura y el guardado están en
 * hooks/useWorkoutSetLog.js (los comparte con el modo entreno del diseño nuevo).
 */
export function WorkoutSetLogger({ memberId, day, exercises = [] }) {
  const [open, setOpen] = useState(false)
  const {
    values, notes, lastSession, loading, saving, savedAt,
    setField, setNoteField, save,
    newPrs, setNewPrs, prShareUrl, setPrShareUrl, prShareBuilding, buildPrShare, sharePr, downloadPr,
  } = useWorkoutSetLog({ memberId, day, exercises, active: open })

  const handleSave = () => save()

  if (!day || exercises.length === 0) return null

  const prDialog = newPrs.length > 0 && (
    <Dialog open onOpenChange={() => { setNewPrs([]); setPrShareUrl(null) }}>
      <DialogContent className="bg-[#111] border-amber-500/30 rounded-3xl max-w-sm p-5">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> ¡Nuevo récord{newPrs.length > 1 ? 's' : ''}!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {newPrs.map(pr => (
            <div key={pr.exercise.id} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-white font-bold">{pr.exercise.name}</p>
              <p className="text-amber-300 text-sm">
                {String(pr.weight).replace('.', ',')} kg{pr.reps ? ` × ${pr.reps}` : ''} <span className="text-gray-500">· antes {String(pr.previous).replace('.', ',')} kg</span>
              </p>
              {!prShareUrl && (
                <Button size="sm" disabled={prShareBuilding} onClick={() => buildPrShare(pr)} className="mt-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold">
                  {prShareBuilding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Share2 className="w-4 h-4 mr-1" />} Crear imagen para compartir
                </Button>
              )}
            </div>
          ))}
          {prShareUrl && (
            <div className="space-y-2">
              <img src={prShareUrl} alt="Nuevo récord" className="w-full rounded-2xl border border-[#2a2a2a]" />
              <div className="flex gap-2">
                <Button onClick={() => sharePr()} className="flex-1 bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-xl"><Share2 className="w-4 h-4 mr-2" /> Compartir</Button>
                <Button variant="outline" onClick={() => downloadPr()} className="rounded-xl border-[#2a2a2a] text-gray-200"><Download className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
      {prDialog}
      {/* Banner: deja claro que es opcional y por qué merece la pena */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold">Registra tus series y notas</h3>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                Opcional
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1 flex items-start gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Si apuntas el peso y las repeticiones de cada serie, tu seguimiento será
                mucho mejor: tu entrenador ve tu progresión real y tus rutinas se ajustan
                a las cargas que mueves de verdad. Si no lo rellenas, no pasa nada.
              </span>
            </p>
            {savedAt && !open && (
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Guardado
              </p>
            )}
          </div>
          {open
            ? <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />}
        </div>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : (
            <>
              {(() => {
                const groups = groupExercises(exercises)

                return groups.map((grp, gi) => {
                  const size = grp.items.length
                  const isSuperset = grp.id > 0 && size >= 2
                  const label = size >= 3 ? 'Tri-serie' : 'Bi-serie'
                  return (
                    <div
                      key={gi}
                      className={isSuperset ? 'border border-amber-500/30 bg-amber-500/[0.04] rounded-2xl p-2.5 space-y-2.5' : 'space-y-3'}
                    >
                      {isSuperset && (
                        <div className="flex items-center gap-2 px-1.5">
                          <span className="text-[10px] uppercase tracking-wide font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            {label}
                          </span>
                          <span className="text-[11px] text-amber-300/70">
                            registra cada ejercicio por separado
                          </span>
                        </div>
                      )}
                      {grp.items.map(ex => (
                        <div key={ex.id} className="bg-black/30 rounded-2xl p-4 border border-[#2a2a2a]">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <p className="text-white font-semibold text-sm">{ex.name}</p>
                            <span className="text-[11px] text-violet-400 whitespace-nowrap">
                              {ex.sets}×{ex.reps}
                            </span>
                          </div>

                          {lastSession[ex.id] && (
                            <p className="text-[11px] text-gray-500 mb-3 flex items-center gap-1">
                              <History className="w-3 h-3" />
                              Última vez: {lastSession[ex.id]}
                            </p>
                          )}

                          <div className="space-y-2">
                            {(values[ex.id] || []).map((row, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 w-12 flex-shrink-0">
                                  Serie {i + 1}
                                </span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="kg"
                                  value={row.weight}
                                  onChange={e => setField(ex.id, i, 'weight', e.target.value)}
                                  disabled={saving}
                                  className="bg-black/50 border-[#2a2a2a] rounded-xl text-white h-9 text-sm"
                                />
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="reps"
                                  value={row.reps}
                                  onChange={e => setField(ex.id, i, 'reps', e.target.value)}
                                  disabled={saving}
                                  className="bg-black/50 border-[#2a2a2a] rounded-xl text-white h-9 text-sm"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex items-start gap-1.5">
                            <NotebookPen className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-2" />
                            <Textarea
                              placeholder="Notas (opcional): p. ej. 'me costó más acabar' o 'tuve que hacerlo con otra máquina'"
                              value={notes[ex.id] || ''}
                              onChange={e => setNoteField(ex.id, e.target.value)}
                              disabled={saving}
                              rows={2}
                              className="bg-black/50 border-[#2a2a2a] rounded-xl text-white text-sm min-h-0 resize-none placeholder:text-gray-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-2xl h-12"
              >
                {saving ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
                ) : (
                  <><Check className="w-5 h-5 mr-2" /> Guardar entreno de hoy</>
                )}
              </Button>
              <p className="text-[11px] text-gray-600 text-center">
                Puedes rellenar solo las series que quieras y volver a editarlas durante el día.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default WorkoutSetLogger
