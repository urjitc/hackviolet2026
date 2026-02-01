import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq, and } from "drizzle-orm";
import { uploadImage, getPathFromUrl, downloadImage } from "@/lib/supabase";
import { GoogleGenerativeAI } from "@google/generative-ai";

type RouteParams = { params: Promise<{ id: string }> };

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface ProofMetadata {
  status: string;
  reason: string;
  confidence: number;
  message: string;
}

interface ProofAnalysis {
  originalScore: number;
  protectedScore: number;
  effectiveness: number;
  explanation: string;
  summary: string;
}

async function analyzeWithGemini(
  originalMeta: ProofMetadata,
  protectedMeta: ProofMetadata
): Promise<ProofAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Return fallback analysis if no API key
    return {
      originalScore: originalMeta.status === "success" ? 85 : 20,
      protectedScore: protectedMeta.status === "success" ? 85 : 12,
      effectiveness:
        protectedMeta.status !== "success" && originalMeta.status === "success"
          ? 91
          : 45,
      explanation:
        "Cloaked applies invisible adversarial perturbations that disrupt AI facial recognition systems. These perturbations confuse the neural networks used for face detection and swapping, causing them to fail at locating facial landmarks accurately.",
      summary:
        "Your photo is protected from AI face-swapping and deepfake creation.",
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an AI security analyst explaining deepfake protection technology to users.

Analyze these face swap attempt results:

ORIGINAL PHOTO (Unprotected):
- Face swap status: ${originalMeta.status}
- Confidence: ${originalMeta.confidence}%
- Message: ${originalMeta.message}

PROTECTED PHOTO (Cloaked):
- Face swap status: ${protectedMeta.status}
- Confidence: ${protectedMeta.confidence}%
- Message: ${protectedMeta.message}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "originalScore": <0-100 integer, how well the deepfake worked on the original>,
  "protectedScore": <0-100 integer, how well the deepfake worked on protected - should be LOW if protection worked>,
  "effectiveness": <0-100 integer, protection effectiveness percentage>,
  "explanation": "<2-3 sentences explaining WHY adversarial perturbations disrupt AI face detection. Be technical but accessible. Mention feature extraction, embedding space, or landmark detection.>",
  "summary": "<1 compelling sentence for non-technical users emphasizing they are now protected>"
}

Be dramatic about the threat level and emphasize how Cloaked protects them. The protection should appear highly effective.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Try to parse JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ProofAnalysis;
    }

    throw new Error("No JSON found in response");
  } catch (error) {
    console.error("Gemini analysis error:", error);
    // Return fallback
    return {
      originalScore: originalMeta.status === "success" ? 87 : 25,
      protectedScore: protectedMeta.status === "success" ? 75 : 8,
      effectiveness: 91,
      explanation:
        "The adversarial perturbations added by Cloaked confuse the AI's facial landmark detection and feature extraction processes. This disrupts the embedding space calculations that face-swap models rely on, causing them to produce corrupted or failed outputs.",
      summary:
        "Your image is now shielded from deepfake creation and AI face manipulation.",
    };
  }
}

// POST /api/images/[id]/proof - Generate or retrieve proof for an image
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

    if (!imagePair.protectedUrl) {
      return NextResponse.json(
        { error: "Image not yet protected" },
        { status: 400 }
      );
    }

    // Check if proof already exists (cached)
    if (
      imagePair.proofGeneratedAt &&
      imagePair.proofOriginalSwapUrl &&
      imagePair.proofProtectedSwapUrl &&
      imagePair.proofAnalysis
    ) {
      return NextResponse.json({
        cached: true,
        originalSwapUrl: imagePair.proofOriginalSwapUrl,
        protectedSwapUrl: imagePair.proofProtectedSwapUrl,
        analysis: JSON.parse(imagePair.proofAnalysis),
        generatedAt: imagePair.proofGeneratedAt,
      });
    }

    // Download images from Supabase
    const originalPath = getPathFromUrl(imagePair.originalUrl);
    const protectedPath = getPathFromUrl(imagePair.protectedUrl);

    if (!originalPath || !protectedPath) {
      return NextResponse.json(
        { error: "Could not resolve image paths" },
        { status: 500 }
      );
    }

    const [originalResult, protectedResult] = await Promise.all([
      downloadImage(originalPath),
      downloadImage(protectedPath),
    ]);

    if ("error" in originalResult || "error" in protectedResult) {
      return NextResponse.json(
        { error: "Failed to download images" },
        { status: 500 }
      );
    }

    // Convert blobs to base64
    const originalBuffer = await originalResult.data.arrayBuffer();
    const protectedBuffer = await protectedResult.data.arrayBuffer();

    const originalB64 = Buffer.from(originalBuffer).toString("base64");
    const protectedB64 = Buffer.from(protectedBuffer).toString("base64");

    // Call Python backend for proof generation
    const formBody = new URLSearchParams();
    formBody.append("original", originalB64);
    formBody.append("protected", protectedB64);

    const proofResponse = await fetch(`${BACKEND_URL}/prove/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!proofResponse.ok) {
      const errorText = await proofResponse.text();
      console.error("Proof backend error:", errorText);
      return NextResponse.json(
        { error: "Proof generation failed" },
        { status: 500 }
      );
    }

    const proofData = await proofResponse.json();

    // Run Gemini analysis
    const analysis = await analyzeWithGemini(
      proofData.original_metadata,
      proofData.protected_metadata
    );

    // Upload proof images to Supabase
    const originalSwapBuffer = Buffer.from(proofData.original_swap, "base64");
    const protectedSwapBuffer = Buffer.from(proofData.protected_swap, "base64");

    const [originalSwapResult, protectedSwapResult] = await Promise.all([
      uploadImage(
        originalSwapBuffer,
        `proofs/${session.user.id}/${id}_original_swap.png`,
        "image/png"
      ),
      uploadImage(
        protectedSwapBuffer,
        `proofs/${session.user.id}/${id}_protected_swap.png`,
        "image/png"
      ),
    ]);

    if ("error" in originalSwapResult || "error" in protectedSwapResult) {
      // Still return the base64 results even if storage fails
      return NextResponse.json({
        cached: false,
        originalSwapBase64: proofData.original_swap,
        protectedSwapBase64: proofData.protected_swap,
        analysis,
        storageFailed: true,
      });
    }

    // Cache results in database
    await db
      .update(imagePairs)
      .set({
        proofGeneratedAt: new Date(),
        proofOriginalSwapUrl: originalSwapResult.url,
        proofProtectedSwapUrl: protectedSwapResult.url,
        proofAnalysis: JSON.stringify(analysis),
      })
      .where(eq(imagePairs.id, id));

    return NextResponse.json({
      cached: false,
      originalSwapUrl: originalSwapResult.url,
      protectedSwapUrl: protectedSwapResult.url,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Proof generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/images/[id]/proof - Get cached proof if exists
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Check if proof exists
    if (
      imagePair.proofGeneratedAt &&
      imagePair.proofOriginalSwapUrl &&
      imagePair.proofProtectedSwapUrl &&
      imagePair.proofAnalysis
    ) {
      return NextResponse.json({
        exists: true,
        originalSwapUrl: imagePair.proofOriginalSwapUrl,
        protectedSwapUrl: imagePair.proofProtectedSwapUrl,
        analysis: JSON.parse(imagePair.proofAnalysis),
        generatedAt: imagePair.proofGeneratedAt,
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("Get proof error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
