import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

// Server-side client with service role (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket name
export const IMAGES_BUCKET = "images";

// Ensure the bucket exists (call once on first upload)
let bucketInitialized = false;
async function ensureBucketExists() {
  if (bucketInitialized) return;

  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === IMAGES_BUCKET);

  if (!bucketExists) {
    await supabaseAdmin.storage.createBucket(IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });
  }

  bucketInitialized = true;
}

// Storage helper functions
export async function uploadImage(
  file: Buffer,
  path: string,
  contentType: string
): Promise<{ url: string } | { error: string }> {
  // Ensure bucket exists before uploading
  await ensureBucketExists();

  const { data, error } = await supabaseAdmin.storage
    .from(IMAGES_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    return { error: error.message };
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(IMAGES_BUCKET)
    .getPublicUrl(data.path);

  return { url: urlData.publicUrl };
}

export async function deleteImage(path: string): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.storage
    .from(IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function downloadImage(
  path: string
): Promise<{ data: Blob } | { error: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(IMAGES_BUCKET)
    .download(path);

  if (error) {
    return { error: error.message };
  }

  return { data };
}

// Helper to extract storage path from full URL
export function getPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/images\/(.+)/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}
