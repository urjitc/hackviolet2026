import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq } from "drizzle-orm";
import { uploadImage, downloadImage, getPathFromUrl } from "@/lib/supabase";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const { imagePairId, strength = "medium" } = await request.json();

    if (!imagePairId) {
      return NextResponse.json(
        { error: "imagePairId is required" },
        { status: 400 }
      );
    }

    // Get the image pair record
    const [imagePair] = await db
      .select()
      .from(imagePairs)
      .where(eq(imagePairs.id, imagePairId));

    if (!imagePair) {
      return NextResponse.json(
        { error: "Image pair not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await db
      .update(imagePairs)
      .set({ status: "processing" })
      .where(eq(imagePairs.id, imagePairId));

    // Get the storage path from the original URL
    const originalPath = getPathFromUrl(imagePair.originalUrl);
    if (!originalPath) {
      await db
        .update(imagePairs)
        .set({ status: "failed" })
        .where(eq(imagePairs.id, imagePairId));
      return NextResponse.json(
        { error: "Could not parse original URL" },
        { status: 500 }
      );
    }

    // Download the original image
    const downloadResult = await downloadImage(originalPath);
    if ("error" in downloadResult) {
      await db
        .update(imagePairs)
        .set({ status: "failed" })
        .where(eq(imagePairs.id, imagePairId));
      return NextResponse.json(
        { error: `Download failed: ${downloadResult.error}` },
        { status: 500 }
      );
    }

    // Convert blob to base64 for the cloaking API
    const arrayBuffer = await downloadResult.data.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    // Call the Python cloaking backend
    const formBody = new URLSearchParams();
    formBody.append("image", base64Image);
    formBody.append("strength", strength);

    const cloakResponse = await fetch(`${BACKEND_URL}/cloak/base64`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    if (!cloakResponse.ok) {
      const errorData = await cloakResponse.json().catch(() => ({}));
      await db
        .update(imagePairs)
        .set({ status: "failed" })
        .where(eq(imagePairs.id, imagePairId));
      return NextResponse.json(
        { error: `Cloaking failed: ${errorData.detail || "Unknown error"}` },
        { status: 500 }
      );
    }

    const cloakData = await cloakResponse.json();

    // Decode the base64 cloaked image
    const cloakedBuffer = Buffer.from(cloakData.cloaked_image, "base64");

    // Generate protected image path
    const protectedPath = originalPath.replace("originals/", "protected/");

    // Upload the cloaked image to Supabase
    const uploadResult = await uploadImage(
      cloakedBuffer,
      protectedPath,
      "image/png"
    );

    if ("error" in uploadResult) {
      await db
        .update(imagePairs)
        .set({ status: "failed" })
        .where(eq(imagePairs.id, imagePairId));
      return NextResponse.json(
        { error: `Upload failed: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    // Update database with protected URL and completed status
    const [updatedPair] = await db
      .update(imagePairs)
      .set({
        protectedUrl: uploadResult.url,
        status: "completed",
      })
      .where(eq(imagePairs.id, imagePairId))
      .returning();

    return NextResponse.json({
      id: updatedPair.id,
      originalUrl: updatedPair.originalUrl,
      protectedUrl: updatedPair.protectedUrl,
      status: updatedPair.status,
      metadata: cloakData.metadata,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
