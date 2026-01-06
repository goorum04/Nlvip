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
import { 
  Home, Dumbbell, Apple, TrendingUp, Bell, LogOut, Plus, Heart, MessageCircle, 
  Flag, Calculator, Crown, Sparkles, Flame, Target, Zap, Star, ShoppingBag,
  Camera, Video, Image as ImageIcon, Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import FloatingChat from './FloatingChat'
import ImageUploader from './ImageUploader'
import VideoPlayer, { VideoCard } from './VideoPlayer'
import { ProgressPhotoUploader, ProgressPhotoGallery } from './ProgressPhotos'
import { useFileUpload, useSignedUrl, generateFileId, getFileExtension } from '@/hooks/useStorage'

export default function MemberDashboard({ user, profile, onLogout }) {
  const [feedPosts, setFeedPosts] = useState([])
  const [myWorkout, setMyWorkout] = useState(null)
  const [workoutVideos, setWorkoutVideos] = useState([])
  const [myDiet, setMyDiet] = useState(null)
  const [progressRecords, setProgressRecords] = useState([])
  const [progressPhotos, setProgressPhotos] = useState([])
  const [notices, setNotices] = useState([])
  const [unreadNotices, setUnreadNotices] = useState(0)
  const [loading, setLoading] = useState(false)
  const [myTrainer, setMyTrainer] = useState(null)
  const [storeProducts, setStoreProducts] = useState([])
  const [feedImageUrls, setFeedImageUrls] = useState({})
  const { toast } = useToast()
  const { getSignedUrl } = useSignedUrl()

  // UI states
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [showPhotoUploader, setShowPhotoUploader] = useState(false)
  const [postImage, setPostImage] = useState(null)

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

  // Macro calculator removed - only trainers/admins can calculate macros

  const { uploadFile, uploading, progress } = useFileUpload()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadFeed(),
      loadMyWorkout(),
      loadMyDiet(),
      loadProgress(),
      loadProgressPhotos(),
      loadNotices(),
      loadMyTrainer(),
      loadStoreProducts()
    ])
  }

  const loadMyTrainer = async () => {
    const { data } = await supabase
      .from('trainer_members')
      .select(`trainer:profiles!trainer_members_trainer_id_fkey(id, name, email)`)
      .eq('member_id', user.id)
      .single()
    if (data) setMyTrainer(data.trainer)
  }

  const loadFeed = async () => {
    const { data } = await supabase
      .from('feed_posts')
      .select(`*, author:profiles!feed_posts_author_id_fkey(name), feed_likes(id, user_id), feed_comments(id, content, created_at, commenter:profiles!feed_comments_commenter_id_fkey(name))`)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (data) {
      setFeedPosts(data)
      // Load signed URLs for images
      const urls = {}
      for (const post of data) {
        if (post.image_url) {
          const url = await getSignedUrl('feed_images', post.image_url, 3600)
          if (url) urls[post.id] = url
        }
      }
      setFeedImageUrls(urls)
    }
  }

  const loadMyWorkout = async () => {
    const { data } = await supabase
      .from('member_workouts')
      .select(`*, workout:workout_templates!member_workouts_workout_template_id_fkey(id, name, description)`)
      .eq('member_id', user.id)
      .single()
    
    if (data) {
      setMyWorkout(data)
      // Load videos for this workout
      const { data: videos } = await supabase
        .from('workout_videos')
        .select('*')
        .eq('workout_template_id', data.workout.id)
        .order('created_at')
      if (videos) setWorkoutVideos(videos)
    }
  }

  const loadMyDiet = async () => {
    const { data } = await supabase
      .from('member_diets')
      .select(`*, diet:diet_templates!member_diets_diet_template_id_fkey(id, name, calories, protein_g, carbs_g, fat_g, content)`)
      .eq('member_id', user.id)
      .single()
    if (data) setMyDiet(data)
  }

  const loadProgress = async () => {
    const { data } = await supabase
      .from('progress_records')
      .select('*')
      .eq('member_id', user.id)
      .order('date', { ascending: false })
      .limit(20)
    if (data) setProgressRecords(data)
  }

  const loadProgressPhotos = async () => {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('member_id', user.id)
      .order('date', { ascending: false })
    if (data) setProgressPhotos(data)
  }

  const loadStoreProducts = async () => {
    try {
      const { data } = await supabase.from('store_products').select('*').eq('is_active', true).order('category')
      if (data) setStoreProducts(data)
    } catch (e) { /* Table may not exist */ }
  }

  const loadNotices = async () => {
    const { data } = await supabase
      .from('trainer_notices')
      .select(`*, notice_reads(id, read_at)`)
      .or(`member_id.eq.${user.id},member_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (data) {
      setNotices(data)
      setUnreadNotices(data.filter(n => !n.notice_reads || n.notice_reads.length === 0).length)
    }
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!newPostContent.trim() && !postImage) return
    
    setLoading(true)
    try {
      let imagePath = null
      
      // Upload image if selected
      if (postImage) {
        const fileId = generateFileId()
        const ext = getFileExtension(postImage.name)
        imagePath = `feed/${user.id}/${fileId}.${ext}`
        
        const result = await uploadFile('feed_images', imagePath, postImage, {
          maxSize: 5 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        })
        
        if (!result.success) throw new Error(result.error)
      }

      const { error } = await supabase.from('feed_posts').insert([{
        author_id: user.id,
        content: newPostContent,
        image_url: imagePath
      }])
      
      if (error) throw error
      toast({ title: '¡Post publicado!' })
      setNewPostContent('')
      setPostImage(null)
      loadFeed()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleLikePost = async (postId) => {
    const { data: existingLike } = await supabase.from('feed_likes').select('id').eq('post_id', postId).eq('user_id', user.id).single()
    if (existingLike) {
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    } else {
      await supabase.from('feed_likes').insert([{ post_id: postId, user_id: user.id }])
    }
    loadFeed()
  }

  const handleComment = async (postId) => {
    if (!newComment.trim()) return
    const { error } = await supabase.from('feed_comments').insert([{ post_id: postId, commenter_id: user.id, content: newComment }])
    if (!error) {
      setNewComment('')
      setCommentingPost(null)
      loadFeed()
    }
  }

  const handleReportPost = async (postId) => {
    await supabase.from('feed_reports').insert([{ post_id: postId, reporter_id: user.id, reason: 'Contenido inapropiado' }])
    toast({ title: 'Post reportado', description: 'El administrador lo revisará' })
  }

  const handleAddProgress = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.from('progress_records').insert([{
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
      toast({ title: '¡Progreso registrado!' })
      setNewWeight(''); setNewChest(''); setNewWaist(''); setNewHips(''); setNewArms(''); setNewLegs(''); setProgressNotes('')
      loadProgress()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePhoto = async (photoId) => {
    const { error } = await supabase.from('progress_photos').delete().eq('id', photoId)
    if (!error) {
      toast({ title: 'Foto eliminada' })
      loadProgressPhotos()
    }
  }

  const markNoticeAsRead = async (noticeId) => {
    await supabase.from('notice_reads').insert([{ notice_id: noticeId, member_id: user.id }])
    loadNotices()
  }

  const isLikedByMe = (post) => post.feed_likes?.some(like => like.user_id === user.id)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0B0B0B] to-[#0a0a0a]">
      {/* HEADER */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A24D]/20 via-transparent to-[#C9A24D]/10" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C9A24D]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center shadow-lg shadow-[#C9A24D]/20">
                <Crown className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#C9A24D] to-[#D4AF37]">NL VIP CLUB</h1>
                <p className="text-xs text-gray-500">Premium Fitness</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#C9A24D] to-[#D4AF37] flex items-center justify-center text-3xl font-black text-black shadow-xl shadow-[#C9A24D]/30">
              {profile.name?.charAt(0)}
            </div>
            <div className="pb-1">
              <p className="text-gray-400 text-sm">Bienvenido de vuelta,</p>
              <h2 className="text-3xl font-black text-white">{profile.name?.split(' ')[0]}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-[#C9A24D]" />
                <span className="text-sm text-[#C9A24D] font-semibold">Socio VIP</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="feed" className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="inline-flex gap-2 bg-transparent p-0 min-w-max">
              {[
                { value: 'feed', icon: Home, label: 'Feed' },
                { value: 'workout', icon: Dumbbell, label: 'Rutina' },
                { value: 'diet', icon: Apple, label: 'Dieta' },
                { value: 'progress', icon: TrendingUp, label: 'Progreso' },
                { value: 'notices', icon: Bell, label: 'Avisos', badge: unreadNotices }
              ].map(tab => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className="relative px-4 py-2.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#C9A24D] data-[state=active]:to-[#D4AF37] data-[state=active]:text-black data-[state=active]:border-transparent data-[state=active]:shadow-lg data-[state=active]:shadow-[#C9A24D]/20 transition-all duration-300"
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* FEED TAB */}
          <TabsContent value="feed" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
              <CardContent className="p-5">
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <Textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="¿Qué logro compartes hoy? 💪"
                    className="bg-black/50 border-[#2a2a2a] text-white rounded-2xl min-h-[80px] resize-none focus:border-[#C9A24D] placeholder:text-gray-500"
                  />
                  <ImageUploader
                    onImageSelect={setPostImage}
                    onImageRemove={() => setPostImage(null)}
                    disabled={loading || uploading}
                  />
                  <Button 
                    type="submit" 
                    disabled={loading || uploading || (!newPostContent.trim() && !postImage)} 
                    className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] hover:opacity-90 text-black font-bold rounded-2xl py-6 shadow-lg shadow-[#C9A24D]/20"
                  >
                    {uploading ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Subiendo {progress}%</>
                    ) : (
                      <><Zap className="w-5 h-5 mr-2" /> Publicar</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {feedPosts.map((post) => (
              <Card key={post.id} className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden hover:border-[#C9A24D]/30 transition-all duration-300">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A24D]/20 to-[#D4AF37]/10 flex items-center justify-center text-[#C9A24D] font-bold border border-[#C9A24D]/20">
                      {post.author?.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white">{post.author?.name}</p>
                      <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-500 hover:text-[#C9A24D]" onClick={() => handleReportPost(post.id)}>
                      <Flag className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {post.content && <p className="text-gray-200 mb-4 leading-relaxed">{post.content}</p>}
                  
                  {/* Post Image */}
                  {feedImageUrls[post.id] && (
                    <div className="mb-4 rounded-2xl overflow-hidden border border-[#2a2a2a]">
                      <img
                        src={feedImageUrls[post.id]}
                        alt="Post"
                        className="w-full max-h-96 object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a2a]">
                    <Button variant="ghost" size="sm" className={`rounded-xl ${isLikedByMe(post) ? 'text-[#C9A24D]' : 'text-gray-400'} hover:text-[#C9A24D]`} onClick={() => handleLikePost(post.id)}>
                      <Heart className="w-5 h-5 mr-2" fill={isLikedByMe(post) ? 'currentColor' : 'none'} />
                      {post.feed_likes?.length || 0}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl text-gray-400 hover:text-[#C9A24D]" onClick={() => setCommentingPost(commentingPost === post.id ? null : post.id)}>
                      <MessageCircle className="w-5 h-5 mr-2" />
                      {post.feed_comments?.length || 0}
                    </Button>
                  </div>
                  {post.feed_comments?.length > 0 && (
                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-[#C9A24D]/20">
                      {post.feed_comments.slice(0, 3).map((c) => (
                        <p key={c.id} className="text-sm"><span className="text-[#C9A24D] font-semibold">{c.commenter?.name}</span> <span className="text-gray-300">{c.content}</span></p>
                      ))}
                    </div>
                  )}
                  {commentingPost === post.id && (
                    <div className="mt-4 flex gap-2">
                      <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Comenta..." className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                      <Button onClick={() => handleComment(post.id)} className="bg-[#C9A24D] text-black rounded-xl px-4">Enviar</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* WORKOUT TAB */}
          <TabsContent value="workout" className="space-y-4">
            {myWorkout ? (
              <>
                <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-[#C9A24D]/30 to-[#C9A24D]/5 flex items-center justify-center">
                    <Dumbbell className="w-20 h-20 text-[#C9A24D]/30" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-3">
                      <Flame className="w-6 h-6 text-[#C9A24D]" />
                      {myWorkout.workout?.name}
                    </CardTitle>
                    <CardDescription className="text-gray-500">Asignada el {new Date(myWorkout.assigned_at).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-black/30 rounded-2xl p-5 border border-[#2a2a2a]">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{myWorkout.workout?.description}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Workout Videos */}
                {workoutVideos.length > 0 && (
                  <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Video className="w-5 h-5 text-[#C9A24D]" />
                        Vídeos de la Rutina ({workoutVideos.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        {workoutVideos.map(video => (
                          <VideoCard
                            key={video.id}
                            video={video}
                            onClick={() => setSelectedVideo(video)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardContent className="py-20 text-center">
                  <Dumbbell className="w-20 h-20 mx-auto text-[#C9A24D]/20 mb-4" />
                  <p className="text-gray-500">Tu entrenador aún no te ha asignado una rutina</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DIET TAB */}
          <TabsContent value="diet" className="space-y-4">
            {myDiet ? (
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-2xl text-white flex items-center gap-3">
                    <Apple className="w-6 h-6 text-[#C9A24D]" />
                    {myDiet.diet?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Calorías', value: myDiet.diet?.calories, icon: Flame, color: 'from-orange-500/20 to-orange-500/5' },
                      { label: 'Proteína', value: `${myDiet.diet?.protein_g}g`, icon: Target, color: 'from-blue-500/20 to-blue-500/5' },
                      { label: 'Carbos', value: `${myDiet.diet?.carbs_g}g`, icon: Zap, color: 'from-yellow-500/20 to-yellow-500/5' },
                      { label: 'Grasas', value: `${myDiet.diet?.fat_g}g`, icon: Star, color: 'from-purple-500/20 to-purple-500/5' },
                    ].map(m => (
                      <div key={m.label} className={`bg-gradient-to-br ${m.color} rounded-2xl p-4 border border-white/5`}>
                        <m.icon className="w-5 h-5 text-[#C9A24D] mb-2" />
                        <p className="text-2xl font-black text-white">{m.value}</p>
                        <p className="text-xs text-gray-500">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-black/30 rounded-2xl p-5 border border-[#2a2a2a]">
                    <p className="text-gray-300 whitespace-pre-wrap">{myDiet.diet?.content}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardContent className="py-20 text-center">
                  <Apple className="w-20 h-20 mx-auto text-[#C9A24D]/20 mb-4" />
                  <p className="text-gray-500">Tu entrenador aún no te ha asignado una dieta</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PROGRESS TAB */}
          <TabsContent value="progress" className="space-y-4">
            {/* Photos Section */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#C9A24D]" />
                    Fotos de Progreso
                  </CardTitle>
                  {!showPhotoUploader && (
                    <Button
                      onClick={() => setShowPhotoUploader(true)}
                      className="bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Subir
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {showPhotoUploader ? (
                  <ProgressPhotoUploader
                    memberId={user.id}
                    onSuccess={() => {
                      setShowPhotoUploader(false)
                      loadProgressPhotos()
                      toast({ title: '¡Foto guardada!' })
                    }}
                    onCancel={() => setShowPhotoUploader(false)}
                  />
                ) : (
                  <ProgressPhotoGallery
                    photos={progressPhotos}
                    canDelete={true}
                    onDelete={handleDeletePhoto}
                  />
                )}
              </CardContent>
            </Card>

            {/* Measurements Section */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#C9A24D]" />
                  Registrar Medidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddProgress} className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Peso (kg)', value: newWeight, setter: setNewWeight },
                      { label: 'Pecho (cm)', value: newChest, setter: setNewChest },
                      { label: 'Cintura (cm)', value: newWaist, setter: setNewWaist },
                      { label: 'Cadera (cm)', value: newHips, setter: setNewHips },
                      { label: 'Brazos (cm)', value: newArms, setter: setNewArms },
                      { label: 'Piernas (cm)', value: newLegs, setter: setNewLegs },
                    ].map(f => (
                      <div key={f.label}>
                        <Label className="text-gray-400 text-xs">{f.label}</Label>
                        <Input type="number" step="0.1" value={f.value} onChange={(e) => f.setter(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Notas</Label>
                    <Textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} placeholder="¿Cómo te sientes?" className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-2xl py-6">
                    Guardar Medidas
                  </Button>
                </form>
              </CardContent>
            </Card>

            {progressRecords.length > 0 && (
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-white">Historial de Medidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {progressRecords.map(r => (
                    <div key={r.id} className="bg-black/30 rounded-2xl p-4 border border-[#2a2a2a]">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-[#C9A24D] font-semibold">{new Date(r.date).toLocaleDateString()}</p>
                        {r.weight_kg && <p className="text-2xl font-black text-white">{r.weight_kg} kg</p>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        {r.chest_cm && <span>Pecho: {r.chest_cm}cm</span>}
                        {r.waist_cm && <span>Cintura: {r.waist_cm}cm</span>}
                        {r.hips_cm && <span>Cadera: {r.hips_cm}cm</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CALCULATOR TAB */}
          <TabsContent value="calculator" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#C9A24D]" />
                  Calculadora de Macros
                </CardTitle>
                <CardDescription className="text-gray-500">Fórmula Mifflin-St Jeor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400 text-xs">Género</Label>
                    <Select value={macroGender} onValueChange={setMacroGender}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="male">Hombre</SelectItem><SelectItem value="female">Mujer</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Edad</Label>
                    <Input type="number" value={macroAge} onChange={(e) => setMacroAge(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Altura (cm)</Label>
                    <Input type="number" value={macroHeight} onChange={(e) => setMacroHeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Peso (kg)</Label>
                    <Input type="number" value={macroWeight} onChange={(e) => setMacroWeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Actividad</Label>
                    <Select value={macroActivity} onValueChange={setMacroActivity}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">Sedentario</SelectItem>
                        <SelectItem value="light">Ligera</SelectItem>
                        <SelectItem value="moderate">Moderada</SelectItem>
                        <SelectItem value="active">Activa</SelectItem>
                        <SelectItem value="very_active">Muy activa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Objetivo</Label>
                    <Select value={macroGoal} onValueChange={setMacroGoal}>
                      <SelectTrigger className="bg-black/50 border-[#2a2a2a] rounded-xl text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cut">Definición</SelectItem>
                        <SelectItem value="maintain">Mantener</SelectItem>
                        <SelectItem value="bulk">Volumen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={calculateMacros} className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D4AF37] text-black font-bold rounded-2xl py-6">
                  Calcular Macros
                </Button>

                {macroResults && (
                  <div className="grid grid-cols-4 gap-3 pt-4">
                    {[
                      { label: 'Calorías', value: macroResults.calories, color: 'from-orange-500/20' },
                      { label: 'Proteína', value: `${macroResults.protein}g`, color: 'from-blue-500/20' },
                      { label: 'Carbos', value: `${macroResults.carbs}g`, color: 'from-yellow-500/20' },
                      { label: 'Grasas', value: `${macroResults.fat}g`, color: 'from-purple-500/20' },
                    ].map(m => (
                      <div key={m.label} className={`bg-gradient-to-br ${m.color} to-transparent rounded-2xl p-4 border border-white/5`}>
                        <p className="text-2xl font-black text-white">{m.value}</p>
                        <p className="text-xs text-gray-500">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTICES TAB */}
          <TabsContent value="notices" className="space-y-4">
            {notices.length > 0 ? (
              notices.map(notice => (
                <Card key={notice.id} className={`bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl ${notice.priority === 'high' ? 'border-l-4 border-l-red-500' : notice.priority === 'normal' ? 'border-l-4 border-l-[#C9A24D]' : ''}`} onClick={() => markNoticeAsRead(notice.id)}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white">{notice.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${notice.priority === 'high' ? 'bg-red-500/20 text-red-400' : notice.priority === 'normal' ? 'bg-[#C9A24D]/20 text-[#C9A24D]' : 'bg-blue-500/20 text-blue-400'}`}>
                        {notice.priority === 'high' ? 'Urgente' : notice.priority === 'normal' ? 'Normal' : 'Info'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{notice.message}</p>
                    <p className="text-xs text-gray-600 mt-3">{new Date(notice.created_at).toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardContent className="py-20 text-center">
                  <Bell className="w-20 h-20 mx-auto text-[#C9A24D]/20 mb-4" />
                  <p className="text-gray-500">No tienes avisos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* Floating Chat */}
      <FloatingChat 
        userId={user.id}
        userRole="member"
        trainerId={myTrainer?.id}
        trainerName={myTrainer?.name}
      />

      <Toaster />
    </div>
  )
}
