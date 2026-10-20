"use client"

import { useState, useEffect, useCallback, Suspense, useRef } from "react"

// CSS for typing cursor animation
const typingCursorStyle = `
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  .typing-cursor {
    display: inline-block;
    animation: blink 1s infinite;
    color: currentColor;
    margin-left: 2px;
  }
`
import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Home, ArrowLeft, Menu, X, Loader2, Sparkles, BookOpen, ExternalLink, Video, FileText, CheckCircle2, Circle, ThumbsUp, ThumbsDown, LogOut } from "lucide-react"
import Link from "next/link"
import { generateContent, generateContentStream, getRecommendations, getSummary, type RecommendationItem } from "@/lib/api"
import { LoadingFacts } from "@/components/loading-facts"
import confetti from "canvas-confetti"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { signOutUser, getUserProfile } from "@/lib/firebase/auth"
import { useAuth } from "@/components/firebase-provider"
import {
  saveTopicGeneratedContent,
  saveTopicRecommendations,
  saveTopicSummary,
  saveTopicFeedback,
  getTopicData,
  getAllModuleTopics,
  createOrUpdateModuleProgress,
  saveTopicQuizScore,
} from "@/lib/firebase/firestore"
import quizDataRaw from "@/quiz_content.json"

interface Module {
  id: string
  name: string
  description: string
  topics: string[]
}

interface TopicResponse {
  topic: string
  text: string
  query: string
}

const MODULES: Module[] = [
  {
    id: "module1",
    name: "Module 1",
    description: "Introduction to Plutus and Core Concepts",
    topics: [
      "What is Plutus?",
      "Introduction to Plutus Core",
      "Introduction to Haskell",
      "Introduction to Plutus Smart Contract",
      "Introduction to eUTXO",
      "Introduction to Plutus Playground",
    ],
  },
  {
    id: "module2",
    name: "Module 2",
    description: "Plutus Versioning and Language Specifications",
    topics: [
      "What is Ledger Language Version",
      "Plutus Core Version",
      "Plutus Haskell Package Version",
    ],
  },
  {
    id: "module3",
    name: "Module 3",
    description: "Plutus Advanced Concepts and Validation",
    topics: [
      "Built-in Semantics Variant",
      "Validation",
      "Advantages of Plutus",
    ],
  },
]

function LearningPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Get user data from URL params with fallbacks
  const nameParam = searchParams.get("name")
  const learnerTypeParam = searchParams.get("type")
  const levelParam = searchParams.get("level")

  // Normalize and provide safe defaults
  const name = nameParam && nameParam.trim() !== "" ? nameParam : "User"
  const personality = (learnerTypeParam && learnerTypeParam.trim() !== ""
    ? learnerTypeParam.split(" ")[0]
    : "Normal") || "Normal"
  const level = (levelParam && levelParam.trim() !== ""
    ? levelParam.charAt(0).toUpperCase() + levelParam.slice(1).toLowerCase()
    : "Beginner") || "Beginner"

  const [selectedModule, setSelectedModule] = useState<Module | null>(null)
  const [activeTab, setActiveTab] = useState("modules")
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // State for topic responses
  const [topicResponses, setTopicResponses] = useState<Record<string, TopicResponse>>({})
  const [currentTopicIndex, setCurrentTopicIndex] = useState<number>(0)
  const [currentGeneratingTopic, setCurrentGeneratingTopic] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState<Record<string, "pending" | "generating" | "completed" | "error">>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [topicFeedback, setTopicFeedback] = useState<Record<string, "like" | "dislike" | null>>({})

  // State for streaming
  const [streamingText, setStreamingText] = useState<Record<string, string>>({})
  const [displayedText, setDisplayedText] = useState<Record<string, string>>({}) // Text actually shown in UI
  const [isStreaming, setIsStreaming] = useState<Record<string, boolean>>({})
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({}) // Whether typing animation is active
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<Record<string, boolean>>({})

  // Refs for auto-scroll
  const contentEndRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const contentContainerRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Refs for typing queue and control
  const typingQueues = useRef<Record<string, string>>({}) // Queue of text waiting to be typed
  const typingIntervals = useRef<Record<string, NodeJS.Timeout | null>>({}) // Active typing intervals
  const chunkCounts = useRef<Record<string, number>>({}) // Track number of chunks received
  const streamComplete = useRef<Record<string, boolean>>({}) // Track if stream is complete
  const finalFormattedText = useRef<Record<string, string>>({}) // Store final formatted text for Firestore

  // State for recommendations (per topic)
  const [topicRecommendations, setTopicRecommendations] = useState<Record<string, RecommendationItem[]>>({})
  const [topicRecommendationText, setTopicRecommendationText] = useState<Record<string, string>>({})
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)

  // State for summary (per topic)
  const [topicSummaries, setTopicSummaries] = useState<Record<string, {
    summary: string
    resources: Array<{ type: "doc" | "video"; url: string }>
  }>>({})
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Toast hook
  const { toast } = useToast()

  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackTopic, setFeedbackTopic] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  // Quiz state
  const [topicQuizScores, setTopicQuizScores] = useState<Record<string, number>>({})
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [quizScoreResult, setQuizScoreResult] = useState<number | null>(null)

  const getQuizDataForTopic = useCallback((moduleName: string, topicName: string) => {
    try {
      const moduleData = (quizDataRaw as any).quizData[moduleName]
      if (moduleData && moduleData[topicName]) {
        return moduleData[topicName]
      }
    } catch (e) {
      console.error("Error accessing quiz data", e)
    }
    return null
  }, [])

  // Load topic data from Firestore when module is selected
  const loadModuleTopicData = useCallback(async (module: Module) => {
    if (!currentUserId) return

    try {
      const allTopicsData = await getAllModuleTopics(currentUserId, module.id)

      // Load existing topic data into state
      const loadedResponses: Record<string, TopicResponse> = {}
      const loadedRecommendations: Record<string, RecommendationItem[]> = {}
      const loadedSummaries: Record<string, { summary: string; resources: Array<{ type: "doc" | "video"; url: string }> }> = {}
      const loadedFeedback: Record<string, "like" | "dislike" | null> = {}
      const initialProgress: Record<string, "pending" | "generating" | "completed" | "error"> = {}
      const loadedScores: Record<string, number> = {}

      allTopicsData.forEach((topicData) => {
        const topicName = topicData.topicName

        // Load generated content
        if (topicData.generatedContent) {
          loadedResponses[topicName] = {
            topic: topicData.generatedContent.topic,
            text: topicData.generatedContent.text,
            query: topicData.generatedContent.query,
          }
          initialProgress[topicName] = "completed"
        } else {
          initialProgress[topicName] = "pending"
        }

        // Load recommendations
        if (topicData.recommendations?.results) {
          loadedRecommendations[topicName] = topicData.recommendations.results
        }

        // Load summary
        if (topicData.summary) {
          loadedSummaries[topicName] = {
            summary: topicData.summary.summary,
            resources: topicData.summary.resources || [],
          }
        }

        // Load feedback
        if (topicData.feedback?.type) {
          loadedFeedback[topicName] = topicData.feedback.type
        }

        // Load quiz score
        if (topicData.quizScore !== undefined) {
          loadedScores[topicName] = topicData.quizScore
        }
      })

      // Update state with loaded data
      setTopicResponses((prev) => ({ ...prev, ...loadedResponses }))
      setTopicRecommendations((prev) => ({ ...prev, ...loadedRecommendations }))
      setTopicSummaries((prev) => ({ ...prev, ...loadedSummaries }))
      setTopicFeedback((prev) => ({ ...prev, ...loadedFeedback }))
      setGenerationProgress((prev) => ({ ...prev, ...initialProgress }))
      setTopicQuizScores((prev) => ({ ...prev, ...loadedScores }))
    } catch (error) {
      console.error("Error loading module topic data:", error)
    }
  }, [currentUserId])

  // Get auth state from context
  const { user, loading: authLoading, isSynced, authReady } = useAuth()

  useEffect(() => {
    if (user) {
      setCurrentUserId(user.uid)
    } else {
      setCurrentUserId(null)
    }
  }, [user])

  // Onboarding Check and Redirect
  useEffect(() => {
    if (authLoading) return

    async function checkProfile() {
      if (user) {
        // Wait for sync to complete before fetching profile
        if (!isSynced) return

        setProfileLoading(true)
        try {
          const profile = await getUserProfile(user.uid)

          if (!profile) {
            const safeName = user.displayName || user.email?.split("@")[0] || ""
            router.push(`/signup?name=${encodeURIComponent(safeName)}&fromLogin=true`)
            return
          }

          if (!profile.personalityType || !profile.level ||
            profile.personalityType.trim() === "" || profile.level.trim() === "") {
            const safeName = profile.name || user.displayName || user.email?.split("@")[0] || ""
            router.push(`/signup?name=${encodeURIComponent(safeName)}&fromLogin=true`)
            return
          }

          const currentNameParam = searchParams.get("name")
          const currentTypeParam = searchParams.get("type")
          const currentLevelParam = searchParams.get("level")

          if (!currentNameParam || !currentTypeParam || !currentLevelParam) {
            const safeName = profile.name || user.displayName || user.email?.split("@")[0] || "User"
            router.replace(`/learning?name=${encodeURIComponent(safeName)}&type=${encodeURIComponent(profile.personalityType)}&level=${encodeURIComponent(profile.level)}`)
          }
        } catch (error) {
          console.error("Error checking user profile:", error)
        } finally {
          setProfileLoading(false)
        }
      } else {
        // Clear topic data when user logs out
        setTopicResponses({})
        setTopicRecommendations({})
        setTopicSummaries({})
        setTopicFeedback({})
        setGenerationProgress({})
        router.push("/login")
      }
    }

    checkProfile()
  }, [user, authLoading, isSynced, router, searchParams])

  // Auto-scroll helper (defined first as it's used by typing animation)
  const scrollToBottom = useCallback((topic: string, force: boolean = false) => {
    const container = contentContainerRefs.current[topic]
    const endMarker = contentEndRefs.current[topic]

    if (!container || !endMarker) return

    // Check if user is near bottom (within 100px) or force scroll
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100

    if (force || isNearBottom || autoScrollEnabled[topic] !== false) {
      endMarker.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [autoScrollEnabled])

  // Formatting normalization function
  const normalizeFormatting = useCallback((text: string): string => {
    if (!text) return ""

    let normalized = text

    // Ensure markdown headers start on new lines
    normalized = normalized.replace(/([^\n])(###\s+)/g, "$1\n\n$2")
    normalized = normalized.replace(/([^\n])(##\s+)/g, "$1\n\n$2")
    normalized = normalized.replace(/([^\n])(#\s+)/g, "$1\n\n$2")

    // Ensure numbered lists start on new lines
    normalized = normalized.replace(/([^\n])(\d+\.\s+)/g, "$1\n$2")

    // Ensure bullet lists start on new lines
    normalized = normalized.replace(/([^\n])([-*]\s+)/g, "$1\n$2")

    // Ensure code blocks start on new lines
    normalized = normalized.replace(/([^\n])(```)/g, "$1\n$2")
    normalized = normalized.replace(/(```)([^\n])/g, "$1\n$2")

    // Fix missing spaces between sentences (period followed by capital letter)
    normalized = normalized.replace(/\.([A-Z])/g, ". $1")

    // Fix missing spaces after punctuation
    normalized = normalized.replace(/([.!?])([A-Za-z])/g, "$1 $2")

    // Normalize multiple spaces to single space (but preserve line breaks)
    normalized = normalized.replace(/[ \t]+/g, " ")

    // Normalize multiple newlines to max 2 (for paragraph breaks)
    normalized = normalized.replace(/\n{3,}/g, "\n\n")

    // Convert plain-text section headers to markdown headers.
    // A line is treated as a header when it:
    //   - Is preceded by a blank line (or is the first line)
    //   - Is short (≤ 60 chars) and doesn't end with a period
    //   - Ends with ? or : OR reads as a title phrase (majority of words capitalised)
    //   - Doesn't already start with a markdown marker (-, *, #, digit)
    const lines = normalized.split("\n")
    const result: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      // Skip already-markdown or empty lines
      if (!trimmed || /^[#\-*`>]/.test(trimmed) || /^\d+\./.test(trimmed)) {
        result.push(line)
        continue
      }
      const prevTrimmed = result.length > 0 ? result[result.length - 1].trim() : ""
      const prevIsBlank = !prevTrimmed
      const isShort = trimmed.length <= 60
      const noTrailingPeriod = !trimmed.endsWith(".")
      const looksLikeTitle =
        trimmed.endsWith("?") ||
        trimmed.endsWith(":") ||
        (() => {
          const words = trimmed.split(" ")
          const caps = words.filter((w) => w.length > 0 && w[0] === w[0].toUpperCase() && /[A-Z]/.test(w[0]))
          return words.length >= 2 && words.length <= 8 && caps.length >= Math.ceil(words.length * 0.6)
        })()
      if (prevIsBlank && isShort && noTrailingPeriod && looksLikeTitle) {
        result.push(`### ${trimmed}`)
        continue
      }
      result.push(line)
    }
    normalized = result.join("\n")

    // Trim but preserve intentional line breaks
    return normalized.trim()
  }, [])

  // Typing animation function
  const startTypingAnimation = useCallback((topic: string) => {
    // Don't start if already typing
    if (typingIntervals.current[topic]) {
      return
    }

    setIsTyping((prev) => ({ ...prev, [topic]: true }))

    const typeNextCharacter = () => {
      const queue = typingQueues.current[topic] || ""

      if (queue.length === 0) {
        // No more text to type
        // Check if stream is complete
        if (streamComplete.current[topic]) {
          // Stream complete and queue empty - finish typing
          if (typingIntervals.current[topic]) {
            clearInterval(typingIntervals.current[topic]!)
            typingIntervals.current[topic] = null
          }
          setIsTyping((prev) => ({ ...prev, [topic]: false }))
          setIsStreaming((prev) => ({ ...prev, [topic]: false }))

          // Save to Firestore with final formatted text
          const finalText = finalFormattedText.current[topic] || ""
          if (finalText && currentUserId && selectedModule) {
            saveTopicGeneratedContent(
              currentUserId,
              selectedModule.id,
              topic,
              selectedModule.topics.indexOf(topic),
              finalText,
              topic,
              topic
            ).catch((error) => {
              console.error("Error saving to Firestore:", error)
            })
          }

          // Update topic response
          setTopicResponses((prev) => ({
            ...prev,
            [topic]: {
              topic: topic,
              text: finalText,
              query: topic,
            },
          }))

          setGenerationProgress((prev) => ({ ...prev, [topic]: "completed" }))

          // Clear displayed text (will show from topicResponses)
          setDisplayedText((prev) => {
            const newState = { ...prev }
            delete newState[topic]
            return newState
          })
        }
        return
      }

      // Type next character or small word
      const char = queue[0]
      const isSpace = char === " "
      const isNewline = char === "\n"

      // Determine typing speed: faster for spaces/newlines, slower for regular chars
      let charsToType = 1
      if (isSpace || isNewline) {
        charsToType = 1
      } else if (char.match(/[a-zA-Z]/)) {
        // For letters, type 1-2 chars at a time for natural feel
        charsToType = Math.random() > 0.7 ? 2 : 1
      }

      const textToAdd = queue.slice(0, charsToType)
      typingQueues.current[topic] = queue.slice(charsToType)

      // Update displayed text
      setDisplayedText((prev) => {
        const current = prev[topic] || ""
        return { ...prev, [topic]: current + textToAdd }
      })

      // Auto-scroll
      requestAnimationFrame(() => {
        scrollToBottom(topic)
      })
    }

    // Start typing loop with variable speed (20-40ms per character)
    const typingSpeed = 25 + Math.random() * 15 // 25-40ms
    typingIntervals.current[topic] = setInterval(typeNextCharacter, typingSpeed)
  }, [currentUserId, selectedModule, scrollToBottom])

  // Add text to typing queue
  const enqueueText = useCallback((topic: string, text: string) => {
    if (!text) return

    // Do NOT normalize chunk. Normalization happens at onComplete.
    // Calling normalizeFormatting here breaks whitespace spacing.

    // Add to queue
    typingQueues.current[topic] = (typingQueues.current[topic] || "") + text

    // Update final formatted text (accumulated)
    finalFormattedText.current[topic] = (finalFormattedText.current[topic] || "") + text

    // Increment chunk count
    chunkCounts.current[topic] = (chunkCounts.current[topic] || 0) + 1

    // Start typing if we've received at least 2 chunks
    if (chunkCounts.current[topic] >= 2 && !typingIntervals.current[topic]) {
      startTypingAnimation(topic)
    }
  }, [normalizeFormatting, startTypingAnimation])

  // Handle scroll events to detect manual scrolling
  const handleContentScroll = useCallback((topic: string) => {
    const container = contentContainerRefs.current[topic]
    if (!container) return

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    setAutoScrollEnabled((prev) => ({ ...prev, [topic]: isNearBottom }))
  }, [])

  // Load topic data when module is selected and user is authenticated and synced
  useEffect(() => {
    if (currentUserId && selectedModule && isSynced) {
      loadModuleTopicData(selectedModule).catch(console.error)
    }
  }, [currentUserId, selectedModule, isSynced, loadModuleTopicData])

  // Effect to auto-scroll when displayed text updates (during typing)
  useEffect(() => {
    Object.keys(displayedText).forEach((topic) => {
      if (isTyping[topic] || isStreaming[topic]) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          scrollToBottom(topic)
        })
      }
    })
  }, [displayedText, isTyping, isStreaming, scrollToBottom])

  // Cleanup typing intervals on unmount
  useEffect(() => {
    return () => {
      Object.keys(typingIntervals.current).forEach((topic) => {
        if (typingIntervals.current[topic]) {
          clearInterval(typingIntervals.current[topic]!)
        }
      })
    }
  }, [])

  // Generate content for a specific topic with streaming
  const generateTopicContent = useCallback(async (topic: string, isRegenerate: boolean = false) => {
    // Prevent duplicate generation unless regenerating
    if (!isRegenerate && (generationProgress[topic] === "generating" || topicResponses[topic])) {
      return
    }

    // Check if already generating something
    if (isGenerating) {
      return
    }

    setIsGenerating(true)
    setCurrentGeneratingTopic(topic)
    setGenerationProgress((prev) => ({ ...prev, [topic]: "generating" }))
    setIsStreaming((prev) => ({ ...prev, [topic]: true }))
    setStreamingText((prev) => {
      console.log(`[Stream] Initializing streamingText for ${topic}`)
      return { ...prev, [topic]: "" }
    })
    setAutoScrollEnabled((prev) => ({ ...prev, [topic]: true }))

    try {
      let finalTopic: string | undefined
      let finalQuery: string | undefined

      await generateContentStream(
        {
          personality: personality.toLowerCase(),
          level: level.toLowerCase(),
          topic: "plutus", // Fixed topic as per API requirement
          query: topic, // The topic name is the query
          max_new_tokens: 700,
          temperature: 0.4,
          top_p: 0.5,
        },
        // onChunk - called for each streaming chunk
        (chunk) => {
          // Ensure chunk.text is always a string
          const textChunk = typeof chunk.text === "string" ? chunk.text : String(chunk.text || "")
          if (!textChunk) return

          // Enqueue text for typing animation (will start after 2 chunks)
          enqueueText(topic, textChunk)

          // Also update streamingText for reference (but UI uses displayedText)
          setStreamingText((prev) => {
            const currentText = typeof prev[topic] === "string" ? prev[topic] : ""
            return { ...prev, [topic]: currentText + textChunk }
          })
        },
        // onError
        (error) => {
          console.error(`Error streaming content for ${topic}:`, error)

          // Stop typing animation
          if (typingIntervals.current[topic]) {
            clearInterval(typingIntervals.current[topic]!)
            typingIntervals.current[topic] = null
          }

          setIsStreaming((prev) => ({ ...prev, [topic]: false }))
          setIsTyping((prev) => ({ ...prev, [topic]: false }))
          setGenerationProgress((prev) => ({ ...prev, [topic]: "error" }))

          // Preserve accumulated text on error
          const accumulatedText = finalFormattedText.current[topic] || displayedText[topic] || ""
          if (accumulatedText) {
            const topicResponse = {
              topic: finalTopic || topic,
              text: accumulatedText,
              query: finalQuery || topic,
            }
            setTopicResponses((prev) => ({
              ...prev,
              [topic]: topicResponse,
            }))
          }

          // Clear states
          setDisplayedText((prev) => {
            const newState = { ...prev }
            delete newState[topic]
            return newState
          })
          setStreamingText((prev) => {
            const newState = { ...prev }
            delete newState[topic]
            return newState
          })
        },
        // onComplete
        (finalText, topicName, queryName) => {
          finalTopic = topicName
          finalQuery = queryName

          // Mark stream as complete
          streamComplete.current[topic] = true

          // Normalize and store final formatted text
          const normalizedFinal = normalizeFormatting(finalText)
          finalFormattedText.current[topic] = normalizedFinal

          // If typing hasn't started yet (less than 2 chunks), start it now
          if (chunkCounts.current[topic] < 2 && !typingIntervals.current[topic]) {
            // Process all remaining text
            typingQueues.current[topic] = normalizedFinal
            startTypingAnimation(topic)
          } else if (typingIntervals.current[topic]) {
            // Typing is active - it will finish when queue is empty
            // The typing animation will handle completion
          } else {
            // Typing already finished or never started - save immediately
            setIsStreaming((prev) => ({ ...prev, [topic]: false }))
            setIsTyping((prev) => ({ ...prev, [topic]: false }))

            setTopicResponses((prev) => ({
              ...prev,
              [topic]: {
                topic: finalTopic || topic,
                text: normalizedFinal,
                query: finalQuery || topic,
              },
            }))

            setGenerationProgress((prev) => ({ ...prev, [topic]: "completed" }))

            // Save to Firestore
            if (currentUserId && selectedModule) {
              saveTopicGeneratedContent(
                currentUserId,
                selectedModule.id,
                topic,
                selectedModule.topics.indexOf(topic),
                normalizedFinal,
                finalTopic || topic,
                finalQuery || topic
              ).catch((error) => {
                console.error("Error saving to Firestore:", error)
              })
            }

            // Clear displayed text
            setDisplayedText((prev) => {
              const newState = { ...prev }
              delete newState[topic]
              return newState
            })
          }

          // Automatically fetch recommendations and summary in background (non-blocking)
          if (selectedModule) {
            // Fetch recommendations in background (don't await)
            getRecommendations({
              personality: personality.toLowerCase(),
              level: level.toLowerCase(),
              topic: finalTopic || "plutus",
              query: finalQuery || topic,
              max_new_tokens: 700,
              temperature: 0.4,
              top_p: 0.5,
            })
              .then((recResponse) => {
                if (!recResponse.error) {
                  setTopicRecommendations((prev) => ({
                    ...prev,
                    [topic]: recResponse.results || [],
                  }))
                  if (recResponse.rawText) {
                    setTopicRecommendationText((prev) => ({ ...prev, [topic]: recResponse.rawText! }))
                  }

                  // Save to Firestore
                  if (currentUserId && selectedModule) {
                    saveTopicRecommendations(
                      currentUserId,
                      selectedModule.id,
                      topic,
                      recResponse.query || topic,
                      recResponse.results || []
                    ).catch((error) => {
                      console.error("Error saving recommendations to Firestore:", error)
                    })
                  }
                }
              })
              .catch((error) => {
                console.error("Error fetching recommendations:", error)
              })

            // Fetch summary in background (don't await)
            getSummary({
              personality: personality.toLowerCase(),
              level: level.toLowerCase(),
              topic: finalTopic || "plutus",
              query: finalQuery || topic,
              content: normalizedFinal,
              top_k: 5,
            })
              .then((summaryResponse) => {
                if (summaryResponse.summary && !summaryResponse.error) {
                  const summaryData = {
                    summary: summaryResponse.summary,
                    resources: summaryResponse.resources || [],
                  }

                  setTopicSummaries((prev) => ({
                    ...prev,
                    [topic]: summaryData,
                  }))

                  // Save to Firestore
                  if (currentUserId && selectedModule) {
                    saveTopicSummary(
                      currentUserId,
                      selectedModule.id,
                      topic,
                      summaryResponse.topic || topic,
                      summaryResponse.summary,
                      summaryResponse.resources || []
                    ).catch((error) => {
                      console.error("Error saving summary to Firestore:", error)
                    })
                  }
                }
              })
              .catch((error) => {
                console.error("Error fetching summary:", error)
              })
          }
        }
      )
    } catch (error) {
      setIsStreaming((prev) => ({ ...prev, [topic]: false }))
      setGenerationProgress((prev) => ({ ...prev, [topic]: "error" }))
      console.error(`Error generating content for ${topic}:`, error)
      alert(`Failed to generate content for ${topic}. Please try again.`)
    } finally {
      setCurrentGeneratingTopic(null)
      setIsGenerating(false)
    }
  }, [personality, level, isGenerating, topicResponses, generationProgress, selectedModule, currentUserId, scrollToBottom])

  // Handle module selection
  const handleModuleSelect = useCallback(async (module: Module) => {
    if (isGenerating) return // Prevent multiple simultaneous generations

    setSelectedModule(module)
    setCurrentTopicIndex(0)
    setActiveTab("content")
    setShowConfetti(false)

    // Initialize progress for all topics
    const initialProgress: Record<string, "pending" | "generating" | "completed" | "error"> = {}
    module.topics.forEach((topic) => {
      initialProgress[topic] = topicResponses[topic] ? "completed" : "pending"
    })
    setGenerationProgress(initialProgress)

    // Load existing topic data from Firestore
    if (currentUserId) {
      await loadModuleTopicData(module)
    }
  }, [isGenerating, topicResponses, currentUserId, loadModuleTopicData])

  // Handle next topic
  const handleNextTopic = useCallback(async () => {
    if (!selectedModule) return

    const nextIndex = currentTopicIndex + 1
    if (nextIndex < selectedModule.topics.length) {
      setCurrentTopicIndex(nextIndex)
      const nextTopic = selectedModule.topics[nextIndex]

      // Generate content for next topic if not already generated
      if (!topicResponses[nextTopic]) {
        await generateTopicContent(nextTopic)
      }
    } else {
      // Check if all topics are completed
      const allCompleted = selectedModule.topics.every(
        (topic) => topicResponses[topic] && generationProgress[topic] === "completed"
      )

      if (allCompleted) {
        // Trigger confetti animation
        const duration = 3000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min
        }

        const interval: NodeJS.Timeout = setInterval(function () {
          const timeLeft = animationEnd - Date.now()

          if (timeLeft <= 0) {
            return clearInterval(interval)
          }

          const particleCount = 50 * (timeLeft / duration)

          // Launch confetti from left
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          })

          // Launch confetti from right
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          })
        }, 250)

        // After confetti animation, return to modules tab
        setTimeout(async () => {
          clearInterval(interval)
          setShowConfetti(false)

          // Save module completion to Firestore
          if (currentUserId && selectedModule) {
            try {
              await createOrUpdateModuleProgress(
                currentUserId,
                selectedModule.id,
                selectedModule.name,
                selectedModule.topics.length,
                selectedModule.topics.length,
                true // isCompleted
              )
            } catch (error) {
              console.error("Error saving module completion:", error)
            }
          }

          setActiveTab("modules")
          setSelectedModule(null)
          setCurrentTopicIndex(0)
        }, duration)
      }
    }
  }, [selectedModule, currentTopicIndex, topicResponses, generationProgress, generateTopicContent])

  // Handle previous topic
  const handlePreviousTopic = useCallback(() => {
    if (currentTopicIndex > 0) {
      setCurrentTopicIndex(currentTopicIndex - 1)
    }
  }, [currentTopicIndex])

  // Handle getting recommendations
  const handleGetRecommendations = useCallback(async () => {
    const currentTopic = selectedModule?.topics[currentTopicIndex]
    if (!currentTopic || !topicResponses[currentTopic]) {
      alert("Please generate content for the current topic first.")
      return
    }

    const response = topicResponses[currentTopic]

    setLoadingRecommendations(true)
    try {
      const recResponse = await getRecommendations({
        personality: personality.toLowerCase(),
        level: level.toLowerCase(),
        topic: response.topic || "plutus",
        query: response.query || currentTopic,
        max_new_tokens: 700,
        temperature: 0.4,
        top_p: 0.5,
      })

      if (!recResponse.error) {
        setTopicRecommendations((prev) => ({
          ...prev,
          [currentTopic]: recResponse.results || [],
        }))
        if (recResponse.rawText) {
          setTopicRecommendationText((prev) => ({ ...prev, [currentTopic]: recResponse.rawText! }))
        }

        // Save to Firestore
        if (currentUserId && selectedModule) {
          try {
            await saveTopicRecommendations(
              currentUserId,
              selectedModule.id,
              currentTopic,
              recResponse.query || currentTopic,
              recResponse.results || []
            )
          } catch (error) {
            console.error("Error saving recommendations to Firestore:", error)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error)
    } finally {
      setLoadingRecommendations(false)
    }
  }, [selectedModule, currentTopicIndex, topicResponses, personality, level, currentUserId])

  // Handle getting summary
  const handleGetSummary = useCallback(async () => {
    const currentTopic = selectedModule?.topics[currentTopicIndex]
    if (!currentTopic || !topicResponses[currentTopic]) {
      alert("Please generate content for the current topic first.")
      return
    }

    const response = topicResponses[currentTopic]

    setLoadingSummary(true)
    try {
      const summaryResponse = await getSummary({
        personality: personality.toLowerCase(),
        level: level.toLowerCase(),
        topic: response.topic || "plutus",
        query: response.query || currentTopic,
        content: response.text,
        top_k: 5,
      })

      if (summaryResponse.summary && !summaryResponse.error) {
        const summaryData = {
          summary: summaryResponse.summary,
          resources: summaryResponse.resources || [],
        }

        setTopicSummaries((prev) => ({
          ...prev,
          [currentTopic]: summaryData,
        }))

        // Save to Firestore
        if (currentUserId && selectedModule) {
          try {
            await saveTopicSummary(
              currentUserId,
              selectedModule.id,
              currentTopic,
              summaryResponse.topic || currentTopic,
              summaryResponse.summary,
              summaryResponse.resources || []
            )
          } catch (error) {
            console.error("Error saving summary to Firestore:", error)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching summary:", error)
    } finally {
      setLoadingSummary(false)
    }
  }, [selectedModule, currentTopicIndex, topicResponses, personality, level, currentUserId])

  // Handle feedback update
  const handleFeedbackUpdate = useCallback(async (topic: string, feedbackType: "like" | "dislike" | null) => {
    // If dislike is clicked, open feedback modal instead of saving immediately
    if (feedbackType === "dislike" && topicFeedback[topic] !== "dislike") {
      setFeedbackTopic(topic)
      setFeedbackText("")
      setFeedbackModalOpen(true)
      return
    }

    // For like or removing feedback, save immediately
    const newFeedback = topicFeedback[topic] === feedbackType ? null : feedbackType
    setTopicFeedback((prev) => ({
      ...prev,
      [topic]: newFeedback,
    }))

    // Save to Firestore if user is authenticated
    if (currentUserId && selectedModule) {
      try {
        await saveTopicFeedback(
          currentUserId,
          selectedModule.id,
          topic,
          newFeedback
        )
      } catch (error) {
        console.error("Error saving feedback to Firestore:", error)
        toast({
          title: "Error",
          description: "Failed to save feedback. Please try again.",
          variant: "destructive",
        })
      }
    }
  }, [currentUserId, selectedModule, topicFeedback, toast])

  // Handle feedback submission (for dislike with text)
  const handleFeedbackSubmit = useCallback(async () => {
    if (!feedbackTopic || !feedbackText.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please tell us how we can improve.",
        variant: "destructive",
      })
      return
    }

    if (!currentUserId || !selectedModule) {
      toast({
        title: "Error",
        description: "You must be logged in to submit feedback.",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingFeedback(true)

    try {
      // Save dislike feedback with text
      await saveTopicFeedback(
        currentUserId,
        selectedModule.id,
        feedbackTopic,
        "dislike",
        feedbackText.trim()
      )

      // Update local state
      setTopicFeedback((prev) => ({
        ...prev,
        [feedbackTopic]: "dislike",
      }))

      // Close modal and show success message
      setFeedbackModalOpen(false)
      setFeedbackText("")
      setFeedbackTopic(null)

      toast({
        title: "Thank you!",
        description: "Thank you for your valuable feedback.",
      })
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }, [feedbackTopic, feedbackText, currentUserId, selectedModule, toast])

  // Calculate generation progress
  const getGenerationProgress = () => {
    if (!selectedModule) return 0
    const completed = selectedModule.topics.filter(
      (topic) => generationProgress[topic] === "completed"
    ).length
    return (completed / selectedModule.topics.length) * 100
  }

  const getCompletedTopicsCount = () => {
    if (!selectedModule) return 0
    return selectedModule.topics.filter(
      (topic) => generationProgress[topic] === "completed"
    ).length
  }

  const handleLogout = async () => {
    try {
      await signOutUser()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
      alert("Failed to sign out. Please try again.")
    }
  }

  // Show loader while auth, sync, or profile is loading - prevent redirects during loading
  if (authLoading || (user && !isSynced) || profileLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">
            {authLoading ? "Initializing..." : !isSynced ? "Synchronizing your profile..." : "Loading your progress..."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{typingCursorStyle}</style>
      <div className="relative min-h-screen bg-white text-slate-800">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="text-xl sm:text-2xl font-bold text-blue-600">
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
              {currentUserId && (
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-slate-700 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              )}
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
                {currentUserId && (
                  <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="text-slate-700 hover:text-red-600 transition-colors justify-start py-2"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                )}
              </div>
            </div>
          )}
        </header>

        <div className="relative z-10 container mx-auto px-4 py-8 pt-24 bg-gradient-to-br from-blue-50 via-white to-teal-50 min-h-screen">
          {/* Navigation buttons */}
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="sm" className="mr-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <Home className="h-4 w-4 mr-1" /> Home
            </Button>
          </div>

          {/* User Info Card */}
          <Card className="mb-6 bg-white shadow-md border-slate-200">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 break-words">
                    Welcome, <span className="text-blue-600">{name || "User"}</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 break-words">
                    {personality || "Normal"} Learner • {level || "Beginner"} Level
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className="bg-white shadow-md border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl text-slate-800">Learning Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="modules" className="text-xs sm:text-sm px-1 sm:px-3">
                    <span className="hidden sm:inline">Modules</span>
                    <span className="sm:hidden">Learn</span>
                  </TabsTrigger>
                  <TabsTrigger value="content" disabled={!selectedModule} className="text-xs sm:text-sm px-1 sm:px-3">
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="recommendations" className="text-xs sm:text-sm px-1 sm:px-3">
                    <span className="hidden sm:inline">Recommendations</span>
                    <span className="sm:hidden">Links</span>
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="text-xs sm:text-sm px-1 sm:px-3">Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="modules">
                  <div className="space-y-4">
                    <p className="text-sm sm:text-base text-slate-600 mb-6">
                      Select a module to start learning. The first topic will be generated automatically. Use the "Next" button to navigate through topics.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {MODULES.map((module) => (
                        <Card
                          key={module.id}
                          className={`cursor-pointer transition-all duration-300 ${selectedModule?.id === module.id
                            ? "border-blue-500 shadow-lg"
                            : "border-slate-200 hover:border-blue-300 hover:shadow-md"
                            }`}
                          onClick={() => !isGenerating && handleModuleSelect(module)}
                        >
                          <CardHeader>
                            <CardTitle className="text-lg sm:text-xl text-slate-800">{module.name}</CardTitle>
                            <p className="text-sm text-slate-600 mt-2">{module.description}</p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Topics covered:</p>
                              <ul className="space-y-1">
                                {module.topics.map((topic, index) => (
                                  <li key={index} className="text-xs sm:text-sm text-slate-600 flex items-start gap-2">
                                    <span className="text-blue-600 mt-1">•</span>
                                    <span>{topic}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="content">
                  {(() => {
                    // Show loading only if generating AND no streaming text has arrived yet
                    const shouldShowLoading = isGenerating &&
                      currentGeneratingTopic &&
                      (!streamingText[currentGeneratingTopic] || streamingText[currentGeneratingTopic].length === 0)

                    return shouldShowLoading ? (
                      <LoadingFacts message="Sit tight! We're generating a personalised learning plan just for you 🚀" />
                    ) : selectedModule ? (
                      <div className="space-y-6">
                        {/* Progress Section */}
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm sm:text-base font-semibold text-slate-800">
                              Module Progress
                            </h3>
                            <span className="text-xs sm:text-sm text-blue-600 font-medium">
                              Topic {currentTopicIndex + 1} of {selectedModule.topics.length}
                            </span>
                          </div>
                          <Progress value={((currentTopicIndex + 1) / selectedModule.topics.length) * 100} className="h-2 mb-4" />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedModule.topics.map((topic, index) => {
                              const status = generationProgress[topic] || "pending"
                              const isCurrent = index === currentTopicIndex
                              return (
                                <div
                                  key={topic}
                                  className={`flex items-center gap-2 text-xs sm:text-sm p-2 rounded ${isCurrent ? "bg-blue-100" : ""
                                    }`}
                                >
                                  {status === "completed" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                                  ) : status === "generating" ? (
                                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                                  ) : status === "error" ? (
                                    <Circle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                  )}
                                  <span className={`${status === "error" ? "text-red-600" : isCurrent ? "font-semibold text-blue-700" : "text-slate-700"}`}>
                                    {index + 1}. {topic}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Current Topic Content */}
                        {(() => {
                          const currentTopic = selectedModule.topics[currentTopicIndex]
                          const response = topicResponses[currentTopic]
                          const status = generationProgress[currentTopic] || "pending"
                          const hasDisplayedText = displayedText[currentTopic] && displayedText[currentTopic].length > 0

                          return (
                            <div className="space-y-4">
                              <Card className="border-slate-200">
                                <CardHeader>
                                  <CardTitle className="text-base sm:text-lg text-slate-800">
                                    {currentTopicIndex + 1}. {currentTopic}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {status === "generating" ? (
                                    // Show typing content when displayed text exists (after 2 chunks)
                                    hasDisplayedText ? (
                                      <div
                                        ref={(el) => {
                                          contentContainerRefs.current[currentTopic] = el
                                        }}
                                        onScroll={() => handleContentScroll(currentTopic)}
                                        className="max-h-[600px] overflow-y-auto"
                                        style={{ scrollBehavior: "smooth" }}
                                      >
                                        {/* During streaming use plain whitespace-pre-wrap so every space/newline
                                            renders exactly as received — ReactMarkdown collapses whitespace and
                                            needs complete syntax which breaks mid-stream. */}
                                        <div className="font-sans text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                          {typeof displayedText[currentTopic] === "string" ? displayedText[currentTopic] : ""}
                                          {(isTyping[currentTopic] || isStreaming[currentTopic]) && (
                                            <span className="typing-cursor inline-block ml-1">▍</span>
                                          )}
                                        </div>
                                        <div ref={(el) => { contentEndRefs.current[currentTopic] = el }} />
                                      </div>
                                    ) : (
                                      // Show loading only before first chunk arrives
                                      <div className="py-8 text-center text-slate-600">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                                        <p className="text-lg font-medium">Starting generation...</p>
                                      </div>
                                    )
                                  ) : status === "error" ? (
                                    <div className="py-8 text-center">
                                      <p className="text-red-600 mb-4">Failed to generate content for this topic.</p>
                                      <Button
                                        onClick={() => generateTopicContent(currentTopic, !!response)}
                                        disabled={isGenerating}
                                        variant="outline"
                                      >
                                        Retry
                                      </Button>
                                    </div>
                                  ) : response ? (
                                    <div className="space-y-4">
                                      <div
                                        ref={(el) => {
                                          contentContainerRefs.current[currentTopic] = el
                                        }}
                                        onScroll={() => handleContentScroll(currentTopic)}
                                        className="max-h-[600px] overflow-y-auto"
                                        style={{ scrollBehavior: "smooth" }}
                                      >
                                        <div className="prose prose-slate prose-headings:font-semibold prose-headings:text-slate-800 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-strong:text-slate-900 prose-strong:font-semibold prose-ul:list-disc prose-ol:list-decimal prose-li:text-slate-700 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 max-w-none text-sm sm:text-base">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {response.text}
                                          </ReactMarkdown>
                                        </div>
                                        <div ref={(el) => { contentEndRefs.current[currentTopic] = el }} />
                                      </div>

                                      {/* Re-generate Button */}
                                      <div className="pt-4 border-t border-slate-200">
                                        <Button
                                          onClick={() => generateTopicContent(currentTopic, true)}
                                          disabled={isGenerating}
                                          variant="outline"
                                          className="w-full sm:w-auto"
                                        >
                                          {isGenerating && currentGeneratingTopic === currentTopic ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating...
                                            </>
                                          ) : (
                                            "Try a better explanation"
                                          )}
                                        </Button>
                                      </div>

                                      {/* Feedback Section */}
                                      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                                        <span className="text-xs sm:text-sm text-slate-600">Was this helpful?</span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleFeedbackUpdate(currentTopic, "like")}
                                            className={`p-2 rounded-lg transition-all ${topicFeedback[currentTopic] === "like"
                                              ? "bg-green-100 text-green-600 hover:bg-green-200"
                                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                              }`}
                                            title="Like this response"
                                          >
                                            <ThumbsUp className="h-4 w-4" />
                                          </button>
                                          <button
                                            onClick={() => handleFeedbackUpdate(currentTopic, "dislike")}
                                            className={`p-2 rounded-lg transition-all ${topicFeedback[currentTopic] === "dislike"
                                              ? "bg-red-100 text-red-600 hover:bg-red-200"
                                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                              }`}
                                            title="Dislike this response"
                                          >
                                            <ThumbsDown className="h-4 w-4" />
                                          </button>
                                        </div>
                                        {topicFeedback[currentTopic] && (
                                          <span className="text-xs text-slate-500">
                                            {topicFeedback[currentTopic] === "like" ? "✓ Liked" : "✓ Disliked"}
                                          </span>
                                        )}
                                      </div>

                                      {/* Quiz Section */}
                                      {getQuizDataForTopic(selectedModule.name, currentTopic) && (
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                          <div>
                                            {topicQuizScores[currentTopic] !== undefined && (
                                              <p className="text-sm font-medium text-green-600 mb-1">
                                                Highest Score: {topicQuizScores[currentTopic]}/5
                                              </p>
                                            )}
                                          </div>
                                          <Button
                                            onClick={() => {
                                              setQuizAnswers({})
                                              setQuizScoreResult(null)
                                              setIsQuizModalOpen(true)
                                            }}
                                            variant={topicQuizScores[currentTopic] !== undefined ? "outline" : "default"}
                                            className={topicQuizScores[currentTopic] !== undefined ? "" : "bg-teal-600 hover:bg-teal-700"}
                                          >
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {topicQuizScores[currentTopic] !== undefined ? "Retake Quiz" : "Take Quiz"}
                                          </Button>
                                        </div>
                                      )}

                                    </div>
                                  ) : (
                                    <div className="py-8 text-center text-slate-600">
                                      <p>Content not yet generated. Click to generate.</p>
                                      <Button
                                        onClick={() => generateTopicContent(currentTopic, false)}
                                        disabled={isGenerating}
                                        className="mt-4"
                                      >
                                        Generate Content
                                      </Button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Navigation Buttons */}
                              <div className="flex justify-between items-center pt-4 gap-2">
                                <Button
                                  onClick={handlePreviousTopic}
                                  disabled={currentTopicIndex === 0 || isGenerating}
                                  variant="outline"
                                  className="flex items-center gap-1 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-4"
                                >
                                  <ArrowLeft className="h-4 w-4" />
                                  <span className="hidden xs:inline sm:inline">Previous</span>
                                </Button>
                                <span className="text-xs sm:text-sm text-slate-600 shrink-0">
                                  {currentTopicIndex + 1} / {selectedModule.topics.length}
                                </span>
                                <Button
                                  onClick={handleNextTopic}
                                  disabled={isGenerating || (currentTopicIndex === selectedModule.topics.length - 1 && !topicResponses[selectedModule.topics[currentTopicIndex]])}
                                  variant="default"
                                  className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-4"
                                >
                                  <span className="hidden sm:inline">{currentTopicIndex === selectedModule.topics.length - 1 ? "Complete Module" : "Next"}</span>
                                  <span className="sm:hidden">{currentTopicIndex === selectedModule.topics.length - 1 ? "Done" : "Next"}</span>
                                  <ArrowLeft className="h-4 w-4 rotate-180" />
                                </Button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <p className="text-slate-600 text-center py-8">Please select a module to start learning.</p>
                    )
                  })()}
                </TabsContent>

                <TabsContent value="recommendations">
                  <div className="space-y-4">
                    {(() => {
                      const currentTopic = selectedModule?.topics[currentTopicIndex]
                      const recommendations = currentTopic ? topicRecommendations[currentTopic] || [] : []

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Recommended Resources</h3>
                            <Button
                              onClick={handleGetRecommendations}
                              disabled={loadingRecommendations}
                              className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9 px-3"
                            >
                              {loadingRecommendations ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading...
                                </>
                              ) : (
                                <>
                                  <BookOpen className="mr-1 h-3 w-3" />
                                  <span className="hidden sm:inline">{currentTopic && topicRecommendations[currentTopic]?.length > 0 ? "Refresh" : "Get Recommendations"}</span>
                                  <span className="sm:hidden">{currentTopic && topicRecommendations[currentTopic]?.length > 0 ? "Refresh" : "Get Links"}</span>
                                </>
                              )}
                            </Button>
                          </div>
                          {loadingRecommendations ? (
                            <LoadingFacts message="Finding the best resources for you..." />
                          ) : recommendations.length > 0 ? (
                            <div className="grid gap-4">
                              {recommendations.map((item, index) => (
                                <Card key={index} className="border-slate-200 hover:border-blue-300 transition-colors">
                                  <CardContent className="pt-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          {item.type === "video" ? (
                                            <Video className="h-5 w-5 text-red-600" />
                                          ) : (
                                            <FileText className="h-5 w-5 text-blue-600" />
                                          )}
                                          <span className="text-xs font-medium text-slate-500 uppercase">{item.type}</span>
                                        </div>
                                        <h4 className="font-semibold text-slate-800 mb-1">{item.topic}</h4>
                                        <a
                                          href={item.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                                        >
                                          View Resource <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : currentTopic && topicRecommendationText[currentTopic] ? (
                            // Raw text response — render with clickable hyperlinks
                            <div className="p-4 bg-slate-50 rounded-lg">
                              <div className="prose prose-slate max-w-none text-sm sm:text-base text-slate-700">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({ href, children }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 underline"
                                      >
                                        {children}
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                      </a>
                                    ),
                                  }}
                                >
                                  {topicRecommendationText[currentTopic]}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-600 text-center py-8">
                              {currentTopic && topicResponses[currentTopic]
                                ? "Recommendations will appear here after content is generated."
                                : "Please generate content for the current topic first."}
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </TabsContent>

                <TabsContent value="summary">
                  <div className="space-y-4">
                    {(() => {
                      const currentTopic = selectedModule?.topics[currentTopicIndex]
                      const summaryData = currentTopic ? topicSummaries[currentTopic] : null

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Summary</h3>
                            <Button
                              onClick={handleGetSummary}
                              disabled={loadingSummary}
                              variant="outline"
                              className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm h-8 sm:h-9 px-3"
                            >
                              {loadingSummary ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-1 h-3 w-3" />
                                  {currentTopic && topicSummaries[currentTopic] ? "Refresh" : "Get Summary"}
                                </>
                              )}
                            </Button>
                          </div>
                          {loadingSummary ? (
                            <LoadingFacts message="Preparing your learning summary..." />
                          ) : summaryData ? (
                            <div className="space-y-6">
                              <div className="p-6 bg-blue-50 rounded-lg">
                                <div className="prose prose-slate prose-headings:font-semibold prose-headings:text-slate-800 prose-h3:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-ul:list-disc prose-ol:list-decimal prose-li:text-slate-700 prose-strong:text-slate-900 max-w-none text-sm sm:text-base">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {summaryData.summary}
                                  </ReactMarkdown>
                                </div>
                              </div>
                              {summaryData.resources.length > 0 && (
                                <div>
                                  <h4 className="text-md font-semibold text-slate-800 mb-3">Additional Resources</h4>
                                  <div className="grid gap-3">
                                    {summaryData.resources.map((resource, index) => (
                                      <Card key={index} className="border-slate-200 hover:border-blue-300 transition-colors">
                                        <CardContent className="pt-4">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              {resource.type === "video" ? (
                                                <Video className="h-5 w-5 text-red-600" />
                                              ) : (
                                                <FileText className="h-5 w-5 text-blue-600" />
                                              )}
                                              <span className="text-xs font-medium text-slate-500 uppercase">{resource.type}</span>
                                            </div>
                                            <a
                                              href={resource.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                                            >
                                              Open <ExternalLink className="h-3 w-3" />
                                            </a>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-slate-600 text-center py-8">
                              {currentTopic && topicResponses[currentTopic]
                                ? "Summary will appear here after content is generated."
                                : "Please generate content for the current topic first."}
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Feedback Modal for Dislike */}
          <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Tell us how we can improve</DialogTitle>
                <DialogDescription>
                  What didn't you like about this content? Your feedback helps us create better learning experiences.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="feedback-text">Your feedback</Label>
                  <Textarea
                    id="feedback-text"
                    placeholder="Please share your thoughts on how we can improve this content..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="min-h-[120px] resize-none"
                    disabled={isSubmittingFeedback}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFeedbackModalOpen(false)
                    setFeedbackText("")
                    setFeedbackTopic(null)
                  }}
                  disabled={isSubmittingFeedback}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFeedbackSubmit}
                  disabled={isSubmittingFeedback || !feedbackText.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmittingFeedback ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Quiz Modal */}
          <Dialog open={isQuizModalOpen} onOpenChange={setIsQuizModalOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
              {(() => {
                if (!selectedModule) return null;
                const topicName = selectedModule.topics[currentTopicIndex]
                const quizQuestions = getQuizDataForTopic(selectedModule.name, topicName)
                if (!quizQuestions) return <div className="p-4">No quiz available for this topic.</div>;

                const handleOptionSelect = (qIndex: number, optIndex: number) => {
                  if (quizScoreResult !== null) return; // Prevent changing answers after submit
                  setQuizAnswers(prev => ({ ...prev, [qIndex]: optIndex }))
                }

                const handleSubmitQuiz = async () => {
                  let score = 0;
                  quizQuestions.forEach((q: any, i: number) => {
                    if (quizAnswers[i] === q.correctIndex) {
                      score++;
                    }
                  });
                  setQuizScoreResult(score);

                  // Save score
                  if (currentUserId && selectedModule) {
                    const currentHighest = topicQuizScores[topicName] || 0;
                    if (score > currentHighest || topicQuizScores[topicName] === undefined) {
                      setTopicQuizScores(prev => ({ ...prev, [topicName]: score }))
                    }
                    try {
                      await saveTopicQuizScore(currentUserId, selectedModule.id, topicName, score)
                    } catch (err) {
                      console.error("Failed to save quiz score", err)
                    }
                  }
                }

                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-xl">Topic Quiz: <span className="text-blue-600">{topicName}</span></DialogTitle>
                      <DialogDescription>
                        Test your knowledge on this topic. There are {quizQuestions.length} questions.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                      {quizScoreResult !== null && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-sm">
                          <h3 className="text-2xl font-bold text-blue-800 mb-1">You scored {quizScoreResult} / {quizQuestions.length}!</h3>
                          <p className="text-blue-600 font-medium">
                            {quizScoreResult === quizQuestions.length ? "Perfect score! Outstanding work ⭐" : "Good effort! Keep learning and try again."}
                          </p>
                        </div>
                      )}

                      <div className="space-y-8">
                        {quizQuestions.map((q: any, qIndex: number) => (
                          <div key={q.id || qIndex} className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="font-semibold text-slate-800 text-sm md:text-base">{qIndex + 1}. {q.question}</p>
                            <div className="space-y-2">
                              {q.options.map((opt: string, optIndex: number) => {
                                const isSelected = quizAnswers[qIndex] === optIndex;
                                let btnVariant = "outline" as any;
                                let btnClass = "w-full justify-start text-left h-auto py-3 px-4 transition-all whitespace-normal shadow-sm relative pr-10";

                                if (quizScoreResult === null) {
                                  if (isSelected) {
                                    btnClass += " ring-2 ring-blue-600 border-transparent bg-blue-50";
                                  } else {
                                    btnClass += " hover:bg-slate-100";
                                  }
                                } else {
                                  const isCorrect = q.correctIndex === optIndex;
                                  if (isCorrect) {
                                    btnClass += " ring-2 ring-green-600 border-transparent bg-green-50 z-10";
                                  } else if (isSelected && !isCorrect) {
                                    btnClass += " ring-2 ring-red-600 border-transparent bg-red-50 z-10";
                                  } else {
                                    btnClass += " opacity-60";
                                  }
                                }

                                return (
                                  <Button
                                    key={optIndex}
                                    variant={btnVariant}
                                    className={btnClass}
                                    onClick={() => handleOptionSelect(qIndex, optIndex)}
                                  >
                                    <div className="flex w-full items-start">
                                      <span className="mr-3 font-bold text-slate-400 mt-0.5">{String.fromCharCode(65 + optIndex)}.</span>
                                      <span className={quizScoreResult !== null && q.correctIndex !== optIndex && isSelected ? "line-through text-slate-600" : "text-slate-700"}>{opt}</span>
                                    </div>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                      {quizScoreResult !== null && q.correctIndex === optIndex && (
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                      )}
                                      {quizScoreResult !== null && q.correctIndex !== optIndex && isSelected && (
                                        <X className="h-5 w-5 text-red-600" />
                                      )}
                                    </div>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {quizScoreResult === null ? (
                        <div className="pt-4 border-t border-slate-100 text-right">
                          <Button
                            className="w-full sm:w-auto min-w-[200px]"
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
                            size="lg"
                          >
                            Submit Answers
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                          <Button variant="outline" className="flex-1" size="lg" onClick={() => setIsQuizModalOpen(false)}>
                            Close
                          </Button>
                          <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            size="lg"
                            onClick={() => {
                              setQuizAnswers({})
                              setQuizScoreResult(null)
                            }}
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Retake Quiz
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </>
  )
}

export default function LearningPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <LearningPageContent />
    </Suspense>
  )
}

// Prevent static generation - this page requires client-side rendering
export const dynamic = 'force-dynamic'
