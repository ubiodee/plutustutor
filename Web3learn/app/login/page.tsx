"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowLeft, Home, Menu, X, Loader2, Eye, EyeOff } from "lucide-react"
import { signInWithEmail, signInWithGoogle, signInWithGoogleAndLink, resetPassword, getUserProfile, AccountLinkingError, PasswordLinkingError } from "@/lib/firebase/auth"
import { useAuth } from "@/components/firebase-provider"
import { OAuthCredential } from "firebase/auth"
import { waitForSync } from "@/lib/firebase/auth-sync"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [needsPasswordForGoogle, setNeedsPasswordForGoogle] = useState(false)
  const [googleLinkingEmail, setGoogleLinkingEmail] = useState("")
  const [googleCredential, setGoogleCredential] = useState<OAuthCredential | null>(null)

  // Get auth state from context
  const { user, loading: authLoading, isSynced } = useAuth()

  // Redirect if already logged in and synced
  useEffect(() => {
    if (!authLoading && user && isSynced) {
      getUserProfile(user.uid).then((profile) => {
        if (profile && profile.personalityType && profile.level) {
          router.push(`/learning?name=${encodeURIComponent(profile.name || "")}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
        } else {
          router.push("/signup?fromLogin=true")
        }
      })
    }
  }, [user, authLoading, isSynced, router])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      setEmailError("Email is required")
      return false
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address")
      return false
    }
    setEmailError("")
    return true
  }

  const validatePassword = (password: string): boolean => {
    if (!password) {
      setPasswordError("Password is required")
      return false
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return false
    }
    setPasswordError("")
    return true
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setEmailError("")
    setPasswordError("")
    setNeedsPasswordForGoogle(false)

    // Validate inputs
    const isEmailValid = validateEmail(email)
    const isPasswordValid = validatePassword(password)

    if (!isEmailValid || !isPasswordValid) {
      return
    }

    setIsLoading(true)

    try {
      // Sign in - auth-sync will handle Firestore updates via onAuthStateChanged
      const user = await signInWithEmail(email, password)

      // Use the user returned from the function directly (more reliable than auth.currentUser)
      if (!user) {
        setError("Authentication failed. Please try again.")
        setIsLoading(false)
        return
      }

      // Wait for sync to complete
      await waitForSync(user.uid)

      // After successful sign in, check profile and redirect
      // Note: auth-sync will handle Firestore updates in the background
      if (user) {
        // Try to get profile - for existing users it should exist
        // For new users, auth-sync will create it but we proceed with onboarding
        const profile = await getUserProfile(user.uid)

        if (profile && profile.personalityType && profile.level &&
          profile.personalityType.trim() !== "" && profile.level.trim() !== "") {
          // Onboarding complete - redirect to learning page
          const safeName = profile.name && profile.name.trim() !== ""
            ? profile.name
            : user.displayName || user.email?.split("@")[0] || "User"
          router.push(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
          setIsLoading(false)
          return
        } else {
          // Onboarding incomplete or profile doesn't exist yet
          const safeName = profile?.name && profile.name.trim() !== ""
            ? profile.name
            : user.displayName || user.email?.split("@")[0] || ""
          router.push(`/signup?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile?.personalityType || "")}&level=${encodeURIComponent(profile?.level || "")}&fromLogin=true`)
          setIsLoading(false)
          return
        }
      }
    } catch (error: any) {
      // Handle PasswordLinkingError - account exists with Google only
      if (error instanceof PasswordLinkingError) {
        setError("This account was created with Google. Please sign in with Google instead, or sign in with Google first to link a password.")
        setIsLoading(false)
        return
      }
      setError(error.message || "Failed to sign in. Please check your credentials.")
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setEmailError("")
    setPasswordError("")
    setNeedsPasswordForGoogle(false)
    setGoogleLinkingEmail("")
    setIsLoading(true)

    try {
      // Sign in with Google - auth-sync will handle Firestore updates via onAuthStateChanged
      const user = await signInWithGoogle()

      // Use the user returned from the function directly (more reliable than auth.currentUser)
      if (!user) {
        setError("Authentication failed. Please try again.")
        setIsLoading(false)
        return
      }

      // Wait a brief moment for auth state to sync
      await new Promise(resolve => setTimeout(resolve, 100))

      // After successful sign in, check profile and redirect
      // Note: auth-sync will handle Firestore updates in the background
      if (user) {
        // Try to get profile - for existing users it should exist
        // For new users, auth-sync will create it but we proceed with onboarding
        const profile = await getUserProfile(user.uid)

        if (profile && profile.personalityType && profile.level &&
          profile.personalityType.trim() !== "" && profile.level.trim() !== "") {
          // Onboarding complete - redirect to learning page
          const safeName = profile.name && profile.name.trim() !== ""
            ? profile.name
            : user.displayName || user.email?.split("@")[0] || "User"
          router.push(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
          setIsLoading(false)
          return
        } else {
          // Onboarding incomplete or profile doesn't exist yet
          router.push("/signup?fromLogin=true")
          setIsLoading(false)
          return
        }
      }
    } catch (error: any) {
      // Handle AccountLinkingError - account exists with email/password
      if (error instanceof AccountLinkingError) {
        setNeedsPasswordForGoogle(true)
        setGoogleLinkingEmail(error.email)
        setGoogleCredential(error.credential)
        setEmail(error.email)
        setError(error.message)
        setIsLoading(false)
        return
      }
      setError(error.message || "Failed to sign in with Google.")
      setIsLoading(false)
    }
  }

  const handleGoogleLoginWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setPasswordError("")

    if (!password) {
      setPasswordError("Password is required")
      return
    }

    setIsLoading(true)

    if (!googleCredential) {
      setError("Authentication error. Please try again.")
      setIsLoading(false)
      return
    }

    try {
      // Sign in with email/password and link Google credential
      const user = await signInWithGoogleAndLink(googleLinkingEmail, password, googleCredential)

      // Use the user returned from the function directly
      if (!user) {
        setError("Authentication failed. Please try again.")
        setIsLoading(false)
        return
      }

      // Wait for sync to complete
      await waitForSync(user.uid)

      if (user) {
        const profile = await getUserProfile(user.uid)

        if (profile && profile.personalityType && profile.level &&
          profile.personalityType.trim() !== "" && profile.level.trim() !== "") {
          const safeName = profile.name && profile.name.trim() !== ""
            ? profile.name
            : user.displayName || user.email?.split("@")[0] || "User"
          router.push(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
          setIsLoading(false)
          return
        } else {
          router.push("/signup?fromLogin=true")
          setIsLoading(false)
          return
        }
      }
    } catch (error: any) {
      setError(error.message || "Failed to link accounts. Please try again.")
      setPasswordError(error.message || "Incorrect password")
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      await resetPassword(resetEmail)
      setError("")
      alert("Password reset email sent! Please check your inbox.")
      setShowResetPassword(false)
      setResetEmail("")
    } catch (error: any) {
      setError(error.message || "Failed to send password reset email.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500">
            Web3Learn
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <Home className="h-4 w-4 mr-1" /> Home
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-24 flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-slate-800">Welcome Back</CardTitle>
            </CardHeader>
            <CardContent>
              {needsPasswordForGoogle ? (
                <form onSubmit={handleGoogleLoginWithPassword} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm mb-4">
                    An account with this email already exists. Please enter your password to link your Google account.
                  </div>
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="linkEmail" className="text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="linkEmail"
                      type="email"
                      value={googleLinkingEmail}
                      disabled
                      className="bg-slate-50 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linkPassword" className="text-slate-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="linkPassword"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setPasswordError("")
                        }}
                        className={`bg-white pr-10 ${passwordError ? "border-red-300" : "border-slate-300"}`}
                        required
                        disabled={isLoading}
                        autoComplete="current-password"
                        suppressHydrationWarning
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-red-600">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNeedsPasswordForGoogle(false)
                        setGoogleLinkingEmail("")
                        setGoogleCredential(null)
                        setPassword("")
                        setError("")
                        setPasswordError("")
                      }}
                      className="flex-1"
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Linking...
                        </>
                      ) : (
                        "Link & Sign In"
                      )}
                    </Button>
                  </div>
                </form>
              ) : !showResetPassword ? (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) validateEmail(e.target.value)
                      }}
                      onBlur={() => validateEmail(email)}
                      className={`bg-white ${emailError ? "border-red-300" : "border-slate-300"}`}
                      required
                      disabled={isLoading}
                      autoComplete="email"
                      suppressHydrationWarning
                    />
                    {emailError && (
                      <p className="text-sm text-red-600">{emailError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (passwordError) validatePassword(e.target.value)
                        }}
                        onBlur={() => validatePassword(password)}
                        className={`bg-white pr-10 ${passwordError ? "border-red-300" : "border-slate-300"}`}
                        required
                        disabled={isLoading}
                        autoComplete="current-password"
                        suppressHydrationWarning
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-red-600">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="resetEmail" className="text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="bg-white border-slate-300"
                      required
                      disabled={isLoading}
                      placeholder="Enter your email"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowResetPassword(false)
                        setError("")
                        setResetEmail("")
                      }}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                        </>
                      ) : (
                        "Send Reset Email"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-300"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <p className="text-sm text-center text-slate-600">
                Don't have an account?{" "}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

