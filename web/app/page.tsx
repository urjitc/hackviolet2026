"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // If user is logged in, redirect to upload page
    if (!isPending && session) {
      router.push("/upload");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">DeepGuard</h1>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Protect Your Images from Deepfakes
          </h2>
          <p className="text-xl text-muted-foreground">
            Add invisible adversarial protection to your photos. They look identical
            to the human eye, but are resistant to AI manipulation and deepfake generation.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-left">
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Upload</h3>
              <p className="text-sm text-muted-foreground">
                Simply upload your original image in PNG, JPEG, or WEBP format.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Protect</h3>
              <p className="text-sm text-muted-foreground">
                Our system adds invisible adversarial data that confuses AI models.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Download</h3>
              <p className="text-sm text-muted-foreground">
                Get your protected image that looks identical but resists manipulation.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
