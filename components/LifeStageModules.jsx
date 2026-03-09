'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
    Baby, Heart, Milk, Timer, Plus, TrendingUp,
    Clock, Loader2, ChevronLeft, ChevronRight,
    Droplets, BarChart3, AlertCircle
} from 'lucide-react'

// =============================================================
// LIFE STAGE SELECTOR — Selector de etapa de vida
// =============================================================
export function LifeStageSelector({ userId, profile, onUpdate }) {
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const stages = [
        { value: 'cycle', emoji: '🌸', label: 'Ciclo', desc: 'Seguimiento menstrual' },
        { value: 'pregnant', emoji: '🤰', label: 'Embarazo', desc: 'Gestación' },
        { value: 'postpartum', emoji: '👶', label: 'Postparto', desc: '0-12 meses' },
        { value: 'lactating', emoji: '🤱', label: 'Lactancia', desc: 'Control de tomas' },
    ]

    const handleSelect = async (stage) => {
        if (profile?.life_stage === stage) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ life_stage: stage, updated_at: new Date().toISOString() })
                .eq('id', userId)

            if (error) throw error
            onUpdate?.({ ...profile, life_stage: stage })
            toast({ title: `✅ Modo ${stages.find(s => s.value === stage)?.label} activado` })
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
            <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-400" />
                    Mi etapa de vida
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-4 gap-2">
                    {stages.map(stage => (
                        <button
                            key={stage.value}
                            onClick={() => handleSelect(stage.value)}
                            disabled={saving}
                            className={`p-3 rounded-2xl border text-center transition-all ${profile?.life_stage === stage.value
                                    ? 'bg-gradient-to-br from-pink-500/30 to-violet-500/20 border-pink-500 text-white'
                                    : 'border-[#2a2a2a] text-gray-500 hover:border-pink-500/40'
                                }`}
                        >
                            <div className="text-2xl mb-1">{stage.emoji}</div>
                            <div className="text-[10px] font-semibold">{stage.label}</div>
                            <div className="text-[9px] text-gray-500 mt-0.5">{stage.desc}</div>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

// =============================================================
// PREGNANCY MODE — Modo Embarazo
// =============================================================
export function PregnancyMode({ userId, profile, onUpdate }) {
    const [showConfig, setShowConfig] = useState(false)
    const [dueDate, setDueDate] = useState(profile?.due_date || '')
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const getPregnancyWeek = () => {
        if (!profile?.due_date) return null
        const due = new Date(profile.due_date)
        const today = new Date()
        const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
        const daysPregnant = 280 - daysUntilDue
        return Math.max(1, Math.min(42, Math.floor(daysPregnant / 7)))
    }

    const week = getPregnancyWeek()

    const getWeekInfo = (w) => {
        if (!w) return null
        if (w <= 12) return { trimester: 1, emoji: '🌱', desc: 'Primer trimestre — Desarrollo inicial', exercise: 'Caminar, yoga prenatal suave, natación' }
        if (w <= 27) return { trimester: 2, emoji: '🌸', desc: 'Segundo trimestre — Etapa de energía', exercise: 'Yoga prenatal, pilates adaptado, natación, caminar' }
        return { trimester: 3, emoji: '🌺', desc: 'Tercer trimestre — Preparación', exercise: 'Caminar suave, ejercicios de suelo pélvico, respiración' }
    }

    const info = getWeekInfo(week)

    const handleSave = async () => {
        if (!dueDate) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ due_date: dueDate, updated_at: new Date().toISOString() })
                .eq('id', userId)
            if (error) throw error
            onUpdate?.({ ...profile, due_date: dueDate })
            toast({ title: '✅ Fecha guardada' })
            setShowConfig(false)
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
            <div className="bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-orange-500/5 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/30 flex items-center justify-center">
                            <Baby className="w-6 h-6 text-rose-300" />
                        </div>
                        <div>
                            <p className="text-xs text-white/60 uppercase tracking-wider">Modo embarazo</p>
                            <h3 className="text-lg font-bold text-white">
                                {week ? `Semana ${week}` : 'Configura tu fecha'}
                            </h3>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowConfig(true)}
                        className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl text-xs"
                    >
                        Editar
                    </Button>
                </div>

                {info && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{info.emoji}</span>
                            <div>
                                <p className="text-xs text-white/50">Trimestre {info.trimester}/3</p>
                                <p className="text-sm text-white font-medium">{info.desc}</p>
                            </div>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-rose-400 to-pink-400 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, ((week || 0) / 40) * 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-white/40">{week}/40 semanas</p>
                    </div>
                )}
            </div>

            {info && (
                <CardContent className="p-4 space-y-3">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3">
                        <p className="text-xs font-medium text-green-400 mb-1">✅ Ejercicio recomendado</p>
                        <p className="text-xs text-gray-300">{info.exercise}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                        <p className="text-xs font-medium text-red-400 mb-1">⛔ Evitar</p>
                        <p className="text-xs text-gray-300">Abdominales hiperpresivos, saltos, ejercicios boca abajo, cargas pesadas</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3">
                        <p className="text-xs font-medium text-blue-400 mb-1">💧 Hidratación extra</p>
                        <p className="text-xs text-gray-300">Aumenta 300ml de agua al día. Necesitas ~2.5L diarios.</p>
                    </div>
                    {/* Medical disclaimer - OBLIGATORIO Apple */}
                    <div className="flex items-start gap-2 p-2">
                        <AlertCircle className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            Consulta siempre con tu ginecólogo/a antes de realizar cualquier ejercicio durante el embarazo. Esta información es orientativa y no constituye consejo médico.
                        </p>
                    </div>
                </CardContent>
            )}

            {!info && (
                <CardContent className="p-4">
                    <Button
                        onClick={() => setShowConfig(true)}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl"
                    >
                        <Baby className="w-4 h-4 mr-2" />
                        Introducir fecha probable de parto
                    </Button>
                </CardContent>
            )}

            <Dialog open={showConfig} onOpenChange={() => setShowConfig(false)}>
                <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Baby className="w-5 h-5 text-rose-400" /> Fecha probable de parto
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-gray-300">Fecha probable de parto (FPP)</Label>
                        <Input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="mt-2 bg-gray-800 border-gray-700 text-white rounded-xl"
                        />
                        <p className="text-xs text-gray-500 mt-2">Puedes obtenerla en tu primera ecografía o calculándola desde la última menstruación.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfig(false)} className="rounded-xl border-gray-700 text-gray-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !dueDate} className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// =============================================================
// POSTPARTUM MODE — Modo Postparto
// =============================================================
export function PostpartumMode({ userId, profile, onUpdate }) {
    const [showConfig, setShowConfig] = useState(false)
    const [birthDate, setBirthDate] = useState(profile?.postpartum_date || '')
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const getPostpartumWeeks = () => {
        if (!profile?.postpartum_date) return null
        const birth = new Date(profile.postpartum_date)
        const today = new Date()
        const days = Math.floor((today - birth) / (1000 * 60 * 60 * 24))
        return Math.floor(days / 7)
    }

    const weeks = getPostpartumWeeks()

    const getPhase = (w) => {
        if (w === null) return null
        if (w < 1) return { label: 'Primeros días', color: 'from-violet-500/20 to-pink-500/10', exercises: ['Solo descanso', 'Respiración diafragmática', 'Contracciones suaves del suelo pélvico'], warnings: ['No hacer ningún esfuerzo físico', 'Reposo absoluto 24-48h'] }
        if (w <= 6) return { label: `Semanas 1-6`, color: 'from-rose-500/20 to-orange-500/10', exercises: ['Caminar suave 10-15 min', 'Ejercicios de Kegel', 'Respiración hipopresiva'], warnings: ['Sin abdominales convencionales', 'Sin correr ni saltar', 'Sin cargas pesadas'] }
        if (w <= 12) return { label: `Semanas 6-12`, color: 'from-orange-500/20 to-amber-500/10', exercises: ['Pilates postparto', 'Hipopresivos', 'Caminar 30 min', 'Inicio fuerza suave'], warnings: ['Evitar si hay diástasis sin tratar', 'Consultar fisioterapeuta suelo pélvico'] }
        return { label: `Semanas 12+`, color: 'from-green-500/20 to-teal-500/10', exercises: ['Entrenamiento de fuerza progresivo', 'Cardio moderado', 'Yoga', 'HIIT suave si hay alta'], warnings: ['Atención a posible diástasis de recto'] }
    }

    const phase = getPhase(weeks)

    const handleSave = async () => {
        if (!birthDate) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ postpartum_date: birthDate, updated_at: new Date().toISOString() })
                .eq('id', userId)
            if (error) throw error
            onUpdate?.({ ...profile, postpartum_date: birthDate })
            toast({ title: '✅ Fecha guardada' })
            setShowConfig(false)
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
            <div className={`bg-gradient-to-br ${phase?.color || 'from-violet-500/10 to-pink-500/5'} p-5`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/30 flex items-center justify-center">
                            <Heart className="w-6 h-6 text-violet-300" />
                        </div>
                        <div>
                            <p className="text-xs text-white/60 uppercase tracking-wider">Postparto</p>
                            <h3 className="text-lg font-bold text-white">
                                {weeks !== null ? `Semana ${weeks}` : 'Configura tu fecha'}
                            </h3>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowConfig(true)} className="text-white/50 hover:text-white hover:bg-white/10 rounded-xl text-xs">
                        Editar
                    </Button>
                </div>
                {phase && <p className="text-sm text-white/70">{phase.label}</p>}
            </div>

            {phase && (
                <CardContent className="p-4 space-y-3">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3">
                        <p className="text-xs font-medium text-green-400 mb-2">✅ Ejercicios recomendados</p>
                        {phase.exercises.map((ex, i) => (
                            <p key={i} className="text-xs text-gray-300">• {ex}</p>
                        ))}
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                        <p className="text-xs font-medium text-red-400 mb-2">⚠️ Precauciones</p>
                        {phase.warnings.map((w, i) => (
                            <p key={i} className="text-xs text-gray-300">• {w}</p>
                        ))}
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3">
                        <p className="text-xs font-medium text-blue-400 mb-1">🏥 Recomendación</p>
                        <p className="text-xs text-gray-300">Visita a un fisioterapeuta especialista en suelo pélvico antes de retomar ejercicio intenso.</p>
                    </div>
                    {/* Disclaimer Apple obligatorio */}
                    <div className="flex items-start gap-2 p-2">
                        <AlertCircle className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            Consulta siempre con tu médico o fisioterapeuta antes de retomar actividad física postparto. Esta información es orientativa y no constituye consejo médico.
                        </p>
                    </div>
                </CardContent>
            )}

            {weeks === null && (
                <CardContent className="p-4">
                    <Button onClick={() => setShowConfig(true)} className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-2xl">
                        <Heart className="w-4 h-4 mr-2" /> Introducir fecha del parto
                    </Button>
                </CardContent>
            )}

            <Dialog open={showConfig} onOpenChange={() => setShowConfig(false)}>
                <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Heart className="w-5 h-5 text-violet-400" /> Fecha del parto
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-gray-300">¿Cuándo nació tu bebé?</Label>
                        <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="mt-2 bg-gray-800 border-gray-700 text-white rounded-xl" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfig(false)} className="rounded-xl border-gray-700 text-gray-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !birthDate} className="rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

// =============================================================
// LACTATION TRACKER — Registro de tomas de lactancia
// =============================================================
export function LactationTracker({ userId }) {
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()

    const [form, setForm] = useState({
        session_type: 'breastfeed',
        breast_side: 'left',
        start_time: new Date().toISOString().slice(0, 16),
        duration_minutes: '',
        amount_ml: '',
        notes: ''
    })

    const loadSessions = async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from('lactation_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('start_time', { ascending: false })
                .limit(20)
            if (data) setSessions(data)
        } catch {
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSessions()
    }, [userId])

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from('lactation_sessions').insert([{
                user_id: userId,
                session_type: form.session_type,
                breast_side: form.breast_side || null,
                start_time: new Date(form.start_time).toISOString(),
                duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
                amount_ml: form.amount_ml ? parseInt(form.amount_ml) : null,
                notes: form.notes || null
            }])
            if (error) throw error
            toast({ title: '✅ Toma registrada' })
            setShowAdd(false)
            setForm({ session_type: 'breastfeed', breast_side: 'left', start_time: new Date().toISOString().slice(0, 16), duration_minutes: '', amount_ml: '', notes: '' })
            loadSessions()
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    // Calcular estadísticas de hoy
    const today = new Date().toDateString()
    const todaySessions = sessions.filter(s => new Date(s.start_time).toDateString() === today)
    const todayMinutes = todaySessions.reduce((a, s) => a + (s.duration_minutes || 0), 0)
    const todayMl = todaySessions.reduce((a, s) => a + (s.amount_ml || 0), 0)

    const SESSION_LABELS = { breastfeed: '🤱 Pecho', pump: '🍼 Extracción', bottle: '🍶 Biberón' }
    const SIDE_LABELS = { left: '← Izquierdo', right: 'Derecho →', both: '↔ Ambos' }

    return (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
            <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                        <Milk className="w-4 h-4 text-blue-400" />
                        Registro de lactancia
                    </CardTitle>
                    <Button
                        onClick={() => setShowAdd(true)}
                        size="sm"
                        className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-xl border border-blue-500/30 text-xs"
                    >
                        <Plus className="w-3 h-3 mr-1" /> Registrar
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
                {/* Stats de hoy */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-500/10 border border-blue-500/15 rounded-2xl p-3 text-center">
                        <p className="text-xl font-bold text-white">{todaySessions.length}</p>
                        <p className="text-[10px] text-gray-500">Tomas hoy</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/15 rounded-2xl p-3 text-center">
                        <p className="text-xl font-bold text-white">{todayMinutes}</p>
                        <p className="text-[10px] text-gray-500">Minutos</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/15 rounded-2xl p-3 text-center">
                        <p className="text-xl font-bold text-white">{todayMl || '-'}</p>
                        <p className="text-[10px] text-gray-500">ml extraídos</p>
                    </div>
                </div>

                {/* Lista de sesiones recientes */}
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-4">Aún no hay registros</p>
                ) : (
                    <div className="space-y-2">
                        {sessions.slice(0, 5).map(s => (
                            <div key={s.id} className="flex items-center gap-3 bg-white/3 rounded-2xl p-3">
                                <div className="text-xl">{s.session_type === 'breastfeed' ? '🤱' : s.session_type === 'pump' ? '🍼' : '🍶'}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white">{SESSION_LABELS[s.session_type]}</p>
                                    <p className="text-[10px] text-gray-500">
                                        {new Date(s.start_time).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {s.breast_side && ` · ${SIDE_LABELS[s.breast_side]}`}
                                    </p>
                                </div>
                                {s.duration_minutes && (
                                    <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-lg">{s.duration_minutes}min</span>
                                )}
                                {s.amount_ml && (
                                    <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">{s.amount_ml}ml</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Modal añadir toma */}
            <Dialog open={showAdd} onOpenChange={() => setShowAdd(false)}>
                <DialogContent className="bg-[#1a1a1a] border-gray-800 rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Milk className="w-5 h-5 text-blue-400" /> Nueva toma
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Tipo */}
                        <div>
                            <Label className="text-gray-300 text-xs mb-2 block">Tipo</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'breastfeed', label: '🤱', desc: 'Pecho' },
                                    { value: 'pump', label: '🍼', desc: 'Extracción' },
                                    { value: 'bottle', label: '🍶', desc: 'Biberón' },
                                ].map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setForm(f => ({ ...f, session_type: t.value }))}
                                        className={`p-2 rounded-xl border text-center transition-all ${form.session_type === t.value
                                                ? 'bg-blue-500/20 border-blue-500 text-white'
                                                : 'border-gray-700 text-gray-500'
                                            }`}
                                    >
                                        <div className="text-xl">{t.label}</div>
                                        <div className="text-[10px]">{t.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Lado */}
                        {form.session_type !== 'bottle' && (
                            <div>
                                <Label className="text-gray-300 text-xs mb-2 block">Lado</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['left', 'right', 'both'].map(side => (
                                        <button
                                            key={side}
                                            onClick={() => setForm(f => ({ ...f, breast_side: side }))}
                                            className={`py-1.5 rounded-xl border text-xs transition-all ${form.breast_side === side
                                                    ? 'bg-blue-500/20 border-blue-500 text-white'
                                                    : 'border-gray-700 text-gray-500'
                                                }`}
                                        >
                                            {side === 'left' ? '← Izq' : side === 'right' ? 'Der →' : '↔ Ambos'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Hora */}
                        <div>
                            <Label className="text-gray-300 text-xs mb-1 block">Hora</Label>
                            <Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                        </div>

                        {/* Duración y cantidad en fila */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-gray-300 text-xs mb-1 block">Duración (min)</Label>
                                <Input type="number" placeholder="15" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                            </div>
                            {form.session_type !== 'breastfeed' && (
                                <div>
                                    <Label className="text-gray-300 text-xs mb-1 block">Cantidad (ml)</Label>
                                    <Input type="number" placeholder="80" value={form.amount_ml} onChange={e => setForm(f => ({ ...f, amount_ml: e.target.value }))} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl border-gray-700 text-gray-300">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-blue-500 to-teal-500 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
