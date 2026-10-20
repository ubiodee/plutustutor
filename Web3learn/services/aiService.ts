/**
 * Unified AI Routing Service
 * 
 * Central service for all AI-related calls. Routes requests to the appropriate
 * endpoint based on task_type:
 * 
 *   - "generate"   → Hugging Face chat-completions endpoint (Devubiodee/plutus-gpt-oss)
 *   - "recommend"  → Hugging Face chat-completions endpoint (Devubiodee/plutus-gpt-oss)
 *   - "summarize"  → Hugging Face chat-completions endpoint (Devubiodee/plutus-gpt-oss)
 */

import OpenAI from "openai";

// ─── Environment Validation ────────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  "HF_TOKEN",
  "HF_ENDPOINT_URL",
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[AI Service] Missing required environment variables: ${missing.join(", ")}. ` +
      `Please add them to your .env.local file.`
    );
  }
}

// ─── OpenAI Client (Lazy Initialization) ───────────────────────────────────────

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.NEXT_OPEN_AI_KEY || "",
    });
  }
  return openaiClient;
}

// ─── Hugging Face Helpers ───────────────────────────────────────────────────────

function getChatCompletionsUrl(): string {
  const rawUrl = (process.env.HF_ENDPOINT_URL || "").trim().replace(/\/+$/, "");
  if (!rawUrl) return "";
  if (rawUrl.endsWith("/chat/completions")) {
    return rawUrl;
  }
  if (rawUrl.endsWith("/v1")) {
    return `${rawUrl}/chat/completions`;
  }
  return `${rawUrl}/v1/chat/completions`;
}

function constructPrompt(input_data: AIServiceInput): string {
  const { personality, level, topic, query } = input_data;
  return `
You are an AI educational assistant.

Personality: ${personality}
Learning Level: ${level}
Topic: ${topic}
User Query: ${query}

Instructions:
- Adapt your response style to the specified personality.
- Explain concepts at the specified learning level.
- Keep the explanation relevant to the specified topic and user query.
- Use clear structure, headings, and examples where appropriate.
- Provide accurate, useful educational content.
- Avoid fabricated facts and technical terminology.
- Generate an appropriately detailed response for the requested topic.
`;
}

function constructRecommendPrompt(input_data: AIServiceInput): string {
  const { personality, level, topic, query } = input_data;
  return `
You are an educational resource finder.

Inputs:
- Personality: ${personality}
- Level: ${level}
- Topic: ${topic}
- Query: ${query}

Find learning resources specifically related to the topic and query. Adapt the difficulty and explanation style to the learner's personality and level.

Provide:
1. **YouTube videos/playlists:** 3 relevant resources with title, direct URL, and a one-line description.
2. **Official documentation:** 2 relevant official documentation or tutorial links.
3. **Articles/PDFs:** 2 useful public learning resources with URLs.
4. **Learning order:** Recommend which resource to study first.

Rules:
- Prioritize resources directly matching the query, not generic topic pages.
- Use real, specific URLs whenever known.
- Never invent URLs, video IDs, titles, or documents.
- If a specific video URL cannot be verified, provide a targeted YouTube search link instead.
- Prefer official documentation and freely accessible resources.
- Keep descriptions concise; prioritize useful links over lengthy explanations.
- If fewer relevant resources are known, return fewer rather than fabricate them.
- Use clickable Markdown links.

Return only the organized resource list and learning order.
`;
}



// ─── Types ──────────────────────────────────────────────────────────────────────

export type TaskType = "generate" | "recommend" | "summarize";

export interface AIServiceInput {
  personality: string;
  level: string;
  topic: string;
  query: string;
  content?: string; // Generated content text (used by summarize)
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface AIServiceResult {
  success: boolean;
  data: any;
  error?: string;
  latency_ms: number;
}

// ─── Logging ────────────────────────────────────────────────────────────────────

function logRequest(task_type: TaskType, input_data: AIServiceInput): void {
  const trimmedInput = {
    ...input_data,
    query: input_data.query?.length > 200
      ? input_data.query.substring(0, 200) + "...[trimmed]"
      : input_data.query,
  };
  console.log(`[AI Service] ▶ ${task_type.toUpperCase()} request:`, JSON.stringify(trimmedInput));
}

function logResponse(task_type: TaskType, output: any, latency_ms: number, success: boolean): void {
  const outputPreview = typeof output === "string"
    ? output.substring(0, 300) + (output.length > 300 ? "...[trimmed]" : "")
    : JSON.stringify(output)?.substring(0, 300);
  console.log(
    `[AI Service] ${success ? "✓" : "✗"} ${task_type.toUpperCase()} ` +
    `completed in ${latency_ms}ms | Output: ${outputPreview}`
  );
}

// ─── Retry Logic ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 120_000; // 2 minutes

function isRetryableError(error: any): boolean {
  if (error instanceof OpenAI.APIError) {
    // Retry on rate limits (429) and server errors (5xx)
    return error.status === 429 || (error.status >= 500 && error.status < 600);
  }
  const status = error?.status;
  if (typeof status === "number") {
    return status === 429 || (status >= 500 && status < 600);
  }
  if (error?.message && /429|500|502|503|504/.test(error.message)) {
    return true;
  }
  // Retry on network errors
  if (error?.code === "ECONNRESET" || error?.code === "ETIMEDOUT") {
    return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, task_type: TaskType): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[AI Service] ⚠ ${task_type.toUpperCase()} attempt ${attempt}/${MAX_RETRIES} failed, ` +
          `retrying in ${delay}ms...`,
          error instanceof Error ? error.message : error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

// ─── Task Handlers ──────────────────────────────────────────────────────────────

/**
 * GENERATE — Uses Hugging Face chat-completions endpoint
 */
async function handleGenerate(input_data: AIServiceInput): Promise<any> {
  validateEnv();

  const prompt = constructPrompt(input_data);
  const max_new_tokens = input_data.max_new_tokens ?? 2500;
  const url = getChatCompletionsUrl();
  const token = process.env.HF_TOKEN;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Devubiodee/plutus-gpt-oss",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
      max_tokens: max_new_tokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error: any = new Error(`Hugging Face API error (${response.status}): ${errorText}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  return {
    text,
    topic: input_data.topic,
    query: input_data.query,
  };
}

/**
 * GENERATE (Streaming) — Uses chat.completions API with stream: false from Hugging Face
 */
export async function* handleGenerateStream(
  input_data: AIServiceInput
): AsyncGenerator<{ text: string; topic?: string; query?: string }> {
  const result = await handleGenerate(input_data);
  if (result.text) {
    yield {
      text: result.text,
      topic: result.topic,
      query: result.query,
    };
  }
}

/** Extract recommendation items from a free-text response containing URLs */
function extractLinksFromText(text: string): Array<{ topic: string; type: "doc" | "video"; url: string }> {
  const items: Array<{ topic: string; type: "doc" | "video"; url: string }> = [];

  // Match markdown links: [title](url)
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const [, title, url] = match;
    const isVideo = /youtube\.com|youtu\.be|vimeo\.com|video/i.test(url + title);
    items.push({ topic: title, type: isVideo ? "video" : "doc", url });
  }

  // If no markdown links found, look for bare URLs
  if (items.length === 0) {
    const urlRegex = /https?:\/\/[^\s\),]+/g;
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0].replace(/[.,;!?)]+$/, ""); // strip trailing punctuation
      const isVideo = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
      // Try to extract a title from surrounding context (text before the URL on the same line)
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineBeforeUrl = text.slice(lineStart, match.index).trim().replace(/^[-*\d.)\s]+/, "").trim();
      const title = lineBeforeUrl || url;
      items.push({ topic: title, type: isVideo ? "video" : "doc", url });
    }
  }

  return items;
}

/**
 * RECOMMEND — Uses Hugging Face chat-completions endpoint with tailored educational resources prompt
 */
async function handleRecommend(input_data: AIServiceInput): Promise<any> {
  validateEnv();

  const prompt = constructRecommendPrompt(input_data);
  const max_new_tokens = input_data.max_new_tokens ?? 2500;
  const url = getChatCompletionsUrl();
  const token = process.env.HF_TOKEN;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Devubiodee/plutus-gpt-oss",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
      max_tokens: max_new_tokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error: any = new Error(`Hugging Face API error (${response.status}): ${errorText}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content || "";

  // Try to parse as JSON first
  let results: any[] = [];
  try {
    const parsed = JSON.parse(outputText);
    if (Array.isArray(parsed)) {
      results = parsed;
    } else if (parsed.results && Array.isArray(parsed.results)) {
      results = parsed.results;
    } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      results = parsed.recommendations;
    }
  } catch {
    // Not JSON — extract links from the free-text response
    results = extractLinksFromText(outputText);
  }

  if (results.length === 0) {
    results = extractLinksFromText(outputText);
  }

  return {
    query: input_data.query,
    results,
    raw_text: outputText,
  };
}

/**
 * SUMMARIZE — Uses Hugging Face chat-completions endpoint (reuses generation flow)
 */
async function handleSummarize(input_data: AIServiceInput): Promise<any> {
  const result = await handleGenerate(input_data);
  return {
    topic: input_data.topic,
    summary: result.text,
    resources: [],
  };
}

// ─── Auto Task Detection ────────────────────────────────────────────────────────

/**
 * Attempts to automatically detect the task type based on input data patterns.
 * Returns the detected task type or null if unable to determine.
 */
export function detectTaskType(input_data: any): TaskType | null {
  if (!input_data) return null;

  // If top_k is present, it's likely a summarize request
  if (input_data.top_k !== undefined) return "summarize";

  // If max_new_tokens or temperature is present with standard fields, likely generate
  if (input_data.max_new_tokens !== undefined || input_data.temperature !== undefined) {
    return "generate";
  }

  return null;
}

// ─── Main Routing Function ──────────────────────────────────────────────────────

/**
 * Unified AI routing function.
 * 
 * Routes to the appropriate OpenAI model based on task_type.
 * 
 * @param task_type - "generate" | "recommend" | "summarize"
 * @param input_data - Request payload (passed as-is to the handler)
 * @returns AIServiceResult with success/error status, data, and latency
 */
export async function call_ai(
  task_type: TaskType,
  input_data: AIServiceInput
): Promise<AIServiceResult> {
  const startTime = Date.now();

  // Validate env on each call (in case of hot reload)
  validateEnv();

  logRequest(task_type, input_data);

  try {
    let data: any;

    // Apply timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[AI Service] Request timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
    );

    const taskPromise = withRetry(async () => {
      switch (task_type) {
        case "generate":
          return handleGenerate(input_data);
        case "recommend":
          return handleRecommend(input_data);
        case "summarize":
          return handleSummarize(input_data);
        default:
          throw new Error(`[AI Service] Unknown task_type: "${task_type}". Valid types: generate, recommend, summarize`);
      }
    }, task_type);

    data = await Promise.race([taskPromise, timeoutPromise]);

    const latency_ms = Date.now() - startTime;
    logResponse(task_type, data, latency_ms, true);

    return {
      success: true,
      data,
      latency_ms,
    };
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[AI Service] ✗ ${task_type.toUpperCase()} failed after ${latency_ms}ms:`, errorMessage);

    logResponse(task_type, errorMessage, latency_ms, false);

    // Return safe fallback response
    const fallbackData = getFallbackResponse(task_type, input_data);

    return {
      success: false,
      data: fallbackData,
      error: errorMessage,
      latency_ms,
    };
  }
}

// ─── Fallback Responses ─────────────────────────────────────────────────────────

function getFallbackResponse(task_type: TaskType, input_data: AIServiceInput): any {
  switch (task_type) {
    case "generate":
      return {
        text: "I'm sorry, I couldn't generate content at this time. Please try again later.",
        topic: input_data.topic,
        query: input_data.query,
      };
    case "recommend":
      return {
        query: input_data.query,
        results: [],
      };
    case "summarize":
      return {
        topic: input_data.topic,
        summary: "Unable to generate summary at this time. Please try again later.",
        resources: [],
      };
    default:
      return { error: `Unknown task type: ${task_type}` };
  }
}
