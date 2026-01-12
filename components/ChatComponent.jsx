'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ChatComponent({ userId, userRole, trainerId }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const { toast } = useToast()

  useEffect(() => {
    loadMessages()
    
    // Subscribe to new messages
    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: userRole === 'member' ? `member_id=eq.${userId}` : `trainer_id=eq.${userId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        scrollToBottom()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, userRole, trainerId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        sender:profiles!chat_messages_sender_id_fkey(name, role)
      `)
      .order('created_at', { ascending: true })

    if (userRole === 'member') {
      query = query.eq('member_id', userId)
    } else {
      query = query.eq('trainer_id', userId)
    }

    const { data, error } = await query

    if (data) {
      setMessages(data)
      setTimeout(scrollToBottom, 100)
      
      // Mark as read
      if (userRole === 'member') {
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .eq('member_id', userId)
          .eq('is_read', false)
          .neq('sender_id', userId)
      }
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setLoading(true)

    try {
      const messageData = {
        sender_id: userId,
        message: newMessage,
        trainer_id: userRole === 'member' ? trainerId : userId,
        member_id: userRole === 'member' ? userId : null // Will be set by trainer when selecting conversation
      }

      const { error } = await supabase
        .from('chat_messages')
        .insert([messageData])

      if (error) throw error

      setNewMessage('')
      loadMessages()

    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-[#1a1a1a] border-[#00D4FF]/20 flex flex-col h-[600px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-[#00D4FF] flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Chat con tu Entrenador
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
          {messages.map((msg) => {
            const isMe = msg.sender_id === userId
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${isMe ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl px-4 py-2 ${
                    isMe 
                      ? 'bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black' 
                      : 'bg-black/50 text-white border border-[#00D4FF]/10'
                  }`}>
                    <p className="text-sm break-words">{msg.message}</p>
                  </div>
                  <p className={`text-xs text-gray-500 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="bg-black border-[#00D4FF]/20 text-white rounded-xl"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] hover:from-[#00B4E6] hover:to-[#00D4FF] text-black rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
