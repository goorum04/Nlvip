'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart 
} from 'recharts'
import { TrendingUp, TrendingDown, Dumbbell, Scale, Target, Calendar } from 'lucide-react'

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/90 border border-[#00D4FF]/30 rounded-xl p-3 shadow-lg">
        <p className="text-[#00D4FF] font-semibold text-sm">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-white text-sm">
            {entry.name}: <span className="font-bold">{entry.value}{entry.unit || ''}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Componente de gráfica de peso
export function WeightChart({ data, timeRange = '30d' }) {
  const filteredData = filterByTimeRange(data, timeRange)
  
  if (!filteredData || filteredData.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardContent className="p-6 text-center text-gray-500">
          <Scale className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay datos de peso disponibles</p>
        </CardContent>
      </Card>
    )
  }

  const firstWeight = filteredData[0]?.weight || 0
  const lastWeight = filteredData[filteredData.length - 1]?.weight || 0
  const weightChange = (lastWeight - firstWeight).toFixed(1)
  const isPositive = weightChange > 0

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#00D4FF]" />
            Evolución de Peso
          </CardTitle>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${isPositive ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {weightChange} kg
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="weight" 
                stroke="#00D4FF" 
                strokeWidth={3}
                fill="url(#weightGradient)"
                name="Peso"
                unit=" kg"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de gráfica de entrenamientos por semana
export function WorkoutsChart({ data, timeRange = '30d' }) {
  const filteredData = filterByTimeRange(data, timeRange)
  
  if (!filteredData || filteredData.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
        <CardContent className="p-6 text-center text-gray-500">
          <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No hay datos de entrenamientos disponibles</p>
        </CardContent>
      </Card>
    )
  }

  const totalWorkouts = filteredData.reduce((acc, item) => acc + (item.workouts || 0), 0)

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-[#00D4FF]" />
            Entrenamientos por Semana
          </CardTitle>
          <div className="bg-[#00D4FF]/20 text-[#00D4FF] px-3 py-1 rounded-full text-sm font-bold">
            {totalWorkouts} total
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="week" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="workouts" 
                fill="#00D4FF" 
                radius={[8, 8, 0, 0]}
                name="Entrenos"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de adherencia al plan
export function AdherenceChart({ completedWorkouts, targetWorkouts }) {
  const percentage = targetWorkouts > 0 ? Math.round((completedWorkouts / targetWorkouts) * 100) : 0
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-[#00D4FF]" />
          Adherencia al Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-4">
        <div className="relative w-32 h-32">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="#2a2a2a"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="url(#adherenceGradient)"
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="adherenceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D4FF" />
                <stop offset="100%" stopColor="#00B4E6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">{percentage}%</span>
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm">
            <span className="text-[#00D4FF] font-bold">{completedWorkouts}</span> de <span className="font-bold">{targetWorkouts}</span> entrenos
          </p>
          <p className="text-gray-500 text-xs mt-1">este mes</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de comparativa mensual
export function MonthlyComparisonChart({ currentMonth, previousMonth }) {
  const data = [
    { name: 'Entrenos', current: currentMonth.workouts || 0, previous: previousMonth.workouts || 0 },
    { name: 'Duración (h)', current: Math.round((currentMonth.duration || 0) / 60), previous: Math.round((previousMonth.duration || 0) / 60) },
    { name: 'Días activos', current: currentMonth.activeDays || 0, previous: previousMonth.activeDays || 0 },
  ]

  return (
    <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border-[#2a2a2a] rounded-3xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#00D4FF]" />
          Comparativa Mensual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis type="number" stroke="#666" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#666" fontSize={12} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="previous" fill="#666" name="Mes anterior" radius={[0, 4, 4, 0]} />
              <Bar dataKey="current" fill="#00D4FF" name="Este mes" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Panel completo de estadísticas
export default function ProgressCharts({ weightData, workoutsData, adherenceData, comparisonData }) {
  const [timeRange, setTimeRange] = useState('30d')

  return (
    <div className="space-y-4">
      {/* Filtros de tiempo */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: '7d', label: '7 días' },
          { value: '30d', label: '30 días' },
          { value: '90d', label: '90 días' },
        ].map(range => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range.value)}
            className={timeRange === range.value 
              ? 'bg-gradient-to-r from-[#00D4FF] to-[#00B4E6] text-black border-0' 
              : 'border-[#2a2a2a] text-gray-400 hover:border-[#00D4FF] hover:text-[#00D4FF]'
            }
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Grid de gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeightChart data={weightData} timeRange={timeRange} />
        <WorkoutsChart data={workoutsData} timeRange={timeRange} />
        <AdherenceChart 
          completedWorkouts={adherenceData?.completed || 0} 
          targetWorkouts={adherenceData?.target || 12} 
        />
        <MonthlyComparisonChart 
          currentMonth={comparisonData?.current || {}} 
          previousMonth={comparisonData?.previous || {}} 
        />
      </div>
    </div>
  )
}

// Utilidad para filtrar por rango de tiempo
function filterByTimeRange(data, range) {
  if (!data || !Array.isArray(data)) return []
  
  const now = new Date()
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  
  return data.filter(item => {
    const itemDate = new Date(item.date || item.week)
    return itemDate >= cutoff
  })
}
