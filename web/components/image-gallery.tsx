"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImagePair {
  id: string;
  originalUrl: string;
  protectedUrl: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
}

interface ImageGalleryProps {
  refreshTrigger?: number;
}

// Clothespin SVG component
function Clothespin({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="28"
      viewBox="0 0 24 28"
      fill="none"
    >
      {/* Left prong */}
      <path
        d="M6 0 L6 10 Q6 14 8 16 L8 28"
        stroke="#8B7355"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Right prong */}
      <path
        d="M18 0 L18 10 Q18 14 16 16 L16 28"
        stroke="#8B7355"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Spring/connector */}
      <ellipse
        cx="12"
        cy="12"
        rx="4"
        ry="3"
        fill="#A0896C"
        stroke="#7A6549"
        strokeWidth="1"
      />
    </svg>
  );
}

// Random tilt for organic look
function getRandomTilt(index: number): number {
  const tilts = [-3, -1, 2, -2, 1, 3, 0, -2, 2, -1];
  return tilts[index % tilts.length];
}

export function ImageGallery({ refreshTrigger }: ImageGalleryProps) {
  const [images, setImages] = useState<ImagePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchImages = async () => {
    try {
      const response = await fetch("/api/images");
      if (!response.ok) {
        throw new Error("Failed to fetch images");
      }
      const data = await response.json();
      setImages(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load images");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [refreshTrigger]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/images/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete image");
      }

      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete image");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusIndicator = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-400",
      processing: "bg-blue-400",
      completed: "bg-green-400",
      failed: "bg-red-400",
    };
    return (
      <span
        className={cn(
          "absolute top-2 right-2 w-3 h-3 rounded-full",
          colors[status] || colors.pending
        )}
        title={status.charAt(0).toUpperCase() + status.slice(1)}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="font-handwriting text-2xl text-muted-foreground">
          loading your photos...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-2">{error}</p>
        <Button variant="ghost" onClick={fetchImages}>
          Try again
        </Button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="clothesline py-8">
        <div className="text-center pt-8">
          <p className="font-handwriting text-2xl text-muted-foreground">
            your protected photos will hang here...
          </p>
        </div>
      </div>
    );
  }

  // Group images into rows (4 on desktop, will adjust with CSS)
  const itemsPerRow = 4;
  const rows: ImagePair[][] = [];
  for (let i = 0; i < images.length; i += itemsPerRow) {
    rows.push(images.slice(i, i + itemsPerRow));
  }

  return (
    <div className="space-y-12">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="clothesline">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
            {row.map((image, imageIndex) => {
              const globalIndex = rowIndex * itemsPerRow + imageIndex;
              const tilt = getRandomTilt(globalIndex);

              return (
                <div
                  key={image.id}
                  className="hanging-polaroid flex flex-col items-center"
                  style={{ animationDelay: `${-globalIndex * 0.3}s` }}
                >
                  {/* Clothespin */}
                  <Clothespin className="relative z-10 -mb-2" />

                  {/* Polaroid card */}
                  <div
                    className="polaroid group relative"
                    style={{ transform: `rotate(${tilt}deg)` }}
                  >
                    {/* Image area */}
                    <div className="w-32 h-32 md:w-40 md:h-40 relative bg-muted overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.protectedUrl || image.originalUrl}
                        alt="Protected image"
                        className="w-full h-full object-cover"
                      />
                      {getStatusIndicator(image.status)}

                      {/* Hover overlay with actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {image.protectedUrl && (
                          <a
                            href={image.protectedUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                            title="Download"
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
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(image.id)}
                          disabled={deletingId === image.id}
                          className="p-2 bg-white/90 rounded-full hover:bg-red-100 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <svg
                            className="w-4 h-4 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Caption area with date */}
                    <div className="mt-2 text-center">
                      <p className="font-handwriting text-lg text-foreground/70">
                        {formatDate(image.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
