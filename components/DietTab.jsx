'use client'

import { useState, useEffect } from 'react'
import { Apple, Flame, Star, Target, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FoodTracker from './FoodTracker'
import { MemberRecipePlan } from './RecipePlan'
import { DietOnboardingBanner } from './DietOnboardingForm'
import { supabase } from '@/lib/supabase'

export function DietTab({ user, diet }) {
    const [pendingOnboarding, setPendingOnboarding] = useState(null)
    const [onboardingChecked, setOnboardingChecked] = useState(false)

    useEffect(() => {
        if (user?.id) checkPendingOnboarding()
    }, [user?.id])

    const checkPendingOnboarding = async () => {
        try {
            const { data } = await supabase
                .from('diet_onboarding_requests')
                .select('id, status')
                .eq('member_id', user.id)
                .eq('status', 'pending')
                .maybeSingle()

            setPendingOnboarding(data || null)
        } catch (e) {
            // Table may not exist yet — silently ignore
        } finally {
            setOnboardingChecked(true)
        }
    }

    return (
        <div className="space-y-4">
            {/* Onboarding banner (if pending) */}
            {onboardingChecked && pendingOnboarding && (
                <DietOnboardingBanner
                    requestId={pendingOnboarding.id}
                    memberId={user.id}
                    onCompleted={() => {
                        setPendingOnboarding(null)
                        window.location.reload()
                    }}
                />
            )}

            {diet ? (
                <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-2xl text-white flex items-center gap-3">
                            <Apple className="w-6 h-6 text-violet-500" />
                            {diet.diet?.name}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: 'Calorías', value: diet.diet?.calories || '-', icon: Flame, color: 'from-orange-500/20 to-orange-500/5' },
                                { label: 'Proteína', value: diet.diet?.protein_g ? `${diet.diet.protein_g}g` : '-', icon: Target, color: 'from-blue-500/20 to-blue-500/5' },
                                { label: 'Carbos', value: diet.diet?.carbs_g ? `${diet.diet.carbs_g}g` : '-', icon: Zap, color: 'from-yellow-500/20 to-yellow-500/5' },
                                { label: 'Grasas', value: diet.diet?.fat_g ? `${diet.diet.fat_g}g` : '-', icon: Star, color: 'from-purple-500/20 to-purple-500/5' },
                            ].map(m => (
                                <div key={m.label} className={`bg-gradient-to-br ${m.color} rounded-2xl p-4 border border-white/5`}>
                                    <m.icon className="w-5 h-5 text-violet-500 mb-2" />
                                    <p className="text-2xl font-black text-white">{m.value}</p>
                                    <p className="text-xs text-gray-500">{m.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="bg-black/30 rounded-2xl p-5 border border-[#2a2a2a]">
                            <p className="text-gray-300 whitespace-pre-wrap">{diet.diet?.content || 'Sin detalles de dieta'}</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                    <CardContent className="py-20 text-center">
                        <Apple className="w-20 h-20 mx-auto text-violet-500/20 mb-4" />
                        <p className="text-gray-500">Tu entrenador aún no te ha asignado una dieta</p>
                    </CardContent>
                </Card>
            )}

            {/* FOOD TRACKER - Contador de macros con fotos */}
            <FoodTracker userId={user.id} />

            {/* Plan de Recetas Semanal */}
            <MemberRecipePlan userId={user.id} />
        </div>
    )
}
