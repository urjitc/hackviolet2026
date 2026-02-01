import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq, and } from "drizzle-orm";
import { downloadImage, getPathFromUrl } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// POST /api/images/[id]/proof/protected - Generate deepfake on protected only
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

    // Use proofUrl (heavy cloak) for the test
    const proofPath = imagePair.proofUrl
      ? getPathFromUrl(imagePair.proofUrl)
      : getPathFromUrl(imagePair.protectedUrl);

    if (!proofPath) {
      return NextResponse.json(
        { error: "Could not resolve protected image path" },
        { status: 500 }
      );
    }

    const proofResult = await downloadImage(proofPath);
    if ("error" in proofResult) {
      return NextResponse.json(
        { error: "Failed to download protected image" },
        { status: 500 }
      );
    }

    // Convert to base64
    const proofBuffer = await proofResult.data.arrayBuffer();
    const proofB64 = Buffer.from(proofBuffer).toString("base64");

    // Call Python backend for protected-only proof
    const formBody = new URLSearchParams();
    formBody.append("protected", proofB64);

    const proofResponse = await fetch(`${BACKEND_URL}/prove/v2/protected`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!proofResponse.ok) {
      const errorText = await proofResponse.text();
      console.error("Protected proof backend error:", errorText);
      return NextResponse.json(
        { error: "Protected proof generation failed" },
        { status: 500 }
      );
    }

    const proofData = await proofResponse.json();

    return NextResponse.json({
      status: "success",
      protectedSwapBase64: proofData.protected_swap,
      protectedMetadata: proofData.protected_metadata,
      // Also return the lightly edited protectedUrl for display
      protectedUrl: imagePair.protectedUrl,
    });
  } catch (error) {
    console.error("Protected proof error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
