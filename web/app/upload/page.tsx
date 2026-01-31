"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ImageUpload } from "@/components/image-upload";
import { ImageGallery } from "@/components/image-gallery";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">DeepGuard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {session.user?.name || session.user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Protect Your Image</h2>
            <p className="text-muted-foreground mt-2">
              Upload an image to add invisible protection against deepfake usage.
            </p>
          </div>

          <ImageUpload onUploadComplete={handleUploadComplete} />

          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">How it works</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Upload your original image</li>
              <li>Our system processes the image and adds invisible adversarial data</li>
              <li>Download the protected version - it looks identical but is resistant to deepfake manipulation</li>
            </ol>
          </div>

          {/* Image History Gallery */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-4">Your Protected Images</h3>
            <ImageGallery refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </main>
    </div>
  );
}
