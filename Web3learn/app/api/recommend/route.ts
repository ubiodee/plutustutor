/**
 * POST /api/recommend
 * 
 * Learning recommendations endpoint.
 * Replaces the external Plutus AI /recommend endpoint.
 * Uses the unified AI service with stored prompt NEXT_RECOMMENDER_MODEL.
 * 
 * Returns JSON: { query, results: [{ topic, type, url }] }
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
      max_new_tokens: body.max_new_tokens ?? 700,
      temperature: body.temperature ?? 0.4,
      top_p: body.top_p ?? 0.5,
    };

    console.log(`[API /recommend] ▶ Request for query: "${input_data.query.substring(0, 100)}"`);

    const result = await call_ai("recommend", input_data);

    if (!result.success) {
      console.error(`[API /recommend] ✗ AI service error:`, result.error);
      // Still return the fallback data with 200 status to avoid breaking the client
      return NextResponse.json(result.data);
    }

    console.log(`[API /recommend] ✓ Success in ${result.latency_ms}ms, ${result.data?.results?.length || 0} results`);

    return NextResponse.json(result.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API /recommend] ✗ Request error:", errorMessage);

    return NextResponse.json(
      {
        query: "",
        results: [],
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
