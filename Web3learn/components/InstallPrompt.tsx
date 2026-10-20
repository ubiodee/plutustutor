"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Share, Smartphone, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InstallPrompt() {
    const [isVisible, setIsVisible] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)
    const deferredPrompt = useRef<any>(null)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
            setIsStandalone(true)
            return
        }

        // Detect iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
        setIsIOS(isIOSDevice)

        // Listen for beforeinstallprompt
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault()
            deferredPrompt.current = e
            setIsVisible(true)
        }

        // Listen for appinstalled
        const handleAppInstalled = () => {
            setIsVisible(false)
            deferredPrompt.current = null
        }

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
        window.addEventListener("appinstalled", handleAppInstalled)

        // For iOS, show the prompt manually if not in standalone
        if (isIOSDevice && !isStandalone) {
            // Small delay to not annoy user immediately
            const timer = setTimeout(() => {
                setIsVisible(true)
            }, 3000)
            return () => clearTimeout(timer)
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
            window.removeEventListener("appinstalled", handleAppInstalled)
        }
    }, [isStandalone])

    const handleInstallClick = async () => {
        if (!deferredPrompt.current) return

        deferredPrompt.current.prompt()
        const { outcome } = await deferredPrompt.current.userChoice

        if (outcome === "accepted") {
            setIsVisible(false)
        }
        deferredPrompt.current = null
    }

    const dismissPrompt = () => {
        setIsVisible(false)
    }

    if (!isVisible || isStandalone) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[100]"
            >
                <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 overflow-hidden relative">
                    <button
                        onClick={dismissPrompt}
                        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-start gap-4">
                        <div className="bg-blue-600 p-3 rounded-xl shadow-blue-200 shadow-lg shrink-0">
                            <Download className="text-white h-6 w-6" />
                        </div>
                        <div className="flex-1 pr-4">
                            <h3 className="font-bold text-slate-900 text-lg">Install Web3Learn</h3>
                            <p className="text-slate-600 text-sm mt-1">
                                Install as an app for a faster, better experience and easy access.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {!isIOS ? (
                            <Button
                                onClick={handleInstallClick}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl shadow-md transition-all active:scale-[0.98]"
                            >
                                Install App
                            </Button>
                        ) : (
                            <div className="bg-slate-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm mb-3">
                                    <Smartphone size={16} />
                                    <span>iOS Instructions</span>
                                </div>
                                <ol className="text-xs text-slate-600 space-y-2 list-none p-0">
                                    <li className="flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center font-bold">1</span>
                                        <span>Tap the <Share size={14} className="inline mx-1 text-blue-600" /> button in your Safari toolbar</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center font-bold">2</span>
                                        <span>Scroll down and select <span className="font-semibold">"Add to Home Screen"</span></span>
                                    </li>
                                </ol>
                            </div>
                        )}

                        <button
                            onClick={dismissPrompt}
                            className="w-full py-2 text-slate-500 text-sm font-medium hover:text-slate-800 transition-colors"
                        >
                            Maybe Later
                        </button>
                    </div>

                    <div className="absolute bottom-0 left-0 h-1 bg-blue-600 w-0 animate-[progress_10s_linear_forwards]" />
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
