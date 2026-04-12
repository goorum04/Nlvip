import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const authHeader = request.headers.get('Authorization')
    const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const { userId } = await request.json()

    if (!userId || !adminToken) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // 1. Verificar que el token proporcionado pertenece a un admin real
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(adminToken)
    
    if (authError || !adminUser) {
      return NextResponse.json({ error: 'Token de administrador inválido' }, { status: 401 })
    }

    // 2. Comprobar el rol de admin en la base de datos
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos de administrador' }, { status: 403 })
    }

    // 3. Obtener el perfil de la víctima para asegurar que es un socio
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!targetProfile || targetProfile.role === 'admin') {
      return NextResponse.json({ error: 'No se puede eliminar a este usuario' }, { status: 403 })
    }

    // 4. Limpiar datos relacionados de la API (para evitar romper constraints)
    
    // Primero, recopilar IDs de posts y retos creados por este usuario
    const { data: userPosts } = await supabaseAdmin.from('feed_posts').select('id').eq('author_id', userId)
    const { data: userChallenges } = await supabaseAdmin.from('challenges').select('id').eq('created_by', userId)
    
    const postIds = userPosts?.map(p => p.id) || []
    const challengeIds = userChallenges?.map(c => c.id) || []

    // Fase 1: Tablas que dependen de otras tablas dependientes (hijos de hijos)
    const phase1Promises = [
      supabaseAdmin.from('feed_comments').delete().eq('commenter_id', userId),
      supabaseAdmin.from('feed_likes').delete().eq('user_id', userId),
      supabaseAdmin.from('feed_reports').delete().eq('reporter_id', userId),
      supabaseAdmin.from('notice_reads').delete().eq('member_id', userId),
    ]

    // Limpiar dependencias DE los posts de este usuario (likes, comentarios, reportes sobre el post)
    if (postIds.length > 0) {
      phase1Promises.push(
        supabaseAdmin.from('feed_comments').delete().in('post_id', postIds),
        supabaseAdmin.from('feed_likes').delete().in('post_id', postIds),
        supabaseAdmin.from('feed_reports').delete().in('item_id', postIds)
      )
    }

    // Limpiar dependencias DE los retos de este usuario (participantes)
    if (challengeIds.length > 0) {
      phase1Promises.push(
        supabaseAdmin.from('challenge_participants').delete().in('challenge_id', challengeIds)
      )
    }

    await Promise.all(phase1Promises)

    // Fase 2: Tablas principales que referencian profiles
    await Promise.all([
      supabaseAdmin.from('member_workouts').delete().eq('member_id', userId),
      supabaseAdmin.from('member_diets').delete().eq('member_id', userId),
      supabaseAdmin.from('food_logs').delete().eq('member_id', userId),
      supabaseAdmin.from('progress_photos').delete().eq('member_id', userId),
      supabaseAdmin.from('progress_records').delete().eq('member_id', userId),
      supabaseAdmin.from('feed_posts').delete().eq('author_id', userId),
      supabaseAdmin.from('challenge_participants').delete().eq('member_id', userId),
      supabaseAdmin.from('challenges').delete().eq('created_by', userId),
      supabaseAdmin.from('diet_onboarding_requests').delete().eq('member_id', userId),
      supabaseAdmin.from('diet_onboarding_requests').delete().eq('requested_by', userId),
      supabaseAdmin.from('daily_activity').delete().eq('member_id', userId),
      supabaseAdmin.from('macro_goals').delete().eq('member_id', userId),
      supabaseAdmin.from('macro_goal_history').delete().eq('member_id', userId),
      supabaseAdmin.from('member_goals').delete().eq('member_id', userId),
      supabaseAdmin.from('member_prs').delete().eq('member_id', userId),
      supabaseAdmin.from('member_badges').delete().eq('member_id', userId),
      supabaseAdmin.from('user_badges').delete().eq('member_id', userId),
      supabaseAdmin.from('member_recipe_plans').delete().eq('member_id', userId),
      supabaseAdmin.from('workout_logs').delete().eq('member_id', userId),
      supabaseAdmin.from('workout_checkins').delete().eq('member_id', userId),
      supabaseAdmin.from('cycle_symptoms').delete().eq('user_id', userId),
      supabaseAdmin.from('lactation_sessions').delete().eq('user_id', userId),
      supabaseAdmin.from('trainer_notices').delete().eq('member_id', userId),
    ])

    // Fase 3: Datos de contenido y autoría (pueden ser muchos)
    await Promise.all([
      supabaseAdmin.from('recipes').delete().eq('created_by', userId),
      supabaseAdmin.from('recipe_catalog').delete().eq('created_by', userId),
      supabaseAdmin.from('exercises').delete().eq('created_by', userId),
      supabaseAdmin.from('workout_videos').delete().eq('uploaded_by', userId),
      supabaseAdmin.from('training_videos').delete().eq('trainer_id', userId),
      supabaseAdmin.from('training_videos').delete().eq('uploaded_by', userId),
      supabaseAdmin.from('training_videos').delete().eq('approved_by', userId),
      supabaseAdmin.from('workout_templates').delete().eq('trainer_id', userId),
      supabaseAdmin.from('diet_templates').delete().eq('trainer_id', userId),
    ])

    // Fase 4: Conversaciones y mensajes (el bloqueador principal del bug)
    // Primero recopilar IDs de cualquier conversación donde el usuario participe o haya creado
    const { data: partConvs } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)

    const { data: createdConvs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('created_by', userId)

    const uniqueConvIds = new Set([
      ...(partConvs?.map(c => c.conversation_id) || []),
      ...(createdConvs?.map(c => c.id) || [])
    ])

    if (uniqueConvIds.size > 0) {
      const convIds = Array.from(uniqueConvIds)
      
      // Limpiar IA Asistente
      await supabaseAdmin.from('admin_assistant_action_logs').delete().in('conversation_id', convIds)
      await supabaseAdmin.from('admin_assistant_messages').delete().in('conversation_id', convIds)

      // Borrar mensajes hijos
      await supabaseAdmin.from('messages').delete().in('conversation_id', convIds)
      
      // Borrar participantes hijos
      await supabaseAdmin.from('conversation_participants').delete().in('conversation_id', convIds)

      // Borrar la conversación en sí
      await supabaseAdmin.from('conversations').delete().in('id', convIds)
    }

    // Limpieza agresiva adicional de cualquier mensaje enviado o IA vinculada
    await supabaseAdmin.from('messages').delete().eq('sender_id', userId)
    await supabaseAdmin.from('admin_assistant_action_logs').delete().eq('admin_id', userId)
    await supabaseAdmin.from('admin_assistant_conversations').delete().eq('admin_id', userId)

    // Fase 5: Relaciones estructurales y metadatos huérfanos
    await Promise.all([
      supabaseAdmin.from('macro_goals').delete().eq('assigned_by', userId),
      supabaseAdmin.from('macro_goal_history').delete().eq('changed_by', userId),
      supabaseAdmin.from('trainer_members').delete().eq('member_id', userId),
      supabaseAdmin.from('trainer_members').delete().eq('trainer_id', userId),
      supabaseAdmin.from('invitation_codes').update({ used_by: null }).eq('used_by', userId),
      supabaseAdmin.from('invitation_codes').delete().eq('trainer_id', userId),
      supabaseAdmin.from('profiles').update({ trainer_id: null }).eq('trainer_id', userId),
    ])

    // 5. Eliminar el usuario de Supabase Auth (esto eliminará automáticamente Profiles si existe el CASCADE trigger)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteAuthError) {
      throw deleteAuthError
    }

    // Por seguridad, intentar eliminar el perfil por si acaso no hay CASCADE
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true, message: 'Socio eliminado permanentemente' })

  } catch (error) {
    Sentry.captureException(error, { tags: { endpoint: 'admin-delete-user' } })
    console.error('Error al intentar eliminar socio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
