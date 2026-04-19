'use client'

import { useState } from 'react'
import { TrendingUp, Camera as CameraIcon, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProgressPhotoUploader, ProgressPhotoGallery } from './ProgressPhotos'
import ProgressCharts from './ProgressCharts'

export function ProgressTab({ user, records, photos, chartData, loading, onAddProgress, onDeletePhoto }) {
    const [newWeight, setNewWeight] = useState('')
    const [newChest, setNewChest] = useState('')
    const [newWaist, setNewWaist] = useState('')
    const [newHips, setNewHips] = useState('')
    const [newArms, setNewArms] = useState('')
    const [newLegs, setNewLegs] = useState('')
    const [progressNotes, setProgressNotes] = useState('')
    const [showPhotoUploader, setShowPhotoUploader] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        onAddProgress({
            weight: newWeight,
            chest: newChest,
            waist: newWaist,
            hips: newHips,
            arms: newArms,
            legs: newLegs,
            notes: progressNotes
        })
        // Reset form
        setNewWeight(''); setNewChest(''); setNewWaist(''); setNewHips(''); setNewArms(''); setNewLegs(''); setProgressNotes('')
    }

    return (
        <div className="space-y-4">
            {/* Charts */}
            <ProgressCharts chartData={chartData} />

            {/* Formulario de registro */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-violet-500" />
                        Registrar Progreso
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-gray-400">Peso (kg)</Label>
                                <Input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Pecho (cm)</Label>
                                <Input type="number" step="0.1" value={newChest} onChange={e => setNewChest(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Cintura (cm)</Label>
                                <Input type="number" step="0.1" value={newWaist} onChange={e => setNewWaist(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Cadera (cm)</Label>
                                <Input type="number" step="0.1" value={newHips} onChange={e => setNewHips(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Brazo (cm)</Label>
                                <Input type="number" step="0.1" value={newArms} onChange={e => setNewArms(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Muslo (cm)</Label>
                                <Input type="number" step="0.1" value={newLegs} onChange={e => setNewLegs(e.target.value)} className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Notas</Label>
                            <Textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} placeholder="¿Cómo te has sentido esta semana?" className="bg-black/50 border-[#2a2a2a] rounded-xl text-white" />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-violet-500 text-black font-bold rounded-xl py-6">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Registro'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Fotos de progreso */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                        <CameraIcon className="w-5 h-5 text-violet-500" />
                        Fotos de Progreso
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setShowPhotoUploader(!showPhotoUploader)} className="rounded-xl border-[#2a2a2a] text-gray-400">
                        {showPhotoUploader ? 'Cancelar' : 'Añadir Foto'}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {showPhotoUploader && (
                        <div className="mb-6">
                            <ProgressPhotoUploader 
                                memberId={user.id} 
                                onSuccess={() => {
                                    setShowPhotoUploader(false)
                                    // El componente padre debería refrescar las fotos si es necesario
                                }} 
                                onCancel={() => setShowPhotoUploader(false)}
                            />
                        </div>
                    )}
                    <ProgressPhotoGallery photos={photos} onDelete={onDeletePhoto} />
                </CardContent>
            </Card>

            {/* Historial de medidas */}
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardHeader>
                    <CardTitle className="text-white">Historial de Medidas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {records.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-[#2a2a2a]">
                                <div>
                                    <p className="text-white font-bold">{new Date(r.date).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-500">Peso: {r.weight_kg}kg</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-violet-400">Cintura: {r.waist_cm}cm</p>
                                    <p className="text-xs text-gray-500">Cadera: {r.hips_cm}cm</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
