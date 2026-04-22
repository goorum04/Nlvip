'use client'

import React from 'react'
import { Sparkles, Trophy, CreditCard } from 'lucide-react'

/**
 * PremiumStitchCard - Refined Example
 * 
 * This component was "inspired" by a Google Stitch design using the prompt:
 * "Premium VIP membership card, matte black background, gold thin borders, high-end feel"
 */
export default function PremiumStitchCard({ name = "SOCIO VIP", plan = "PLATINUM" }) {
  return (
    <div className="relative group w-full max-w-sm">
      {/* Animated Glow Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#C9A24D] to-[#9A7B3C] rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
      
      {/* Main Card */}
      <div className="relative flex flex-col items-center justify-between p-8 bg-[#0B0B0B] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Trophy className="w-24 h-24 text-[#C9A24D]" />
        </div>
        
        <div className="w-full flex justify-between items-center mb-12">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#C9A24D]/10 rounded-xl border border-[#C9A24D]/20">
              <Sparkles className="w-5 h-5 text-[#C9A24D]" />
            </div>
            <span className="text-xs font-bold tracking-[0.2em] text-[#C9A24D] uppercase">NL VIP TEAM</span>
          </div>
          <CreditCard className="w-6 h-6 text-white/20" />
        </div>

        <div className="w-full space-y-1">
          <p className="text-[10px] font-medium text-gray-500 tracking-widest uppercase">Miembro Elite</p>
          <h3 className="text-2xl font-black text-white tracking-tight">{name}</h3>
        </div>

        <div className="w-full mt-12 flex items-end justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-500 tracking-widest uppercase">Plan Actual</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#C9A24D] animate-pulse" />
              <span className="text-sm font-bold text-white/90">{plan}</span>
            </div>
          </div>
          
          <div className="text-[10px] font-mono text-white/10">
            ID: 8820-XXXX-VIP
          </div>
        </div>

        {/* Glossy Overlay */}
        <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-25deg] group-hover:animate-[shimmer_2s_infinite]"></div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
      `}</style>
    </div>
  )
}
