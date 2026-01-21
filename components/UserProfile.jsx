'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { User, Camera, Save, Trash2, Loader2, X, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Avatar Bubble Component - Para mostrar en el header
export function AvatarBubble({ profile, size = 'md', onClick }) {
  const [imageUrl, setImageUrl] = useState(null)
  
  useEffect(() => {
    if (profile?.avatar_url) {
      loadAvatarUrl()
    }
  }, [profile?.avatar_url])

  const loadAvatarUrl = async () => {
    if (!profile?.avatar_url) return
    
    // Si es una URL completa, usarla directamente
    if (profile.avatar_url.startsWith('http')) {
      setImageUrl(profile.avatar_url)
      return
    }
    
    // Si es un path de Supabase, obtener URL firmada
    const { data } = await supabase.storage
      .from('avatars')
      .createSignedUrl(profile.avatar_url, 3600)
    
    if (data?.signedUrl) {
      setImageUrl(data.signedUrl)
    }
  }

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl'
  }

  const initial = profile?.name?.charAt(0)?.toUpperCase() || '?'

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all hover:scale-105 cursor-pointer border-2 border-white/20`}
    >
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={profile?.name || 'Avatar'}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </button>
  )
}

// Profile Modal Component
export function ProfileModal({ user, profile, isOpen, onClose, onProfileUpdate, onLogout }) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  // Form states
  const [name, setName] = useState(profile?.name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setPhone(profile.phone || '')
      setBirthDate(profile.birth_date || '')
      setAvatarUrl(profile.avatar_url || '')
      loadAvatarPreview()
    }
  }, [profile])

  const loadAvatarPreview = async () => {
    if (!profile?.avatar_url) {
      setPreviewUrl(null)
      return
    }
    
    if (profile.avatar_url.startsWith('http')) {
      setPreviewUrl(profile.avatar_url)
      return
    }
    
    const { data } = await supabase.storage
      .from('avatars')
      .createSignedUrl(profile.avatar_url, 3600)
    
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo y tamaño
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Solo se permiten imágenes', variant: 'destructive' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'La imagen no puede superar 2MB', variant: 'destructive' })
      return
    }

    setUploading(true)
    try {
      // Generar nombre único
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${ext}`

      // Subir a Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      setAvatarUrl(fileName)
      
      // Crear preview local
      const reader = new FileReader()
      reader.onload = (e) => setPreviewUrl(e.target.result)
      reader.readAsDataURL(file)

      toast({ title: '¡Foto subida!' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast({ title: '¡Perfil actualizado!' })
      
      // Notificar al componente padre para recargar el perfil
      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          name: name.trim(),
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          avatar_url: avatarUrl || null
        })
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast({ title: 'Error', description: 'Introduce tu contraseña para confirmar', variant: 'destructive' })
      return
    }

    setDeleting(true)
    try {
      // Verificar contraseña intentando re-autenticar
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: deletePassword
      })

      if (authError) {
        throw new Error('Contraseña incorrecta')
      }

      // Eliminar datos relacionados del usuario
      // El orden importa por las foreign keys
      
      // 1. Eliminar fotos de progreso
      await supabase.from('progress_photos').delete().eq('member_id', user.id)
      
      // 2. Eliminar registros de progreso
      await supabase.from('progress_records').delete().eq('member_id', user.id)
      
      // 3. Eliminar participaciones en retos
      await supabase.from('challenge_participants').delete().eq('member_id', user.id)
      
      // 4. Eliminar likes del feed
      await supabase.from('feed_likes').delete().eq('user_id', user.id)
      
      // 5. Eliminar comentarios del feed
      await supabase.from('feed_comments').delete().eq('commenter_id', user.id)
      
      // 6. Eliminar posts del feed
      await supabase.from('feed_posts').delete().eq('author_id', user.id)
      
      // 7. Eliminar asignaciones de dieta
      await supabase.from('member_diets').delete().eq('member_id', user.id)
      
      // 8. Eliminar asignaciones de rutina
      await supabase.from('member_workouts').delete().eq('member_id', user.id)
      
      // 9. Eliminar relación trainer-member
      await supabase.from('trainer_members').delete().eq('member_id', user.id)
      
      // 10. Eliminar actividad diaria
      await supabase.from('daily_activity').delete().eq('user_id', user.id)
      
      // 11. Eliminar food logs
      await supabase.from('food_logs').delete().eq('user_id', user.id)

      // 12. Eliminar avatar de storage si existe
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        await supabase.storage.from('avatars').remove([avatarUrl])
      }

      // 13. Eliminar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (profileError) throw profileError

      // 14. Cerrar sesión (esto también intentará eliminar el usuario de auth)
      toast({ title: 'Cuenta eliminada', description: 'Tu cuenta ha sido eliminada correctamente' })
      
      setTimeout(() => {
        onLogout()
      }, 1500)

    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
      setDeletePassword('')
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <User className="w-5 h-5 text-violet-400" />
            Mi Perfil
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Gestiona tu información personal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black text-3xl font-bold border-4 border-violet-500/30">
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{name?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-violet-400 transition-colors shadow-lg">
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500">Haz clic en el icono para cambiar la foto</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300 text-sm">Nombre completo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Email</Label>
              <Input
                value={profile?.email || ''}
                disabled
                className="bg-black/30 border-violet-500/10 rounded-xl text-gray-500 mt-1"
              />
              <p className="text-xs text-gray-600 mt-1">El email no se puede modificar</p>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Teléfono (opcional)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Fecha de nacimiento (opcional)</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="bg-black/50 border-violet-500/20 rounded-xl text-white mt-1"
              />
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveProfile}
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold rounded-xl py-5"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>
            )}
          </Button>

          {/* Delete Account Section */}
          <div className="pt-4 border-t border-red-500/20">
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar mi cuenta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1a1a1a] border-red-500/30 rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    ¿Eliminar cuenta?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    Esta acción es <span className="text-red-400 font-bold">irreversible</span>. Se eliminarán todos tus datos:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Tu perfil y foto</li>
                      <li>Registros de progreso y fotos</li>
                      <li>Posts y comentarios del feed</li>
                      <li>Participaciones en retos</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4">
                  <Label className="text-gray-300 text-sm">Introduce tu contraseña para confirmar</Label>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="bg-black/50 border-red-500/30 rounded-xl text-white mt-2"
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 rounded-xl">
                    Cancelar
                  </AlertDialogCancel>
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleting || !deletePassword}
                    className="bg-red-600 hover:bg-red-500 text-white rounded-xl"
                  >
                    {deleting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Eliminando...</>
                    ) : (
                      <><Trash2 className="w-4 h-4 mr-2" /> Eliminar Cuenta</>
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileModal
