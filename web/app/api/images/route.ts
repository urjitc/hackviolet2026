import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { eq, desc } from "drizzle-orm";

// GET /api/images - Get all image pairs for the authenticated user
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const images = await db
      .select()
      .from(imagePairs)
      .where(eq(imagePairs.userId, session.user.id))
      .orderBy(desc(imagePairs.createdAt));

    return NextResponse.json(images);
  } catch (error) {
    console.error("Get images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
