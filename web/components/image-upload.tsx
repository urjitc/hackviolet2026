"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProtectionProofModal } from "@/components/protection-proof-modal";

interface ImagePair {
  id: string;
  originalUrl: string;
  protectedUrl: string | null;
  status: "pending" | "processing" | "completed" | "failed";
}

interface ImageUploadProps {
  onUploadComplete?: () => void;
}

export function ImageUpload({ onUploadComplete }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePair, setImagePair] = useState<ImagePair | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);

  // Track polling state for cleanup
  const pollingRef = useRef<{ active: boolean; timeoutId: NodeJS.Timeout | null }>({
    active: false,
    timeoutId: null,
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.active = false;
      if (pollingRef.current.timeoutId) {
        clearTimeout(pollingRef.current.timeoutId);
      }
    };
  }, []);


  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const pollForCompletion = useCallback(
    async (id: string) => {
      const maxAttempts = 60;
      let attempts = 0;

      pollingRef.current.active = true;

      const poll = async () => {
        if (!pollingRef.current.active) {
          return;
        }

        attempts++;
        try {
          const response = await fetch(`/api/images/${id}`);

          if (!response.ok) {
            throw new Error("Failed to fetch image status");
          }

          const data = await response.json();

          if (data.status === "completed" || data.status === "failed") {
            setImagePair(data);
            if (data.status === "completed") {
              onUploadComplete?.();
            } else if (data.status === "failed") {
              setError("Image conversion failed. Please try again.");
            }
            pollingRef.current.active = false;
            return;
          }

          if (attempts < maxAttempts && pollingRef.current.active) {
            pollingRef.current.timeoutId = setTimeout(poll, 1000);
          } else if (attempts >= maxAttempts) {
            setError("Conversion is taking longer than expected. Please refresh and check your image history.");
            setImagePair((prev) => prev ? { ...prev, status: "failed" } : null);
            pollingRef.current.active = false;
          }
        } catch (err) {
          console.error("Polling error:", err);
          setError("Failed to check conversion status. Please refresh the page.");
          pollingRef.current.active = false;
        }
      };

      poll();
    },
    [onUploadComplete]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Please upload PNG, JPEG, or WEBP.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }

      setError(null);
      setIsUploading(true);
      setImagePair(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/images/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        setImagePair(data);
        pollForCompletion(data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [pollForCompletion]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const getHandwrittenCaption = () => {
    if (isUploading) return "uploading...";
    if (imagePair?.status === "processing" || imagePair?.status === "pending") return "adding protection...";
    if (imagePair?.status === "completed") return "protected";
    if (imagePair?.status === "failed") return "protection failed";
    if (isDragging) return "drop to protect";
    return "ready to protect";
  };

  const resetUpload = () => {
    setImagePair(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Polaroid Frame */}
      <div
        className={cn(
          "polaroid polaroid-lg polaroid-tilt cursor-pointer relative",
          isDragging && "scale-105",
          imagePair?.status === "failed" && "ring-2 ring-[var(--destructive)] ring-offset-2"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          disabled={isUploading || imagePair?.status === "processing"}
          className="hidden"
          id="file-upload"
        />

        {/* Photo Area with vignette */}
        <label
          htmlFor="file-upload"
          className={cn(
            "photo-vignette block w-64 h-64 md:w-80 md:h-80 cursor-pointer transition-all duration-200 relative overflow-hidden",
            "flex items-center justify-center",
            imagePair?.originalUrl
              ? "bg-[var(--vintage-paper)]"
              : isDragging
                ? "bg-[var(--vintage-amber)]/20 border-2 border-dashed border-[var(--vintage-amber)]"
                : "bg-[var(--muted)] hover:bg-[var(--vintage-paper)]",
            (isUploading || imagePair?.status === "processing") && "cursor-wait"
          )}
        >
          {imagePair?.protectedUrl ? (
            // Show protected image when complete
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imagePair.protectedUrl}
              alt="Protected"
              className="w-full h-full object-cover"
            />
          ) : imagePair?.originalUrl ? (
            // Show original while processing
            <div className="relative w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePair.originalUrl}
                alt="Original"
                className={cn(
                  "w-full h-full object-cover transition-all duration-500",
                  (imagePair.status === "processing" || imagePair.status === "pending") && "opacity-60 blur-[1px]"
                )}
              />
              {(imagePair.status === "processing" || imagePair.status === "pending") && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--vintage-paper)]/30">
                  <div className="w-12 h-12 border-4 border-[var(--vintage-brown)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            // Empty state - vintage camera viewfinder
            <div className="flex flex-col items-center gap-4 text-[var(--vintage-brown)]">
              {/* Viewfinder corners */}
              <div className="relative w-24 h-24">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[var(--vintage-brown)]/50" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[var(--vintage-brown)]/50" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[var(--vintage-brown)]/50" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[var(--vintage-brown)]/50" />
                {/* Camera icon */}
                <svg
                  className="absolute inset-0 m-auto w-10 h-10 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <circle cx="12" cy="13" r="3" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-sm opacity-70">
                {isUploading ? "Uploading..." : "Click or drag"}
              </span>
            </div>
          )}
        </label>

        {/* Handwritten Caption Area */}
        <div className="mt-3 text-center">
          <p className="font-handwriting text-xl md:text-2xl text-[var(--vintage-brown)]">
            {getHandwrittenCaption()}
          </p>
        </div>
      </div>

      {/* Error Message - Vintage styled */}
      {error && (
        <div className="mt-4 p-3 bg-[var(--darkroom-red)]/10 border border-[var(--darkroom-red)]/30 rounded-lg text-[var(--darkroom-red)] text-sm max-w-sm text-center">
          <span className="font-handwriting text-lg">{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      {imagePair?.status === "completed" && imagePair.protectedUrl && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <Button asChild className="btn-vintage">
              <a
                href={imagePair.protectedUrl}
                download="cloaked-image"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Cloaked
              </a>
            </Button>
            <Button variant="outline" onClick={resetUpload}>
              Upload Another
            </Button>
          </div>
          {/* See Protection Proof button */}
          <Button
            variant="outline"
            onClick={() => setShowProofModal(true)}
            className="gap-2 border-green-600/30 text-green-700 hover:bg-green-50 hover:border-green-600/50"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            See Protection Proof
          </Button>
        </div>
      )}

      {imagePair?.status === "failed" && (
        <div className="mt-6">
          <Button variant="outline" onClick={resetUpload}>
            Try Again
          </Button>
        </div>
      )}

      {/* File type hint */}
      {!imagePair && !error && (
        <p className="mt-4 text-xs text-[var(--vintage-brown)]/60 font-handwriting text-lg">
          PNG, JPEG, or WEBP up to 10MB
        </p>
      )}

      {/* Protection Proof Modal */}
      {imagePair && (
        <ProtectionProofModal
          imageId={imagePair.id}
          open={showProofModal}
          onOpenChange={setShowProofModal}
        />
      )}
    </div>
  );
}
