"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { User, onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { setupAuthSync, waitForSync } from "@/lib/firebase/auth-sync"
import { Loader2 } from "lucide-react"

interface AuthContextType {
    user: User | null
    loading: boolean
    isSynced: boolean
    authReady: boolean
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isSynced: false,
    authReady: false,
})

export const useAuth = () => useContext(AuthContext)

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSynced, setIsSynced] = useState(false)
    const [authReady, setAuthReady] = useState(false)

    useEffect(() => {
        // Setup the centralized sync listener - only on client
        const unsubscribeSync = setupAuthSync()

        // Wait for auth to be ready from persistence
        auth.authStateReady().then(() => {
            setAuthReady(true)
        })

        // Listen to auth state changes
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setUser(user)

            if (user) {
                setIsSynced(false)
                await waitForSync(user.uid)
                setIsSynced(true)
            } else {
                setIsSynced(false)
            }

            setLoading(false)
        })

        return () => {
            unsubscribeSync()
            unsubscribeAuth()
        }
    }, [])

    if (!authReady) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-600 font-medium">Initializing application...</p>
            </div>
        )
    }

    return (
        <AuthContext.Provider value={{ user, loading, isSynced, authReady }}>
            {children}
        </AuthContext.Provider>
    )
}
