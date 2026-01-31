"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
    },
    []
  );

  const uploadFile = async (file: File) => {
    // Client-side validation
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

      // Poll for conversion completion
      pollForCompletion(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const pollForCompletion = async (id: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const response = await fetch(`/api/images/${id}`);
        const data = await response.json();

        if (data.status === "completed" || data.status === "failed") {
          setImagePair(data);
          if (data.status === "completed") {
            onUploadComplete?.();
          }
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          styles[status] || styles.pending
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <div className="text-4xl">📷</div>
          <p className="text-lg font-medium">
            {isUploading ? "Uploading..." : "Drop an image here or click to upload"}
          </p>
          <p className="text-sm text-muted-foreground">
            PNG, JPEG, or WEBP up to 10MB
          </p>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {imagePair && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Image Protection Result</CardTitle>
            {getStatusBadge(imagePair.status)}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Image */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Original
                </h3>
                <div className="border rounded-lg overflow-hidden bg-muted/50">
                  <img
                    src={imagePair.originalUrl}
                    alt="Original"
                    className="w-full h-auto object-contain max-h-64"
                  />
                </div>
              </div>

              {/* Protected Image */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Protected
                </h3>
                <div className="border rounded-lg overflow-hidden bg-muted/50 min-h-32 flex items-center justify-center">
                  {imagePair.protectedUrl ? (
                    <img
                      src={imagePair.protectedUrl}
                      alt="Protected"
                      className="w-full h-auto object-contain max-h-64"
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm p-4">
                      {imagePair.status === "processing"
                        ? "Processing..."
                        : imagePair.status === "failed"
                        ? "Conversion failed"
                        : "Waiting for conversion..."}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Download Button */}
            {imagePair.protectedUrl && (
              <div className="mt-4 flex justify-end">
                <Button asChild>
                  <a
                    href={imagePair.protectedUrl}
                    download="protected-image"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Protected Image
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
