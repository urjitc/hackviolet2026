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
      <div className="min-h-screen flex items-center justify-center bg-[var(--vintage-cream)]">
        <p className="font-handwriting text-3xl text-[var(--vintage-brown)]/70">loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Vintage styled */}
      <header className="border-b border-[var(--vintage-brown)]/10 bg-[var(--vintage-cream)]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-handwriting text-2xl md:text-3xl text-[var(--vintage-brown)]">
            Cloaked
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-sm text-[var(--vintage-brown)]/70 hidden sm:block">
              Welcome, {session.user?.name || session.user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-[var(--vintage-brown)]/70 hover:text-[var(--vintage-brown)] hover:bg-[var(--vintage-brown)]/5"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Upload Section */}
          <section className="py-8 md:py-12">
            <ImageUpload onUploadComplete={handleUploadComplete} />
          </section>

          {/* Gallery Section */}
          <section className="py-8">
            {/* Section title with decorative line */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--vintage-brown)]/20 to-transparent" />
              <h2 className="font-handwriting text-2xl md:text-3xl text-[var(--vintage-brown)]/80 px-4">
                protected photos
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--vintage-brown)]/20 to-transparent" />
            </div>
            <ImageGallery refreshTrigger={refreshTrigger} />
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 text-center">
        <p className="font-handwriting text-2xl text-[var(--vintage-brown)]/50">
          your photos, safe
        </p>
      </footer>
    </div>
  );
}
