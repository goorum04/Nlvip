'use client'

import { Dumbbell, Flame, Video } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VideoCard } from './VideoPlayer'

export function WorkoutTab({ workout, videos, onVideoSelect }) {
    return (
        <div className="space-y-4">
            {workout ? (
                <>
                    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl overflow-hidden">
                        <div className="h-32 bg-gradient-to-br from-violet-500/30 to-violet-500/5 flex items-center justify-center">
                            <Dumbbell className="w-20 h-20 text-violet-500/30" />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-2xl text-white flex items-center gap-3">
                                <Flame className="w-6 h-6 text-violet-500" />
                                {workout.workout?.name}
                            </CardTitle>
                            <CardDescription className="text-gray-500">
                                Asignada el {new Date(workout.assigned_at).toLocaleDateString()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-black/30 rounded-2xl p-5 border border-[#2a2a2a]">
                                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {workout.workout?.description}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {videos.length > 0 && (
                        <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Video className="w-5 h-5 text-violet-500" />
                                    Vídeos de la Rutina ({videos.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-3">
                                    {videos.map(video => (
                                        <VideoCard
                                            key={video.id}
                                            video={video}
                                            onClick={() => onVideoSelect(video)}
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
        </div>
    )
}
