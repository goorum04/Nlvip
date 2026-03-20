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
  Flag, Sparkles, Flame, Target, Zap, Star, ShoppingBag,
  Camera, Video, Image as ImageIcon, Loader2, Trophy, BarChart3, UtensilsCrossed, Footprints, Lock, Gift, Sun, Calendar
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import FloatingChat from './FloatingChat'
import ImageUploader from './ImageUploader'
import VideoPlayer, { VideoCard } from './VideoPlayer'
import { ProgressPhotoUploader, ProgressPhotoGallery } from './ProgressPhotos'
import { useFileUpload, useSignedUrl, generateFileId, getFileExtension } from '@/hooks/useStorage'
import { ChallengesSection, BadgesGallery } from './ChallengesBadges'
import ProgressCharts from './ProgressCharts'
import { MemberRecipePlan } from './RecipePlan'
import { RecipesGallery } from './RecipesManager'
import ActivityTracker from './ActivityTracker'
import FoodTracker from './FoodTracker'
import { AvatarBubble, ProfileModal } from './UserProfile'
import { CycleModule } from './CycleModule'
import { LifeStageSelector, PregnancyMode, PostpartumMode, LactationTracker } from './LifeStageModules'
import { DietOnboardingBanner } from './DietOnboardingForm'
import { DietDailyView, DietWeeklyView } from './DietTabParts'

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
  const [pendingOnboarding, setPendingOnboarding] = useState(null)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [dietViewMode, setDietViewMode] = useState('daily')
  const [myTrainer, setMyTrainer] = useState(null)
  const [storeProducts, setStoreProducts] = useState([])
  const [feedImageUrls, setFeedImageUrls] = useState({})
  const [pageTheme, setPageTheme] = useState('default')
  const [showProfileModal, setShowProfileModal] = useState(false)
  const { toast } = useToast()
  const { getSignedUrl } = useSignedUrl()

  // Check if user has premium access (registered with invitation code)
  const hasPremium = profile?.has_premium === true

  // Premium-only features
  const premiumFeatures = ['feed', 'badges', 'workout', 'diet', 'progress']

  // Chart data states
  const [workoutCheckins, setWorkoutCheckins] = useState([])
  const [chartData, setChartData] = useState({
    weight: [],
    workouts: [],
    adherence: { completed: 0, target: 12 },
    comparison: { current: {}, previous: {} }
  })

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
  const [newGlutes, setNewGlutes] = useState('')
  const [newCalf, setNewCalf] = useState('')
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
      loadOnboarding(),
      loadMyTrainer(),
      loadStoreProducts(),
      loadChartData()
    ])
  }

  const loadOnboarding = async () => {
    try {
      const { data } = await supabase
        .from('diet_onboarding_requests')
        .select('id, status')
        .eq('member_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()
      setPendingOnboarding(data || null)
    } catch (e) {
      console.warn('Error fetching onboarding:', e.message)
    } finally {
      setOnboardingChecked(true)
    }
  }

  const loadStoreProducts = async () => {
    try {
      // Dummy fetch to populate if needed, or just set empty if store_products doesn't exist
      const { data, error } = await supabase.from('store_products').select('*').limit(10).maybeSingle()
      if (!error && data) setStoreProducts([data]) // Safely ignore or use real table
    } catch (e) {
      console.warn('Error fetching store products:', e)
    }
  }

  const loadChartData = async () => {
    try {
      // Load workout checkins for charts
      const { data: checkins } = await supabase
        .from('workout_checkins')
        .select('*')
        .eq('member_id', user.id)
        .order('checked_in_at', { ascending: true })

      // Load progress records for weight chart
      const { data: progressData } = await supabase
        .from('progress_records')
        .select('*')
        .eq('member_id', user.id)
        .order('date', { ascending: true })

      // Transform weight data
      const weightData = (progressData || []).map(p => ({
        date: new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        weight: p.weight_kg
      }))

      // Transform workout data by week
      const workoutsByWeek = {}
      const now = new Date()
      ;(checkins || []).forEach(c => {
        const date = new Date(c.checked_in_at)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        workoutsByWeek[weekKey] = (workoutsByWeek[weekKey] || 0) + 1
      })

      const workoutsData = Object.entries(workoutsByWeek).map(([week, workouts]) => ({
        week,
        workouts,
        date: new Date()
      })).slice(-8)

      // Calculate adherence (current month)
      const currentMonth = now.getMonth()
      const currentMonthCheckins = (checkins || []).filter(c => 
        new Date(c.checked_in_at).getMonth() === currentMonth
      ).length

      // Calculate previous month data
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
      const prevMonthCheckins = (checkins || []).filter(c => 
        new Date(c.checked_in_at).getMonth() === prevMonth
      )

      const currentMonthDuration = (checkins || [])
        .filter(c => new Date(c.checked_in_at).getMonth() === currentMonth)
        .reduce((acc, c) => acc + (c.duration_minutes || 0), 0)

      const prevMonthDuration = prevMonthCheckins.reduce((acc, c) => acc + (c.duration_minutes || 0), 0)

      // Count active days
      const currentActiveDays = new Set((checkins || [])
        .filter(c => new Date(c.checked_in_at).getMonth() === currentMonth)
        .map(c => new Date(c.checked_in_at).toDateString())
      ).size

      const prevActiveDays = new Set(prevMonthCheckins
        .map(c => new Date(c.checked_in_at).toDateString())
      ).size

      setChartData({
        weight: weightData,
        workouts: workoutsData,
        adherence: { completed: currentMonthCheckins, target: 12 },
        comparison: {
          current: { workouts: currentMonthCheckins, duration: currentMonthDuration, activeDays: currentActiveDays },
          previous: { workouts: prevMonthCheckins.length, duration: prevMonthDuration, activeDays: prevActiveDays }
        }
      })
    } catch (error) {
      console.error('Error loading chart data:', error)
    }
  }

  const loadMyTrainer = async () => {
    try {
      const { data, error } = await supabase
        .from('trainer_members')
        .select(`trainer:profiles!trainer_members_trainer_id_fkey(id, name, email)`)
        .eq('member_id', user.id)
        .maybeSingle()
      
      if (error) throw error
      if (data) setMyTrainer(data.trainer)
    } catch (error) {
      console.error('Error loading trainer:', error)
    }
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

  const isLikedByMe = (post) => post.feed_likes?.some(like => like.user_id === user.id)

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
        glutes_cm: parseFloat(newGlutes) || null,
        calves_cm: parseFloat(newCalf) || null,
        notes: progressNotes
      }])
      if (error) throw error
      toast({ title: '¡Progreso registrado!' })
      setNewWeight(''); setNewChest(''); setNewWaist(''); setNewHips(''); setNewArms(''); setNewLegs(''); setNewGlutes(''); setNewCalf(''); setProgressNotes('')
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

  const getThemeClasses = () => {
    switch (pageTheme) {
      case 'menstrual': return 'theme-menstrual'
      case 'follicular': return 'theme-follicular'
      case 'ovulation': return 'theme-ovulation'
      case 'luteal': return 'theme-luteal'
      case 'pregnant': return 'theme-pregnant'
      case 'postpartum': return 'theme-postpartum'
      case 'lactating': return 'theme-lactating'
      default: return 'theme-default'
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0B0B0B] to-[#0a0a0a] transition-colors duration-700 ${getThemeClasses()}`}>
      {/* Navbar Estática */}
      <header className="sticky top-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-violet-500/5 header-gradient opacity-50" />
        
        <div className="relative container mx-auto px-4 pt-12 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo-nl-vip.jpg" 
                alt="NL VIP TEAM" 
                className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-violet-500/20"
              />
              <div>
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-500 tracking-tight">NL VIP TEAM</h1>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Premium Fitness</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AvatarBubble 
                profile={profile} 
                size="md" 
                onClick={() => setShowProfileModal(true)} 
              />
              <Button variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-400/10" onClick={onLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero / Welcome Section (Este sí hace scroll) */}
      <div className="relative overflow-hidden pt-4 pb-4">
        <div className="absolute top-0 left-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="container mx-auto px-4">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-3xl font-black text-black shadow-xl shadow-violet-500/30 overflow-hidden">
              {profile.avatar_url ? (
                <AvatarBubble profile={profile} size="xl" onClick={() => setShowProfileModal(true)} />
              ) : (
                profile.name?.charAt(0)
              )}
            </div>
            <div className="pb-1">
              <p className="text-gray-400 text-sm font-medium">Bienvenido de vuelta,</p>
              <h2 className="text-3xl font-black text-white">{profile.name?.split(' ')[0]}</h2>
              <div className="flex items-center gap-2 mt-1">
                {hasPremium ? (
                  <>
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="text-sm text-violet-500 font-bold uppercase tracking-wider">Socio VIP</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">Cuenta Básica</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        user={user}
        profile={profile}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={(updatedProfile) => {
          window.location.reload()
        }}
        onLogout={onLogout}
      />

      <main className="container mx-auto px-4 py-6">
        <Tabs 
          defaultValue="activity" 
          className="space-y-6"
          onValueChange={(val) => {
            if (val !== 'bienestar') setPageTheme('default')
          }}
        >
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="inline-flex gap-2 bg-transparent p-0 min-w-max">
              {[
                { value: 'activity', icon: Footprints, label: 'Actividad', premium: false },
                profile?.sex === 'female' ? { value: 'bienestar', icon: Heart, label: 'Bienestar', premium: false } : null,
                { value: 'feed', icon: Home, label: 'Feed', premium: true },
                { value: 'challenges', icon: Target, label: 'Retos', premium: false },
                { value: 'badges', icon: Trophy, label: 'Logros', premium: true },
                { value: 'workout', icon: Dumbbell, label: 'Rutina', premium: true },
                { value: 'diet', icon: Apple, label: 'Dieta', premium: true },
                { value: 'recipes', icon: UtensilsCrossed, label: 'Recetas', premium: false },
                { value: 'stats', icon: BarChart3, label: 'Estadísticas', premium: false },
                { value: 'progress', icon: TrendingUp, label: 'Progreso', premium: true },
                { value: 'notices', icon: Bell, label: 'Avisos', badge: unreadNotices, premium: false }
              ].filter(Boolean).map(tab => {
                const isLocked = tab.premium && !hasPremium
                return (
                  <TabsTrigger 
                    key={tab.value}
                    value={isLocked ? 'locked' : tab.value}
                    disabled={isLocked}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault()
                        toast({
                          title: '🔒 Función Premium',
                          description: 'Necesitas un código de invitación para acceder a esta función.',
                        })
                      }
                    }}
                    className={`relative px-4 py-2.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-cyan-500 data-[state=active]:text-black data-[state=active]:border-transparent data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/20 transition-all duration-300 ${isLocked ? 'opacity-50' : ''}`}
                  >
                    {isLocked ? <Lock className="w-4 h-4 mr-2" /> : <tab.icon className="w-4 h-4 mr-2" />}
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                    )}
                  </TabsTrigger>
                )
              })}
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
                    className="bg-black/50 border-[#2a2a2a] text-white rounded-2xl min-h-[80px] resize-none focus:border-violet-500 placeholder:text-gray-500"
                  />
                  <ImageUploader
                    onImageSelect={setPostImage}
                    onImageRemove={() => setPostImage(null)}
                    disabled={loading || uploading}
                  />
                  <Button 
                    type="submit" 
                    disabled={loading || uploading || (!newPostContent.trim() && !postImage)} 
                    className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 hover:opacity-90 text-black font-bold rounded-2xl py-6 shadow-lg shadow-violet-500/20"
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
              <Card key={post.id} className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden hover:border-violet-500/30 transition-all duration-300">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 flex items-center justify-center text-violet-500 font-bold border border-violet-500/20">
                      {post.author?.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white">{post.author?.name}</p>
                      <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl text-gray-500 hover:text-violet-500" onClick={() => handleReportPost(post.id)}>
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
                    <Button variant="ghost" size="sm" className={`rounded-xl ${isLikedByMe(post) ? 'text-violet-500' : 'text-gray-400'} hover:text-violet-500`} onClick={() => handleLikePost(post.id)}>
                      <Heart className="w-5 h-5 mr-2" fill={isLikedByMe(post) ? 'currentColor' : 'none'} />
                      {post.feed_likes?.length || 0}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl text-gray-400 hover:text-violet-500" onClick={() => setCommentingPost(commentingPost === post.id ? null : post.id)}>
                      <MessageCircle className="w-5 h-5 mr-2" />
                      {post.feed_comments?.length || 0}
                    </Button>
                  </div>
                  {post.feed_comments?.length > 0 && (
                    <div className="mt-4 space-y-2 pl-4 border-l-2 border-violet-500/20">
                      {post.feed_comments.slice(0, 3).map((c) => (
                        <p key={c.id} className="text-sm"><span className="text-violet-500 font-semibold">{c.commenter?.name}</span> <span className="text-gray-300">{c.content}</span></p>
                      ))}
                    </div>
                  )}
                  {commentingPost === post.id && (
                    <div className="mt-4 flex gap-2">
                      <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Comenta..." className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                      <Button onClick={() => handleComment(post.id)} className="bg-violet-500 text-black rounded-xl px-4">Enviar</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ACTIVITY TAB - Step Counter */}
          <TabsContent value="activity" className="space-y-4">
            {profile?.sex === 'female' && (
              <CycleModule 
                user={user} 
                profile={profile} 
                variant="compact" 
                onProfileUpdate={() => window.location.reload()} 
              />
            )}
            <ActivityTracker userId={user.id} />
          </TabsContent>

            {/* Bienestar Femenino (Strictly female) */}
            {profile?.sex === 'female' && (
            <TabsContent value="bienestar" className="space-y-4 pb-32">
              <LifeStageSelector userId={user.id} profile={profile} onUpdate={() => window.location.reload()} />
              {(!profile?.life_stage || profile.life_stage === 'cycle') && (
                <CycleModule user={user} profile={profile} variant="full" onProfileUpdate={() => window.location.reload()} onThemeChange={setPageTheme} />
              )}
              {profile?.life_stage === 'pregnant' && <PregnancyMode userId={user.id} profile={profile} onUpdate={() => window.location.reload()} onThemeChange={setPageTheme} />}
              {profile?.life_stage === 'postpartum' && <PostpartumMode userId={user.id} profile={profile} onUpdate={() => window.location.reload()} onThemeChange={setPageTheme} />}
              {profile?.life_stage === 'lactating' && (
                <>
                  <LactationTracker userId={user.id} onThemeChange={setPageTheme} />
                  <PostpartumMode userId={user.id} profile={profile} onUpdate={() => window.location.reload()} onThemeChange={setPageTheme} />
                </>
              )}
            </TabsContent>
          )}

          {/* CHALLENGES TAB */}
          <TabsContent value="challenges" className="space-y-4">
            <ChallengesSection userId={user.id} />
          </TabsContent>

          {/* BADGES TAB */}
          <TabsContent value="badges" className="space-y-4">
            <BadgesGallery userId={user.id} />
          </TabsContent>

          {/* WORKOUT TAB */}
          <TabsContent value="workout" className="space-y-4">
            {myWorkout ? (
              <>
                <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-violet-500/30 to-violet-500/5 flex items-center justify-center">
                    <Dumbbell className="w-20 h-20 text-violet-500/30" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-3">
                      <Flame className="w-6 h-6 text-violet-500" />
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
                        <Video className="w-5 h-5 text-violet-500" />
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
                  <Dumbbell className="w-20 h-20 mx-auto text-violet-500/20 mb-4" />
                  <p className="text-gray-500">Tu entrenador aún no te ha asignado una rutina</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DIET TAB */}
          <TabsContent value="diet" className="space-y-6">
            {onboardingChecked && pendingOnboarding && (
              <DietOnboardingBanner
                requestId={pendingOnboarding.id}
                memberId={user.id}
                onCompleted={() => {
                  setPendingOnboarding(null)
                  loadData()
                }}
              />
            )}

            {myDiet ? (
              <div className="space-y-6">
                {/* Header with Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-600/20 flex items-center justify-center">
                      <Apple className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold leading-none">{myDiet.diet?.name}</h3>
                      <p className="text-gray-500 text-xs mt-1">Asignada el {new Date(myDiet.assigned_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 w-full sm:w-auto">
                    <button
                      onClick={() => setDietViewMode('daily')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        dietViewMode === 'daily' 
                          ? 'bg-violet-600 text-white shadow-lg' 
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      DIARIO
                    </button>
                    <button
                      onClick={() => setDietViewMode('weekly')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        dietViewMode === 'weekly' 
                          ? 'bg-violet-600 text-white shadow-lg' 
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      SEMANAL
                    </button>
                  </div>
                </div>

                {dietViewMode === 'daily' ? (
                  <div className="space-y-8">
                    {/* Compact Macros for Daily */}
                    <div className="grid grid-cols-4 gap-2 sm:gap-4">
                      {[
                        { label: 'Kcal', value: myDiet.diet?.calories, color: 'text-orange-400' },
                        { label: 'Prot', value: myDiet.diet?.protein_g ? `${myDiet.diet.protein_g}g` : '-', color: 'text-blue-400' },
                        { label: 'Carbs', value: myDiet.diet?.carbs_g ? `${myDiet.diet.carbs_g}g` : '-', color: 'text-amber-400' },
                        { label: 'Grasas', value: myDiet.diet?.fat_g ? `${myDiet.diet.fat_g}g` : '-', color: 'text-purple-400' },
                      ].map(m => (
                        <div key={m.label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 text-center">
                          <p className={`text-lg sm:text-2xl font-black ${m.color}`}>{m.value}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter sm:tracking-normal">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Timeline */}
                    <div className="bg-white/[0.01] rounded-[2.5rem] p-6 sm:p-8 border border-white/[0.03]">
                      <DietDailyView content={myDiet.diet?.content} />
                    </div>

                    {/* Today's Recipe part is already inside MemberRecipePlan which we show below */}
                    <MemberRecipePlan userId={user.id} />
                  </div>
                ) : (
                  <div className="space-y-8">
                    <MemberRecipePlan userId={user.id} forceFullWeek={true} />
                    
                    <DietWeeklyView 
                      content={myDiet.diet?.content}
                      calories={myDiet.diet?.calories}
                      protein={myDiet.diet?.protein_g}
                      carbs={myDiet.diet?.carbs_g}
                      fat={myDiet.diet?.fat_g}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardContent className="py-20 text-center">
                  <Apple className="w-20 h-20 mx-auto text-violet-500/20 mb-4" />
                  <p className="text-gray-500">Tu entrenador aún no te ha asignado una dieta</p>
                </CardContent>
              </Card>
            )}

            {/* FOOD TRACKER is always useful in daily context, but we keep it below the main diet logic */}
            {dietViewMode === 'daily' && <FoodTracker userId={user.id} />}
          </TabsContent>

          {/* RECIPES TAB - Browse all recipes */}
          <TabsContent value="recipes" className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-violet-500" />
                  Catálogo de Recetas
                </CardTitle>
                <CardDescription className="text-gray-500">
                  Explora todas las recetas saludables disponibles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecipesGallery />
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS TAB - Advanced Charts */}
          <TabsContent value="stats" className="space-y-4">
            <ProgressCharts 
              weightData={chartData.weight}
              workoutsData={chartData.workouts}
              adherenceData={chartData.adherence}
              comparisonData={chartData.comparison}
            />
          </TabsContent>

          {/* PROGRESS TAB */}
          <TabsContent value="progress" className="space-y-4">
            {/* Photos Section */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-violet-500" />
                    Fotos de Progreso
                  </CardTitle>
                  {!showPhotoUploader && (
                    <Button
                      onClick={() => setShowPhotoUploader(true)}
                      className="bg-gradient-to-r from-violet-500 to-cyan-500 text-black rounded-xl"
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
                  <TrendingUp className="w-5 h-5 text-violet-500" />
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
                      { label: 'Glúteo (cm)', value: newGlutes, setter: setNewGlutes },
                      { label: 'Gemelo (cm)', value: newCalf, setter: setNewCalf },
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
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 text-black font-bold rounded-2xl py-6">
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
                        <p className="text-violet-500 font-semibold">{new Date(r.date).toLocaleDateString()}</p>
                        {r.weight_kg && <p className="text-2xl font-black text-white">{r.weight_kg} kg</p>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        {r.chest_cm && <span>Pecho: {r.chest_cm}cm</span>}
                        {r.waist_cm && <span>Cintura: {r.waist_cm}cm</span>}
                        {r.hips_cm && <span>Cadera: {r.hips_cm}cm</span>}
                        {r.glutes_cm && <span>Glúteo: {r.glutes_cm}cm</span>}
                        {r.calves_cm && <span>Gemelo: {r.calves_cm}cm</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* NOTICES TAB */}
          <TabsContent value="notices" className="space-y-4">
            {notices.length > 0 ? (
              notices.map(notice => (
                <Card key={notice.id} className={`bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl ${notice.priority === 'high' ? 'border-l-4 border-l-red-500' : notice.priority === 'normal' ? 'border-l-4 border-l-violet-500' : ''}`} onClick={() => markNoticeAsRead(notice.id)}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white">{notice.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${notice.priority === 'high' ? 'bg-red-500/20 text-red-400' : notice.priority === 'normal' ? 'bg-violet-500/20 text-violet-500' : 'bg-blue-500/20 text-blue-400'}`}>
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
                  <Bell className="w-20 h-20 mx-auto text-violet-500/20 mb-4" />
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
