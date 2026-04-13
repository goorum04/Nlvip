'use client'

import { Apple, Flame, Star, Target, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import FoodTracker from './FoodTracker'
import { MemberRecipePlan } from './RecipePlan'
import { DietViewer } from './DietBuilder'

export function DietTab({ user, diet }) {
    return (
        <div className="space-y-6">
            {diet ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Tu Nutrición</h2>
                        <div className="bg-green-500/20 px-4 py-1.5 rounded-full border border-green-500/30">
                            <span className="text-green-400 text-xs font-black uppercase tracking-widest">Activa</span>
                        </div>
                    </div>

                    <Card className="bg-[#1a1a1b] border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
                        <CardHeader className="border-b border-white/5 bg-black/20 p-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <Apple className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-black text-white">{diet.diet?.name}</CardTitle>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Plan Nutricional Personalizado</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <DietViewer dietId={diet.diet?.id} />
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card className="bg-white/2 border-white/5 border-dashed rounded-[40px]">
                    <CardContent className="py-24 text-center">
                        <Apple className="w-20 h-20 mx-auto text-white/10 mb-6" />
                        <h3 className="text-lg font-bold text-gray-400">Sin Dieta Asignada</h3>
                        <p className="text-gray-600 max-w-xs mx-auto text-sm mt-2 italic">
                            Tu entrenador personal aún no ha publicado tu plan de nutrición.
                            Te avisaremos cuando esté disponible.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* FOOD TRACKER - Contador de macros con fotos */}
            <FoodTracker userId={user.id} />

            {/* Plan de Recetas Semanal */}
            <MemberRecipePlan userId={user.id} />

            <p className="text-center text-xs text-gray-600 pt-2">
                Las recomendaciones nutricionales tienen carácter orientativo y no sustituyen el consejo de un profesional de la salud o nutrición.
            </p>
        </div>
    )
}
