'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Shield, AlertCircle } from 'lucide-react'
import { FeedSection } from './FeedSection'

export function AdminFeedTab({ user }) {
    return (
        <div className="space-y-6">
            <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-violet-600/10 to-cyan-500/10 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-white flex items-center gap-2 text-2xl font-black italic">
                                <MessageSquare className="w-6 h-6 text-violet-400" />
                                FEED GLOBAL
                            </CardTitle>
                            <CardDescription className="text-gray-400">
                                Moderación y publicaciones oficiales del club.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl border border-white/10">
                            <Shield className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Modo Administrador</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                        <p className="text-xs text-amber-200/80 leading-relaxed">
                            Como administrador, puedes eliminar cualquier publicación o comentario.
                            Las publicaciones realizadas desde aquí aparecerán como oficiales del club.
                        </p>
                    </div>

                    <FeedSection userId={user.id} userRole="admin" canModerate={true} />
                </CardContent>
            </Card>
        </div>
    )
}
