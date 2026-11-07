import { Client } from "@gradio/client";

export const PLUTUS_API_BASE_URL =
  process.env.NEXT_PUBLIC_PLUTUS_API_URL || "https://plutustutor-1.onrender.com";

export const PLUTUS_RECOMMEND_ENDPOINT = "/recommend_ui";

export interface PlutusRecommendOptions {
  k?: number;
  tool?: "all" | "plinth" | "cardano";
  exclude_text?: string;
}

// Cached client connection promise
let clientInstancePromise: Promise<Client> | null = null;

/**
 * Gets or connects the shared Gradio Client instance.
 * Automatically resets the cache on error so retries can re-establish connection.
 */
export async function getGradioClient(): Promise<Client> {
  if (!clientInstancePromise) {
    clientInstancePromise = Client.connect(PLUTUS_API_BASE_URL).catch((err) => {
      clientInstancePromise = null;
      console.error("[PlutusApi] Failed to connect to Gradio API:", err);
      throw new Error(
        "Could not connect to Plutus Tutor. The backend on Render may take 30-50s to wake up if inactive. Please retry shortly."
      );
    });
  }
  return clientInstancePromise;
}

/**
 * Explicitly resets the client connection cache (e.g. after persistent errors).
 */
export function resetGradioClient(): void {
  clientInstancePromise = null;
}

// In-flight request deduplication map: key -> Promise<string>
const inflightRequests = new Map<string, Promise<string>>();

/**
 * Retrieves Plutus learning recommendations from the deployed Gradio endpoint.
 *
 * @param query The selected Plutus topic or query
 * @param options Optional parameters (k: number, tool: "all"|"plinth"|"cardano", exclude_text: string)
 * @returns Markdown string of recommendations
 */
export async function getPlutusRecommendations(
  query: string,
  options: PlutusRecommendOptions = {}
): Promise<string> {
  const normalizedQuery = (query || "").trim();
  if (!normalizedQuery) {
    throw new Error("Query cannot be empty.");
  }

  const { k = 5, tool = "all", exclude_text = "Hello!!" } = options;
  const requestKey = `${normalizedQuery}::${k}::${tool}::${exclude_text}`;

  // Return existing in-flight request if duplicate triggered
  const existingInflight = inflightRequests.get(requestKey);
  if (existingInflight) {
    return existingInflight;
  }

  const requestPromise = (async () => {
    try {
      const client = await getGradioClient();

      const result = await client.predict(PLUTUS_RECOMMEND_ENDPOINT, {
        query: normalizedQuery,
        k,
        tool,
        exclude_text,
      });

      if (!result || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("No recommendation data received from Plutus Tutor.");
      }

      const markdownOutput = result.data[0];
      if (typeof markdownOutput !== "string") {
        throw new Error("Unexpected response format received from Plutus Tutor.");
      }

      return markdownOutput;
    } catch (err: unknown) {
      console.error(`[PlutusApi] Error predicting recommendations for "${normalizedQuery}":`, err);
      // Reset connection promise on failure so next call tries reconnecting
      resetGradioClient();

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to retrieve recommendations. Please check your connection and try again.";
      throw new Error(errorMessage);
    } finally {
      inflightRequests.delete(requestKey);
    }
  })();

  inflightRequests.set(requestKey, requestPromise);
  return requestPromise;
}
