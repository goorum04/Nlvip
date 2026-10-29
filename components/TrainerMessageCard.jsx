'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageCircle, Check } from 'lucide-react'

// Último mensaje personal del entrenador (al aprobar una revisión o al "dar un
// toque"). Se muestra hasta que el socio lo marca como leído o pasan 14 días.
export function TrainerMessageCard({ memberId }) {
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    const load = async () => {
      const since = new Date(Date.now() - 14 * 86400000).toISOString()
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, created_at')
        .eq('user_id', memberId)
        .in('type', ['trainer_message', 'trainer_nudge'])
        .is('read_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setMsg(data || null)
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  if (!msg) return null

  const dismiss = async () => {
    setMsg(null)
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', msg.id)
  }

  const when = new Date(msg.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  return (
    <Card className="bg-gradient-to-br from-violet-500/15 to-cyan-500/5 border-violet-500/30 rounded-3xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">{msg.title} · {when}</p>
            <p className="text-white text-sm leading-relaxed mt-1 whitespace-pre-wrap">{msg.body}</p>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button size="sm" variant="ghost" onClick={dismiss} className="h-8 rounded-xl text-violet-200 hover:text-white hover:bg-violet-500/20">
            <Check className="w-4 h-4 mr-1" /> Leído
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default TrainerMessageCard
