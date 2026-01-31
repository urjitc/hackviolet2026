import { createClient } from "@supabase/supabase-js";
import { decode } from "base64-arraybuffer";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket name (must match web app)
export const IMAGES_BUCKET = "images";

// Image pair types
export type ImagePairStatus = "pending" | "processing" | "completed" | "failed";

export interface ImagePair {
  id: string;
  user_id: string;
  original_url: string;
  protected_url: string | null;
  status: ImagePairStatus;
  created_at: string;
  updated_at: string;
}

// Database operations for image_pairs table
export async function getUserImagePairs(userId: string): Promise<ImagePair[]> {
  const { data, error } = await supabase
    .from("image_pairs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching image pairs:", error);
    return [];
  }

  return data || [];
}

export async function createImagePair(
  userId: string,
  originalUrl: string
): Promise<ImagePair | null> {
  const { data, error } = await supabase
    .from("image_pairs")
    .insert({
      user_id: userId,
      original_url: originalUrl,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating image pair:", error);
    return null;
  }

  return data;
}

export async function updateImagePairStatus(
  id: string,
  status: ImagePairStatus,
  protectedUrl?: string
): Promise<ImagePair | null> {
  const updateData: { status: string; protected_url?: string } = { status };
  if (protectedUrl) {
    updateData.protected_url = protectedUrl;
  }

  const { data, error } = await supabase
    .from("image_pairs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating image pair:", error);
    return null;
  }

  return data;
}

export async function deleteImagePair(id: string): Promise<boolean> {
  const { error } = await supabase.from("image_pairs").delete().eq("id", id);

  if (error) {
    console.error("Error deleting image pair:", error);
    return false;
  }

  return true;
}

// Upload image to Supabase Storage from base64
export async function uploadImageToStorage(
  base64Data: string,
  path: string,
  contentType: string
): Promise<{ url: string } | { error: string }> {
  try {
    // Convert base64 to ArrayBuffer using base64-arraybuffer
    const arrayBuffer = decode(base64Data);

    const { data, error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      return { error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from(IMAGES_BUCKET)
      .getPublicUrl(data.path);

    return { url: urlData.publicUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
}

// Delete image from storage
export async function deleteImageFromStorage(
  path: string
): Promise<{ error?: string }> {
  const { error } = await supabase.storage.from(IMAGES_BUCKET).remove([path]);

  if (error) {
    return { error: error.message };
  }

  return {};
}

// Get public URL for an image
export function getImageUrl(path: string): string {
  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Helper to extract storage path from full URL
export function getPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(
      /\/storage\/v1\/object\/public\/images\/(.+)/
    );
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}
