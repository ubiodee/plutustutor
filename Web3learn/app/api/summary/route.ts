/**
 * POST /api/summary
 * 
 * Topic summary endpoint.
 * Replaces the external Plutus AI /summary endpoint.
 * Uses the unified AI service with stored prompt NEXT_SUMMRY_MODEL.
 * 
 * Returns JSON: { topic, summary, resources: [{ type, url }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { call_ai, type AIServiceInput } from "@/services/aiService";

export const maxDuration = 120; // Allow up to 2 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.query && !body.topic) {
      return NextResponse.json(
        { error: "Missing required field: query or topic" },
        { status: 400 }
      );
    }

    const input_data: AIServiceInput = {
      personality: body.personality || "normal",
      level: body.level || "beginner",
      topic: body.topic || "plutus",
      query: body.query || body.topic,
      content: body.content || undefined,
      top_k: body.top_k ?? 5,
    };

    console.log(`[API /summary] ▶ Request for query: "${input_data.query.substring(0, 100)}"`);

    const result = await call_ai("summarize", input_data);

    if (!result.success) {
      console.error(`[API /summary] ✗ AI service error:`, result.error);
      // Still return the fallback data with 200 status to avoid breaking the client
      return NextResponse.json(result.data);
    }

    console.log(`[API /summary] ✓ Success in ${result.latency_ms}ms`);

    return NextResponse.json(result.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API /summary] ✗ Request error:", errorMessage);

    return NextResponse.json(
      {
        topic: "",
        summary: "Unable to generate summary at this time. Please try again later.",
        resources: [],
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
