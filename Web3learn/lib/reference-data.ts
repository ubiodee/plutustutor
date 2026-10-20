// Utility functions to work with referenceData.json

export type Personality = "Dyslexic" | "Autistic" | "Dyscalculic" | "Expressive" | "Introverted" | "Normal" | "Nerd"
export type Level = "Beginner" | "Intermediary" | "Expert"

export interface ContentEntry {
  Topic: string
  Level: string
  Personality: string
  Content: string
}

export interface ReferenceData {
  Modules: {
    [moduleName: string]: ContentEntry[]
  }
}

// Load reference data
let cachedData: ReferenceData | null = null

export async function loadReferenceData(): Promise<ReferenceData> {
  if (cachedData) {
    return cachedData
  }

  try {
    const response = await fetch("/refrenceData.json")
    if (!response.ok) {
      throw new Error("Failed to load reference data")
    }
    cachedData = await response.json()
    return cachedData
  } catch (error) {
    console.error("Error loading reference data:", error)
    throw error
  }
}

// Get content for a specific topic, personality, and level
export function getContentForTopic(
  data: ReferenceData,
  topic: string,
  personality: Personality,
  level: Level
): ContentEntry | null {
  for (const moduleName in data.Modules) {
    const entries = data.Modules[moduleName]
    const match = entries.find(
      (entry) =>
        entry.Topic === topic &&
        entry.Personality === personality &&
        entry.Level === level
    )
    if (match) {
      return match
    }
  }
  return null
}

// Get all topics for a module
export function getTopicsForModule(data: ReferenceData, moduleName: string): string[] {
  const entries = data.Modules[moduleName] || []
  const topics = new Set<string>()
  entries.forEach((entry) => topics.add(entry.Topic))
  return Array.from(topics)
}

// Get all modules
export function getModules(data: ReferenceData): string[] {
  return Object.keys(data.Modules)
}

// Get content for a module, personality, and level
export function getModuleContent(
  data: ReferenceData,
  moduleName: string,
  personality: Personality,
  level: Level
): ContentEntry[] {
  const entries = data.Modules[moduleName] || []
  return entries.filter(
    (entry) => entry.Personality === personality && entry.Level === level
  )
}

