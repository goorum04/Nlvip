'use client'

import { Card, CardContent } from '@/components/ui/card'
import { 
  Coffee, Sun as SunIcon, Moon, Apple, Clock, Flame, 
  ChevronRight, Calendar, Info, ShieldCheck, Droplets
} from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const MEAL_icons = {
  'DESAYUNO': Coffee,
  'MEDIA MAÑANA': Apple,
  'COMIDA': SunIcon,
  'MERIENDA': Apple,
  'CENA': Moon,
  'POST-ENTRENO': Flame,
  'PRE-ENTRENO': Flame,
}

const MEAL_COLORS = {
  'DESAYUNO': 'from-amber-500/20 to-orange-500/20 text-orange-400',
  'MEDIA MAÑANA': 'from-blue-400/20 to-cyan-400/20 text-cyan-400',
  'COMIDA': 'from-green-500/20 to-emerald-500/20 text-emerald-400',
  'MERIENDA': 'from-purple-500/20 to-pink-500/20 text-pink-400',
  'CENA': 'from-indigo-500/20 to-blue-500/20 text-blue-400',
  'POST-ENTRENO': 'from-red-500/20 to-orange-500/20 text-red-400',
}

export function DietDailyView({ content }) {
  if (!content) return null

  // Function to parse the AI generated meals
  const parseMeals = (text) => {
    const meals = []
    const lines = text.split('\n')
    let currentMeal = null

    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return

      // Match meal headers like "🌅 DESAYUNO (08:00):" or "☀️ COMIDA:"
      const mealMatch = trimmed.match(/^(?:[^\w\s]*\s*)?([A-Z\sÑ]+)(\s*\([^)]+\))?:?$/i)
      
      if (mealMatch && !trimmed.includes('REGLAS') && !trimmed.includes('MACROS') && !trimmed.includes('SUPLEMENTACIÓN')) {
        const mealName = mealMatch[1].trim().toUpperCase()
        if (MEAL_icons[mealName] || mealName.includes('COMIDA') || mealName.includes('MAÑANA')) {
          if (currentMeal) meals.push(currentMeal)
          currentMeal = {
            name: mealName,
            time: mealMatch[2] ? mealMatch[2].replace(/[()]/g, '') : null,
            items: []
          }
          return
        }
      }

      if (currentMeal && trimmed.startsWith('-')) {
        currentMeal.items.push(trimmed.substring(1).trim())
      }
    })

    if (currentMeal) meals.push(currentMeal)
    return meals
  }

  const meals = parseMeals(content)

  if (meals.length === 0) {
    // Fallback if parsing fails or structure is different
    return (
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* Vertical line for timeline */}
      <div className="absolute left-[21px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/50 via-cyan-500/50 to-transparent hidden sm:block" />

      {meals.map((meal, idx) => {
        const Icon = MEAL_icons[meal.name] || Clock
        const colorClass = MEAL_COLORS[meal.name] || 'from-gray-500/20 to-gray-600/20 text-gray-400'

        return (
          <div key={idx} className="relative pl-0 sm:pl-12 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            {/* Timeline dot */}
            <div className="absolute left-4 top-1 w-3.5 h-3.5 rounded-full bg-[#1a1a1a] border-2 border-violet-500 z-10 hidden sm:block shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
            
            <Card className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300">
              <CardContent className="p-0">
                <div className={`p-4 bg-gradient-to-r ${colorClass} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <h4 className="font-black tracking-tight text-white uppercase">{meal.name}</h4>
                  </div>
                  {meal.time && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-black/20 rounded-full text-xs font-bold text-white/90">
                      <Clock className="w-3.5 h-3.5" />
                      {meal.time}
                    </div>
                  )}
                </div>
                
                <div className="p-5 space-y-3">
                  {meal.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 group/item">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500/50 group-hover/item:bg-violet-500 transition-colors" />
                      <p className="text-gray-300 text-sm leading-relaxed group-hover/item:text-white transition-colors">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

export function DietWeeklyView({ content, calories, protein, carbs, fat }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Macro Summary for Weekly View */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'CALORÍAS', value: calories, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'PROTEÍNA', value: `${protein}g`, icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'CARBOS', value: `${carbs}g`, icon: Droplets, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'GRASAS', value: `${fat}g`, icon: Info, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} rounded-2xl p-4 border border-white/5 flex flex-col items-center text-center`}>
            <m.icon className={`w-5 h-5 ${m.color} mb-2`} />
            <p className="text-white font-black text-xl">{m.value || '-'}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Full Content */}
      <div className="prose prose-invert max-w-none bg-white/[0.02] rounded-3xl p-6 sm:p-8 border border-white/5 shadow-2xl">
        <style jsx global>{`
          .prose h1, .prose h2, .prose h3 { color: white; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; margin-top: 2.5rem; }
          .prose h2 { font-size: 1.25rem; background: linear-gradient(to right, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; border-bottom: none; }
          .prose p { color: #d1d5db; line-height: 1.8; }
          .prose strong { color: #8b5cf6; }
          .prose ul { list-style: none; padding-left: 0; }
          .prose li { position: relative; padding-left: 1.5rem; margin-bottom: 0.75rem; color: #9ca3af; }
          .prose li::before { content: "→"; position: absolute; left: 0; color: #8b5cf6; font-weight: bold; }
          .prose hr { border-color: rgba(255,255,255,0.05); margin: 3rem 0; }
          .prose blockquote { border-left-color: #8b5cf6; background: rgba(139,92,246,0.05); padding: 1.5rem; border-radius: 0 1rem 1rem 0; font-style: italic; }
        `}</style>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
