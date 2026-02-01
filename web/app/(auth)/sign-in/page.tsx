"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const signInResponse = await authClient.signIn.email({
        email,
        password,
      });

      if (signInResponse.error) {
        setError(signInResponse.error.message || "Failed to sign in");
        return;
      }

      router.push("/upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--vintage-cream)]">
      {/* Polaroid-style card */}
      <div className="polaroid polaroid-lg w-full max-w-sm">
        {/* Header area */}
        <div className="bg-[var(--vintage-paper)] p-6 text-center border-b border-[var(--vintage-brown)]/10">
          <h1 className="font-handwriting text-4xl text-[var(--vintage-brown)] mb-2">
            Cloaked
          </h1>
          <p className="font-handwriting text-lg text-[var(--vintage-brown)]/60">
            welcome back
          </p>
        </div>

        {/* Form area (caption area) */}
        <div className="pt-6 pb-2 px-2">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-[var(--darkroom-red)]/10 border border-[var(--darkroom-red)]/30 rounded text-[var(--darkroom-red)] text-sm">
                <span className="font-handwriting text-base">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="font-handwriting text-lg text-[var(--vintage-brown)]"
              >
                email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="auth-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="font-handwriting text-lg text-[var(--vintage-brown)]"
              >
                password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="auth-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-vintage font-handwriting text-lg"
              disabled={isLoading}
            >
              {isLoading ? "signing in..." : "sign in"}
            </Button>

            <p className="text-center font-handwriting text-base text-[var(--vintage-brown)]/70">
              new here?{" "}
              <Link
                href="/sign-up"
                className="text-[var(--vintage-amber)] hover:text-[var(--vintage-brown)] underline underline-offset-2"
              >
                create account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
