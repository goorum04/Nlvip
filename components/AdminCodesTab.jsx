'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Code, Plus, Trash2, Key, Loader2,
    Calendar, Users, CheckCircle2, XCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function AdminCodesTab({
    codes,
    trainers,
    onRefresh,
    onDeleteCode
}) {
    const [selectedTrainerId, setSelectedTrainerId] = useState('all')
    const [codeMaxUses, setCodeMaxUses] = useState('10')
    const [codeExpireDays, setCodeExpireDays] = useState('30')
    const [loading, setLoading] = useState(false)

    const handleGenerateCode = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const code = Math.random().toString(36).substring(2, 10).toUpperCase()
            const expires = new Date()
            expires.setDate(expires.getDate() + parseInt(codeExpireDays))

            const { error } = await supabase.from('invitation_codes').insert([{
                code,
                trainer_id: selectedTrainerId === 'all' ? null : selectedTrainerId,
                max_uses: parseInt(codeMaxUses),
                expires_at: expires.toISOString()
            }])

            if (error) throw error
            onRefresh?.()
        } catch (error) {
            console.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Creation Card */}
                <div className="md:col-span-1">
                    <Card className="bg-[#1a1a1a] border-amber-500/20 rounded-3xl sticky top-6">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-amber-400" />
                                Generar Código
                            </CardTitle>
                            <CardDescription>Crea invitaciones para nuevos socios Premium.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleGenerateCode} className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Asignar Entrenador (Opcional)</Label>
                                    <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
                                        <SelectTrigger className="bg-black/50 border-white/10 text-white rounded-xl">
                                            <SelectValue placeholder="Cualquiera" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Cualquier Entrenador</SelectItem>
                                            {trainers.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-gray-400">Usos Máx.</Label>
                                        <Input
                                            type="number"
                                            value={codeMaxUses}
                                            onChange={e => setCodeMaxUses(e.target.value)}
                                            className="bg-black/50 border-white/10 text-white rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-400">Validez (Días)</Label>
                                        <Input
                                            type="number"
                                            value={codeExpireDays}
                                            onChange={e => setCodeExpireDays(e.target.value)}
                                            className="bg-black/50 border-white/10 text-white rounded-xl"
                                        />
                                    </div>
                                </div>
                                <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl py-6 mt-2">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'GENERAR CÓDIGO'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* List Card */}
                <div className="md:col-span-2">
                    <Card className="bg-[#1a1a1a] border-white/5 rounded-3xl overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-400" />
                                Códigos Activos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-white/5 text-gray-400 text-[10px] uppercase font-black">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Código</th>
                                            <th className="px-4 py-3 text-left">Entrenador</th>
                                            <th className="px-4 py-3 text-center">Usos</th>
                                            <th className="px-4 py-3 text-left">Expira</th>
                                            <th className="px-4 py-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {codes.map(code => (
                                            <tr key={code.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-4">
                                                    <code className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded font-bold">{code.code}</code>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="text-xs text-gray-300">{code.trainer?.name || 'Sistema'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span className="text-sm font-bold text-white">{code.uses_count || 0}</span>
                                                        <span className="text-gray-600 text-xs">/ {code.max_uses}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="text-[10px] text-gray-500">
                                                        {new Date(code.expires_at).toLocaleDateString()}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onDeleteCode?.(code.id)}
                                                        className="text-gray-700 hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {codes.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-4 py-12 text-center text-gray-600 italic">No hay códigos generados</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
