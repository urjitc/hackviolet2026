import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq, and } from "drizzle-orm";
import { deleteImage, getPathFromUrl } from "@/lib/supabase";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/images/[id] - Get a specific image pair
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
      .where(and(eq(imagePairs.id, id), eq(imagePairs.userId, session.user.id)));

    if (!imagePair) {
      return NextResponse.json(
        { error: "Image pair not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(imagePair);
  } catch (error) {
    console.error("Get image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/images/[id] - Delete an image pair and its files
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
      .where(and(eq(imagePairs.id, id), eq(imagePairs.userId, session.user.id)));

    if (!imagePair) {
      return NextResponse.json(
        { error: "Image pair not found" },
        { status: 404 }
      );
    }

    // Delete files from storage
    const originalPath = getPathFromUrl(imagePair.originalUrl);
    if (originalPath) {
      await deleteImage(originalPath);
    }

    if (imagePair.protectedUrl) {
      const protectedPath = getPathFromUrl(imagePair.protectedUrl);
      if (protectedPath) {
        await deleteImage(protectedPath);
      }
    }

    // Delete database record
    await db.delete(imagePairs).where(eq(imagePairs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
