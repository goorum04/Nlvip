'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Trophy, Target, Flame, Crown, Medal, Dumbbell, Footprints, 
  Star, CheckCircle2, Clock, Users, Zap, Lock, Sparkles
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
  bronze: 'from-amber-700 to-amber-600',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-[#C9A24D] to-[#D4AF37]',
  platinum: 'from-cyan-400 to-blue-400',
  green: 'from-green-500 to-emerald-400',
  orange: 'from-orange-500 to-amber-400',
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
        shadow-lg ${unlocked ? `shadow-${badge.color === 'gold' ? '[#C9A24D]' : badge.color}-500/30` : ''}
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
          <p className="text-[#C9A24D] text-xs mt-1">
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
            <Trophy className="w-5 h-5 text-[#C9A24D]" />
            Mis Logros
          </CardTitle>
          <span className="text-[#C9A24D] font-bold">{unlockedCount}/{totalCount}</span>
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

// Componente de Reto individual
export function ChallengeCard({ challenge, participation, onJoin, onUpdateProgress }) {
  const isJoined = !!participation
  const progress = participation?.progress_value || 0
  const isCompleted = participation?.completed || false
  const percentage = Math.min((progress / challenge.target_value) * 100, 100)
  
  const typeIcons = {
    workouts: Dumbbell,
    weight: Target,
    consistency: Flame
  }
  const TypeIcon = typeIcons[challenge.type] || Target

  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24)))

  return (
    <Card className={`
      bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl
      ${isCompleted ? 'border-green-500/50 shadow-lg shadow-green-500/10' : ''}
      transition-all hover:border-[#C9A24D]/30
    `}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`
              w-12 h-12 rounded-2xl flex items-center justify-center
              ${isCompleted 
                ? 'bg-gradient-to-br from-green-500 to-emerald-400' 
                : 'bg-gradient-to-br from-[#C9A24D]/20 to-[#D4AF37]/10 border border-[#C9A24D]/20'
              }
            `}>
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <TypeIcon className={`w-6 h-6 ${isJoined ? 'text-[#C9A24D]' : 'text-gray-500'}`} />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white">{challenge.title}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysLeft > 0 ? `${daysLeft} días restantes` : 'Finalizado'}
              </p>
            </div>
          </div>
          
          {isCompleted && (
            <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded-lg text-xs font-bold">
              ✓ Completado
            </div>
          )}
        </div>

        <p className="text-gray-400 text-sm mb-4">{challenge.description}</p>

        {isJoined ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Progreso</span>
              <span className="text-[#C9A24D] font-bold">
                {progress} / {challenge.target_value}
                {challenge.type === 'weight' ? ' kg' : challenge.type === 'consistency' ? ' días' : ' entrenos'}
              </span>
            </div>
            <div className="relative h-3 bg-black/50 rounded-full overflow-hidden">
              <div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                  isCompleted 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                    : 'bg-gradient-to-r from-[#C9A24D] to-[#D4AF37]'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-center text-xs text-gray-500">{Math.round(percentage)}% completado</p>
          </div>
        ) : (
          <Button 
            onClick={() => onJoin(challenge.id)}
            className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-xl hover:opacity-90"
          >
            <Zap className="w-4 h-4 mr-2" />
            Unirme al Reto
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Componente principal de Retos
export function ChallengesSection({ userId }) {
  const [challenges, setChallenges] = useState([])
  const [participations, setParticipations] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadChallenges()
  }, [userId])

  const loadChallenges = async () => {
    try {
      // Cargar retos activos
      const { data: activeChall } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })

      // Cargar participaciones del usuario
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

      toast({ title: '¡Te has unido al reto! 💪', description: 'A por todas, ¡tú puedes!' })
      loadChallenges()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const getParticipation = (challengeId) => 
    participations.find(p => p.challenge_id === challengeId)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2].map(i => (
          <Card key={i} className="bg-[#1a1a1a] border-[#2a2a2a] rounded-3xl animate-pulse">
            <CardContent className="p-5 h-40" />
          </Card>
        ))}
      </div>
    )
  }

  const activeParticipations = participations.filter(p => !p.completed)
  const completedParticipations = participations.filter(p => p.completed)

  return (
    <div className="space-y-6">
      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-2xl p-4 border border-[#2a2a2a] text-center">
          <Target className="w-6 h-6 text-[#C9A24D] mx-auto mb-1" />
          <p className="text-2xl font-black text-white">{challenges.length}</p>
          <p className="text-xs text-gray-500">Disponibles</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-2xl p-4 border border-[#2a2a2a] text-center">
          <Flame className="w-6 h-6 text-orange-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-white">{activeParticipations.length}</p>
          <p className="text-xs text-gray-500">En curso</p>
        </div>
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] rounded-2xl p-4 border border-[#2a2a2a] text-center">
          <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-white">{completedParticipations.length}</p>
          <p className="text-xs text-gray-500">Completados</p>
        </div>
      </div>

      {/* Lista de retos */}
      {challenges.length > 0 ? (
        <div className="space-y-4">
          {challenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              participation={getParticipation(challenge.id)}
              onJoin={joinChallenge}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
          <CardContent className="p-8 text-center">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">No hay retos activos</h3>
            <p className="text-gray-500">Los entrenadores crearán nuevos retos pronto. ¡Mantente atento!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Exportar todo
export default { BadgesGallery, ChallengesSection, ChallengeCard, BadgeCard }
