"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ShutterLoaderProps {
    onComplete?: () => void;
}

export function ShutterLoader({ onComplete }: ShutterLoaderProps) {
    const [animationPhase, setAnimationPhase] = useState<"idle" | "opening">("idle");

    useEffect(() => {
        // Start opening sequence after a brief delay
        const timer = setTimeout(() => {
            setAnimationPhase("opening");
        }, 800);

        return () => clearTimeout(timer);
    }, []);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* 
              The 'Hole Punch' Background.
              It's a small div with a MASSIVE white shadow.
              Initially scale=0 (shadow covers everything).
              Then scales up to reveal the hole (content underneath).
            */}
            <motion.div
                className="absolute rounded-full bg-transparent"
                style={{
                    width: "100px",
                    height: "100px",
                    boxShadow: "0 0 0 250vmax #ffffff",
                }}
                initial={{ scale: 0 }}
                animate={animationPhase === "opening" ? { scale: 30, rotate: 90 } : { scale: 0, rotate: 0 }}
                transition={{
                    duration: 1.2,
                    ease: [0.65, 0, 0.35, 1], // Custom easing for smooth "shutter" feel
                }}
                onAnimationComplete={() => {
                    if (animationPhase === "opening" && onComplete) {
                        onComplete();
                    }
                }}
            />

            {/* Center Shutter Icon (Visible on top of the white background initially) */}
            <AnimatePresence>
                {animationPhase === "idle" && (
                    <motion.div
                        className="relative z-10 w-24 h-24 text-pink-400"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1, rotate: 180 }}
                        exit={{ opacity: 0, scale: 1.5, rotate: 360 }}
                        transition={{ duration: 0.8, ease: "anticipate" }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4" className="opacity-50" />
                            {/* Decorative shutter blades */}
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M12 2L12 6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M12 18L12 22" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M22 12L18 12" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M6 12L2 12" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M19.07 19.07L16.24 16.24" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M7.76 7.76L4.93 4.93" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M19.07 4.93L16.24 7.76" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M7.76 16.24L4.93 19.07" />
                        </svg>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
