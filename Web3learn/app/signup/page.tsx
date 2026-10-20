"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowLeft, Home, Menu, X, Loader2, Eye, EyeOff } from "lucide-react"
import type { Personality } from "@/lib/reference-data"
import { signUpWithEmail, signInWithGoogle, signInWithGoogleAndLink, signUpOrSignInWithGoogle, getUserProfile, AccountLinkingError, PasswordLinkingError } from "@/lib/firebase/auth"
import { useAuth } from "@/components/firebase-provider"
import { OAuthCredential } from "firebase/auth"
import { waitForSync } from "@/lib/firebase/auth-sync"
import { updateUserOnboardingData } from "@/lib/firebase/user-profile"

type QuestionOption = {
  id: string
  text: string
  value: string
  personalityScore: Partial<Record<Personality, number>>
}

type Question = {
  id: string
  text: string
  options: QuestionOption[]
}

function SignupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<"auth" | "info" | "welcome" | "q1" | "q2" | "q3" | "q4" | "q5" | "result" | "level">("auth")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [learnerType, setLearnerType] = useState<Personality>("Normal")
  const [level, setLevel] = useState<string>("")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [needsPasswordForGoogle, setNeedsPasswordForGoogle] = useState(false)
  const [googleLinkingEmail, setGoogleLinkingEmail] = useState("")
  const [googleCredential, setGoogleCredential] = useState<OAuthCredential | null>(null)
  const [passwordError, setPasswordError] = useState("")
  const [nameError, setNameError] = useState("")

  // Get auth state from context
  const { user, loading: authLoading, isSynced } = useAuth()

  useEffect(() => {
    setIsAuthenticated(!!user)
  }, [user])

  // Check if user is already logged in and handle profile check
  useEffect(() => {
    if (authLoading) return

    async function checkUserStatus() {
      if (user) {
        // Wait for sync to complete
        if (!isSynced) return

        try {
          const profile = await getUserProfile(user.uid)
          if (profile) {
            setName(profile.name)
            setEmail(profile.email)
            setLearnerType(profile.personalityType as Personality)
            setLevel(profile.level)

            if (profile.personalityType && profile.level &&
              profile.personalityType.trim() !== "" && profile.level.trim() !== "") {
              const safeName = profile.name && profile.name.trim() !== ""
                ? profile.name
                : user.displayName || user.email?.split("@")[0] || "User"
              router.push(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
            } else {
              setStep("welcome")
            }
          } else {
            setName(user.displayName || user.email?.split("@")[0] || "User")
            setEmail(user.email || "")
            setStep("welcome")
          }
        } catch (error: any) {
          console.error("Error fetching user profile:", error)
          setName(user.displayName || user.email?.split("@")[0] || "User")
          setEmail(user.email || "")
          setStep("welcome")
        }
      } else {
        // Logged out
        setName("")
        setEmail("")
        setPassword("")
        setError("")
        setEmailError("")
        setPasswordError("")
        setNameError("")
        setAnswers({})
        setSelectedOptions({})
        setLearnerType("Normal")
        setLevel("")
        setShowPassword(false)

        const fromLogin = searchParams.get("fromLogin")
        if (fromLogin === "true") {
          setStep("welcome")
        } else {
          setStep("auth")
        }
      }
    }

    checkUserStatus()
  }, [user, authLoading, isSynced, router, searchParams])

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

  const validateName = (name: string): boolean => {
    if (!name) {
      setNameError("Name is required")
      return false
    }
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters")
      return false
    }
    setNameError("")
    return true
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setEmailError("")
    setPasswordError("")
    setNameError("")

    // Validate inputs
    const isNameValid = validateName(name)
    const isEmailValid = validateEmail(email)
    const isPasswordValid = validatePassword(password)

    if (!isNameValid || !isEmailValid || !isPasswordValid) {
      return
    }

    setIsLoading(true)

    try {
      // Create account - auth-sync will handle Firestore document creation via onAuthStateChanged
      await signUpWithEmail(email, password, name, "", "")

      // After successful sign up, proceed to onboarding
      // auth-sync will create the user document in the background
      // We don't wait for it - proceed to welcome step
      setStep("welcome")
      setIsLoading(false)
    } catch (error: any) {
      setError(error.message || "Failed to create account. Please try again.")
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError("")
    setEmailError("")
    setNeedsPasswordForGoogle(false)
    setGoogleLinkingEmail("")
    setIsLoading(true)

    try {
      // Use unified signup/login function - checks if user exists first
      // If user exists with Google → logs in automatically
      // If user doesn't exist → creates account (signup)
      // If user exists with email/password → prompts for password linking
      const user = await signUpOrSignInWithGoogle()

      // Use the user returned from the function directly (more reliable than auth.currentUser)
      if (!user) {
        setError("Authentication failed at Google signup. Please try again.")
        setIsLoading(false)
        return
      }

      // Wait for sync to complete
      await waitForSync(user.uid)

      // Try to get profile (may not exist yet if first Google login)
      // auth-sync will create it in the background, but we proceed with auth data
      let profile
      try {
        profile = await getUserProfile(user.uid)
      } catch (profileError: any) {
        // Check if it's a permission error
        if (profileError.message?.includes("Missing or insufficient permissions") ||
          profileError.message?.includes("permission-denied") ||
          profileError.code === "permission-denied") {
          // Check if we've already tried refreshing (prevent infinite loop)
          const refreshKey = `google_signup_refresh_${user.uid}`
          const hasRefreshed = sessionStorage.getItem(refreshKey)

          if (!hasRefreshed) {
            // Mark that we're about to refresh
            sessionStorage.setItem(refreshKey, "true")
            // Wait a moment for auth to fully propagate
            await new Promise(resolve => setTimeout(resolve, 1000))
            // Refresh the page to allow auth state to fully sync
            window.location.reload()
            return
          } else {
            // Already refreshed once, clear the flag and show error
            sessionStorage.removeItem(refreshKey)
            throw new Error("Permission error persists. Please try signing in again.")
          }
        }
        // Re-throw if it's not a permission error
        throw profileError
      }

      if (profile) {
        // Profile exists - check if onboarding is complete
        if (profile.personalityType && profile.level &&
          profile.personalityType.trim() !== "" && profile.level.trim() !== "") {
          // Onboarding complete - redirect to learning (user was logged in)
          const safeName = profile.name && profile.name.trim() !== ""
            ? profile.name
            : user.displayName || user.email?.split("@")[0] || "User"
          router.push(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
          setIsLoading(false)
          return
        }
        // Profile exists but onboarding incomplete - use profile data
        setName(profile.name && profile.name.trim() !== "" ? profile.name : user.displayName || user.email?.split("@")[0] || "User")
        setEmail(profile.email && profile.email.trim() !== "" ? profile.email : user.email || "")
      } else {
        // No profile yet - use auth data (profile will be created by auth-sync)
        // This is a new user (signup) - proceed to onboarding
        setName(user.displayName || user.email?.split("@")[0] || "User")
        setEmail(user.email || "")
      }

      // Clear refresh flag on success
      const refreshKey = `google_signup_refresh_${user.uid}`
      sessionStorage.removeItem(refreshKey)

      // Proceed to welcome step for onboarding (new user) or continue onboarding (existing user)
      setStep("welcome")
      setIsLoading(false)
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

      // Check if it's a permission error
      if (error.message?.includes("Missing or insufficient permissions") ||
        error.message?.includes("permission-denied") ||
        error.code === "permission-denied") {
        // Get user ID if available
        const userId = user?.uid
        if (userId) {
          const refreshKey = `google_signup_refresh_${userId}`
          const hasRefreshed = sessionStorage.getItem(refreshKey)

          if (!hasRefreshed) {
            // Mark that we're about to refresh
            sessionStorage.setItem(refreshKey, "true")
            // Wait a moment for auth to fully propagate
            await new Promise(resolve => setTimeout(resolve, 1000))
            // Refresh the page to allow auth state to fully sync
            window.location.reload()
            return
          } else {
            // Already refreshed once, clear the flag and show error
            sessionStorage.removeItem(refreshKey)
            setError("Permission error persists. Please try signing in again.")
            setIsLoading(false)
            return
          }
        }
      }

      setError(error.message || "Failed to sign up with Google.")
      setIsLoading(false)
    }
  }

  const handleGoogleSignUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setEmailError("")

    if (!password) {
      setError("Password is required")
      return
    }

    if (!googleCredential) {
      setError("Authentication error. Please try again.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // Sign in with email/password and link Google credential
      const user = await signInWithGoogleAndLink(googleLinkingEmail, password, googleCredential)

      // Use the user returned from the function directly
      if (!user) {
        setError("Authentication failed at password linking. Please try again.")
        setIsLoading(false)
        return
      }

      // Wait for sync to complete
      await waitForSync(user.uid)

      const profile = await getUserProfile(user.uid)
      if (profile) {
        // Check if onboarding is complete
        if (profile.personalityType && profile.level &&
          profile.personalityType.trim() !== "" && profile.level.trim() !== "") {
          const safeName = profile.name && profile.name.trim() !== ""
            ? profile.name
            : user.displayName || user.email?.split("@")[0] || "User"
          router.push(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
          setIsLoading(false)
          return
        }
        setName(profile.name && profile.name.trim() !== "" ? profile.name : user.displayName || user.email?.split("@")[0] || "User")
        setEmail(profile.email && profile.email.trim() !== "" ? profile.email : user.email || "")
      } else {
        setName(user.displayName || user.email?.split("@")[0] || "User")
        setEmail(user.email || "")
      }

      setStep("welcome")
      setNeedsPasswordForGoogle(false)
      setPassword("")
      setIsLoading(false)
    } catch (error: any) {
      setError(error.message || "Failed to link accounts. Please try again.")
      setIsLoading(false)
    }
  }

  const questions: Record<string, Question> = {
    q1: {
      id: "q1",
      text: "How do you prefer to learn new programming concepts?",
      options: [
        {
          id: "q1o1",
          text: "Through detailed technical documentation with clear structure",
          value: "structured-detail",
          personalityScore: { Autistic: 3, Nerd: 2 },
        },
        {
          id: "q1o2",
          text: "Through visual diagrams, colors, and chunked information",
          value: "visual-chunked",
          personalityScore: { Dyslexic: 3, Dyscalculic: 2 },
        },
        {
          id: "q1o3",
          text: "Through creative metaphors, stories, and expressive examples",
          value: "creative-expressive",
          personalityScore: { Expressive: 3 },
        },
        {
          id: "q1o4",
          text: "Through quiet, focused study at my own pace",
          value: "self-paced",
          personalityScore: { Introverted: 3 },
        },
        {
          id: "q1o5",
          text: "Through a balanced mix of theory and practice",
          value: "balanced",
          personalityScore: { Normal: 3 },
        },
        {
          id: "q1o6",
          text: "Through deep technical dives and academic rigor",
          value: "technical-deep",
          personalityScore: { Nerd: 3, Autistic: 2 },
        },
      ],
    },
    q2: {
      id: "q2",
      text: "When reading code or documentation, what helps you most?",
      options: [
        {
          id: "q2o1",
          text: "Clear, logical structure with definitions and step-by-step breakdowns",
          value: "logical-structure",
          personalityScore: { Autistic: 3, Nerd: 2 },
        },
        {
          id: "q2o2",
          text: "Simple language, avoiding complex symbols and math",
          value: "simple-language",
          personalityScore: { Dyslexic: 3, Dyscalculic: 3 },
        },
        {
          id: "q2o3",
          text: "Metaphors, analogies, and creative explanations",
          value: "metaphors",
          personalityScore: { Expressive: 3 },
        },
        {
          id: "q2o4",
          text: "Quiet environment with minimal distractions",
          value: "quiet-focus",
          personalityScore: { Introverted: 3 },
        },
        {
          id: "q2o5",
          text: "Standard explanations with examples",
          value: "standard-examples",
          personalityScore: { Normal: 3 },
        },
        {
          id: "q2o6",
          text: "Formal definitions, type systems, and mathematical precision",
          value: "formal-precision",
          personalityScore: { Nerd: 3, Autistic: 2 },
        },
      ],
    },
    q3: {
      id: "q3",
      text: "How do you handle complex information?",
      options: [
        {
          id: "q3o1",
          text: "I break it into systematic parts and understand each piece thoroughly",
          value: "systematic-breakdown",
          personalityScore: { Autistic: 3 },
        },
        {
          id: "q3o2",
          text: "I prefer information broken into small, manageable chunks with visual aids",
          value: "chunked-visual",
          personalityScore: { Dyslexic: 3, Dyscalculic: 2 },
        },
        {
          id: "q3o3",
          text: "I connect it to stories, scenarios, or creative frameworks",
          value: "creative-connection",
          personalityScore: { Expressive: 3 },
        },
        {
          id: "q3o4",
          text: "I take my time, reflect deeply, and process it internally",
          value: "reflective-processing",
          personalityScore: { Introverted: 3 },
        },
        {
          id: "q3o5",
          text: "I use a combination of approaches depending on the topic",
          value: "flexible-approach",
          personalityScore: { Normal: 3 },
        },
        {
          id: "q3o6",
          text: "I dive deep into the theoretical foundations and formal systems",
          value: "theoretical-deep",
          personalityScore: { Nerd: 3 },
        },
      ],
    },
    q4: {
      id: "q4",
      text: "What type of learning content resonates most with you?",
      options: [
        {
          id: "q4o1",
          text: "Structured definitions, tables, and logical hierarchies",
          value: "structured-definitions",
          personalityScore: { Autistic: 3 },
        },
        {
          id: "q4o2",
          text: "Plain language explanations without heavy math or symbols",
          value: "plain-language",
          personalityScore: { Dyslexic: 3, Dyscalculic: 3 },
        },
        {
          id: "q4o3",
          text: "Narrative-driven content with metaphors and vivid descriptions",
          value: "narrative-metaphor",
          personalityScore: { Expressive: 3 },
        },
        {
          id: "q4o4",
          text: "Concise, focused content I can study independently",
          value: "concise-independent",
          personalityScore: { Introverted: 3 },
        },
        {
          id: "q4o5",
          text: "Well-balanced content with clear explanations",
          value: "balanced-clear",
          personalityScore: { Normal: 3 },
        },
        {
          id: "q4o6",
          text: "Technical deep-dives with academic rigor and formal notation",
          value: "academic-rigor",
          personalityScore: { Nerd: 3 },
        },
      ],
    },
    q5: {
      id: "q5",
      text: "Which learning environment suits you best?",
      options: [
        {
          id: "q5o1",
          text: "Highly organized, with clear rules and systematic progression",
          value: "organized-systematic",
          personalityScore: { Autistic: 3 },
        },
        {
          id: "q5o2",
          text: "Visual and simple, with emphasis on concepts over calculations",
          value: "visual-conceptual",
          personalityScore: { Dyslexic: 3, Dyscalculic: 3 },
        },
        {
          id: "q5o3",
          text: "Creative and expressive, allowing for imaginative exploration",
          value: "creative-exploration",
          personalityScore: { Expressive: 3 },
        },
        {
          id: "q5o4",
          text: "Quiet and self-paced, with minimal external pressure",
          value: "quiet-self-paced",
          personalityScore: { Introverted: 3 },
        },
        {
          id: "q5o5",
          text: "Standard learning environment with good structure",
          value: "standard-structured",
          personalityScore: { Normal: 3 },
        },
        {
          id: "q5o6",
          text: "Academic and rigorous, with focus on formal methods",
          value: "academic-formal",
          personalityScore: { Nerd: 3 },
        },
      ],
    },
  }

  const handleSubmitInfo = (e: React.FormEvent) => {
    e.preventDefault()
    if (name && email) {
      // If user is authenticated, just proceed to welcome
      if (isAuthenticated) {
        setStep("welcome")
      } else {
        // If not authenticated, they need to sign up first
        setError("Please sign up or log in first")
      }
    }
  }

  const handleSelectOption = (questionId: string, value: string, allowMultiple: boolean = false) => {
    if (allowMultiple) {
      const current = selectedOptions[questionId] || []
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      setSelectedOptions({
        ...selectedOptions,
        [questionId]: updated,
      })
    } else {
      setAnswers({
        ...answers,
        [questionId]: value,
      })

      // Move to next question
      if (questionId === "q1") {
        setStep("q2")
      } else if (questionId === "q2") {
        setStep("q3")
      } else if (questionId === "q3") {
        setStep("q4")
      } else if (questionId === "q4") {
        setStep("q5")
      } else if (questionId === "q5") {
        // Calculate personality type based on scores
        calculatePersonality()
        setStep("result")
      }
    }
  }

  const calculatePersonality = () => {
    const scores: Record<Personality, number> = {
      Dyslexic: 0,
      Autistic: 0,
      Dyscalculic: 0,
      Expressive: 0,
      Introverted: 0,
      Normal: 0,
      Nerd: 0,
    }

    // Calculate scores from all answers
    Object.keys(answers).forEach((qId) => {
      const answerValue = answers[qId]
      const question = questions[qId as keyof typeof questions]
      const selectedOption = question.options.find((opt) => opt.value === answerValue)

      if (selectedOption?.personalityScore) {
        Object.entries(selectedOption.personalityScore).forEach(([personality, score]) => {
          scores[personality as Personality] += score || 0
        })
      }
    })

    // Find personality with highest score
    const maxScore = Math.max(...Object.values(scores))
    const determinedPersonality = (Object.entries(scores).find(([, score]) => score === maxScore)?.[0] ||
      "Normal") as Personality

    setLearnerType(determinedPersonality)
  }

  const handleSelectLevel = async (selectedLevel: string) => {
    // Map to referenceData format
    const levelMap: Record<string, string> = {
      beginner: "Beginner",
      intermediary: "Intermediary",
      expert: "Expert",
    }
    const mappedLevel = levelMap[selectedLevel] || selectedLevel
    setLevel(mappedLevel)

    // Update user profile in Firestore if authenticated
    if (isAuthenticated) {
      try {
        await updateUserOnboardingData(
          learnerType,
          mappedLevel,
          name || undefined
        )
      } catch (error: any) {
        console.error("Error updating user profile:", error)
        setError(error.message || "Failed to save profile. Redirecting anyway...")
        // Still redirect even if update fails - user can complete onboarding later
      }
    }

    // Ensure we have valid values for redirect
    const safeName = name || "User"
    const safeType = learnerType || "Normal"
    const safeLevel = mappedLevel || "Beginner"

    router.push(
      `/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(safeType)}&level=${encodeURIComponent(safeLevel)}`,
    )
  }

  if (authLoading || (user && !isSynced)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">
            {authLoading ? "Initializing..." : "Synchronizing your profile..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-white text-slate-800">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Web3Learn
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            <Link href="/" className="text-slate-700 hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link href="/cardano" className="text-slate-700 hover:text-blue-600 transition-colors">
              Cardano
            </Link>
            <Link href="#" className="text-slate-700 hover:text-blue-600 transition-colors">
              About
            </Link>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 py-4">
            <div className="container mx-auto px-4 flex flex-col space-y-4">
              <Link href="/" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                Home
              </Link>
              <Link href="/cardano" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                Cardano
              </Link>
              <Link href="#" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                About
              </Link>
            </div>
          </div>
        )}
      </header>

      <div className="relative z-10 container mx-auto px-4 py-12 flex items-center justify-center min-h-screen pt-20 bg-gradient-to-br from-blue-50 via-white to-teal-50">
        <div className="w-full max-w-md">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="sm" className="mr-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <Home className="h-4 w-4 mr-1" /> Home
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {step === "auth" && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white shadow-md border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl sm:text-2xl text-center text-slate-800 px-2">
                      {needsPasswordForGoogle ? "Link Your Account" : "Get Started"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {needsPasswordForGoogle ? (
                      <form onSubmit={handleGoogleSignUpWithPassword} className="space-y-4">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm mb-4">
                          An account with this email already exists. Please enter your password to link your Google account.
                        </div>
                        {error && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="link-email" className="text-slate-700">
                            Email Address
                          </Label>
                          <Input
                            id="link-email"
                            type="email"
                            value={googleLinkingEmail}
                            disabled
                            className="bg-slate-50 border-slate-300"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="link-password" className="text-slate-700">
                            Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="link-password"
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value)
                                setError("")
                              }}
                              className="bg-white pr-10 border-slate-300"
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
                              "Link & Continue"
                            )}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="text-center mb-6 text-sm sm:text-base text-slate-600 px-2">
                          Please sign up or log in to continue with your personalized learning journey.
                        </p>
                        <div className="space-y-4">
                          <form onSubmit={handleSignUp} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="auth-name" className="text-slate-700">
                                Your Name
                              </Label>
                              <Input
                                id="auth-name"
                                value={name}
                                onChange={(e) => {
                                  setName(e.target.value)
                                  if (nameError) validateName(e.target.value)
                                }}
                                onBlur={() => validateName(name)}
                                className={`bg-white ${nameError ? "border-red-300" : "border-slate-300"}`}
                                required
                              />
                              {nameError && (
                                <p className="text-sm text-red-600">{nameError}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="auth-email" className="text-slate-700">
                                Email Address
                              </Label>
                              <Input
                                id="auth-email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                  setEmail(e.target.value)
                                  if (emailError) validateEmail(e.target.value)
                                }}
                                onBlur={() => validateEmail(email)}
                                className={`bg-white ${emailError ? "border-red-300" : "border-slate-300"}`}
                                required
                                autoComplete="email"
                                suppressHydrationWarning
                              />
                              {emailError && (
                                <p className="text-sm text-red-600">{emailError}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="auth-password" className="text-slate-700">
                                Password
                              </Label>
                              <div className="relative">
                                <Input
                                  id="auth-password"
                                  type={showPassword ? "text" : "password"}
                                  value={password}
                                  onChange={(e) => {
                                    setPassword(e.target.value)
                                    if (passwordError) validatePassword(e.target.value)
                                  }}
                                  onBlur={() => validatePassword(password)}
                                  className={`bg-white pr-10 ${passwordError ? "border-red-300" : "border-slate-300"}`}
                                  required
                                  minLength={6}
                                  autoComplete="new-password"
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
                            {error && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{error}</p>
                              </div>
                            )}
                            <Button
                              type="submit"
                              disabled={isLoading}
                              className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...
                                </>
                              ) : (
                                "Sign Up"
                              )}
                            </Button>
                          </form>
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-slate-300" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-white px-2 text-slate-500">Or continue with</span>
                            </div>
                          </div>
                          <Button
                            onClick={handleGoogleSignUp}
                            disabled={isLoading}
                            variant="outline"
                            className="w-full border-slate-300 hover:bg-slate-50"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                              </>
                            ) : (
                              <>
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
                                Sign up with Google
                              </>
                            )}
                          </Button>
                          <div className="text-center">
                            <p className="text-sm text-slate-600">
                              Already have an account?{" "}
                              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                                Log in
                              </Link>
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "info" && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white shadow-md border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl sm:text-2xl text-center text-slate-800 px-2">Let's Get Started</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitInfo} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-700">
                          Your Name
                        </Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="bg-white border-slate-300"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-700">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-white border-slate-300"
                          required
                        />
                      </div>
                    </form>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={handleSubmitInfo}
                      className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                    >
                      Continue
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white shadow-md border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl sm:text-2xl text-center text-slate-800 px-2 break-words">Welcome, {name || "User"}!</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center mb-4 text-sm sm:text-base text-slate-600 px-2">
                      Let's personalize your learning experience. We'll ask you a few questions to understand your
                      learning style better.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => setStep("q1")}
                      className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                    >
                      Let's Begin
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {(step === "q1" || step === "q2" || step === "q3" || step === "q4" || step === "q5") && (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white shadow-md border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-xl text-center text-slate-800 px-2">
                      Question {step === "q1" ? "1" : step === "q2" ? "2" : step === "q3" ? "3" : step === "q4" ? "4" : "5"} of 5
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center mb-6 text-base sm:text-lg text-slate-700 px-2">{questions[step].text}</p>
                    <div className="space-y-3">
                      {questions[step].options.map((option) => {
                        const isSelected = answers[step] === option.value
                        return (
                          <Button
                            key={option.id}
                            variant={isSelected ? "default" : "outline"}
                            className={`w-full text-left justify-start h-auto py-3 px-4 break-words whitespace-normal ${isSelected
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "border-slate-300 hover:bg-blue-50 hover:border-blue-300 text-slate-700"
                              }`}
                            onClick={() => handleSelectOption(step, option.value)}
                          >
                            <span className="block">{option.text}</span>
                          </Button>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white shadow-md border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl sm:text-2xl text-center text-slate-800 px-2">Your Learning Profile</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-blue-50 rounded-lg mb-4">
                      <p className="text-center text-base sm:text-lg mb-2 text-slate-700 px-2">Based on your responses, you are an:</p>
                      <p className="text-center text-xl sm:text-2xl font-bold text-blue-600 mb-4 break-words px-2">{learnerType}</p>
                      <p className="text-center text-sm sm:text-base text-slate-600 px-2">
                        You may sometimes find it easier to learn some concepts as compared to others, but don't worry,
                        our AI is here for you.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => setStep("level")}
                      className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white"
                    >
                      Continue
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {step === "level" && (
              <motion.div
                key="level"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white shadow-md border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl sm:text-2xl text-center text-slate-800 px-2">Choose Your Expertise Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center mb-6 text-sm sm:text-base text-slate-600 px-2">
                      Select your current level of expertise with Plutus and Cardano development:
                    </p>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        className="w-full text-left justify-start h-auto py-3 border-slate-300 hover:bg-blue-50 hover:border-blue-300 text-slate-700"
                        onClick={() => handleSelectLevel("beginner")}
                      >
                        Beginner - New to Cardano and Plutus
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full text-left justify-start h-auto py-3 border-slate-300 hover:bg-blue-50 hover:border-blue-300 text-slate-700"
                        onClick={() => handleSelectLevel("intermediary")}
                      >
                        Intermediary - Some experience with Cardano
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full text-left justify-start h-auto py-3 border-slate-300 hover:bg-blue-50 hover:border-blue-300 text-slate-700"
                        onClick={() => handleSelectLevel("expert")}
                      >
                        Expert - Experienced Cardano developer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  )
}

// Prevent static generation - this page requires client-side rendering
export const dynamic = 'force-dynamic'

