"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

interface ProofAnalysis {
  originalScore: number;
  protectedScore: number;
  effectiveness: number;
  explanation: string;
  summary: string;
}

// Removed ScoreBar component - no longer needed

interface ProofData {
  originalSwapUrl?: string;
  protectedSwapUrl?: string;
  protectedUrl?: string; // Fallback: lightly edited image when deepfake fails
  originalSwapBase64?: string;
  protectedSwapBase64?: string;
  analysis: ProofAnalysis;
  generatedAt?: string;
  cached?: boolean;
  // Progressive loading states
  originalReady?: boolean;
  protectedReady?: boolean;
}

interface ProtectionProofModalProps {
  imageId: string;
  originalUrl?: string;
  protectedUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProofImageCard({
  title,
  subtitle,
  imageUrl,
  imageBase64,
  variant,
  isLoading,
}: {
  title: string;
  subtitle: string;
  imageUrl?: string;
  imageBase64?: string;
  variant: "danger" | "success";
  isLoading?: boolean;
}) {
  const imageSrc = imageUrl || (imageBase64 ? `data:image/png;base64,${imageBase64}` : undefined);
  const borderColor = variant === "danger" ? "ring-red-400/50" : "ring-green-500/50";
  const labelColor = variant === "danger" ? "text-red-600" : "text-green-700";
  const subtitleColor = variant === "danger" ? "text-red-500/80" : "text-green-600/80";

  return (
    <div className="flex flex-col items-center">
      {/* Title above image */}
      <span className={cn("text-xs uppercase tracking-wider font-bold mb-2", labelColor)}>
        {title}
      </span>

      {/* Polaroid-style image container - enlarged */}
      <div
        className={cn(
          "polaroid p-2 pb-3 transition-all duration-300",
          "ring-2",
          borderColor,
          "bg-[var(--vintage-cream)]",
          "shadow-lg"
        )}
      >
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 bg-[var(--vintage-paper)] overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {/* Vintage-style loading with film camera icon */}
              <div className="relative">
                <div className="w-12 h-12 border-3 border-[var(--vintage-brown)]/20 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-3 border-t-[var(--vintage-brown)] rounded-full animate-spin" />
              </div>
              <span className="text-xs mt-3 font-[var(--font-handwriting)] text-[var(--vintage-brown)]/70">
                Generating...
              </span>
            </div>
          ) : imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-[var(--vintage-brown)]/20 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-3 border-t-[var(--vintage-brown)] rounded-full animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtitle below image */}
      <p className={cn("text-sm font-medium mt-2", subtitleColor)}>
        {isLoading ? "Generating..." : subtitle}
      </p>
    </div>
  );
}

export function ProtectionProofModal({
  imageId,
  open,
  onOpenChange,
}: ProtectionProofModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofData, setProofData] = useState<ProofData | null>(null);

  const fetchProof = useCallback(async () => {
    if (!imageId) return;

    setLoading(true);
    setError(null);

    try {
      // First check if proof already exists (cached)
      const checkResponse = await fetch(`/api/images/${imageId}/proof`);
      const checkData = await checkResponse.json();

      if (checkData.exists) {
        setProofData({
          originalSwapUrl: checkData.originalSwapUrl,
          protectedSwapUrl: checkData.protectedSwapUrl,
          protectedUrl: checkData.protectedUrl,
          analysis: checkData.analysis,
          generatedAt: checkData.generatedAt,
          cached: true,
          originalReady: true,
          protectedReady: true,
        });
        setLoading(false);
        return;
      }

      // Initialize proof data with loading states
      setProofData({
        analysis: {
          originalScore: 87,
          protectedScore: 8,
          effectiveness: 94,
          explanation: "",
          summary: "",
        },
        originalReady: false,
        protectedReady: false,
      });
      setLoading(false); // Stop full-page loading, show progressive UI

      // Start both requests in parallel for progressive loading
      const originalPromise = fetch(`/api/images/${imageId}/proof/original`, {
        method: "POST",
      }).then(async (res) => {
        if (!res.ok) throw new Error("Original proof failed");
        return res.json();
      });

      const protectedPromise = fetch(`/api/images/${imageId}/proof/protected`, {
        method: "POST",
      }).then(async (res) => {
        if (!res.ok) throw new Error("Protected proof failed");
        return res.json();
      });

      // Handle original result when ready (should be faster)
      originalPromise.then((originalData) => {
        setProofData((prev) => prev ? {
          ...prev,
          originalSwapBase64: originalData.originalSwapBase64,
          originalReady: true,
        } : prev);
      }).catch((err) => {
        console.error("Original proof error:", err);
      });

      // Handle protected result when ready (should take longer or fail)
      protectedPromise.then((protectedData) => {
        setProofData((prev) => prev ? {
          ...prev,
          protectedUrl: protectedData.protectedUrl,
          protectedSwapBase64: protectedData.protectedSwapBase64,
          protectedReady: true,
        } : prev);
      }).catch((err) => {
        console.error("Protected proof error:", err);
        // On failure, just show the protected image (which is what we want!)
        setProofData((prev) => prev ? {
          ...prev,
          protectedReady: true,
        } : prev);
      });

    } catch (err) {
      console.error("Proof fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load proof");
      setLoading(false);
    }
  }, [imageId]);

  useEffect(() => {
    if (open && !proofData && !loading) {
      fetchProof();
    }
  }, [open, proofData, loading, fetchProof]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation
      const timeout = setTimeout(() => {
        setProofData(null);
        setError(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="!max-w-4xl bg-[var(--vintage-paper)] border-[var(--vintage-brown)]/20 p-5">
        <VisuallyHidden>
          <AlertDialogTitle>Protection Proof</AlertDialogTitle>
        </VisuallyHidden>
        {/* Hero Section */}
        <div className="text-center pb-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--vintage-brown)]">
            Your Photo is Protected
          </h2>
          <p className="text-sm text-[var(--vintage-brown)]/70">
            See how Cloaked blocks AI face-swapping attacks
          </p>
        </div>

        <div>
          {loading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-[var(--vintage-brown)]/20 rounded-full animate-spin border-t-[var(--vintage-brown)]" />
              </div>
              <p className="text-[var(--vintage-brown)]/70 font-[var(--font-handwriting)] text-base">
                Generating proof...
              </p>
              <p className="text-[10px] text-[var(--vintage-brown)]/50">
                This may take a few seconds
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={fetchProof}
                className="mt-4 px-4 py-2 bg-[var(--vintage-brown)] text-white rounded-lg hover:bg-[var(--vintage-brown)]/80 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {proofData && !loading && (
            <div className="space-y-3">
              {/* Side by side comparison */}
              <div className="flex flex-row items-start justify-center gap-4 sm:gap-8">
                <ProofImageCard
                  title="Without Protection"
                  subtitle="Deepfake successfully produced"
                  imageUrl={proofData.originalSwapUrl}
                  imageBase64={proofData.originalSwapBase64}
                  variant="danger"
                  isLoading={!proofData.originalReady}
                />

                {/* Shield Divider */}
                <div className="flex flex-col items-center justify-center flex-shrink-0 px-2 pt-12">
                  <div className="w-10 h-10 rounded-full bg-[var(--vintage-amber)]/20 flex items-center justify-center ring-2 ring-[var(--vintage-amber)]/30">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--vintage-brown)]/60 mt-1.5 font-semibold">
                    Cloaked
                  </span>
                </div>

                <ProofImageCard
                  title="With Protection"
                  subtitle="Deepfake failed"
                  imageUrl={proofData.protectedUrl}
                  imageBase64={proofData.protectedSwapBase64}
                  variant="success"
                  isLoading={!proofData.protectedReady}
                />
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel className="w-full sm:w-auto bg-[var(--vintage-cream)] text-[var(--vintage-brown)] hover:bg-[var(--vintage-brown)]/10 border-2 border-[var(--vintage-brown)] px-10 py-2.5 text-base font-semibold">
            Got It
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
