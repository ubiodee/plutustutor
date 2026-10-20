"use client"

import { doc, updateDoc } from "firebase/firestore"
import { getDbInstance } from "./config"
import { auth } from "./config"
import { retryWithBackoff } from "./firestore"

/**
 * Update user onboarding data (personalityType and level, optionally name)
 * This is separate from auth-sync because it's part of the onboarding flow,
 * not the authentication flow.
 * 
 * Only updates if user is authenticated and document exists.
 * Note: Firestore rules only allow updating: lastLoginAt, name, level, personalityType
 */
export async function updateUserOnboardingData(
  personalityType: string,
  level: string,
  name?: string
): Promise<void> {
  const user = auth.currentUser
  if (!user) {
    throw new Error("User must be authenticated to update profile")
  }

  try {
    const userRef = doc(getDbInstance(), "users", user.uid)

    const updateData: Record<string, any> = {
      personalityType,
      level,
    }

    // Optionally update name if provided (email cannot be updated per Firestore rules)
    if (name !== undefined) {
      updateData.name = name
    }

    // Note: photoURL cannot be updated via onboarding (not in allowed update fields)
    // It's only set during user creation in auth-sync

    await retryWithBackoff(() => updateDoc(userRef, updateData))
  } catch (error: any) {
    if (error.code === "permission-denied") {
      console.error("Firestore permission denied when updating onboarding data:", {
        code: error.code,
        message: error.message,
        userId: user.uid,
        timestamp: new Date().toISOString()
      })
      throw new Error("Permission denied. Please ensure you are logged in.")
    } else if (error.code === "not-found") {
      throw new Error("User profile not found. Please try signing out and back in.")
    } else {
      console.error("Error updating user onboarding data:", error)
      throw new Error(error.message || "Failed to update user profile")
    }
  }
}
