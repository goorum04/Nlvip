'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import {
  Home, Dumbbell, Apple, TrendingUp, Bell, Plus, Heart,
  Target, Trophy, BarChart3, UtensilsCrossed, Footprints, Lock
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Components
import FloatingChat from './FloatingChat'
import { ProfileModal } from './UserProfile'
import { useFileUpload, useSignedUrl } from '@/hooks/useStorage'
import { CycleModule } from './CycleModule'
import { LifeStageSelector, PregnancyMode, PostpartumMode, LactationTracker } from './LifeStageModules'
import ActivityTracker from './ActivityTracker'
import { RecipesGallery } from './RecipesManager'
import { ChallengesSection, BadgesGallery } from './ChallengesBadges'

// Refactored Tabs
import { DashboardHeader } from './DashboardHeader'
import { SupportDrawer } from './SupportDrawer'
import { FeedTab } from './FeedTab'
import { WorkoutTab } from './WorkoutTab'
import { DietTab } from './DietTab'
import { ProgressTab } from './ProgressTab'
import { StatsTab } from './StatsTab'
import { NoticesTab } from './NoticesTab'

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
  const [feedImageUrls, setFeedImageUrls] = useState({})
  const [localProfile, setLocalProfile] = useState(profile)
  const [activeTab, setActiveTab] = useState('activity')
  const [pageTheme, setPageTheme] = useState('default')
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)

  const [chartData, setChartData] = useState({
    weight: [],
    workouts: [],
    adherence: { completed: 0, target: 12 },
    comparison: { current: { workouts: 0, duration: 0, activeDays: 0 }, previous: { workouts: 0, duration: 0, activeDays: 0 } }
  })

  const { toast } = useToast()
  const { getSignedUrl } = useSignedUrl()
  const { uploadFile, uploading, progress } = useFileUpload()

  const hasPremium = localProfile?.has_premium === true

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadFeed().catch(e => console.error('Error loading feed:', e)),
        loadMyWorkout().catch(e => console.error('Error loading workout:', e)),
        loadMyDiet().catch(e => console.error('Error loading diet:', e)),
        loadProgress().catch(e => console.error('Error loading progress:', e)),
        loadProgressPhotos().catch(e => console.error('Error loading photos:', e)),
        loadNotices().catch(e => console.error('Error loading notices:', e)),
        loadMyTrainer().catch(e => console.error('Error loading trainer:', e)),
        loadChartData().catch(e => console.error('Error loading chart data:', e))
      ])
    } catch (err) {
      console.error('Fatal error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadChartData = async () => {
    try {
      const [{ data: checkins }, { data: progressData }] = await Promise.all([
        supabase.from('workout_checkins').select('*').eq('member_id', user.id).order('checked_in_at', { ascending: true }),
        supabase.from('progress_records').select('*').eq('member_id', user.id).order('date', { ascending: true })
      ])

      const now = new Date()
      const currentMonth = now.getMonth()
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1

      // Weight data with safety checks
      const weightData = (progressData || []).map(p => {
        const d = new Date(p.date)
        const dateLabel = isNaN(d.getTime()) ? '---' : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        return {
          date: dateLabel,
          weight: p.weight_kg
        }
      }).filter(item => item.date !== '---')

      // Stats calculations
      const currentMonthCheckins = (checkins || []).filter(c => {
        const d = new Date(c.checked_in_at)
        return !isNaN(d.getTime()) && d.getMonth() === currentMonth
      })

      const prevMonthCheckins = (checkins || []).filter(c => {
        const d = new Date(c.checked_in_at)
        return !isNaN(d.getTime()) && d.getMonth() === prevMonth
      })

      const currentActiveDays = new Set(currentMonthCheckins.map(c => new Date(c.checked_in_at).toDateString())).size
      const prevActiveDays = new Set(prevMonthCheckins.map(c => new Date(c.checked_in_at).toDateString())).size

      setChartData({
        weight: weightData,
        workouts: [],
        adherence: { completed: currentMonthCheckins.length, target: 12 },
        comparison: {
          current: { workouts: currentMonthCheckins.length, activeDays: currentActiveDays },
          previous: { workouts: prevMonthCheckins.length, activeDays: prevActiveDays }
        }
      })
    } catch (e) {
      console.error('Chart Data Error:', e)
    }
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
      const { data: videos } = await supabase.from('workout_videos').select('*').eq('workout_template_id', data.workout.id).order('created_at')
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
    const { data } = await supabase.from('progress_records').select('*').eq('member_id', user.id).order('date', { ascending: false }).limit(20)
    if (data) setProgressRecords(data)
  }

  const loadProgressPhotos = async () => {
    const { data } = await supabase.from('progress_photos').select('*').eq('member_id', user.id).order('date', { ascending: false })
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

  const handleLikePost = async (postId) => {
    const { data: existingLike } = await supabase.from('feed_likes').select('id').eq('post_id', postId).eq('user_id', user.id).single()
    if (existingLike) {
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    } else {
      await supabase.from('feed_likes').insert([{ post_id: postId, user_id: user.id }])
    }
    loadFeed()
  }

  const handleComment = async (postId, content) => {
    if (!content.trim()) return
    const { error } = await supabase.from('feed_comments').insert([{ post_id: postId, commenter_id: user.id, content }])
    if (!error) loadFeed()
  }

  const handleReportPost = async (postId) => {
    await supabase.from('feed_reports').insert([{ post_id: postId, reporter_id: user.id, reason: 'Contenido inapropiado' }])
    toast({ title: 'Post reportado', description: 'El administrador lo revisar├í' })
  }

  const handleAddProgress = async (formData) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('progress_records').insert([{
        member_id: user.id,
        date: new Date().toISOString(),
        weight_kg: parseFloat(formData.weight) || null,
        chest_cm: parseFloat(formData.chest) || null,
        waist_cm: parseFloat(formData.waist) || null,
        hips_cm: parseFloat(formData.hips) || null,
        arms_cm: parseFloat(formData.arms) || null,
        legs_cm: parseFloat(formData.legs) || null,
        notes: formData.notes
      }])
      if (error) throw error
      toast({ title: '┬íProgreso registrado!' })
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
      default: return ''
    }
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0B0B0B] to-[#0a0a0a] transition-colors duration-700 ${getThemeClasses()}`}>
      <DashboardHeader
        profile={localProfile}
        hasPremium={hasPremium}
        onLogout={onLogout}
        onProfileClick={() => setShowProfileModal(true)}
      />

      <ProfileModal
        user={user}
        profile={localProfile}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={setLocalProfile}
        onLogout={onLogout}
      />

      <main className="container mx-auto px-4 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val)
            if (val !== 'bienestar') setPageTheme('default')
          }}
          className="space-y-6"
        >
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="inline-flex gap-2 bg-transparent p-0 min-w-max">
              {[
                { value: 'activity', icon: Footprints, label: 'Actividad', premium: false },
                localProfile?.sex === 'female' ? { value: 'bienestar', icon: Heart, label: 'Bienestar', premium: false } : null,
                { value: 'feed', icon: Home, label: 'Feed', premium: true },
                { value: 'challenges', icon: Target, label: 'Retos', premium: false },
                { value: 'badges', icon: Trophy, label: 'Logros', premium: true },
                { value: 'workout', icon: Dumbbell, label: 'Rutina', premium: true },
                { value: 'diet', icon: Apple, label: 'Dieta', premium: true },
                { value: 'recipes', icon: UtensilsCrossed, label: 'Recetas', premium: false },
                { value: 'stats', icon: BarChart3, label: 'Estad├¡sticas', premium: false },
                { value: 'progress', icon: TrendingUp, label: 'Progreso', premium: true },
                { value: 'notices', icon: Bell, label: 'Avisos', badge: unreadNotices, premium: false }
              ].filter(Boolean).map(tab => {
                const isLocked = tab.premium && !hasPremium
                const value = isLocked ? 'locked' : tab.value

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={value}
                    disabled={isLocked}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault()
                        toast({ title: '­ƒöÆ Funci├│n Premium', description: 'Necesitas un c├│digo de invitaci├│n.' })
                      }
                    }}
                    className={`relative px-4 py-2.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-cyan-500 data-[state=active]:text-black transition-all duration-300 ${isLocked ? 'opacity-50' : ''}`}
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

          <TabsContent value="activity" className="space-y-4">
            <CycleModule user={user} profile={localProfile} variant="compact" onProfileUpdate={setLocalProfile} />
            <ActivityTracker userId={user.id} />
          </TabsContent>

          {localProfile?.sex === 'female' && (
            <TabsContent value="bienestar" className="space-y-4 pb-32">
              <LifeStageSelector userId={user.id} profile={localProfile} onUpdate={setLocalProfile} />
              {(!localProfile?.life_stage || localProfile.life_stage === 'cycle') && (
                <CycleModule user={user} profile={localProfile} variant="full" onProfileUpdate={setLocalProfile} onThemeChange={setPageTheme} />
              )}
              {localProfile?.life_stage === 'pregnant' && <PregnancyMode userId={user.id} profile={localProfile} onUpdate={setLocalProfile} onThemeChange={setPageTheme} />}
              {localProfile?.life_stage === 'postpartum' && <PostpartumMode userId={user.id} profile={localProfile} onUpdate={setLocalProfile} onThemeChange={setPageTheme} />}
              {localProfile?.life_stage === 'lactating' && (
                <>
                  <LactationTracker userId={user.id} onThemeChange={setPageTheme} />
                  <PostpartumMode userId={user.id} profile={localProfile} onUpdate={setLocalProfile} onThemeChange={setPageTheme} />
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="feed">
            <FeedTab
              user={user} posts={feedPosts} imageUrls={feedImageUrls}
              loading={loading} uploading={uploading} progress={progress}
              onPostCreated={loadFeed} onLike={handleLikePost} onComment={handleComment}
              onReport={handleReportPost} uploadFile={uploadFile}
            />
          </TabsContent>

          <TabsContent value="challenges"><ChallengesSection userId={user.id} /></TabsContent>
          <TabsContent value="badges"><BadgesGallery userId={user.id} /></TabsContent>

          <TabsContent value="workout">
            <WorkoutTab workout={myWorkout} videos={workoutVideos} onVideoSelect={setSelectedVideo} />
          </TabsContent>

          <TabsContent value="diet">
            <DietTab user={user} diet={myDiet} />
          </TabsContent>

          <TabsContent value="recipes"><RecipesGallery /></TabsContent>
          <TabsContent value="stats"><StatsTab chartData={chartData} /></TabsContent>

          <TabsContent value="progress">
            <ProgressTab
              user={user} records={progressRecords} photos={progressPhotos}
              chartData={chartData} loading={loading}
              onAddProgress={handleAddProgress} onDeletePhoto={handleDeletePhoto}
            />
          </TabsContent>

          <TabsContent value="notices">
            <NoticesTab notices={notices} onMarkAsRead={markNoticeAsRead} />
          </TabsContent>
        </Tabs>
      </main>

      <FloatingChat
        userId={user.id}
        userRole={localProfile?.role}
        trainerId={myTrainer?.id}
        trainerName={myTrainer?.name}
      />
      <SupportDrawer />
      <Toaster />
    </div>
  )
}
