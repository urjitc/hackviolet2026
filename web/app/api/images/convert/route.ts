import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq } from "drizzle-orm";
import { uploadImage, downloadImage, getPathFromUrl } from "@/lib/supabase";

/**
 * PLACEHOLDER CONVERSION ENDPOINT
 *
 * This endpoint simulates the image protection/conversion process.
 * In the real implementation, this will:
 * 1. Download the original image
 * 2. Apply adversarial perturbations to prevent deepfake usage
 * 3. Upload the protected image
 *
 * For now, it just copies the original as the "protected" version.
 */
export async function POST(request: NextRequest) {
  try {
    const { imagePairId } = await request.json();

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

    // Simulate processing delay (1-2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1500));

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

    // PLACEHOLDER: In the real implementation, apply adversarial protection here
    // For now, we just use the original image as-is
    const protectedImageData = downloadResult.data;

    // Generate protected image path
    const protectedPath = originalPath.replace("originals/", "protected/");

    // Upload the "protected" image
    const arrayBuffer = await protectedImageData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await uploadImage(
      buffer,
      protectedPath,
      protectedImageData.type || "image/png"
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
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
