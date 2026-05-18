'use client'

import { useMemo, useRef } from 'react'
import AdminAssistant from './AdminAssistant'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Dumbbell, Apple, FileCheck, ChevronRight, AlertTriangle, Sparkles } from 'lucide-react'

// --- Sub-components ---

function StatChip({ icon, value, label, colorClass, urgent, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 p-3 rounded-2xl border bg-gradient-to-br ${colorClass} hover:brightness-125 transition-all active:scale-95 text-left w-full`}
    >
      {urgent && value > 0 && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-current animate-pulse opacity-80" />
      )}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/30 flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-black text-white leading-none">{value}</div>
        <div className="text-[10px] uppercase font-bold tracking-wider mt-0.5 opacity-60">{label}</div>
      </div>
    </button>
  )
}

function MemberAttentionCard({ member, onAssign, onGeneratePlan }) {
  const displayName = member.name || member.email?.split('@')[0] || 'Socio'
  const initial = displayName.charAt(0).toUpperCase()
  const req = member.dietRequest
  const hasSubmitted = req?.status === 'submitted'
  const hasCompleted = req?.status === 'completed' || req?.status === 'reviewed'

  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-violet-500/20 transition-all">
      <div className="w-10 h-10 rounded-xl flex-shrink-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-black font-black text-sm">
        {initial}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {member.missingWorkout && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase">
              Sin rutina
            </span>
          )}
          {member.missingDiet && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold uppercase">
              Sin dieta
            </span>
          )}
          {hasSubmitted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold uppercase">
              📋 Formulario listo
            </span>
          )}
          {hasCompleted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
              ✅ Plan generado
            </span>
          )}
        </div>
      </div>

      {hasSubmitted ? (
        <Button
          size="sm"
          onClick={onGeneratePlan}
          className="h-8 px-3 rounded-xl text-xs font-bold flex-shrink-0 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-lg shadow-violet-500/20 gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Generar IA
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onAssign}
          className="h-8 px-3 rounded-xl text-xs font-bold flex-shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 gap-1"
        >
          Asignar
          <ChevronRight className="w-3 h-3" />
        </Button>
      )}
    </div>
  )
}

function EmptyAttentionState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
        ✓
      </div>
      <p className="text-sm font-semibold text-emerald-400">Todo al día</p>
      <p className="text-xs text-gray-600 max-w-[180px]">
        Todos los socios tienen rutina y dieta asignadas
      </p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-10 h-10 rounded-xl bg-white/5" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-28 rounded bg-white/5" />
        <Skeleton className="h-2 w-16 rounded bg-white/5" />
      </div>
      <Skeleton className="h-8 w-16 rounded-xl bg-white/5" />
    </div>
  )
}

// Builds a natural-language prompt from the member's questionnaire responses
function buildPlanPrompt(memberName, responses) {
  if (!responses) return `Genera y aplica un plan completo (dieta + rutina) para ${memberName}.`

  const goalMap = {
    perder_grasa: 'perder grasa',
    mantenimiento: 'mantenerse en su peso actual',
    ganar_masa: 'ganar músculo',
  }
  const goal = goalMap[responses?.objetivo] || 'mejorar su condición física'
  const weight = responses?.['Medida - Peso'] || '?'
  const height = responses?.['Medida - Altura'] || '?'
  const workIntensity = responses?.['Trabajo - Intensidad'] || '?'
  const diet = responses?.preferencias || 'omnívoro'
  const restrictions = responses?.restricciones || 'ninguna'
  const trainTime = responses?.['Entreno - Momento'] || '?'
  const medCondition = responses?.extras?.condicion_medica || responses?.condicion_medica || 'ninguna'

  return `Genera y aplica un plan completo (dieta + rutina) para ${memberName}.
Datos de su cuestionario nutricional:
- Objetivo: ${goal}
- Peso: ${weight} kg, Altura: ${height} cm
- Intensidad laboral: ${workIntensity}
- Preferencia dietética: ${diet}
- Restricciones/alergias: ${restrictions}
- Momento de entreno: ${trainTime}
- Condición médica: ${medCondition}
Aplica el plan completo directamente.`
}

// --- Main component ---

export default function AdminCommandCenter({
  userId, voiceTrigger,
  members, allAssignments,
  workoutTemplates, dietTemplates, trainers,
  pendingDietSubmissions,
  membersWithoutWorkout, membersWithoutDiet,
  dietRequests,
  onNavigate, onSelectMember,
}) {
  const aiSendRef = useRef(null)

  // Map member_id → dietRequest for O(1) lookup
  const dietRequestByMember = useMemo(() => {
    const map = new Map()
    for (const req of (dietRequests || [])) {
      if (!map.has(req.member_id)) map.set(req.member_id, req)
    }
    return map
  }, [dietRequests])

  // Merge members missing workout and/or diet, attach questionnaire state
  const attentionMembers = useMemo(() => {
    const map = new Map()
    for (const m of (membersWithoutWorkout || []))
      map.set(m.id, { ...m, missingWorkout: true, missingDiet: false })
    for (const m of (membersWithoutDiet || [])) {
      if (map.has(m.id)) map.get(m.id).missingDiet = true
      else map.set(m.id, { ...m, missingWorkout: false, missingDiet: true })
    }
    return Array.from(map.values())
      .map(m => ({ ...m, dietRequest: dietRequestByMember.get(m.id) || null }))
      .sort((a, b) => {
        const score = x =>
          (x.dietRequest?.status === 'submitted' ? 4 : 0) +
          (x.missingWorkout ? 2 : 0) +
          (x.missingDiet ? 1 : 0)
        return score(b) - score(a)
      })
  }, [membersWithoutWorkout, membersWithoutDiet, dietRequestByMember])

  const isLoading = members.length === 0

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 240px)' }}>

      {/* ============ LEFT / TOP: AI ASSISTANT ============ */}
      <div className="lg:w-[55%] flex flex-col rounded-3xl overflow-hidden border border-violet-500/20 bg-[#0f0f0f] min-h-[440px] lg:min-h-0">
        <AdminAssistant
          userId={userId}
          voiceTrigger={voiceTrigger}
          onInputReady={(_setInput, sendFn) => { aiSendRef.current = sendFn }}
        />
      </div>

      {/* ============ RIGHT / BELOW: STATS + ATTENTION ============ */}
      <div className="lg:w-[45%] flex flex-col gap-3 lg:overflow-y-auto">

        {/* Stat chips — 2×2 grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatChip
            icon={<Users className="w-4 h-4 text-violet-400" />}
            value={members.length}
            label="Socios"
            colorClass="from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-400"
            urgent={false}
            onClick={() => onNavigate('members')}
          />
          <StatChip
            icon={<Dumbbell className="w-4 h-4 text-amber-400" />}
            value={membersWithoutWorkout.length}
            label="Sin Rutina"
            colorClass={membersWithoutWorkout.length > 0
              ? 'from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-400'
              : 'from-white/5 to-transparent border-white/10 text-gray-500'}
            urgent={membersWithoutWorkout.length > 0}
            onClick={() => onNavigate('assignments')}
          />
          <StatChip
            icon={<Apple className="w-4 h-4 text-orange-400" />}
            value={membersWithoutDiet.length}
            label="Sin Dieta"
            colorClass={membersWithoutDiet.length > 0
              ? 'from-orange-500/20 to-orange-500/5 border-orange-500/40 text-orange-400'
              : 'from-white/5 to-transparent border-white/10 text-gray-500'}
            urgent={membersWithoutDiet.length > 0}
            onClick={() => onNavigate('assignments')}
          />
          <StatChip
            icon={<FileCheck className="w-4 h-4 text-red-400" />}
            value={pendingDietSubmissions}
            label="Formularios"
            colorClass={pendingDietSubmissions > 0
              ? 'from-red-500/20 to-red-500/5 border-red-500/40 text-red-400'
              : 'from-white/5 to-transparent border-white/10 text-gray-500'}
            urgent={pendingDietSubmissions > 0}
            onClick={() => onNavigate('diets')}
          />
        </div>

        {/* Attention list */}
        <div className="flex-1 flex flex-col rounded-3xl border border-white/5 bg-gradient-to-b from-[#131313] to-[#0f0f0f] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Necesita Atención
              </span>
            </div>
            {attentionMembers.length > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {attentionMembers.length}
              </span>
            )}
          </div>

          <ScrollArea className="flex-1 max-h-[420px] lg:max-h-none">
            <div className="p-3 space-y-2">
              {isLoading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}

              {!isLoading && attentionMembers.length === 0 && <EmptyAttentionState />}

              {attentionMembers.map(member => (
                <MemberAttentionCard
                  key={member.id}
                  member={member}
                  onAssign={() => onSelectMember(member)}
                  onGeneratePlan={() => {
                    const prompt = buildPlanPrompt(
                      member.name || member.email?.split('@')[0] || 'el socio',
                      member.dietRequest?.responses
                    )
                    aiSendRef.current?.(prompt)
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

      </div>
    </div>
  )
}
