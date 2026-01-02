import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper para obtener el usuario actual
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}

// Helper para obtener el perfil completo
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) return null
  return data
}

// Helper para verificar rol
export const checkRole = async (userId, requiredRole) => {
  const profile = await getUserProfile(userId)
  if (!profile) return false
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(profile.role)
  }
  
  return profile.role === requiredRole
}