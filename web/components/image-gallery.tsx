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

// Enhanced Clothespin SVG component with wood grain detail
function Clothespin({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="32"
      viewBox="0 0 28 32"
      fill="none"
    >
      {/* Left prong with wood grain */}
      <path
        d="M7 0 L7 12 Q7 16 9 18 L9 32"
        stroke="#C4A882"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M7 0 L7 12 Q7 16 9 18 L9 32"
        stroke="#8B7355"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Right prong with wood grain */}
      <path
        d="M21 0 L21 12 Q21 16 19 18 L19 32"
        stroke="#C4A882"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M21 0 L21 12 Q21 16 19 18 L19 32"
        stroke="#8B7355"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Metal spring */}
      <ellipse
        cx="14"
        cy="13"
        rx="5"
        ry="4"
        fill="#9CA3AF"
        stroke="#6B7280"
        strokeWidth="1.5"
      />
      {/* Spring coil detail */}
      <path
        d="M10 13 Q14 10 18 13 Q14 16 10 13"
        stroke="#4B5563"
        strokeWidth="0.5"
        fill="none"
      />
    </svg>
  );
}

// Random tilt for organic look
function getRandomTilt(index: number): number {
  const tilts = [-3, -1.5, 2.5, -2, 1, 3, -0.5, -2.5, 2, -1];
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

  if (isLoading) {
    return (
      <div className="rounded-xl p-8 min-h-[200px] flex items-center justify-center">
        <p className="font-handwriting text-2xl text-[var(--vintage-brown)]/70">
          loading protected images...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-8 text-center">
        <p className="text-[var(--darkroom-red)] mb-4 font-handwriting text-xl">{error}</p>
        <Button
          variant="outline"
          onClick={fetchImages}
          className="border-[var(--vintage-brown)]/30 text-[var(--vintage-brown)] hover:bg-[var(--vintage-brown)]/10"
        >
          Try again
        </Button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="rounded-xl p-8 min-h-[250px]">
        {/* Empty clothesline */}
        <div className="clothesline">
          <div className="flex justify-center gap-16">
            {/* Empty swaying clothespins */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="hanging-polaroid opacity-40"
                style={{ animationDelay: `${-i * 0.5}s` }}
              >
                <Clothespin />
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-8">
          <p className="font-handwriting text-2xl text-[var(--vintage-brown)]/60">
            your images are protected here
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
    <div className="rounded-xl p-6 md:p-8">
      <div className="space-y-16">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="clothesline">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {row.map((image, imageIndex) => {
                const globalIndex = rowIndex * itemsPerRow + imageIndex;
                const tilt = getRandomTilt(globalIndex);
                const isCompleted = image.status === "completed";

                return (
                  <div
                    key={image.id}
                    className="hanging-polaroid flex flex-col items-center"
                    style={{ animationDelay: `${-globalIndex * 0.3}s` }}
                  >
                    {/* Clothespin */}
                    <Clothespin className="relative z-10 -mb-6" />

                    {/* Polaroid card */}
                    <div
                      className={cn(
                        "polaroid group relative",
                        "transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                      )}
                      style={{
                        transform: `rotate(${tilt}deg)`,
                        ["--tilt" as string]: `${tilt}deg`,
                      }}
                    >
                      {/* Image area with vignette */}
                      <div className="photo-vignette w-28 h-28 md:w-36 md:h-36 relative bg-[var(--vintage-paper)] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.protectedUrl || image.originalUrl}
                          alt="Protected image"
                          className="w-full h-full object-cover"
                        />

                        {/* Status indicator - small dot */}
                        {!isCompleted && (
                          <span
                            className={cn(
                              "absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm",
                              image.status === "pending" && "bg-yellow-400",
                              image.status === "processing" && "bg-blue-400 animate-pulse",
                              image.status === "failed" && "bg-red-400"
                            )}
                            title={image.status.charAt(0).toUpperCase() + image.status.slice(1)}
                          />
                        )}

                        {/* Hover overlay with actions */}
                        <div className="absolute inset-0 bg-[var(--vintage-brown)]/80 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3">
                          {image.protectedUrl && (
                            <a
                              href={image.protectedUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 bg-[var(--vintage-cream)] rounded-full hover:bg-white transition-colors shadow-lg"
                              title="Download"
                            >
                              <svg
                                className="w-4 h-4 text-[var(--vintage-brown)]"
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
                            className="p-2.5 bg-[var(--vintage-cream)] rounded-full hover:bg-[var(--darkroom-accent)]/20 transition-colors disabled:opacity-50 shadow-lg"
                            title="Delete"
                          >
                            <svg
                              className="w-4 h-4 text-[var(--darkroom-accent)]"
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
                        <p className="font-handwriting text-base md:text-lg text-[var(--vintage-brown)]/80">
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
    </div>
  );
}
