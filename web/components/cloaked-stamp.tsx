"use client";

import { cn } from "@/lib/utils";

interface CloakedStampProps {
  visible?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CloakedStamp({ visible = false, size = "md", className }: CloakedStampProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  const stampClass = size === "sm" ? "cloaked-stamp-sm" : "cloaked-stamp";

  return (
    <div
      className={cn(
        stampClass,
        visible && "visible",
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className={cn(sizeClasses[size])}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer circle with distressed edge */}
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="oklch(0.45 0.15 25)"
          strokeWidth="3"
          strokeDasharray="4 2"
          fill="none"
          opacity="0.85"
        />

        {/* Inner circle */}
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke="oklch(0.45 0.15 25)"
          strokeWidth="2"
          fill="none"
          opacity="0.75"
        />

        {/* CLOAKED text - curved along top */}
        <defs>
          <path
            id="textCircle"
            d="M 50,50 m -30,0 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0"
            fill="none"
          />
        </defs>

        <text
          fill="oklch(0.45 0.15 25)"
          fontSize="12"
          fontWeight="bold"
          fontFamily="var(--font-sans), system-ui, sans-serif"
          letterSpacing="3"
          opacity="0.85"
        >
          <textPath href="#textCircle" startOffset="15%">
            CLOAKED
          </textPath>
        </text>

        {/* Shield icon in center */}
        <g transform="translate(35, 35)" opacity="0.8">
          <path
            d="M15 2L4 7v6.5c0 5.25 4.7 10.15 11 11.5 6.3-1.35 11-6.25 11-11.5V7L15 2z"
            stroke="oklch(0.45 0.15 25)"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M15 8l-3.5 3.5L15 15l7-7-1.5-1.5L15 12l-2-2L15 8z"
            fill="oklch(0.45 0.15 25)"
          />
        </g>

        {/* Decorative stars */}
        <text
          x="20"
          y="75"
          fill="oklch(0.45 0.15 25)"
          fontSize="8"
          opacity="0.7"
        >
          ★
        </text>
        <text
          x="75"
          y="75"
          fill="oklch(0.45 0.15 25)"
          fontSize="8"
          opacity="0.7"
        >
          ★
        </text>
      </svg>
    </div>
  );
}
