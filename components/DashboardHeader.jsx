'use client'

import { LogOut, Sparkles, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarBubble } from './UserProfile'

export function DashboardHeader({ profile, hasPremium, onLogout, onProfileClick }) {
    return (
        <header className="relative overflow-hidden header-transition" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-transparent to-violet-500/10 transition-opacity duration-700 header-gradient" />
            <div className="absolute top-0 left-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 transition-colors duration-700 header-glow" />

            <div className="relative container mx-auto px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <img
                            src="/logo-nl-vip.jpg"
                            alt="NL VIP Team"
                            className="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-violet-500/20"
                        />
                        <div>
                            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-500 tracking-tight">NL VIP Team</h1>
                            <p className="text-xs text-gray-500">Premium Fitness</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <AvatarBubble
                            profile={profile}
                            size="md"
                            onClick={onProfileClick}
                        />
                        <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10" onClick={onLogout}>
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-end gap-4">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-3xl font-black text-black shadow-xl shadow-violet-500/30 overflow-hidden">
                        {profile.avatar_url ? (
                            <AvatarBubble profile={profile} size="xl" onClick={onProfileClick} />
                        ) : (
                            profile.name?.charAt(0)
                        )}
                    </div>
                    <div className="pb-1">
                        <p className="text-gray-400 text-sm">Bienvenido de vuelta,</p>
                        <h2 className="text-3xl font-black text-white">{profile.name?.split(' ')[0]}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            {hasPremium ? (
                                <>
                                    <Sparkles className="w-4 h-4 text-violet-500" />
                                    <span className="text-sm text-violet-500 font-semibold">Socio VIP</span>
                                </>
                            ) : (
                                <>
                                    <Gift className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-400 font-semibold">Cuenta Básica</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
