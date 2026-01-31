import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/src/db/drizzle";
import { imagePairs } from "@/auth-schema";
import { uploadImage } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPEG, WEBP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 10MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileId = crypto.randomUUID();
    const extension = file.name.split(".").pop() || "png";
    const storagePath = `originals/${userId}/${fileId}.${extension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const uploadResult = await uploadImage(buffer, storagePath, file.type);

    if ("error" in uploadResult) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    // Create database record
    const [imagePair] = await db
      .insert(imagePairs)
      .values({
        userId,
        originalUrl: uploadResult.url,
        status: "pending",
      })
      .returning();

    // Call conversion endpoint (fire and forget for now)
    // In production, you might want to use a queue or background job
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/images/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imagePairId: imagePair.id }),
    }).catch((err) => {
      console.error("Failed to trigger conversion:", err);
    });

    return NextResponse.json({
      id: imagePair.id,
      originalUrl: imagePair.originalUrl,
      status: imagePair.status,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
