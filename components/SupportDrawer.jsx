'use client'

import { useState } from 'react'
import {
    MessageCircle, Mail, Phone, ExternalLink,
    HelpCircle, ChevronRight, MessageSquare, Instagram
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"

export function SupportDrawer() {
    const [activeTab, setActiveTab] = useState('contact')

    const faqs = [
        { q: '¿Cómo registro mi peso?', a: 'Ve a la pestaña "Progreso" y rellena el formulario de medidas.' },
        { q: '¿Cómo ver mi dieta?', a: 'En la pestaña "Dieta" encontrarás tu plan actual asignado.' },
        { q: '¿Necesito equipo para entrenar?', a: 'Tu rutina está adaptada a lo que indicaste a tu entrenador.' }
    ]

    return (
        <Drawer>
            <DrawerTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 border-none shadow-xl shadow-violet-500/40 text-black z-40 animate-bounce"
                >
                    <HelpCircle className="w-7 h-7" />
                </Button>
            </DrawerTrigger>
            <DrawerContent className="bg-[#1a1a1a] border-violet-500/20 text-white">
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle className="text-2xl font-black flex items-center gap-2">
                            <MessageCircle className="w-6 h-6 text-violet-500" />
                            Soporte NL VIP
                        </DrawerTitle>
                        <DrawerDescription className="text-gray-400">
                            ¿En qué podemos ayudarte hoy?
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4 space-y-6">
                        {/* Contact Options */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Contacto Directo</p>
                            <div className="grid grid-cols-2 gap-2">
                                <a
                                    href="https://wa.me/34600000000"
                                    target="_blank"
                                    className="flex flex-col items-center justify-center p-4 bg-green-500/10 border border-green-500/20 rounded-2xl hover:bg-green-500/20 transition-all"
                                >
                                    <MessageSquare className="w-6 h-6 text-green-400 mb-2" />
                                    <span className="text-sm font-semibold">WhatsApp</span>
                                </a>
                                <a
                                    href="https://instagram.com/nlvipteam"
                                    target="_blank"
                                    className="flex flex-col items-center justify-center p-4 bg-pink-500/10 border border-pink-500/20 rounded-2xl hover:bg-pink-500/20 transition-all"
                                >
                                    <Instagram className="w-6 h-6 text-pink-400 mb-2" />
                                    <span className="text-sm font-semibold">Instagram</span>
                                </a>
                            </div>
                        </div>

                        {/* FAQs */}
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Preguntas Frecuentes</p>
                            {faqs.map((faq, i) => (
                                <div key={i} className="p-4 bg-black/40 border border-[#2a2a2a] rounded-2xl">
                                    <p className="text-sm font-bold text-violet-400 mb-1">{faq.q}</p>
                                    <p className="text-xs text-gray-400 leading-relaxed">{faq.a}</p>
                                </div>
                            ))}
                        </div>

                        {/* Support Link */}
                        <Button variant="ghost" className="w-full justify-between text-gray-300 hover:text-white hover:bg-white/5 rounded-xl h-12">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span>Enviar email de soporte</span>
                            </div>
                            <ExternalLink className="w-4 h-4 opacity-50" />
                        </Button>
                    </div>

                    <DrawerFooter className="pb-8">
                        <DrawerClose asChild>
                            <Button className="w-full bg-white text-black font-bold rounded-2xl h-14">Cerrar</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
