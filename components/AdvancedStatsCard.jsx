'use client'

import React from 'react'
import { TrendingUp, Activity, Target, ChevronRight } from 'lucide-react'

/**
 * AdvancedStatsCard - Ultra Premium Version (Responsive)
 * 
 * Demonstrates high-end data visualization style inspired by Google Stitch v2.
 * Now adjusted to fill its container for better use in Desktop grids.
 */
export default function AdvancedStatsCard({ 
  label = "Masa Muscular", 
  value = "34.5", 
  unit = "kg", 
  trend = "+1.2",
  history = [40, 65, 45, 90, 65, 80, 70] // Mock data for sparkline
}) {
  return (
    <div className="relative group w-full h-full">
      {/* Background Depth Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A] to-[#030303] rounded-[2.5rem] shadow-2xl"></div>
      
      {/* Premium Border Glow */}
      <div className="absolute -inset-px bg-gradient-to-tr from-[#C9A24D]/0 via-[#C9A24D]/20 to-[#C9A24D]/0 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

      <div className="relative p-7 flex flex-col h-full min-h-[320px]">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
            <Activity className="w-6 h-6 text-[#C9A24D]" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A24D]/10 rounded-full border border-[#C9A24D]/20">
            <TrendingUp className="w-3.5 h-3.5 text-[#C9A24D]" />
            <span className="text-[10px] font-bold text-[#C9A24D]">{trend}%</span>
          </div>
        </div>

        {/* Value Section */}
        <div className="space-y-1 mb-8">
          <h4 className="text-gray-500 text-xs font-bold tracking-[0.2em] uppercase">{label}</h4>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white tracking-tighter sm:text-6xl lg:text-5xl xl:text-7xl">{value}</span>
            <span className="text-xl font-bold text-[#C9A24D]/60 sm:text-2xl">{unit}</span>
          </div>
        </div>

        {/* Sparkline (Visual Representation) */}
        <div className="relative h-20 w-full mb-8 flex items-end gap-1 px-1">
          {history.map((h, i) => (
            <div 
              key={i} 
              className="flex-1 bg-gradient-to-t from-[#C9A24D]/20 to-[#C9A24D] rounded-full transition-all duration-500 group-hover:brightness-125"
              style={{ height: `${h}%`, opacity: 0.3 + (i * 0.1) }}
            />
          ))}
          {/* Subtle Glow beneath bars */}
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#C9A24D]/10 blur-xl"></div>
        </div>

        {/* Footer / CTA */}
        <button className="mt-auto w-full group/btn flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-gray-400 group-hover/btn:text-[#C9A24D] transition-colors" />
            <span className="text-xs font-bold text-gray-300">Ver análisis completo</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  )
}
