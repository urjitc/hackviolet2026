"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    if (imagePair?.status === "processing" || imagePair?.status === "pending") return "working some magic...";
    if (imagePair?.status === "completed") return "all done! ✓";
    if (imagePair?.status === "failed") return "oops, something went wrong";
    return "drop your photo here ↑";
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
          "polaroid polaroid-lg polaroid-tilt cursor-pointer transition-all duration-300",
          isDragging && "scale-105 shadow-xl"
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

        {/* Photo Area */}
        <label
          htmlFor="file-upload"
          className={cn(
            "block w-64 h-64 md:w-80 md:h-80 cursor-pointer transition-all duration-200",
            "flex items-center justify-center",
            imagePair?.originalUrl
              ? "bg-muted"
              : isDragging
                ? "bg-primary/10 border-2 border-dashed border-primary"
                : "bg-muted/70 hover:bg-muted",
            (isUploading || imagePair?.status === "processing") && "cursor-wait"
          )}
        >
          {imagePair?.protectedUrl ? (
            // Show protected image when complete
            // eslint-disable-next-line @next/next/no-img-element
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
                  "w-full h-full object-cover",
                  imagePair.status === "processing" && "opacity-70"
                )}
              />
              {(imagePair.status === "processing" || imagePair.status === "pending") && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            // Empty state
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <svg
                className="w-16 h-16 opacity-40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm">
                {isUploading ? "Uploading..." : "Click or drag"}
              </span>
            </div>
          )}
        </label>

        {/* Handwritten Caption Area */}
        <div className="mt-3 text-center">
          <p className="font-handwriting text-xl md:text-2xl text-foreground/80">
            {getHandwrittenCaption()}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-sm text-center">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      {imagePair?.status === "completed" && imagePair.protectedUrl && (
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <a
              href={imagePair.protectedUrl}
              download="protected-image"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Protected
            </a>
          </Button>
          <Button variant="outline" onClick={resetUpload}>
            Upload Another
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
        <p className="mt-4 text-xs text-muted-foreground">
          PNG, JPEG, or WEBP up to 10MB
        </p>
      )}
    </div>
  );
}
