"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ProofAnalysis {
  originalScore: number;
  protectedScore: number;
  effectiveness: number;
  explanation: string;
  summary: string;
}

interface ProofData {
  originalSwapUrl?: string;
  protectedSwapUrl?: string;
  originalSwapBase64?: string;
  protectedSwapBase64?: string;
  analysis: ProofAnalysis;
  generatedAt?: string;
  cached?: boolean;
}

interface ProtectionProofModalProps {
  imageId: string;
  originalUrl?: string;
  protectedUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ScoreBar({ score, label, variant }: { score: number; label: string; variant: "danger" | "success" }) {
  const bgColor = variant === "danger" ? "bg-red-500/80" : "bg-green-600/80";
  const textColor = variant === "danger" ? "text-red-700" : "text-green-700";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={cn("font-medium", textColor)}>{label}</span>
        <span className={cn("font-bold", textColor)}>{score}/100</span>
      </div>
      <div className="h-2.5 bg-[var(--vintage-cream)] rounded-full overflow-hidden ring-1 ring-[var(--vintage-brown)]/20">
        <div
          className={cn("h-full rounded-full transition-all duration-1000", bgColor)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ProofImageCard({
  title,
  subtitle,
  imageUrl,
  imageBase64,
  score,
  variant,
}: {
  title: string;
  subtitle: string;
  imageUrl?: string;
  imageBase64?: string;
  score: number;
  variant: "danger" | "success";
}) {
  const imageSrc = imageUrl || (imageBase64 ? `data:image/png;base64,${imageBase64}` : undefined);
  const borderColor = variant === "danger" ? "ring-red-400/40" : "ring-green-500/40";
  const labelColor = variant === "danger" ? "text-red-600" : "text-green-700";
  const subtitleColor = variant === "danger" ? "text-red-500/80" : "text-green-600/80";
  const bgGradient = variant === "danger"
    ? "bg-gradient-to-br from-red-50/50 to-[var(--vintage-cream)]"
    : "bg-gradient-to-br from-green-50/50 to-[var(--vintage-cream)]";
  const shadowColor = variant === "danger" ? "shadow-red-200/30" : "shadow-green-200/30";

  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-1.5">
        <span className={cn("text-xs uppercase tracking-wider font-bold", labelColor)}>
          {title}
        </span>
        <p className={cn("text-xs font-medium", subtitleColor)}>{subtitle}</p>
      </div>

      <div
        className={cn(
          "polaroid p-1.5 pb-2.5 transition-all duration-300",
          "ring-2",
          borderColor,
          bgGradient,
          "shadow-md",
          shadowColor
        )}
      >
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 bg-[var(--vintage-cream)] overflow-hidden">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--vintage-brown)]/50">
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="w-full mt-2 max-w-[140px]">
        <ScoreBar
          score={score}
          label={variant === "danger" ? "Deepfake Quality" : "Protection Level"}
          variant={variant}
        />
      </div>
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
      // First check if proof already exists
      const checkResponse = await fetch(`/api/images/${imageId}/proof`);
      const checkData = await checkResponse.json();

      if (checkData.exists) {
        setProofData({
          originalSwapUrl: checkData.originalSwapUrl,
          protectedSwapUrl: checkData.protectedSwapUrl,
          analysis: checkData.analysis,
          generatedAt: checkData.generatedAt,
          cached: true,
        });
        setLoading(false);
        return;
      }

      // Generate new proof
      const generateResponse = await fetch(`/api/images/${imageId}/proof`, {
        method: "POST",
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || "Failed to generate proof");
      }

      const data = await generateResponse.json();
      setProofData({
        originalSwapUrl: data.originalSwapUrl,
        protectedSwapUrl: data.protectedSwapUrl,
        originalSwapBase64: data.originalSwapBase64,
        protectedSwapBase64: data.protectedSwapBase64,
        analysis: data.analysis,
        generatedAt: data.generatedAt,
        cached: data.cached,
      });
    } catch (err) {
      console.error("Proof fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load proof");
    } finally {
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
              <div className="flex flex-row items-start justify-center gap-3 sm:gap-5">
                <ProofImageCard
                  title="Without Protection"
                  subtitle="Deepfake succeeds"
                  imageUrl={proofData.originalSwapUrl}
                  imageBase64={proofData.originalSwapBase64}
                  score={proofData.analysis.originalScore}
                  variant="danger"
                />

                {/* Shield Divider */}
                <div className="flex flex-col items-center justify-center flex-shrink-0 px-1 pt-8">
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
                  subtitle="Deepfake blocked!"
                  imageUrl={proofData.protectedSwapUrl}
                  imageBase64={proofData.protectedSwapBase64}
                  score={100 - proofData.analysis.protectedScore}
                  variant="success"
                />
              </div>

              {/* Verdict Section - Horizontal layout */}
              <div className="border-t border-[var(--vintage-brown)]/10 pt-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Left: AI Verdict text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-[var(--vintage-amber)]/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-[var(--vintage-brown)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-semibold text-[var(--vintage-brown)]">
                        AI Verdict
                      </h4>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--vintage-brown)]/80">
                      {proofData.analysis.explanation}
                    </p>
                  </div>

                  {/* Right: Effectiveness + Summary */}
                  <div className="sm:w-56 flex-shrink-0">
                    <div className="bg-green-50/50 rounded-lg p-3 ring-1 ring-green-200/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[var(--vintage-brown)]">
                          Effectiveness
                        </span>
                        <span className="text-lg font-bold text-green-600 tabular-nums">
                          {proofData.analysis.effectiveness}%
                        </span>
                      </div>
                      <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${proofData.analysis.effectiveness}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-xs font-handwriting text-green-700">
                        {proofData.analysis.summary}
                      </p>
                    </div>
                  </div>
                </div>
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
