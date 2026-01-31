"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // If user is already logged in, redirect to upload page
    if (!isPending && session) {
      router.push("/upload");
    }
  }, [session, isPending, router]);

  // Show nothing while checking auth state
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If already authenticated, don't show auth pages
  if (session) {
    return null;
  }

  return <>{children}</>;
}
