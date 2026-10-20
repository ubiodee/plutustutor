// Firebase Authentication Service
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  updateProfile,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  OAuthCredential,
  EmailAuthProvider,
  AuthCredential,
  getIdToken,
} from "firebase/auth"
import { auth } from "./config"
import { doc, getDoc } from "firebase/firestore"
import { retryWithBackoff } from "./firestore"
import { getDbInstance } from "./config"

const googleProvider = new GoogleAuthProvider()

// Special error class for account linking flows
export class AccountLinkingError extends Error {
  constructor(
    message: string,
    public email: string,
    public credential: OAuthCredential | null = null,
    public signInMethods: string[] = []
  ) {
    super(message)
    this.name = "AccountLinkingError"
  }
}

// Special error class for password linking flows
export class PasswordLinkingError extends Error {
  constructor(
    message: string,
    public email: string,
    public signInMethods: string[] = []
  ) {
    super(message)
    this.name = "PasswordLinkingError"
  }
}

export interface UserProfile {
  uid: string
  email: string
  name: string
  personalityType: string
  level: string
  createdAt: any
  lastLoginAt: any
  provider: string
  photoURL?: string
}

// Email/Password Signup - Unified flow with Google account detection
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  personalityType: string,
  level: string
): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Force token propagation
    await getIdToken(user, true)

    // Update display name (non-blocking)
    try {
      await updateProfile(user, { displayName: name })
    } catch (profileError: any) {
      console.warn("Failed to update display name:", profileError)
      // Continue even if display name update fails
    }

    // Note: User document creation is handled by onAuthStateChanged in auth-sync.ts
    // This ensures auth state is fully ready before Firestore writes

    return user
  } catch (error: any) {
    // Handle different error types
    if (error.code === "auth/email-already-in-use") {
      // Check if account exists with Google only
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, email)

        // If Google is available but password is not, allow password linking
        if (signInMethods.includes("google.com") && !signInMethods.includes("password")) {
          throw new PasswordLinkingError(
            "An account with this email already exists with Google. Please sign in with Google first, then you can link a password.",
            email,
            signInMethods
          )
        }

        throw new Error("An account with this email already exists. Please sign in instead.")
      } catch (methodError: any) {
        // Re-throw PasswordLinkingError as-is
        if (methodError instanceof PasswordLinkingError) {
          throw methodError
        }
        // If fetchSignInMethodsForEmail fails, use default error
        throw new Error("An account with this email already exists. Please sign in instead.")
      }
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address. Please check your email and try again.")
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use a stronger password.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else {
      throw new Error(error.message || "Failed to sign up. Please try again.")
    }
  }
}

// Email/Password Login - Unified flow with Google account detection
export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Force token propagation
    await getIdToken(user, true)

    // Note: User document updates are handled by onAuthStateChanged in auth-sync.ts
    // This ensures auth state is fully ready before Firestore writes
    // For login, we only update lastLoginAt if document exists

    return user
  } catch (error: any) {
    // Handle different error types
    if (error.code === "auth/user-not-found") {
      // Check if account exists with Google only
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, email)

        // If Google is available but password is not, throw special error
        if (signInMethods.includes("google.com") && !signInMethods.includes("password")) {
          throw new PasswordLinkingError(
            "This account was created with Google. Please sign in with Google, or set a password to link it to your account.",
            email,
            signInMethods
          )
        }

        throw new Error("User not registered. Please sign up first.")
      } catch (methodError: any) {
        // Re-throw PasswordLinkingError as-is
        if (methodError instanceof PasswordLinkingError) {
          throw methodError
        }
        // If fetchSignInMethodsForEmail fails, use default error
        throw new Error("User not registered. Please sign up first.")
      }
    } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      throw new Error("Incorrect password. Please try again.")
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address. Please check your email and try again.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please try again later.")
    } else {
      throw new Error(error.message || "Failed to sign in. Please check your credentials.")
    }
  }
}

// Link Google credential to existing user account
export async function linkGoogleCredentialToUser(googleCredential: OAuthCredential): Promise<User> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error("You must be signed in to link your Google account. Please sign in with your email and password first.")
  }

  try {
    // Link the Google credential to the current user
    const userCredential = await linkWithCredential(currentUser, googleCredential)
    const user = userCredential.user

    // Force token propagation
    await getIdToken(user, true)
    return user
  } catch (linkError: any) {
    if (linkError.code === "auth/credential-already-in-use") {
      // Credential is already linked to this or another account
      // Return the current user as linking is not needed
      return currentUser
    } else if (linkError.code === "auth/email-already-in-use") {
      throw new Error("This Google account is already linked to another account.")
    } else {
      throw new Error(linkError.message || "Failed to link Google account. Please try again.")
    }
  }
}

// Link password credential to existing Google account
export async function linkPasswordToUser(email: string, password: string): Promise<User> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error("You must be signed in to link a password. Please sign in with Google first.")
  }

  if (currentUser.email !== email) {
    throw new Error("Email does not match the signed-in account.")
  }

  try {
    // Create email/password credential
    const credential = EmailAuthProvider.credential(email, password)

    // Link the password credential to the current user
    const userCredential = await linkWithCredential(currentUser, credential)
    const user = userCredential.user

    // Force token propagation
    await getIdToken(user, true)
    return user
  } catch (linkError: any) {
    if (linkError.code === "auth/credential-already-in-use") {
      // Credential is already linked
      return currentUser
    } else if (linkError.code === "auth/email-already-in-use") {
      throw new Error("This email is already linked to another account.")
    } else if (linkError.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use a stronger password.")
    } else {
      throw new Error(linkError.message || "Failed to link password. Please try again.")
    }
  }
}

// Google OAuth Sign In - Unified flow for both signup and login
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Force token propagation
    await getIdToken(user, true)

    // Note: User document creation/updates are handled by onAuthStateChanged in auth-sync.ts
    // This ensures auth state is fully ready before Firestore writes
    // First-time Google login creates document, subsequent logins only update lastLoginAt

    return user
  } catch (error: any) {
    // Handle account-exists-with-different-credential error
    if (error.code === "auth/account-exists-with-different-credential") {
      const email = error.customData?.email
      const credential = error.credential as OAuthCredential

      if (!email || !credential) {
        throw new Error("An account with this email already exists. Please sign in with your email and password first.")
      }

      // Check existing sign-in methods for this email
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, email)

        // If user is already signed in (e.g., with email/password), link Google credential automatically
        if (auth.currentUser && auth.currentUser.email === email) {
          try {
            return await linkGoogleCredentialToUser(credential)
          } catch (linkError: any) {
            throw new Error(linkError.message || "Failed to link Google account. Please try again.")
          }
        }

        // If password auth exists, throw special error to prompt for password
        if (signInMethods.includes("password")) {
          throw new AccountLinkingError(
            "An account with this email already exists. Please sign in with your email and password to link your Google account.",
            email,
            credential,
            signInMethods
          )
        }

        // If Google is already an allowed method, retry sign-in
        // This shouldn't happen, but handle it gracefully
        if (signInMethods.includes("google.com")) {
          try {
            const retryResult = await signInWithPopup(auth, googleProvider)
            return retryResult.user
          } catch (retryError: any) {
            throw new Error(retryError.message || "Failed to sign in with Google. Please try again.")
          }
        }

        // Unknown sign-in method
        throw new Error("An account with this email already exists. Please sign in with your existing account first.")
      } catch (methodError: any) {
        // Re-throw AccountLinkingError as-is
        if (methodError instanceof AccountLinkingError) {
          throw methodError
        }
        // If fetchSignInMethodsForEmail fails, throw user-friendly error
        if (methodError.message && !methodError.message.includes("account with this email")) {
          throw new Error("An account with this email already exists. Please sign in with your email and password first.")
        }
        throw methodError
      }
    }

    // Handle other error types
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in was cancelled. Please try again.")
    } else if (error.code === "auth/popup-blocked") {
      throw new Error("Popup was blocked. Please allow popups for this site and try again.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else {
      // Handle COOP warnings gracefully - they're warnings, not errors
      if (error.message?.includes("Cross-Origin-Opener-Policy") ||
        error.message?.includes("window.closed")) {
        // COOP warning - popup likely still succeeded, just log and continue
        console.warn("COOP warning (non-critical):", error.message)
        // If we have a user from result, return it
        if (auth.currentUser) {
          return auth.currentUser
        }
      }
      throw new Error(error.message || "Failed to sign in with Google. Please try again.")
    }
  }
}

// Unified Google sign-in with password linking support
// This function handles the complete flow: sign in with email/password, then link Google credential
export async function signInWithGoogleAndLink(email: string, password: string, googleCredential: OAuthCredential): Promise<User> {
  try {
    // Sign in with email/password first
    const userCredential = await signInWithEmailAndPassword(auth, email, password)

    // Now link Google credential
    const user = await linkGoogleCredentialToUser(googleCredential)

    // Force token propagation
    await getIdToken(user, true)
    return user
  } catch (linkError: any) {
    if (linkError.code === "auth/user-not-found") {
      throw new Error("User not found. Please check your email and try again.")
    } else if (linkError.code === "auth/wrong-password" || linkError.code === "auth/invalid-credential") {
      throw new Error("Incorrect password. Please try again.")
    } else {
      throw new Error(linkError.message || "Failed to link accounts. Please try again.")
    }
  }
}

// Unified Google signup/login - checks if user exists first, logs in if exists, signs up if not
// This provides seamless experience: signup button works as both signup and login
export async function signUpOrSignInWithGoogle(): Promise<User> {
  try {
    // Attempt Google sign-in (this will work for both existing and new users)
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user

    // Force token propagation
    await getIdToken(user, true)

    // If we get here, user is authenticated (either logged in existing or created new)
    // Note: User document creation/updates are handled by onAuthStateChanged in auth-sync.ts
    return user
  } catch (error: any) {
    // Handle account-exists-with-different-credential error
    if (error.code === "auth/account-exists-with-different-credential") {
      const email = error.customData?.email
      const credential = error.credential as OAuthCredential

      if (!email || !credential) {
        throw new Error("An account with this email already exists. Please sign in with your email and password first.")
      }

      // Check existing sign-in methods for this email
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, email)

        // If user is already signed in (e.g., with email/password), link Google credential automatically
        if (auth.currentUser && auth.currentUser.email === email) {
          try {
            return await linkGoogleCredentialToUser(credential)
          } catch (linkError: any) {
            throw new Error(linkError.message || "Failed to link Google account. Please try again.")
          }
        }

        // If Google is already an allowed method, retry sign-in (user exists, just log them in)
        if (signInMethods.includes("google.com")) {
          try {
            const retryResult = await signInWithPopup(auth, googleProvider)
            return retryResult.user
          } catch (retryError: any) {
            // If retry fails, check if it's the same error
            if (retryError.code === "auth/account-exists-with-different-credential") {
              // This shouldn't happen, but handle gracefully
              throw new Error("Unable to sign in. Please try again or use email/password.")
            }
            throw new Error(retryError.message || "Failed to sign in with Google. Please try again.")
          }
        }

        // If password auth exists, throw special error to prompt for password
        if (signInMethods.includes("password")) {
          throw new AccountLinkingError(
            "An account with this email already exists. Please sign in with your email and password to link your Google account.",
            email,
            credential,
            signInMethods
          )
        }

        // Unknown sign-in method
        throw new Error("An account with this email already exists. Please sign in with your existing account first.")
      } catch (methodError: any) {
        // Re-throw AccountLinkingError as-is
        if (methodError instanceof AccountLinkingError) {
          throw methodError
        }
        // If fetchSignInMethodsForEmail fails, throw user-friendly error
        if (methodError.message && !methodError.message.includes("account with this email")) {
          throw new Error("An account with this email already exists. Please sign in with your email and password first.")
        }
        throw methodError
      }
    }

    // Handle other error types
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in was cancelled. Please try again.")
    } else if (error.code === "auth/popup-blocked") {
      throw new Error("Popup was blocked. Please allow popups for this site and try again.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else {
      // Handle COOP warnings gracefully - they're warnings, not errors
      if (error.message?.includes("Cross-Origin-Opener-Policy") ||
        error.message?.includes("window.closed")) {
        // COOP warning - popup likely still succeeded, just log and continue
        console.warn("COOP warning (non-critical):", error.message)
        // If we have a user from result, return it
        if (auth.currentUser) {
          return auth.currentUser
        }
      }
      throw new Error(error.message || "Failed to sign in with Google. Please try again.")
    }
  }
}

// Sign Out
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth)
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign out")
  }
}

// Password Reset
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (error: any) {
    // Handle specific Firebase Auth errors
    // Note: Firebase returns success even for unregistered emails to prevent email enumeration
    // But if Firebase does return an error, we handle it cleanly
    if (error.code === "auth/user-not-found") {
      throw new Error("No account found with this email address.")
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address. Please check your email and try again.")
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.")
    } else {
      throw new Error(error.message || "Failed to send password reset email. Please try again.")
    }
  }
}
// Get User Profile from Firestore (no retries - direct fetch only)
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(getDbInstance(), "users", uid)
    const userDoc = await retryWithBackoff(() => getDoc(userRef))

    if (userDoc.exists()) {
      return {
        uid,
        ...userDoc.data(),
      } as UserProfile
    }

    return null
  } catch (error: any) {
    // If offline error, return null instead of throwing to allow app to continue
    if (error.message?.includes("offline") || error.code === "unavailable") {
      console.warn("Firestore is offline, returning null profile. App will continue with default flow.")
      return null
    }
    throw new Error(error.message || "Failed to get user profile")
  }
}


