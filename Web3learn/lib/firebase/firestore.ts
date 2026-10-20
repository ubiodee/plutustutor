// Firestore Database Service
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { getDbInstance, auth } from "./config"

/**
 * Exponential backoff utility for Firestore operations
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  // Ensure auth is ready from persistence before any Firestore operation
  // This prevents "insufficient permissions" during initial page load
  await auth.authStateReady()

  let retries = 0
  while (true) {
    try {
      return await operation()
    } catch (error: any) {
      const isTransient =
        error.code === "unavailable" ||
        error.code === "deadline-exceeded" ||
        error.message?.includes("offline") ||
        error.code === "resource-exhausted"

      if (!isTransient || retries >= maxRetries) {
        throw error
      }

      retries++
      const delay = initialDelay * Math.pow(2, retries - 1)
      console.warn(`Firestore operation failed (attempt ${retries}/${maxRetries + 1}), retrying in ${delay}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

/**
 * Helper to ensure user is authenticated before performing operations
 */
async function ensureAuth(): Promise<string> {
  // Wait for auth to initialize
  await auth.authStateReady?.()

  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error("Authentication required for this operation")
  }
  return currentUser.uid
}

// Types
export interface ModuleProgress {
  userId: string
  moduleId: string
  moduleName: string
  completedAt: Timestamp | null
  topicsCompleted: number
  totalTopics: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface TopicData {
  userId: string
  moduleId: string
  topicName: string
  topicIndex: number
  generatedContent?: {
    text: string
    topic: string
    query: string
    generatedAt: Timestamp
  }
  recommendations?: {
    query: string
    results: Array<{
      topic: string
      type: "doc" | "video"
      url: string
    }>
    fetchedAt: Timestamp
  }
  summary?: {
    topic: string
    summary: string
    resources: Array<{
      type: "doc" | "video"
      url: string
    }>
    fetchedAt: Timestamp
  }
  feedback?: {
    type: "like" | "dislike" | null
    text?: string  // Optional feedback text for dislike
    updatedAt: Timestamp
  }
  quizScore?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Module Progress Functions
export async function createOrUpdateModuleProgress(
  userId: string,
  moduleId: string,
  moduleName: string,
  topicsCompleted: number,
  totalTopics: number,
  isCompleted: boolean = false
): Promise<void> {
  try {
    const db = getDbInstance()
    const moduleRef = doc(db, "modules", `${userId}_${moduleId}`)

    await retryWithBackoff(async () => {
      const moduleDoc = await getDoc(moduleRef)

      const moduleData: Partial<ModuleProgress> = {
        userId,
        moduleId,
        moduleName,
        topicsCompleted,
        totalTopics,
        updatedAt: serverTimestamp() as Timestamp,
      }

      if (moduleDoc.exists()) {
        if (isCompleted) {
          moduleData.completedAt = serverTimestamp() as Timestamp
        }
        await updateDoc(moduleRef, moduleData)
      } else {
        await setDoc(moduleRef, {
          ...moduleData,
          completedAt: isCompleted ? (serverTimestamp() as Timestamp) : null,
          createdAt: serverTimestamp() as Timestamp,
        })
      }
    })
  } catch (error: any) {
    console.error("Error saving module progress:", error)
    throw new Error(error.message || "Failed to save module progress")
  }
}

export async function getModuleProgress(
  userId: string,
  moduleId: string
): Promise<ModuleProgress | null> {
  try {
    const db = getDbInstance()
    const moduleRef = doc(db, "modules", `${userId}_${moduleId}`)
    const moduleDoc = await retryWithBackoff(() => getDoc(moduleRef))

    if (moduleDoc.exists()) {
      return { id: moduleDoc.id, ...moduleDoc.data() } as unknown as ModuleProgress
    }

    return null
  } catch (error: any) {
    console.error("Error getting module progress:", error)
    return null
  }
}

export async function getAllUserModules(userId: string): Promise<ModuleProgress[]> {
  try {
    const db = getDbInstance()
    const modulesQuery = query(
      collection(db, "modules"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )

    const querySnapshot = await retryWithBackoff(() => getDocs(modulesQuery))
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as ModuleProgress[]
  } catch (error: any) {
    console.error("Error getting user modules:", error)
    return []
  }
}

// Topic Data Functions
export async function saveTopicGeneratedContent(
  userId: string,
  moduleId: string,
  topicName: string,
  topicIndex: number,
  text: string,
  topic: string,
  query: string
): Promise<void> {
  try {
    const db = getDbInstance()
    const topicId = `${userId}_${moduleId}_${topicName.replace(/\s+/g, "_")}`
    const topicRef = doc(db, "topics", topicId)

    await retryWithBackoff(() =>
      setDoc(
        topicRef,
        {
          userId,
          moduleId,
          topicName,
          topicIndex,
          generatedContent: {
            text,
            topic,
            query,
            generatedAt: serverTimestamp() as Timestamp,
          },
          updatedAt: serverTimestamp() as Timestamp,
        },
        { merge: true }
      )
    )
  } catch (error: any) {
    console.error("Error saving topic content:", error)
    throw new Error(error.message || "Failed to save topic content")
  }
}

export async function saveTopicRecommendations(
  userId: string,
  moduleId: string,
  topicName: string,
  query: string,
  results: Array<{ topic: string; type: "doc" | "video"; url: string }>
): Promise<void> {
  try {
    const db = getDbInstance()
    const topicId = `${userId}_${moduleId}_${topicName.replace(/\s+/g, "_")}`
    const topicRef = doc(db, "topics", topicId)

    await retryWithBackoff(() =>
      updateDoc(topicRef, {
        recommendations: {
          query,
          results,
          fetchedAt: serverTimestamp() as Timestamp,
        },
        updatedAt: serverTimestamp() as Timestamp,
      })
    )
  } catch (error: any) {
    console.error("Error saving topic recommendations:", error)
    throw new Error(error.message || "Failed to save topic recommendations")
  }
}

export async function saveTopicSummary(
  userId: string,
  moduleId: string,
  topicName: string,
  topic: string,
  summary: string,
  resources: Array<{ type: "doc" | "video"; url: string }>
): Promise<void> {
  try {
    const db = getDbInstance()
    const topicId = `${userId}_${moduleId}_${topicName.replace(/\s+/g, "_")}`
    const topicRef = doc(db, "topics", topicId)

    await retryWithBackoff(() =>
      updateDoc(topicRef, {
        summary: {
          topic,
          summary,
          resources,
          fetchedAt: serverTimestamp() as Timestamp,
        },
        updatedAt: serverTimestamp() as Timestamp,
      })
    )
  } catch (error: any) {
    console.error("Error saving topic summary:", error)
    throw new Error(error.message || "Failed to save topic summary")
  }
}

export async function saveTopicFeedback(
  userId: string,
  moduleId: string,
  topicName: string,
  feedbackType: "like" | "dislike" | null,
  feedbackText?: string
): Promise<void> {
  try {
    const db = getDbInstance()
    const topicId = `${userId}_${moduleId}_${topicName.replace(/\s+/g, "_")}`
    const topicRef = doc(db, "topics", topicId)

    const feedbackData: any = {
      type: feedbackType,
      updatedAt: serverTimestamp() as Timestamp,
    }

    if (feedbackText && feedbackText.trim() !== "") {
      feedbackData.text = feedbackText.trim()
    }

    await retryWithBackoff(() =>
      updateDoc(topicRef, {
        feedback: feedbackData,
        updatedAt: serverTimestamp() as Timestamp,
      })
    )
  } catch (error: any) {
    console.error("Error saving topic feedback:", error)
    throw new Error(error.message || "Failed to save topic feedback")
  }
}

export async function getTopicData(
  userId: string,
  moduleId: string,
  topicName: string
): Promise<TopicData | null> {
  try {
    const db = getDbInstance()
    const topicId = `${userId}_${moduleId}_${topicName.replace(/\s+/g, "_")}`
    const topicRef = doc(db, "topics", topicId)
    const topicDoc = await retryWithBackoff(() => getDoc(topicRef))

    if (topicDoc.exists()) {
      return { id: topicDoc.id, ...topicDoc.data() } as unknown as TopicData
    }

    return null
  } catch (error: any) {
    console.error("Error getting topic data:", error)
    return null
  }
}

export async function getAllModuleTopics(
  userId: string,
  moduleId: string
): Promise<TopicData[]> {
  try {
    const db = getDbInstance()
    const topicsQuery = query(
      collection(db, "topics"),
      where("userId", "==", userId),
      where("moduleId", "==", moduleId),
      orderBy("topicIndex", "asc")
    )

    const querySnapshot = await retryWithBackoff(() => getDocs(topicsQuery))
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as TopicData[]
  } catch (error: any) {
    console.error("Error getting module topics:", error)
    return []
  }
}

export async function saveTopicQuizScore(
  userId: string,
  moduleId: string,
  topicName: string,
  score: number
): Promise<void> {
  try {
    const db = getDbInstance()
    const topicId = `${userId}_${moduleId}_${topicName.replace(/\s+/g, "_")}`
    const topicRef = doc(db, "topics", topicId)

    await retryWithBackoff(() =>
      updateDoc(topicRef, {
        quizScore: score,
        updatedAt: serverTimestamp() as Timestamp,
      })
    )
  } catch (error: any) {
    console.error("Error saving topic quiz score:", error)
    throw new Error(error.message || "Failed to save topic quiz score")
  }
}


