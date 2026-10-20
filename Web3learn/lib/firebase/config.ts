// Firebase configuration
import { initializeApp, getApps, FirebaseApp } from "firebase/app"
import { getAuth, Auth } from "firebase/auth"
import { getFirestore, Firestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Lazy initialization - only initialize on client side
let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

function getApp(): FirebaseApp {
  // Only initialize on client side
  if (typeof window === "undefined") {
    // During build/SSR, return a mock app object to prevent errors
    // This will never be used in practice since client components only run on client
    return {} as FirebaseApp
  }

  if (!app) {
    // Validate config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error("Firebase configuration is missing. Please check your environment variables.")
    }

    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig)
    } else {
      app = getApps()[0]
    }
  }
  return app
}

export function getAuthInstance(): Auth {
  if (typeof window === "undefined") {
    // During build/SSR, return a mock auth object
    return {} as Auth
  }
  if (!authInstance) {
    authInstance = getAuth(getApp())
  }
  return authInstance
}

export function getDbInstance(): Firestore {
  if (typeof window === "undefined") {
    // During build/SSR, return a mock firestore object
    return {} as Firestore
  }
  if (!dbInstance) {
    dbInstance = getFirestore(getApp())
  }
  return dbInstance
}

// Export lazy getters for backward compatibility
// These proxies only access Firebase on the client side
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (typeof window === "undefined") {
      // During build/SSR, return a no-op function for methods
      // This prevents build errors but won't be used in practice
      return () => Promise.resolve()
    }
    const instance = getAuthInstance()
    const value = instance[prop as keyof Auth]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  }
})

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (typeof window === "undefined") {
      // During build/SSR, return a no-op function for methods
      // This prevents build errors but won't be used in practice
      return () => { }
    }
    return getDbInstance()[prop as keyof Firestore]
  }
})

export default function getFirebaseApp(): FirebaseApp {
  return getApp()
}

