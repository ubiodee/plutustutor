// API service functions for Plutus AI endpoints
// Routes now point to local Next.js API routes (/api/generate, /api/recommend, /api/summary)
// which use the unified AI service (services/aiService.ts) to call OpenAI directly.

const API_BASE_URL = "" // Same-origin: calls go to Next.js API routes

export interface GenerateRequest {
  personality: string
  level: string
  topic: string
  query: string
}

export interface GenerateResponse {
  text?: string
  topic?: string
  query?: string
  error?: string
}

export interface RecommendationItem {
  topic: string
  type: "doc" | "video"
  url: string
}

export interface RecommendRequest {
  personality: string
  level: string
  topic: string
  query: string
}

export interface RecommendResponse {
  query?: string
  results?: RecommendationItem[]
  rawText?: string
  error?: string
}

export interface SummaryRequest {
  personality: string
  level: string
  topic: string
  query: string
  content?: string // Generated lesson text for the model to summarize
  top_k?: number
}

export interface SummaryResponse {
  topic?: string
  summary?: string
  resources?: Array<{
    type: "doc" | "video"
    url: string
  }>
  error?: string
}

// Generate questions/content (non-streaming, for backward compatibility)
// Note: This API call may take several minutes to complete. No timeout is set to allow for long-running requests.
export async function generateContent(request: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personality: request.personality.toLowerCase(),
        level: request.level.toLowerCase(),
        topic: request.topic.toLowerCase(),
        query: request.query,
        max_new_tokens: 2500
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      text: data.text || data.response || data.content || JSON.stringify(data),
      topic: data.topic,
      query: data.query
    }
  } catch (error) {
    console.error("Error generating content:", error)
    return { error: error instanceof Error ? error.message : "Failed to generate content" }
  }
}

// Streaming response handler type
export type StreamChunkHandler = (chunk: { text: string }) => void
export type StreamErrorHandler = (error: Error) => void
export type StreamCompleteHandler = (finalText: string, topic?: string, query?: string) => void

/**
 * Generate content with streaming support
 * Handles incremental JSON responses: { "text": "<partial or complete text>" }
 */
export async function generateContentStream(
  request: GenerateRequest,
  onChunk: StreamChunkHandler,
  onError: StreamErrorHandler,
  onComplete: StreamCompleteHandler
): Promise<void> {
  let accumulatedText = ""
  let finalTopic: string | undefined
  let finalQuery: string | undefined

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personality: request.personality.toLowerCase(),
        level: request.level.toLowerCase(),
        topic: request.topic.toLowerCase(),
        query: request.query,
        max_new_tokens: 2500
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    if (!response.body) {
      throw new Error("Response body is null")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let streamComplete = false

    // Helper function to check if JSON string is complete
    const isCompleteJSON = (str: string): boolean => {
      if (!str || !str.trim()) return false

      try {
        // Count braces to check if JSON is complete
        let braceCount = 0
        let bracketCount = 0
        let inString = false
        let escapeNext = false

        for (let i = 0; i < str.length; i++) {
          const char = str[i]

          if (escapeNext) {
            escapeNext = false
            continue
          }

          if (char === '\\') {
            escapeNext = true
            continue
          }

          if (char === '"' && !escapeNext) {
            inString = !inString
            continue
          }

          if (!inString) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
            if (char === '[') bracketCount++
            if (char === ']') bracketCount--
          }
        }

        // JSON is complete if all braces/brackets are balanced and we're not in a string
        return braceCount === 0 && bracketCount === 0 && !inString && str.trim().length > 0
      } catch {
        return false
      }
    }

    // Helper to safely try parsing JSON
    const tryParseJSON = (jsonStr: string): any => {
      if (!jsonStr || !jsonStr.trim()) {
        return null
      }

      // First check if it's complete JSON
      if (!isCompleteJSON(jsonStr)) {
        return null
      }

      try {
        const parsed = JSON.parse(jsonStr)
        return parsed
      } catch (parseError) {
        // Log parse errors for debugging
        console.warn("JSON parse error:", parseError, "String:", jsonStr.substring(0, 100))
        return null
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process SSE format: lines starting with "data:"
        // Continuously process complete lines
        while (true) {
          // Look for complete lines (ending with \n)
          const newlineIndex = buffer.indexOf("\n")
          if (newlineIndex === -1) {
            // No complete line yet, wait for more data
            break
          }

          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)

          if (!line.trim()) continue

          // Process lines starting with "data:" (SSE format)
          if (line.startsWith("data:")) {
            // Strip "data:" prefix and get content
            const dataContent = line.slice(5).trim()

            // Check for stream completion marker
            if (dataContent === "[DONE]") {
              streamComplete = true
              break
            }

            // Skip empty data lines
            if (!dataContent) continue

            // Try to parse JSON - only if complete
            let chunk = tryParseJSON(dataContent)

            // If parsing failed but JSON looks complete, try direct parse as fallback
            if (!chunk && dataContent.trim().startsWith("{") && dataContent.trim().endsWith("}")) {
              try {
                chunk = JSON.parse(dataContent)
                console.log("[Stream] Fallback parse succeeded for:", dataContent.substring(0, 50))
              } catch (fallbackError) {
                // If still fails, it's incomplete - put back in buffer
                if (!isCompleteJSON(dataContent)) {
                  buffer = line + "\n" + buffer
                  break
                }
              }
            }

            if (chunk && chunk.text && typeof chunk.text === "string") {
              // API sends incremental text chunks (not accumulated)
              // Each chunk.text is a new portion to append
              const newPortion = chunk.text
              accumulatedText += newPortion

              console.log("[Stream] Parsed chunk, calling onChunk with:", newPortion.substring(0, 50))

              // Call onChunk callback to update UI
              try {
                onChunk({ text: newPortion })
              } catch (chunkError) {
                console.error("Error in onChunk callback:", chunkError)
              }

              // Extract topic and query if present
              if (chunk.topic) finalTopic = chunk.topic
              if (chunk.query) finalQuery = chunk.query
            } else if (!isCompleteJSON(dataContent)) {
              // Incomplete JSON - put it back in buffer to wait for more data
              // This handles cases where JSON spans multiple chunks
              buffer = line + "\n" + buffer
              break
            } else if (dataContent && dataContent.trim()) {
              // JSON is complete but parsing failed - log for debugging
              console.warn("[Stream] Failed to parse complete JSON:", dataContent.substring(0, 100))
            }
          } else if (line.trim().startsWith("{")) {
            // Handle direct JSON format (without "data:" prefix)
            const trimmedLine = line.trim()
            const chunk = tryParseJSON(trimmedLine)

            if (chunk && chunk.text && typeof chunk.text === "string") {
              // API sends incremental text chunks
              const newPortion = chunk.text
              accumulatedText += newPortion
              onChunk({ text: newPortion })

              if (chunk.topic) finalTopic = chunk.topic
              if (chunk.query) finalQuery = chunk.query
            } else if (!isCompleteJSON(trimmedLine)) {
              // Incomplete JSON - put it back in buffer
              buffer = line + "\n" + buffer
              break
            }
          }
          // Ignore other lines (SSE comments, etc.)
        }

        // If we received [DONE], stop reading
        if (streamComplete) {
          break
        }
      }

      // Process any remaining buffer (in case stream ended without newline)
      if (buffer.trim() && !streamComplete) {
        const trimmedBuffer = buffer.trim()
        if (trimmedBuffer.startsWith("data:")) {
          const dataContent = trimmedBuffer.slice(5).trim()

          if (dataContent === "[DONE]") {
            streamComplete = true
          } else if (dataContent) {
            const chunk = tryParseJSON(dataContent)
            if (chunk && chunk.text && typeof chunk.text === "string") {
              // API sends incremental text chunks
              const newPortion = chunk.text
              accumulatedText += newPortion
              onChunk({ text: newPortion })

              if (chunk.topic) finalTopic = chunk.topic
              if (chunk.query) finalQuery = chunk.query
            }
          }
        } else if (trimmedBuffer.startsWith("{")) {
          const chunk = tryParseJSON(trimmedBuffer)
          if (chunk && chunk.text && typeof chunk.text === "string") {
            // API sends incremental text chunks
            const newPortion = chunk.text
            accumulatedText += newPortion
            onChunk({ text: newPortion })

            if (chunk.topic) finalTopic = chunk.topic
            if (chunk.query) finalQuery = chunk.query
          }
        }
      }

      // Stream completed successfully
      onComplete(accumulatedText, finalTopic, finalQuery)
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    // Preserve accumulated text on error
    onError(error instanceof Error ? error : new Error("Stream failed"))
    // Still call onComplete with what we have
    if (accumulatedText) {
      onComplete(accumulatedText, finalTopic, finalQuery)
    }
  }
}

// Get recommendations
// Note: This API call may take several minutes to complete. No timeout is set to allow for long-running requests.
export async function getRecommendations(request: RecommendRequest): Promise<RecommendResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/recommend`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personality: request.personality.toLowerCase(),
        level: request.level.toLowerCase(),
        topic: request.topic.toLowerCase(),
        query: request.query
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      query: data.query,
      results: Array.isArray(data.results) ? data.results : [],
      rawText: data.raw_text || undefined,
    }
  } catch (error) {
    console.error("Error getting recommendations:", error)
    return { error: error instanceof Error ? error.message : "Failed to get recommendations" }
  }
}

// Get summary (for further learning)
// Note: This API call may take several minutes to complete. No timeout is set to allow for long-running requests.
export async function getSummary(request: SummaryRequest): Promise<SummaryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/summary`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personality: request.personality.toLowerCase(),
        level: request.level.toLowerCase(),
        topic: request.topic.toLowerCase(),
        query: request.query,
        content: request.content || undefined,
        top_k: request.top_k,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    // Check if response is streaming (has body reader) or regular JSON
    if (response.body) {
      const contentType = response.headers.get("content-type") || ""

      // If it's text/event-stream or we detect streaming format, handle as stream
      if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let accumulatedText = ""
        let finalTopic: string | undefined
        let finalResources: Array<{ type: "doc" | "video"; url: string }> = []
        let streamComplete = false

        // Helper function to check if JSON string is complete
        const isCompleteJSON = (str: string): boolean => {
          if (!str || !str.trim()) return false

          try {
            let braceCount = 0
            let bracketCount = 0
            let inString = false
            let escapeNext = false

            for (let i = 0; i < str.length; i++) {
              const char = str[i]

              if (escapeNext) {
                escapeNext = false
                continue
              }

              if (char === '\\') {
                escapeNext = true
                continue
              }

              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }

              if (!inString) {
                if (char === '{') braceCount++
                if (char === '}') braceCount--
                if (char === '[') bracketCount++
                if (char === ']') bracketCount--
              }
            }

            return braceCount === 0 && bracketCount === 0 && !inString && str.trim().length > 0
          } catch {
            return false
          }
        }

        // Helper to safely try parsing JSON
        const tryParseJSON = (jsonStr: string): any => {
          if (!jsonStr || !jsonStr.trim()) {
            return null
          }

          if (!isCompleteJSON(jsonStr)) {
            return null
          }

          try {
            return JSON.parse(jsonStr)
          } catch {
            return null
          }
        }

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              break
            }

            buffer += decoder.decode(value, { stream: true })

            while (true) {
              const newlineIndex = buffer.indexOf("\n")
              if (newlineIndex === -1) {
                break
              }

              const line = buffer.slice(0, newlineIndex)
              buffer = buffer.slice(newlineIndex + 1)

              if (!line.trim()) continue

              if (line.startsWith("data:")) {
                const dataContent = line.slice(5).trim()

                if (dataContent === "[DONE]") {
                  streamComplete = true
                  break
                }

                if (!dataContent) continue

                let chunk = tryParseJSON(dataContent)

                if (!chunk && dataContent.trim().startsWith("{") && dataContent.trim().endsWith("}")) {
                  try {
                    chunk = JSON.parse(dataContent)
                  } catch {
                    if (!isCompleteJSON(dataContent)) {
                      buffer = line + "\n" + buffer
                      break
                    }
                  }
                }

                if (chunk) {
                  if (chunk.text && typeof chunk.text === "string") {
                    accumulatedText += chunk.text
                  }
                  if (chunk.summary && typeof chunk.summary === "string") {
                    accumulatedText += chunk.summary
                  }
                  if (chunk.topic) finalTopic = chunk.topic
                  if (Array.isArray(chunk.resources)) {
                    finalResources = chunk.resources
                  }
                } else if (!isCompleteJSON(dataContent)) {
                  buffer = line + "\n" + buffer
                  break
                }
              } else if (line.trim().startsWith("{")) {
                const chunk = tryParseJSON(line.trim())
                if (chunk) {
                  if (chunk.text) accumulatedText += chunk.text
                  if (chunk.summary) accumulatedText += chunk.summary
                  if (chunk.topic) finalTopic = chunk.topic
                  if (Array.isArray(chunk.resources)) finalResources = chunk.resources
                } else if (!isCompleteJSON(line.trim())) {
                  buffer = line + "\n" + buffer
                  break
                }
              }
            }

            if (streamComplete) {
              break
            }
          }

          // Process remaining buffer
          if (buffer.trim() && !streamComplete) {
            const trimmedBuffer = buffer.trim()
            if (trimmedBuffer.startsWith("data:")) {
              const dataContent = trimmedBuffer.slice(5).trim()
              if (dataContent !== "[DONE]" && dataContent) {
                const chunk = tryParseJSON(dataContent)
                if (chunk) {
                  if (chunk.text) accumulatedText += chunk.text
                  if (chunk.summary) accumulatedText += chunk.summary
                  if (chunk.topic) finalTopic = chunk.topic
                  if (Array.isArray(chunk.resources)) finalResources = chunk.resources
                }
              }
            } else if (trimmedBuffer.startsWith("{")) {
              const chunk = tryParseJSON(trimmedBuffer)
              if (chunk) {
                if (chunk.text) accumulatedText += chunk.text
                if (chunk.summary) accumulatedText += chunk.summary
                if (chunk.topic) finalTopic = chunk.topic
                if (Array.isArray(chunk.resources)) finalResources = chunk.resources
              }
            }
          }

          reader.releaseLock()

          return {
            topic: finalTopic || request.topic,
            summary: accumulatedText || "",
            resources: finalResources
          }
        } catch (streamError) {
          reader.releaseLock()
          throw streamError
        }
      }
    }

    // Fallback to regular JSON parsing if not streaming
    const data = await response.json()
    return {
      topic: data.topic,
      summary: data.summary || data.content || JSON.stringify(data),
      resources: Array.isArray(data.resources) ? data.resources : []
    }
  } catch (error) {
    console.error("Error getting summary:", error)
    return { error: error instanceof Error ? error.message : "Failed to get summary" }
  }
}

