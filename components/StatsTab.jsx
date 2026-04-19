'use client'

import { ChartBar as BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ProgressCharts from './ProgressCharts'

export function StatsTab({ chartData }) {
    return (
        <div className="space-y-4">
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-violet-500" />
                        Estadísticas Detalladas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ProgressCharts chartData={chartData} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-black/40 border-[#2a2a2a] rounded-3xl p-5">
                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2">Entrenamientos Mes</p>
                    <p className="text-3xl font-black text-white">{chartData.comparison.current.workouts}</p>
                    <p className="text-xs text-violet-400 mt-1">vs {chartData.comparison.previous.workouts} mes ant.</p>
                </Card>
                <Card className="bg-black/40 border-[#2a2a2a] rounded-3xl p-5">
                    <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-2">Días Activos Mes</p>
                    <p className="text-3xl font-black text-white">{chartData.comparison.current.activeDays}</p>
                    <p className="text-xs text-violet-400 mt-1">vs {chartData.comparison.previous.activeDays} mes ant.</p>
                </Card>
            </div>
        </div>
    )
}
