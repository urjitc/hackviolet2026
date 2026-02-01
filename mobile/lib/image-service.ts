import { db } from "./db";
import { imagePairs } from "../auth-schema";
import { eq, desc, and } from "drizzle-orm";

export type ImagePairStatus = "pending" | "processing" | "completed" | "failed";

export interface ImagePair {
  id: string;
  userId: string;
  originalUrl: string;
  protectedUrl: string | null;
  status: ImagePairStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Get all image pairs for a user
export async function getUserImagePairs(userId: string): Promise<ImagePair[]> {
  const images = await db
    .select()
    .from(imagePairs)
    .where(eq(imagePairs.userId, userId))
    .orderBy(desc(imagePairs.createdAt));

  return images as ImagePair[];
}

// Get a specific image pair by ID
export async function getImagePairById(
  id: string,
  userId: string
): Promise<ImagePair | null> {
  const [image] = await db
    .select()
    .from(imagePairs)
    .where(and(eq(imagePairs.id, id), eq(imagePairs.userId, userId)));

  return (image as ImagePair) || null;
}

// Create a new image pair record
export async function createImagePair(
  userId: string,
  originalUrl: string
): Promise<ImagePair> {
  const id = crypto.randomUUID();

  const [created] = await db
    .insert(imagePairs)
    .values({
      id,
      userId,
      originalUrl,
      status: "pending",
    })
    .returning();

  return created as ImagePair;
}

// Update image pair status
export async function updateImagePairStatus(
  id: string,
  status: ImagePairStatus,
  protectedUrl?: string
): Promise<ImagePair | null> {
  const updateValues: Partial<{ status: string; protectedUrl: string }> = {
    status,
  };

  if (protectedUrl) {
    updateValues.protectedUrl = protectedUrl;
  }

  const [updated] = await db
    .update(imagePairs)
    .set(updateValues)
    .where(eq(imagePairs.id, id))
    .returning();

  return (updated as ImagePair) || null;
}

// Delete an image pair
export async function deleteImagePair(id: string): Promise<boolean> {
  await db.delete(imagePairs).where(eq(imagePairs.id, id));
  return true;
}
