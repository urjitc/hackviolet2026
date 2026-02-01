import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq, and } from "drizzle-orm";
import { downloadImage, getPathFromUrl } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// POST /api/images/[id]/proof/original - Generate deepfake on original only
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get image pair (only if it belongs to the user)
    const [imagePair] = await db
      .select()
      .from(imagePairs)
      .where(
        and(eq(imagePairs.id, id), eq(imagePairs.userId, session.user.id))
      );

    if (!imagePair) {
      return NextResponse.json(
        { error: "Image pair not found" },
        { status: 404 }
      );
    }

    // Download original image from Supabase
    const originalPath = getPathFromUrl(imagePair.originalUrl);
    if (!originalPath) {
      return NextResponse.json(
        { error: "Could not resolve original image path" },
        { status: 500 }
      );
    }

    const originalResult = await downloadImage(originalPath);
    if ("error" in originalResult) {
      return NextResponse.json(
        { error: "Failed to download original image" },
        { status: 500 }
      );
    }

    // Convert to base64
    const originalBuffer = await originalResult.data.arrayBuffer();
    const originalB64 = Buffer.from(originalBuffer).toString("base64");

    // Call Python backend for original-only proof
    const formBody = new URLSearchParams();
    formBody.append("original", originalB64);

    const proofResponse = await fetch(`${BACKEND_URL}/prove/v2/original`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!proofResponse.ok) {
      const errorText = await proofResponse.text();
      console.error("Original proof backend error:", errorText);
      return NextResponse.json(
        { error: "Original proof generation failed" },
        { status: 500 }
      );
    }

    const proofData = await proofResponse.json();

    return NextResponse.json({
      status: "success",
      originalSwapBase64: proofData.original_swap,
      originalMetadata: proofData.original_metadata,
    });
  } catch (error) {
    console.error("Original proof error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
