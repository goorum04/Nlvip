'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Users, UserPlus, Shield, Trash2, Key, LoaderCircle as Loader2,
    ChevronRight, ExternalLink, Mail, Phone, Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function AdminUsersTab({
    trainers,
    members,
    onRefresh,
    onSelectMember,
    onDeleteTrainer
}) {
    const [newTrainerEmail, setNewTrainerEmail] = useState('')
    const [newTrainerPassword, setNewTrainerPassword] = useState('')
    const [newTrainerName, setNewTrainerName] = useState('')
    const [loading, setLoading] = useState(false)

    const handleCreateTrainer = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { data, error } = await supabase.auth.signUp({
                email: newTrainerEmail,
                password: newTrainerPassword,
                options: {
                    data: {
                        name: newTrainerName,
                        role: 'trainer'
                    }
                }
            })

            if (error) throw error

            // Note: role assignment usually needs a trigger or service role in Prod
            // Here we assume a trigger maps metadata to profile.role

            setNewTrainerEmail(''); setNewTrainerPassword(''); setNewTrainerName('')
            onRefresh?.()
        } catch (error) {
            console.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-[#1a1a1a] border-violet-500/20 rounded-3xl">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{members.length}</p>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Socios Activos</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#1a1a1a] border-cyan-500/20 rounded-3xl">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-white">{trainers.length}</p>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Entrenadores</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Gestión de Entrenadores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[#1a1a1a] border-white/5 rounded-3xl">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-cyan-400" />
                            Nuevo Entrenador
                        </CardTitle>
                        <CardDescription>Crea una cuenta para un nuevo miembro del equipo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateTrainer} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-gray-400">Nombre Completo</Label>
                                <Input
                                    value={newTrainerName}
                                    onChange={(e) => setNewTrainerName(e.target.value)}
                                    placeholder="Ej: Marcos Entrenador"
                                    className="bg-black/50 border-white/10 text-white rounded-xl"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Email</Label>
                                <Input
                                    type="email"
                                    value={newTrainerEmail}
                                    onChange={(e) => setNewTrainerEmail(e.target.value)}
                                    placeholder="email@nlvip.com"
                                    className="bg-black/50 border-white/10 text-white rounded-xl"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Contraseña Temporal</Label>
                                <Input
                                    type="password"
                                    value={newTrainerPassword}
                                    onChange={(e) => setNewTrainerPassword(e.target.value)}
                                    placeholder="********"
                                    className="bg-black/50 border-white/10 text-white rounded-xl"
                                    required
                                />
                            </div>
                            <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl py-6 font-bold">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Entrenador'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="bg-[#1a1a1a] border-white/5 rounded-3xl overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-violet-400" />
                            Lista de Entrenamiento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {trainers.map(t => (
                                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-black font-bold">
                                            {t.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{t.name}</p>
                                            <p className="text-xs text-gray-500">{t.email}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onDeleteTrainer?.(t.id)}
                                        className="text-gray-600 hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {trainers.length === 0 && (
                                <div className="p-8 text-center text-gray-600">No hay entrenadores registrados</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Socios */}
            <Card className="bg-[#1a1a1a] border-white/5 rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-white">Directorio de Socios</CardTitle>
                        <CardDescription>Gestiona todos los usuarios del club.</CardDescription>
                    </div>
                    <div className="bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
                        <span className="text-xs text-violet-400 font-bold">{members.length} Total</span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                        {members.map(member => (
                            <div
                                key={member.id}
                                className="p-4 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer group"
                                onClick={() => onSelectMember?.(member)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className={`w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center border ${member.has_premium ? 'border-amber-500/50' : 'border-white/10'}`}>
    <Users className={`w-5 h-5 ${member.has_premium ? 'text-amber-500' : 'text-gray-500'}`} />
</div>
{member.has_premium && (
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#1a1a1a]">
        <Key className="w-2.5 h-2.5 text-black" />
    </div>
)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white flex items-center gap-2">
                                            {member.name}
                                            {member.sex === 'female' && <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 rounded uppercase">F</span>}
                                        </h4>
                                        <p className="text-xs text-gray-500">{member.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-400">Registrado</p>
                                        <p className="text-[10px] text-gray-600">{new Date(member.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-gray-600 group-hover:text-violet-400 transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
