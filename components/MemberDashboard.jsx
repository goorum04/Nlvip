'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Home, Dumbbell, Apple, TrendingUp, Bell, LogOut, Plus, Heart, MessageCircle, 
  Flag, Calculator, Calendar, Image as ImageIcon, Weight, Ruler
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

export default function MemberDashboard({ user, profile, onLogout }) {
  const [feedPosts, setFeedPosts] = useState([])
  const [myWorkout, setMyWorkout] = useState(null)
  const [myDiet, setMyDiet] = useState(null)
  const [progressRecords, setProgressRecords] = useState([])
  const [notices, setNotices] = useState([])
  const [unreadNotices, setUnreadNotices] = useState(0)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Feed form
  const [newPostContent, setNewPostContent] = useState('')
  const [commentingPost, setCommentingPost] = useState(null)
  const [newComment, setNewComment] = useState('')

  // Progress form
  const [newWeight, setNewWeight] = useState('')
  const [newChest, setNewChest] = useState('')
  const [newWaist, setNewWaist] = useState('')
  const [newHips, setNewHips] = useState('')
  const [newArms, setNewArms] = useState('')
  const [newLegs, setNewLegs] = useState('')
  const [progressNotes, setProgressNotes] = useState('')

  // Macro calculator
  const [macroGender, setMacroGender] = useState('male')
  const [macroAge, setMacroAge] = useState('')
  const [macroHeight, setMacroHeight] = useState('')
  const [macroWeight, setMacroWeight] = useState('')
  const [macroActivity, setMacroActivity] = useState('moderate')
  const [macroGoal, setMacroGoal] = useState('maintain')
  const [macroResults, setMacroResults] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadFeed(),
      loadMyWorkout(),
      loadMyDiet(),
      loadProgress(),
      loadNotices()
    ])
  }

  const loadFeed = async () => {
    const { data, error } = await supabase
      .from('feed_posts')
      .select(`
        *,
        author:profiles!feed_posts_author_id_fkey(name),
        feed_likes(id, user_id),
        feed_comments(
          id,
          content,
          created_at,
          commenter:profiles!feed_comments_commenter_id_fkey(name)
        )
      `)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (data) setFeedPosts(data)
  }

  const loadMyWorkout = async () => {
    const { data, error } = await supabase
      .from('member_workouts')
      .select(`
        *,
        workout:workout_templates!member_workouts_workout_template_id_fkey(
          id,
          name,
          description
        )
      `)
      .eq('member_id', user.id)
      .single()
    
    if (data) setMyWorkout(data)
  }

  const loadMyDiet = async () => {
    const { data, error } = await supabase
      .from('member_diets')
      .select(`
        *,
        diet:diet_templates!member_diets_diet_template_id_fkey(
          id,
          name,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          content
        )
      `)
      .eq('member_id', user.id)
      .single()
    
    if (data) setMyDiet(data)
  }

  const loadProgress = async () => {
    const { data, error } = await supabase
      .from('progress_records')
      .select('*')
      .eq('member_id', user.id)
      .order('date', { ascending: false })
      .limit(20)
    
    if (data) setProgressRecords(data)
  }

  const loadNotices = async () => {
    const { data, error } = await supabase
      .from('trainer_notices')
      .select(`
        *,
        notice_reads(id, read_at)
      `)
      .or(`member_id.eq.${user.id},member_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (data) {
      setNotices(data)
      const unread = data.filter(n => !n.notice_reads || n.notice_reads.length === 0).length
      setUnreadNotices(unread)
    }
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('feed_posts')
        .insert([{
          author_id: user.id,
          content: newPostContent
        }])

      if (error) throw error

      toast({
        title: '¡Post publicado!',
        description: 'Tu post ya es visible en el feed'
      })

      setNewPostContent('')
      loadFeed()

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

  const handleLikePost = async (postId) => {
    // Check if already liked
    const { data: existingLike } = await supabase
      .from('feed_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single()

    if (existingLike) {
      // Unlike
      await supabase
        .from('feed_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
    } else {
      // Like
      await supabase
        .from('feed_likes')
        .insert([{
          post_id: postId,
          user_id: user.id
        }])
    }

    loadFeed()
  }

  const handleComment = async (postId) => {
    if (!newComment.trim()) return

    const { error } = await supabase
      .from('feed_comments')
      .insert([{
        post_id: postId,
        commenter_id: user.id,
        content: newComment
      }])

    if (!error) {
      setNewComment('')
      setCommentingPost(null)
      loadFeed()
      toast({
        title: 'Comentario publicado'
      })
    }
  }

  const handleReportPost = async (postId) => {
    const { error } = await supabase
      .from('feed_reports')
      .insert([{
        post_id: postId,
        reporter_id: user.id,
        reason: 'Contenido inapropiado'
      }])

    if (!error) {
      toast({
        title: 'Post reportado',
        description: 'El administrador revisará este contenido'
      })
    }
  }

  const handleAddProgress = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('progress_records')
        .insert([{
          member_id: user.id,
          date: new Date().toISOString(),
          weight_kg: parseFloat(newWeight) || null,
          chest_cm: parseFloat(newChest) || null,
          waist_cm: parseFloat(newWaist) || null,
          hips_cm: parseFloat(newHips) || null,
          arms_cm: parseFloat(newArms) || null,
          legs_cm: parseFloat(newLegs) || null,
          notes: progressNotes
        }])

      if (error) throw error

      toast({
        title: '¡Progreso registrado!',
        description: 'Tu entrenador puede ver tu evolución'
      })

      setNewWeight('')
      setNewChest('')
      setNewWaist('')
      setNewHips('')
      setNewArms('')
      setNewLegs('')
      setProgressNotes('')
      loadProgress()

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

  const calculateMacros = () => {
    const age = parseInt(macroAge)
    const height = parseInt(macroHeight)
    const weight = parseFloat(macroWeight)

    // Mifflin-St Jeor Formula
    let bmr
    if (macroGender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161
    }

    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    }

    let tdee = bmr * activityMultipliers[macroActivity]

    // Goal adjustments
    if (macroGoal === 'cut') {
      tdee *= 0.85 // 15% deficit
    } else if (macroGoal === 'bulk') {
      tdee *= 1.15 // 15% surplus
    }

    // Macro distribution
    const protein = weight * 1.8
    const fat = weight * 0.8
    const proteinCals = protein * 4
    const fatCals = fat * 9
    const carbs = (tdee - proteinCals - fatCals) / 4

    setMacroResults({
      calories: Math.round(tdee),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat)
    })
  }

  const markNoticeAsRead = async (noticeId) => {
    await supabase
      .from('notice_reads')
      .insert([{
        notice_id: noticeId,
        member_id: user.id
      }])

    loadNotices()
  }

  const isLikedByMe = (post) => {
    return post.feed_likes?.some(like => like.user_id === user.id)
  }

  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      {/* Modern Hero Header */}
      <header 
        className="relative bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80)',
          minHeight: '280px'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-[#0B0B0B]" />
        <div className="relative container mx-auto px-4 py-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-8">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </Button>
            <div className="flex items-center gap-2">
              {unreadNotices > 0 && (
                <div className="relative">
                  <Bell className="w-6 h-6 text-[#C9A24D]" />
                  <span className="absolute -top-1 -right-1 bg-[#C9A24D] text-black text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {unreadNotices}
                  </span>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                className="text-white hover:bg-white/10 rounded-full"
                onClick={onLogout}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Welcome Card */}
          <div className="space-y-2">
            <p className="text-gray-300 text-sm">Hola,</p>
            <h2 className="text-4xl font-bold text-white">{profile.name}!</h2>
            <div className="flex items-center gap-2 mt-3">
              <Crown className="w-5 h-5 text-[#C9A24D]" />
              <p className="text-[#C9A24D] font-semibold">Socio VIP</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 -mt-8">
        {/* Modern Tab Navigation */}
        <div className="bg-[#1a1a1a] rounded-2xl p-2 mb-6 shadow-lg border border-[#C9A24D]/10">
          <Tabs defaultValue="feed" className="space-y-6">
            <TabsList className="bg-transparent grid grid-cols-3 md:grid-cols-6 gap-2 p-0">
              <TabsTrigger 
                value="feed" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Home className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Feed</span>
              </TabsTrigger>
              <TabsTrigger 
                value="workout" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Dumbbell className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Rutina</span>
              </TabsTrigger>
              <TabsTrigger 
                value="diet" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Apple className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Dieta</span>
              </TabsTrigger>
              <TabsTrigger 
                value="progress" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <TrendingUp className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Progreso</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calculator" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all"
              >
                <Calculator className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Macros</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notices" 
                className="rounded-xl data-[state=active]:bg-[#C9A24D] data-[state=active]:text-black data-[state=active]:shadow-lg transition-all relative"
              >
                <Bell className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Avisos</span>
                {unreadNotices > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#C9A24D] text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg">
                    {unreadNotices}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

          {/* Feed Social */}
          <TabsContent value="feed" className="space-y-4">
            {/* Create Post Card - Modern */}
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/10 rounded-2xl shadow-lg overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#C9A24D] text-lg">Compartir con la comunidad</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <Textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="¿Qué logro quieres compartir hoy? 💪"
                    required
                    className="bg-black/50 border-[#C9A24D]/20 text-white rounded-xl min-h-[100px] resize-none focus:border-[#C9A24D] transition-colors"
                  />
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] hover:from-[#D4AF37] hover:to-[#C9A24D] text-black font-semibold rounded-xl py-6 shadow-lg"
                    disabled={loading}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Publicar
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Feed Posts - Modern Cards */}
            <div className="space-y-4">
              {feedPosts.map((post) => (
                <Card key={post.id} className="bg-[#1a1a1a] border-[#C9A24D]/10 rounded-2xl shadow-lg overflow-hidden hover:border-[#C9A24D]/30 transition-all">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Author Info */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center text-black font-bold text-lg">
                            {post.author?.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{post.author?.name}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(post.created_at).toLocaleString('es-ES', { 
                                day: 'numeric', 
                                month: 'short', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-full"
                          onClick={() => handleReportPost(post.id)}
                        >
                          <Flag className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Content */}
                      <p className="text-gray-200 leading-relaxed">{post.content}</p>
                      
                      {/* Image if exists */}
                      {post.image_url && (
                        <div className="rounded-xl overflow-hidden">
                          <img 
                            src={post.image_url} 
                            alt="Post" 
                            className="w-full h-auto object-cover"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-6 pt-2 border-t border-[#C9A24D]/10">
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`${isLikedByMe(post) ? 'text-[#C9A24D]' : 'text-gray-400'} hover:text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-full`}
                          onClick={() => handleLikePost(post.id)}
                        >
                          <Heart className="w-5 h-5 mr-2" fill={isLikedByMe(post) ? 'currentColor' : 'none'} />
                          <span className="font-semibold">{post.feed_likes?.length || 0}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-full"
                          onClick={() => setCommentingPost(post.id)}
                        >
                          <MessageCircle className="w-5 h-5 mr-2" />
                          <span className="font-semibold">{post.feed_comments?.length || 0}</span>
                        </Button>
                      </div>

                      {/* Comments */}
                      {post.feed_comments && post.feed_comments.length > 0 && (
                        <div className="space-y-3 pl-4 border-l-2 border-[#C9A24D]/20 mt-4">
                          {post.feed_comments.map((comment) => (
                            <div key={comment.id} className="text-sm">
                              <span className="font-semibold text-[#C9A24D]">{comment.commenter?.name}</span>
                              <span className="text-gray-300 ml-2">{comment.content}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Form */}
                      {commentingPost === post.id && (
                        <div className="flex gap-2 pt-2">
                          <Input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Escribe un comentario..."
                            className="bg-black/50 border-[#C9A24D]/20 text-white rounded-xl focus:border-[#C9A24D]"
                          />
                          <Button
                            size="sm"
                            className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black rounded-xl px-6"
                            onClick={() => handleComment(post.id)}
                          >
                            Enviar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {feedPosts.length === 0 && (
                <Card className="bg-[#1a1a1a] border-[#C9A24D]/10 rounded-2xl shadow-lg">
                  <CardContent className="py-16">
                    <div className="text-center space-y-2">
                      <Home className="w-12 h-12 text-[#C9A24D]/40 mx-auto" />
                      <p className="text-gray-400">No hay posts aún. ¡Sé el primero en publicar!</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Mi Rutina */}
          <TabsContent value="workout" className="space-y-4">
            {myWorkout ? (
              <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
                <CardHeader>
                  <CardTitle className="text-[#C9A24D]">{myWorkout.workout?.name}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Asignada el {new Date(myWorkout.assigned_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                    <p className="text-gray-200 whitespace-pre-wrap">{myWorkout.workout?.description}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
                <CardContent className="py-12">
                  <p className="text-center text-gray-400">Tu entrenador aún no te ha asignado una rutina</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Mi Dieta */}
          <TabsContent value="diet" className="space-y-4">
            {myDiet ? (
              <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
                <CardHeader>
                  <CardTitle className="text-[#C9A24D]">{myDiet.diet?.name}</CardTitle>
                  <CardDescription className="text-gray-400">
                    Asignada el {new Date(myDiet.assigned_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <p className="text-sm text-gray-400">Calorías</p>
                      <p className="text-2xl font-bold text-[#C9A24D]">{myDiet.diet?.calories}</p>
                      <p className="text-xs text-gray-500">kcal</p>
                    </div>
                    <div className="text-center p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <p className="text-sm text-gray-400">Proteína</p>
                      <p className="text-2xl font-bold text-white">{myDiet.diet?.protein_g}</p>
                      <p className="text-xs text-gray-500">gramos</p>
                    </div>
                    <div className="text-center p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <p className="text-sm text-gray-400">Carbohidratos</p>
                      <p className="text-2xl font-bold text-white">{myDiet.diet?.carbs_g}</p>
                      <p className="text-xs text-gray-500">gramos</p>
                    </div>
                    <div className="text-center p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <p className="text-sm text-gray-400">Grasas</p>
                      <p className="text-2xl font-bold text-white">{myDiet.diet?.fat_g}</p>
                      <p className="text-xs text-gray-500">gramos</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-3">Plan de Comidas</h3>
                    <div className="prose prose-invert max-w-none">
                      <p className="text-gray-200 whitespace-pre-wrap">{myDiet.diet?.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
                <CardContent className="py-12">
                  <p className="text-center text-gray-400">Tu entrenador aún no te ha asignado una dieta</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Progreso */}
          <TabsContent value="progress" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Registrar Progreso</CardTitle>
                <CardDescription className="text-gray-400">
                  Registra tus medidas y peso para que tu entrenador vea tu evolución
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddProgress} className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Peso (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        placeholder="75.5"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Pecho (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newChest}
                        onChange={(e) => setNewChest(e.target.value)}
                        placeholder="100"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Cintura (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newWaist}
                        onChange={(e) => setNewWaist(e.target.value)}
                        placeholder="85"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Cadera (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newHips}
                        onChange={(e) => setNewHips(e.target.value)}
                        placeholder="95"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Brazos (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newArms}
                        onChange={(e) => setNewArms(e.target.value)}
                        placeholder="35"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Piernas (cm)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newLegs}
                        onChange={(e) => setNewLegs(e.target.value)}
                        placeholder="60"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Notas</Label>
                    <Textarea
                      value={progressNotes}
                      onChange={(e) => setProgressNotes(e.target.value)}
                      placeholder="Cómo te sientes, energía, etc."
                      className="bg-black border-[#C9A24D]/20 text-white"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                    disabled={loading}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Guardar Progreso
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Historial de Progreso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {progressRecords.map((record) => (
                    <div key={record.id} className="p-4 bg-black/50 rounded-lg border border-[#C9A24D]/10">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-white">
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                        {record.weight_kg && (
                          <span className="text-[#C9A24D] font-bold">{record.weight_kg} kg</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        {record.chest_cm && <p className="text-gray-400">Pecho: {record.chest_cm}cm</p>}
                        {record.waist_cm && <p className="text-gray-400">Cintura: {record.waist_cm}cm</p>}
                        {record.hips_cm && <p className="text-gray-400">Cadera: {record.hips_cm}cm</p>}
                      </div>
                      {record.notes && (
                        <p className="text-sm text-gray-300 mt-2 italic">{record.notes}</p>
                      )}
                    </div>
                  ))}
                  {progressRecords.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No has registrado progreso aún</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculadora de Macros */}
          <TabsContent value="calculator" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Calculadora de Macros</CardTitle>
                <CardDescription className="text-gray-400">
                  Calcula tus necesidades calóricas y distribución de macronutrientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Sexo</Label>
                      <Select value={macroGender} onValueChange={setMacroGender}>
                        <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Hombre</SelectItem>
                          <SelectItem value="female">Mujer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Edad</Label>
                      <Input
                        type="number"
                        value={macroAge}
                        onChange={(e) => setMacroAge(e.target.value)}
                        placeholder="30"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-200">Altura (cm)</Label>
                      <Input
                        type="number"
                        value={macroHeight}
                        onChange={(e) => setMacroHeight(e.target.value)}
                        placeholder="175"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-200">Peso (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={macroWeight}
                        onChange={(e) => setMacroWeight(e.target.value)}
                        placeholder="75"
                        className="bg-black border-[#C9A24D]/20 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Nivel de Actividad</Label>
                    <Select value={macroActivity} onValueChange={setMacroActivity}>
                      <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">Sedentario (poco o ningún ejercicio)</SelectItem>
                        <SelectItem value="light">Ligero (1-3 días/semana)</SelectItem>
                        <SelectItem value="moderate">Moderado (3-5 días/semana)</SelectItem>
                        <SelectItem value="active">Activo (6-7 días/semana)</SelectItem>
                        <SelectItem value="very_active">Muy Activo (2 veces al día)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-200">Objetivo</Label>
                    <Select value={macroGoal} onValueChange={setMacroGoal}>
                      <SelectTrigger className="bg-black border-[#C9A24D]/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cut">Pérdida de grasa (déficit)</SelectItem>
                        <SelectItem value="maintain">Mantener peso</SelectItem>
                        <SelectItem value="bulk">Ganancia muscular (superávit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={calculateMacros}
                    className="w-full bg-[#C9A24D] hover:bg-[#D4AF37] text-black"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular
                  </Button>

                  {macroResults && (
                    <div className="mt-6 p-6 bg-black/50 rounded-lg border border-[#C9A24D]/20">
                      <h3 className="text-xl font-bold text-[#C9A24D] mb-4">Tus Resultados</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Calorías</p>
                          <p className="text-3xl font-bold text-[#C9A24D]">{macroResults.calories}</p>
                          <p className="text-xs text-gray-500">kcal/día</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Proteína</p>
                          <p className="text-3xl font-bold text-white">{macroResults.protein}</p>
                          <p className="text-xs text-gray-500">gramos</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Carbohidratos</p>
                          <p className="text-3xl font-bold text-white">{macroResults.carbs}</p>
                          <p className="text-xs text-gray-500">gramos</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Grasas</p>
                          <p className="text-3xl font-bold text-white">{macroResults.fat}</p>
                          <p className="text-xs text-gray-500">gramos</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avisos */}
          <TabsContent value="notices" className="space-y-4">
            <Card className="bg-[#1a1a1a] border-[#C9A24D]/20">
              <CardHeader>
                <CardTitle className="text-[#C9A24D]">Avisos de tu Entrenador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notices.map((notice) => {
                    const isRead = notice.notice_reads && notice.notice_reads.length > 0
                    return (
                      <div 
                        key={notice.id} 
                        className={`p-4 rounded-lg border ${
                          isRead 
                            ? 'bg-black/30 border-[#C9A24D]/10' 
                            : 'bg-[#C9A24D]/10 border-[#C9A24D]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-white">{notice.title}</h4>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              notice.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                              notice.priority === 'normal' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {notice.priority === 'high' ? 'Alta' : notice.priority === 'normal' ? 'Normal' : 'Baja'}
                            </span>
                            {!isRead && (
                              <span className="text-xs bg-[#C9A24D] text-black px-2 py-1 rounded font-semibold">
                                NUEVO
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-300 mb-2">{notice.message}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            {new Date(notice.created_at).toLocaleString()}
                          </p>
                          {!isRead && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#C9A24D]/40 text-[#C9A24D] hover:bg-[#C9A24D]/10"
                              onClick={() => markNoticeAsRead(notice.id)}
                            >
                              Marcar como leído
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {notices.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No tienes avisos</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </main>

      <Toaster />
    </div>
  )
}
