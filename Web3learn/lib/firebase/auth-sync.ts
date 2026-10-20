"use client"

import { onAuthStateChanged, User, getIdToken } from "firebase/auth"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { auth } from "./config"
import { getDbInstance } from "./config"

let syncInProgress = false
let syncCompletedForUser: string | null = null
let syncPromise: Promise<void> | null = null

/**
 * Centralized Firestore user sync module
 */
export async function waitForSync(userId: string): Promise<void> {
  if (syncCompletedForUser === userId) return
  if (syncPromise) return syncPromise

  // If no sync is in progress but it's not completed, we might need to wait for onAuthStateChanged to trigger it
  return new Promise((resolve) => {
    const checkSync = setInterval(() => {
      if (syncCompletedForUser === userId) {
        clearInterval(checkSync)
        resolve()
      }
    }, 100)

    // Timeout after 10 seconds to prevent infinite wait
    setTimeout(() => {
      clearInterval(checkSync)
      resolve()
    }, 10000)
  })
}

export function setupAuthSync(): () => void {
  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      syncInProgress = false
      syncCompletedForUser = null
      syncPromise = null
      return
    }

    if (syncInProgress || syncCompletedForUser === user.uid) {
      return
    }

    syncPromise = (async () => {
      try {
        syncInProgress = true

        // Wait for auth token to be ready
        let tokenReady = false
        let retries = 0
        const maxRetries = 5

        while (!tokenReady && retries < maxRetries) {
          try {
            const token = await getIdToken(user, true)
            if (token) {
              tokenReady = true
            } else {
              retries++
              await new Promise(resolve => setTimeout(resolve, 500 * retries))
            }
          } catch (tokenError: any) {
            retries++
            if (retries >= maxRetries) break
            await new Promise(resolve => setTimeout(resolve, 500 * retries))
          }
        }

        // Additional delay to ensure auth state is propagated to Firestore rules
        await new Promise(resolve => setTimeout(resolve, 200))

        const db = getDbInstance()
        const userRef = doc(db, "users", user.uid)

        // Use a simple get/set logic with error handling
        let userDocExists = false
        let existingData: any = null

        try {
          const userDoc = await getDoc(userRef)
          userDocExists = userDoc.exists()
          if (userDocExists) existingData = userDoc.data()
        } catch (getWarn) {
          console.warn("Could not fetch user doc for sync, might be first-time user and rules not propagated yet. Retrying...")
          await new Promise(resolve => setTimeout(resolve, 1000))
          const userDoc = await getDoc(userRef)
          userDocExists = userDoc.exists()
          if (userDocExists) existingData = userDoc.data()
        }

        if (!userDocExists) {
          const userEmail = user.email || ""
          const userName = user.displayName || userEmail.split("@")[0] || "User"
          const googleProvider = user.providerData.find(p => p.providerId === "google.com")
          const provider = googleProvider?.providerId || user.providerData[0]?.providerId || "password"

          await setDoc(userRef, {
            email: userEmail,
            name: userName,
            provider: provider,
            personalityType: "",
            level: "",
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            ...(user.photoURL && { photoURL: user.photoURL }),
          })
        } else {
          const googleProvider = user.providerData.find(p => p.providerId === "google.com")
          const currentProvider = googleProvider?.providerId || user.providerData[0]?.providerId || "password"

          const updates: any = {
            lastLoginAt: serverTimestamp(),
          }

          if (existingData.provider !== currentProvider) updates.provider = currentProvider
          if (user.photoURL && existingData.photoURL !== user.photoURL) updates.photoURL = user.photoURL
          if (user.displayName && existingData.name !== user.displayName) updates.name = user.displayName

          await updateDoc(userRef, updates)
        }

        syncCompletedForUser = user.uid
      } catch (error: any) {
        console.error("Auth sync failed:", error)
      } finally {
        syncInProgress = false
        syncPromise = null
      }
    })()
  })

  return unsubscribe
}
