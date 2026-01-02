'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, Send, X, Minimize2 } from 'lucide-react'

export default function FloatingChat({ userId, userRole, trainerId, trainerName, members }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (userRole === 'member' && trainerId) {
      loadMessages()
      loadUnreadCount()
    }
    setupSubscription()
  }, [userId, trainerId])

  useEffect(() => {
    if (selectedMember) {
      loadMessagesForMember(selectedMember.id)
    }
  }, [selectedMember])

  const setupSubscription = () => {
    const filter = userRole === 'member' 
      ? `member_id=eq.${userId}` 
      : `trainer_id=eq.${userId}`
    
    const channel = supabase
      .channel('floating_chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter
      }, (payload) => {
        if (userRole === 'member' || (selectedMember && payload.new.member_id === selectedMember.id)) {
          setMessages(prev => [...prev, payload.new])
          scrollToBottom()
        }
        if (!isOpen) {
          setUnreadCount(prev => prev + 1)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const loadUnreadCount = async () => {
    if (userRole === 'member') {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('member_id', userId)
        .eq('is_read', false)
        .neq('sender_id', userId)
      
      setUnreadCount(count || 0)
    }
  }

  const loadMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select(`*, sender:profiles!chat_messages_sender_id_fkey(name, role)`)
      .eq('member_id', userId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setMessages(data)
      scrollToBottom()
      // Mark as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('member_id', userId)
        .neq('sender_id', userId)
      setUnreadCount(0)
    }
  }

  const loadMessagesForMember = async (memberId) => {
    const { data } = await supabase
      .from('chat_messages')
      .select(`*, sender:profiles!chat_messages_sender_id_fkey(name, role)`)
      .eq('trainer_id', userId)
      .eq('member_id', memberId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setMessages(data)
      scrollToBottom()
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    
    const memberId = userRole === 'member' ? userId : selectedMember?.id
    const trainerIdToUse = userRole === 'member' ? trainerId : userId
    
    if (!memberId || !trainerIdToUse) return

    setLoading(true)
    try {
      await supabase.from('chat_messages').insert([{
        sender_id: userId,
        trainer_id: trainerIdToUse,
        member_id: memberId,
        message: newMessage
      }])
      setNewMessage('')
      if (userRole === 'member') {
        loadMessages()
      } else {
        loadMessagesForMember(memberId)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    if (userRole === 'member') {
      loadMessages()
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] rounded-full shadow-2xl shadow-[#C9A24D]/40 flex items-center justify-center hover:scale-110 transition-all duration-300 z-50 group"
        >
          <MessageCircle className="w-7 h-7 text-black" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          )}
          <span className="absolute -top-10 right-0 bg-black/90 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            💬 Chat
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[500px] bg-[#0f0f0f] rounded-3xl shadow-2xl shadow-black/50 border border-[#2a2a2a] flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="font-bold text-black">
                  {userRole === 'member' ? trainerName || 'Tu Entrenador' : selectedMember?.name || 'Selecciona socio'}
                </h3>
                <p className="text-xs text-black/60">
                  {userRole === 'member' ? 'Chat directo' : `${members?.length || 0} socios`}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-8 h-8 rounded-full text-black/60 hover:text-black hover:bg-black/10"
                onClick={() => setIsOpen(false)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-8 h-8 rounded-full text-black/60 hover:text-black hover:bg-black/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Trainer: Member selector */}
          {userRole === 'trainer' && !selectedMember && (
            <div className="flex-1 p-4 overflow-y-auto">
              <p className="text-gray-400 text-sm mb-3">Selecciona un socio para chatear:</p>
              <div className="space-y-2">
                {members?.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className="w-full flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-2xl hover:bg-[#252525] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A24D]/30 to-[#C9A24D]/10 flex items-center justify-center text-[#C9A24D] font-bold">
                      {member.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Area */}
          {(userRole === 'member' || selectedMember) && (
            <>
              {/* Back button for trainer */}
              {userRole === 'trainer' && selectedMember && (
                <button 
                  onClick={() => { setSelectedMember(null); setMessages([]) }}
                  className="px-4 py-2 text-xs text-[#C9A24D] hover:text-[#D4AF37] text-left border-b border-[#2a2a2a]"
                >
                  ← Volver a la lista
                </button>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
                        <MessageCircle className="w-8 h-8 text-[#C9A24D]/30" />
                      </div>
                      <p className="text-gray-500 text-sm">
                        {userRole === 'member' && !trainerId 
                          ? 'No tienes entrenador asignado'
                          : 'Inicia la conversación'}
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === userId
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${isMe 
                          ? 'bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black rounded-2xl rounded-br-md' 
                          : 'bg-[#1a1a1a] text-white rounded-2xl rounded-bl-md border border-[#2a2a2a]'
                        } px-4 py-2.5`}>
                          <p className="text-sm leading-relaxed">{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-black/50' : 'text-gray-500'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSend} className="p-3 border-t border-[#2a2a2a] flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={trainerId || selectedMember ? "Escribe un mensaje..." : "Sin entrenador asignado"}
                  disabled={loading || (!trainerId && userRole === 'member')}
                  className="bg-[#1a1a1a] border-[#2a2a2a] rounded-2xl text-white text-sm placeholder:text-gray-600 focus:border-[#C9A24D]"
                />
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={loading || !newMessage.trim() || (!trainerId && userRole === 'member')}
                  className="w-10 h-10 rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] hover:opacity-90 text-black shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
