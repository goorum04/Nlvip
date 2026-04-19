'use client'

import { Bell, CircleCheckBig as CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NoticesTab({ notices, onMarkAsRead }) {
    if (notices.length === 0) {
        return (
            <div className="py-20 text-center">
                <Bell className="w-20 h-20 mx-auto text-violet-500/20 mb-4" />
                <p className="text-gray-500">No tienes avisos pendientes</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {notices.map((notice) => {
                const isRead = notice.notice_reads && notice.notice_reads.length > 0
                const priorityColors = {
                    high: 'border-red-500/50 bg-red-500/5',
                    normal: 'border-blue-500/30 bg-blue-500/5',
                    low: 'border-gray-500/30 bg-gray-500/5'
                }

                return (
                    <Card key={notice.id} className={`border-[#2a2a2a] rounded-3xl overflow-hidden ${isRead ? 'opacity-60' : priorityColors[notice.priority || 'normal']}`}>
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-white">{notice.title}</h3>
                                        {!isRead && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                                    </div>
                                    <p className="text-sm text-gray-300 mb-3">{notice.content}</p>
                                    <p className="text-[10px] text-gray-500">{new Date(notice.created_at).toLocaleDateString()}</p>
                                </div>
                                {!isRead && (
                                    <Button variant="ghost" size="sm" onClick={() => onMarkAsRead(notice.id)} className="rounded-xl text-violet-500 hover:bg-violet-500/10">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
