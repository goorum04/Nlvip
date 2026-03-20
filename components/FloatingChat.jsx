'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  MessageCircle, Send, X, Minimize2, Mic, MicOff, 
  Trash2, Play, Pause, Shield, User, ChevronLeft,
  Bot, Volume2, Image as ImageIcon, Loader2
} from 'lucide-react'

// El administrador se busca dinámicamente en initializeMemberConversations

// Componente AudioPlayer (Fuera del principal para evitar re-renders innecesarios)
const AudioPlayer = ({ path }) => {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/chat_audios/${path}`

  if (!path) return null

  return (
    <div className="flex items-center gap-3 bg-black/20 rounded-xl p-2 min-w-[200px]">
      <button 
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (playing) audioRef.current.pause()
          else audioRef.current.play()
          setPlaying(!playing)
        }}
        className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-black"
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full bg-violet-500 ${playing ? 'animate-progress' : ''}`} style={{ width: playing ? '100%' : '0%', transition: playing ? 'width 30s linear' : 'none' }}></div>
      </div>
      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => setPlaying(false)} 
        className="hidden" 
      />
    </div>
  )
}

export default function FloatingChat({ userId, userRole, trainerId, trainerName, members }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeConversation, setActiveConversation] = useState(null)
  const [conversations, setConversations] = useState({ trainer: null, admin: null })
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, byMember: {}, byUser: {} })
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState(userRole === 'admin' ? 'list' : 'chat')
  const [activeTab, setActiveTab] = useState('trainer')
  
  // Voice Recording States (Only for Admin)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  
  // Image Upload States
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const mediaRecorderRef = useRef(null)
  const fileInputRef = useRef(null)
  const timerRef = useRef(null)

  // Speech Recognition States (For all)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen && userRole === 'member') {
      initializeMemberConversations()
    } else if (isOpen && (userRole === 'trainer' || userRole === 'admin')) {
      // Logic for trainer/admin to see their list of chats will be handled when they select a member
    }
  }, [isOpen, userId, trainerId])

  useEffect(() => {
    let cleanupFunc = null;

    if (activeConversation) {
      loadMessages(activeConversation.id)
      cleanupFunc = setupSubscription(activeConversation.id)
      if (isOpen) markAsRead(activeConversation.id)
    }

    return () => {
      if (cleanupFunc) cleanupFunc();
    }
  }, [activeConversation, isOpen])

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'es-ES'

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setNewMessage(prev => prev + (prev ? ' ' : '') + transcript)
        setIsListening(false)
      }

      recognition.onend = () => setIsListening(false)
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
    
    // Initial fetch of unread counts
    fetchUnreadCounts()
    
    // Global subscription for new messages (unread count)
    const channel = supabase
      .channel('chat_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        if (payload.new.sender_id !== userId) {
          fetchUnreadCounts()
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        fetchUnreadCounts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const fetchUnreadCounts = async () => {
    try {
      // 1. Obtener mis participaciones
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)

      if (!myParticipations || myParticipations.length === 0) return
      const myConvIds = myParticipations.map(p => p.conversation_id)

      // 2. Obtener quién más está en esas conversaciones para mapear a usuarios
      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', myConvIds)
        .neq('user_id', userId)

      const convToUserMap = {}
      otherParticipants?.forEach(p => {
        convToUserMap[p.conversation_id] = p.user_id
      })

      // 3. Contar mensajes no leídos
      const { data: unreadMsgs, error } = await supabase
        .from('messages')
        .select('conversation_id, sender_id')
        .in('conversation_id', myConvIds)
        .eq('is_read', false)
        .neq('sender_id', userId)

      if (error) throw error

      const counts = { total: unreadMsgs.length, byMember: {}, byUser: {} }
      unreadMsgs.forEach(msg => {
        counts.byMember[msg.conversation_id] = (counts.byMember[msg.conversation_id] || 0) + 1
        const otherUserId = convToUserMap[msg.conversation_id]
        if (otherUserId) {
          counts.byUser[otherUserId] = (counts.byUser[otherUserId] || 0) + 1
        }
      })

      setUnreadCounts(counts)
    } catch (err) {
      console.error('Error fetching unread counts:', err)
    }
  }

  const markAsRead = async (convId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', convId)
        .eq('is_read', false)
        .neq('sender_id', userId)
      
      if (error) throw error
      fetchUnreadCounts()
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  // Listen for external open-chat events
  useEffect(() => {
    const handleOpenChat = async (e) => {
      const { memberId, name } = e.detail
      if (!isOpen) setIsOpen(true)
      
      setLoading(true)
      const conv = await getOrCreateConversation('admin_member', [userId, memberId])
      if (conv) {
        setActiveConversation({ ...conv, display_name: name })
        setView('chat')
      }
      setLoading(false)
    }

    window.addEventListener('open-chat', handleOpenChat)
    return () => window.removeEventListener('open-chat', handleOpenChat)
  }, [userId])

  const initializeMemberConversations = async () => {
    // 1. Get or Create Trainer Conversation
    let trainerConv = null
    if (trainerId) {
      trainerConv = await getOrCreateConversation('trainer_member', [userId, trainerId])
    }

    // 2. Get or Create Admin Conversation
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    const targetAdminId = adminUser?.id || '64145053-45fd-473c-b2c4-7523d181aad3'
    const adminConv = await getOrCreateConversation('admin_member', [userId, targetAdminId])

    setConversations({ trainer: trainerConv, admin: adminConv })
    
    // Default to trainer if available, else admin
    if (activeTab === 'trainer' && trainerConv) {
      setActiveConversation(trainerConv)
    } else if (activeTab === 'admin' && adminConv) {
      setActiveConversation(adminConv)
    } else if (adminConv) {
      setActiveTab('admin')
      setActiveConversation(adminConv)
    }
  }

  const getOrCreateConversation = async (type, participants) => {
    const validParticipants = participants.filter(id => id && id.length > 30)
    if (validParticipants.length < 2) {
      console.warn('Participantes inválidos:', participants)
      return null
    }

    try {
      // Find intersection manually for maximum reliability
      const { data: myParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', validParticipants[0])
        
      const { data: theirParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', validParticipants[1])

      const myConvIds = (myParts || []).map(p => p.conversation_id)
      const theirConvIds = (theirParts || []).map(p => p.conversation_id)
      const commonConvId = myConvIds.find(id => theirConvIds.includes(id))

      if (commonConvId) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id, type')
          .eq('id', commonConvId)
          .single()
          
        if (existingConv && existingConv.type === type) {
          return {
            ...existingConv,
            conversation_participants: validParticipants.map(id => ({ user_id: id }))
          }
        }
      }

      console.log('Creando nueva conversación de tipo:', type)
      const { data: convId, error: rpcError } = await supabase.rpc('start_conversation', {
        p_type: type,
        p_participant_ids: validParticipants
      })

      if (rpcError) throw rpcError

      if (convId) {
        const { data: newConv } = await supabase
          .from('conversations')
          .select('id, type')
          .eq('id', convId)
          .single()
        
        return {
          ...(newConv || { id: convId, type }),
          conversation_participants: validParticipants.map(id => ({ user_id: id }))
        }
      }
    } catch (err) {
      console.error('Error in getOrCreateConversation:', err)
    }
    return null
  }

  const loadMessages = async (convId) => {
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!messages_sender_id_fkey(name, role)`)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setMessages(data)
      scrollToBottom()
      // Mark as read (simplified)
    }
  }

  const setupSubscription = (convId) => {
    const channel = supabase
      .channel(`conv_${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        scrollToBottom()
        if (isOpen && activeConversation && payload.new.conversation_id === activeConversation.id) {
          markAsRead(activeConversation.id)
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen es demasiado grande (máx 5MB)')
        return
      }
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSend = async (e) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() && !audioBlob && !imageFile) return
    
    if (!activeConversation) {
      alert('Error: No hay una conversación activa. Por favor, espera a que el chat cargue o refresca la página.')
      return
    }

    setLoading(true)
    try {
      let audioPath = null
      let imagePath = null
      let messageType = 'text'

      // 1. Manejar Audio
      if (audioBlob) {
        const fileName = `${userId}_${Date.now()}.webm`
        const { data, error } = await supabase.storage
          .from('chat_audios')
          .upload(fileName, audioBlob)
        
        if (error) throw error
        audioPath = data.path
        messageType = 'audio'
      }

      // 2. Manejar Imagen
      if (imageFile) {
        setUploadingImage(true)
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${userId}_${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage
          .from('chat_images')
          .upload(fileName, imageFile)
        
        if (error) throw error
        imagePath = data.path
        messageType = 'image'
      }

      const { error } = await supabase.from('messages').insert([{
        conversation_id: activeConversation.id,
        sender_id: userId,
        text: newMessage,
        type: messageType,
        audio_path: audioPath,
        image_path: imagePath
      }])

      if (error) throw error
      
      setNewMessage('')
      setAudioBlob(null)
      setImageFile(null)
      setImagePreview(null)
      setRecordingDuration(0)
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error al enviar el mensaje: ' + error.message)
    } finally {
      setLoading(false)
      setUploadingImage(false)
    }
  }

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      const chunks = []

      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setRecordingDuration(0)
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error recording:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(timerRef.current)
    }
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const toggleListening = () => {
    if (!recognitionRef.current) return
    
    try {
      if (isListening) {
        recognitionRef.current.stop()
        setIsListening(false)
      } else {
        recognitionRef.current.start()
        setIsListening(true)
      }
    } catch (err) {
      console.error('Recognition error:', err)
      setIsListening(false)
    }
  }


  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    if (conversations[tab]) {
      setActiveConversation(conversations[tab])
    }
  }

  return (
    <>
      {/* Botón Flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed ${userRole === 'admin' ? 'bottom-2' : 'bottom-6'} right-6 w-16 h-16 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-full shadow-2xl shadow-violet-500/40 flex items-center justify-center hover:scale-110 transition-all duration-300 z-50 group`}
        >
          <MessageCircle className="w-7 h-7 text-black" />
          
          {/* Unread Badge */}
          {unreadCounts.total > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-[#1a1a1a] flex items-center justify-center animate-bounce">
              {unreadCounts.total > 9 ? '9+' : unreadCounts.total}
            </span>
          )}

          <span className="absolute -top-10 right-0 bg-black text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 uppercase tracking-widest font-bold">
            Chat NL VIP
          </span>
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 w-[92%] max-w-[400px] h-[600px] max-h-[85vh] bg-[#0A0A0A] rounded-[2rem] shadow-2xl shadow-black border border-white/10 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5 duration-300">
          
          {/* Header & Tabs */}
          <div className="bg-gradient-to-b from-zinc-900 to-black p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {view === 'chat' && userRole === 'admin' && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="w-8 h-8 rounded-full text-zinc-400 hover:text-white mr-1"
                    onClick={() => {
                      setView('list')
                      setActiveConversation(null)
                    }}
                  >
                    <ChevronLeft size={18} />
                  </Button>
                )}
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Shield className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {view === 'list' ? 'Seleccionar Socio' : activeConversation?.display_name || 'Soporte NL VIP'}
                  </h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                    {view === 'list' ? `${members?.length || 0} Socios` : 'Chat Activo'}
                  </p>
                </div>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="w-8 h-8 rounded-full text-zinc-500 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} />
              </Button>
            </div>

            {userRole === 'member' && (
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                <button
                  onClick={() => handleTabSwitch('trainer')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all relative ${
                    activeTab === 'trainer' 
                      ? 'bg-violet-500 text-black shadow-lg shadow-violet-500/20' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Entrenador
                  {conversations.trainer && unreadCounts.byMember?.[conversations.trainer.id] > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm"></span>
                  )}
                </button>
                <button
                  onClick={() => handleTabSwitch('admin')}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all relative ${
                    activeTab === 'admin' 
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Administración
                  {conversations.admin && unreadCounts.byMember?.[conversations.admin.id] > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm"></span>
                  )}
                </button>
              </div>
            )}
            
            {userRole === 'admin' && view === 'list' && (
              <div className="relative mt-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar socio..."
                  className="h-9 bg-white/5 border-white/5 rounded-xl text-xs text-white"
                />
              </div>
            )}
          </div>

          {/* Area de Mensajes o Lista de Socios */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/40">
            {view === 'list' && userRole === 'admin' ? (
              <div className="space-y-2">
                {(members || []).filter(Boolean).filter(m => (m?.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(member => (
                  <button
                    key={member.id}
                    onClick={async () => {
                      setLoading(true)
                      const conv = await getOrCreateConversation('admin_member', [userId, member.id])
                      if (conv) {
                        setActiveConversation({ ...conv, display_name: member.name })
                        setView('chat')
                        markAsRead(conv.id)
                      }
                      setLoading(false)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-violet-500/10 border border-white/5 hover:border-violet-500/30 transition-all text-left relative"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold">
                      {(member?.name || '?').charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white flex items-center justify-between">
                        {member?.name || 'Socio sin nombre'}
                        {/* Indicador de mensaje nuevo por socio */}
                        {unreadCounts.byUser?.[member.id] > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">
                              {unreadCounts.byUser[member.id]}
                            </span>
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          </div>
                        )}
                      </p>
                      <p className="text-[10px] text-zinc-500">{member.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (messages || []).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <Bot size={48} className="text-zinc-800 mb-4" />
                <p className="text-sm text-zinc-500">No hay mensajes aún.<br/>Inicia la conversación.</p>
              </div>
            ) : (
              (messages || []).map((msg) => {
                if (!msg || typeof msg !== 'object') return null; // Safe guard
                const isMe = msg.sender_id === userId
                let formattedTime = ''
                try {
                  formattedTime = msg.created_at 
                    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : ''
                } catch (e) {
                  // Ignore invalid date crashes
                }

                return (
                  <div key={msg.id || Math.random().toString()} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl shadow-lg ${
                        isMe 
                          ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-tr-sm' 
                          : 'bg-zinc-900 text-white border border-white/5 rounded-tl-sm'
                      }`}>
                        {msg.type === 'audio' && msg.audio_path ? (
                          <AudioPlayer path={msg.audio_path} />
                        ) : msg.type === 'image' && msg.image_path ? (
                          <div className="space-y-2">
                            <img 
                              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/chat_images/${msg.image_path}`} 
                              alt="Imagen de chat"
                              className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                              onError={(e) => { e.target.style.display = 'none' }} // Hide broken images safely
                              onClick={() => window.open(`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/chat_images/${msg.image_path}`, '_blank')}
                            />
                            {msg.text && typeof msg.text === 'string' && <p className="text-sm leading-relaxed">{msg.text}</p>}
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed">{typeof msg.text === 'string' ? msg.text : ''}</p>
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-600 px-1">
                        {formattedTime}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input con Funciones Especiales */}
          <div className="p-4 bg-zinc-950 border-t border-white/5">
            {view === 'list' ? (
              <p className="text-xs text-zinc-500 text-center py-2">Selecciona un socio para comenzar a chatear</p>
            ) : isRecording ? (
              <div className="flex items-center gap-4 bg-red-500/10 p-3 rounded-2xl border border-red-500/20 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs text-red-500 font-bold flex-1">GRABANDO AUDIO... {formatDuration(recordingDuration)}</span>
                <button onClick={stopRecording} className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white">
                  <X size={18} />
                </button>
              </div>
            ) : audioBlob ? (
              <div className="flex items-center gap-4 bg-violet-500/10 p-3 rounded-2xl border border-violet-500/20">
                <Play size={18} className="text-violet-500" />
                <span className="text-xs text-violet-500 font-medium flex-1">Audio listo para enviar</span>
                <button onClick={() => setAudioBlob(null)} className="text-zinc-500 hover:text-white">
                  <Trash2 size={18} />
                </button>
                <Button onClick={handleSend} className="bg-violet-500 text-black rounded-xl">Enviar</Button>
              </div>
            ) : imagePreview ? (
              <div className="flex items-center gap-4 bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                  <img src={imagePreview} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-cyan-400 font-medium flex-1">Imagen lista para enviar</span>
                <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="text-zinc-500 hover:text-white">
                  <Trash2 size={18} />
                </button>
                <Button onClick={handleSend} disabled={uploadingImage} className="bg-cyan-500 text-black rounded-xl">
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : 'Enviar'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageSelect} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                <div className="flex-1 relative">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="h-12 bg-white/5 border-white/5 rounded-2xl pl-4 pr-10 text-sm focus:border-violet-500/50 text-white placeholder:text-zinc-500"
                  />
                  {userRole === 'admin' && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isListening ? 'text-violet-500' : 'text-zinc-600'}`}
                    >
                      <Mic size={18} />
                    </button>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                >
                  <ImageIcon size={20} />
                </button>

                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
                  >
                    <Volume2 size={20} />
                  </button>
                )}

                <Button 
                  type="submit" 
                  size="icon"
                  disabled={loading || (!newMessage.trim() && !audioBlob && !imageFile)}
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-black shadow-lg shadow-violet-500/20"
                >
                  <Send size={18} />
                </Button>
              </form>
            )}
            <p className="text-[10px] text-zinc-600 mt-2 text-center">
              {userRole === 'admin' ? 'Pulsa el icono de audio para enviar mensajes de voz' : 'Puedes usar el micrófono para dictar texto'}
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 30s linear infinite;
        }
      `}</style>
    </>
  )
}
