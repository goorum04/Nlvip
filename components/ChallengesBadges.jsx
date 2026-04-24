'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Trophy, Target, Flame, Crown, Medal, Dumbbell, Footprints, 
  Star, CircleCheckBig as CheckCircle2, Clock, Users, Zap, Lock, Sparkles
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Mapeo de iconos
const iconMap = {
  trophy: Trophy,
  target: Target,
  flame: Flame,
  crown: Crown,
  medal: Medal,
  dumbbell: Dumbbell,
  footprints: Footprints,
  star: Star,
}

// Colores de badges
const colorMap = {
  bronze: 'from-amber-600 to-orange-500',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-violet-500 to-cyan-500',
  platinum: 'from-violet-500 to-purple-400',
  green: 'from-emerald-500 to-green-400',
  orange: 'from-orange-500 to-red-400',
}

// Componente de Badge individual
export function BadgeCard({ badge, unlocked = false, awardedAt = null }) {
  const Icon = iconMap[badge.icon] || Trophy
  const gradientClass = colorMap[badge.color] || colorMap.gold
  
  return (
    <div className={`relative group ${!unlocked ? 'opacity-50 grayscale' : ''}`}>
      <div className={`
        w-20 h-20 rounded-2xl 
        bg-gradient-to-br ${unlocked ? gradientClass : 'from-gray-600 to-gray-700'}
        flex items-center justify-center
        shadow-lg ${unlocked ? `shadow-${badge.color === 'gold' ? '[rgb(139, 92, 246)]' : badge.color}-500/30` : ''}
        transition-all duration-300
        ${unlocked ? 'hover:scale-110 hover:shadow-xl' : ''}
      `}>
        {unlocked ? (
          <Icon className="w-10 h-10 text-black" />
        ) : (
          <Lock className="w-8 h-8 text-gray-500" />
        )}
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 rounded-xl border border-[#2a2a2a] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        <p className="text-white font-bold text-sm">{badge.title}</p>
        <p className="text-gray-400 text-xs">{badge.description}</p>
        {unlocked && awardedAt && (
          <p className="text-violet-400 text-xs mt-1">
            Desbloqueado: {new Date(awardedAt).toLocaleDateString('es-ES')}
          </p>
        )}
      </div>
      
      {/* Badge nombre */}
      <p className="text-center text-xs text-gray-400 mt-2 truncate w-20">{badge.title}</p>
    </div>
  )
}

// Componente de galería de badges
export function BadgesGallery({ userId }) {
  const [allBadges, setAllBadges] = useState([])
  const [userBadges, setUserBadges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBadges()
  }, [userId])

  const loadBadges = async () => {
    try {
      // Cargar todos los badges
      const { data: badges } = await supabase.from('badges').select('*').order('condition_value')
      
      // Cargar badges del usuario
      const { data: earned } = await supabase
        .from('user_badges')
        .select('badge_id, awarded_at')
        .eq('member_id', userId)
      
      setAllBadges(badges || [])
      setUserBadges(earned || [])
    } catch (error) {
      console.error('Error loading badges:', error)
    } finally {
      setLoading(false)
    }
  }

  const isUnlocked = (badgeId) => userBadges.some(ub => ub.badge_id === badgeId)
  const getAwardedAt = (badgeId) => userBadges.find(ub => ub.badge_id === badgeId)?.awarded_at

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardContent className="p-6 text-center">
          <div className="animate-pulse flex gap-4 justify-center">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-20 h-20 bg-[#2a2a2a] rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const unlockedCount = userBadges.length
  const totalCount = allBadges.length

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-400" />
            Mis Logros
          </CardTitle>
          <span className="text-violet-400 font-bold">{unlockedCount}/{totalCount}</span>
        </div>
        <CardDescription className="text-gray-500">
          Desbloquea badges completando entrenamientos y retos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 justify-center">
          {allBadges.map(badge => (
            <BadgeCard 
              key={badge.id}
              badge={badge}
              unlocked={isUnlocked(badge.id)}
              awardedAt={getAwardedAt(badge.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Tipos de reto: config visual
const challengeTypeConfig = {
  workouts: { icon: Dumbbell, label: 'Entrenamientos', unit: 'entrenos', gradient: 'from-violet-600 to-purple-500', glow: 'shadow-violet-500/30' },
  weight:   { icon: Target,    label: 'Pérdida de peso', unit: 'kg',       gradient: 'from-cyan-500 to-blue-500',   glow: 'shadow-cyan-500/30'   },
  consistency: { icon: Flame,  label: 'Constancia',      unit: 'días',     gradient: 'from-orange-500 to-red-500', glow: 'shadow-orange-500/30' },
}

// Tarjeta grande para reto ACEPTADO (en curso o completado)
function ActiveChallengeCard({ challenge, participation }) {
  const progress = participation?.progress_value || 0
  const isCompleted = participation?.completed || false
  const percentage = Math.min((progress / challenge.target_value) * 100, 100)
  const cfg = challengeTypeConfig[challenge.type] || challengeTypeConfig.workouts
  const TypeIcon = cfg.icon
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24)))

  return (
    <div className={`relative overflow-hidden rounded-3xl border ${
      isCompleted
        ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 to-[#141414]'
        : 'border-violet-500/20 bg-gradient-to-br from-[#1c1524] to-[#121212]'
    } p-5 shadow-xl ${isCompleted ? 'shadow-emerald-500/10' : cfg.glow}`}>

      {/* Glow blob de fondo */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${cfg.gradient}`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${isCompleted ? 'from-emerald-500 to-green-400' : cfg.gradient} flex items-center justify-center shadow-lg`}>
            {isCompleted ? <CheckCircle2 className="w-6 h-6 text-white" /> : <TypeIcon className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h3 className="font-black text-white text-base leading-tight">{challenge.title}</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {daysLeft > 0 ? `${daysLeft} días restantes` : 'Finalizado'}
            </p>
          </div>
        </div>
        {isCompleted ? (
          <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">✓ Completado</span>
        ) : (
          <span className="text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Flame className="w-3 h-3" /> En curso
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2 relative">
        <div className="flex justify-between items-end">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Progreso</span>
          <span className={`text-2xl font-black ${isCompleted ? 'text-emerald-400' : 'text-white'}`}>
            {Math.round(percentage)}<span className="text-sm font-medium text-gray-500">%</span>
          </span>
        </div>
        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r ${isCompleted ? 'from-emerald-500 to-green-400' : cfg.gradient}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>{progress} {cfg.unit}</span>
          <span>Meta: {challenge.target_value} {cfg.unit}</span>
        </div>
      </div>
    </div>
  )
}

// Tarjeta compacta para reto DISPONIBLE (no aceptado)
function AvailableChallengeCard({ challenge, onJoin }) {
  const cfg = challengeTypeConfig[challenge.type] || challengeTypeConfig.workouts
  const TypeIcon = cfg.icon
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#1a1a1a] to-[#111] p-4 transition-all duration-300 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5 group">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0`}>
          <TypeIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-white text-sm leading-tight truncate">{challenge.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Meta: <span className="text-gray-400">{challenge.target_value} {cfg.unit}</span>
            <span className="mx-1.5">·</span>
            <Clock className="w-3 h-3 inline -mt-0.5" /> {daysLeft}d
          </p>
        </div>
        <Button
          onClick={() => onJoin(challenge.id)}
          size="sm"
          className={`flex-shrink-0 bg-gradient-to-r ${cfg.gradient} text-white font-bold rounded-xl text-xs px-3 py-1.5 h-auto hover:opacity-90 hover:scale-105 transition-all shadow-lg`}
        >
          <Zap className="w-3 h-3 mr-1" /> Unirme
        </Button>
      </div>
      <p className="text-xs text-gray-600 mt-2.5 leading-relaxed line-clamp-2">{challenge.description}</p>
    </div>
  )
}

// Componente principal de Retos
export function ChallengesSection({ userId }) {
  const [challenges, setChallenges] = useState([])
  const [participations, setParticipations] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => { loadChallenges() }, [userId])

  const loadChallenges = async () => {
    try {
      const { data: activeChall } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })

      const { data: parts } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('member_id', userId)

      setChallenges(activeChall || [])
      setParticipations(parts || [])
    } catch (error) {
      console.error('Error loading challenges:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinChallenge = async (challengeId) => {
    try {
      const { error } = await supabase.from('challenge_participants').insert([{
        challenge_id: challengeId,
        member_id: userId,
        progress_value: 0
      }])
      if (error) throw error
      toast({ title: '¡Reto aceptado! 🔥', description: '¡A por todas, tú puedes!' })
      loadChallenges()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const getParticipation = (id) => participations.find(p => p.challenge_id === id)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-[#1a1a1a] rounded-3xl animate-pulse border border-[#2a2a2a]" />
        ))}
      </div>
    )
  }

  const joinedChallenges = challenges.filter(c => !!getParticipation(c.id))
  const availableChallenges = challenges.filter(c => !getParticipation(c.id))
  const completedCount = participations.filter(p => p.completed).length

  return (
    <div className="space-y-6">

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Target,       value: challenges.length,        label: 'Activos',    color: 'text-violet-400' },
          { icon: Flame,        value: joinedChallenges.length,  label: 'En curso',   color: 'text-orange-400' },
          { icon: CheckCircle2, value: completedCount,           label: 'Superados',  color: 'text-emerald-400' },
        ].map(({ icon: Icon, value, label, color }) => (
          <div key={label} className="rounded-2xl bg-white/[0.03] border border-white/5 p-3 text-center">
            <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
            <p className="text-xl font-black text-white">{value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Mis retos en curso */}
      {joinedChallenges.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-orange-500 to-red-500" />
            <h3 className="text-white font-black text-sm uppercase tracking-widest">Mis Retos</h3>
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 font-bold">{joinedChallenges.length}</span>
          </div>
          <div className="space-y-3">
            {joinedChallenges.map(c => (
              <ActiveChallengeCard key={c.id} challenge={c} participation={getParticipation(c.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Retos disponibles */}
      {availableChallenges.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-violet-500 to-cyan-500" />
            <h3 className="text-white font-black text-sm uppercase tracking-widest">Disponibles</h3>
            <span className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-full px-2 py-0.5 font-bold">{availableChallenges.length}</span>
          </div>
          <div className="space-y-2">
            {availableChallenges.map(c => (
              <AvailableChallengeCard key={c.id} challenge={c} onJoin={joinChallenge} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {challenges.length === 0 && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-violet-500/50" />
          </div>
          <h3 className="text-white font-bold text-lg mb-1">No hay retos activos</h3>
          <p className="text-gray-600 text-sm">El equipo pronto creará nuevos desafíos. ¡Mantente listo!</p>
        </div>
      )}
    </div>
  )
}

