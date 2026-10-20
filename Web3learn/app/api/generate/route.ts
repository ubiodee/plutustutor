/**
 * POST /api/generate
 * 
 * Streaming content generation endpoint.
 * Replaces the external Plutus AI /generate endpoint.
 * Uses the unified AI service with the fine-tuned NEXT_GENERATOR_MODEL.
 * 
 * Returns SSE stream: data: {"text": "..."}\n\n ... data: [DONE]\n\n
 */

import { NextRequest } from "next/server";
import { handleGenerateStream, type AIServiceInput } from "@/services/aiService";

export const maxDuration = 120; // Allow up to 2 minutes for long generations

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.query && !body.topic) {
      return new Response(
        JSON.stringify({ error: "Missing required field: query or topic" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const input_data: AIServiceInput = {
      personality: body.personality || "normal",
      level: body.level || "beginner",
      topic: body.topic || "plutus",
      query: body.query || body.topic,
      max_new_tokens: body.max_new_tokens ?? 2500,
      temperature: body.temperature ?? 0.7,
      top_p: body.top_p ?? 0.5,
    };

    console.log(`[API /generate] ▶ Starting stream for query: "${input_data.query.substring(0, 100)}"`);

    // Create a ReadableStream for SSE
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0;

          for await (const chunk of handleGenerateStream(input_data)) {
            chunkCount++;
            const sseData = `data: ${JSON.stringify({ text: chunk.text, topic: chunk.topic, query: chunk.query })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }

          // Send completion marker
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));

          const latency = Date.now() - startTime;
          console.log(`[API /generate] ✓ Stream complete: ${chunkCount} chunks in ${latency}ms`);

          controller.close();
        } catch (error) {
          const latency = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[API /generate] ✗ Stream error after ${latency}ms:`, errorMessage);

          // Send error as SSE event before closing
          try {
            const errorData = `data: ${JSON.stringify({ text: "\n\n[Error: Unable to complete generation. Please try again.]", error: errorMessage })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch {
            // Controller may already be closed
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[API /generate] ✗ Request error after ${latency}ms:`, errorMessage);

    return new Response(
      JSON.stringify({
        text: "I'm sorry, I couldn't generate content at this time. Please try again later.",
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
