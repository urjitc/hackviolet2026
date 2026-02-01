"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Settings, Aperture, Circle } from "lucide-react";

interface HeroProps {
    onGetStarted?: () => void;
}

export function Hero({ onGetStarted }: HeroProps) {
    const [dialRotation, setDialRotation] = useState(0);
    const [printed, setPrinted] = useState(false);

    const BACKGROUND_IMAGES = [
        "/backgrounds/2.JPG",
        "/backgrounds/3.JPG",
        "/backgrounds/4.JPG",
        "/backgrounds/5.JPG",
        "/backgrounds/1.JPG",
        "/backgrounds/6.JPG",
        "/backgrounds/7.JPG",
        "/backgrounds/1.JPG",
    ];

    // Calculate current image index based on rotation (45 degrees per click)
    // We use Math.abs to handle negative rotation if it were to happen, though here it's additive
    // We assume 8 positions (360 / 45 = 8)
    const currentImageIndex = Math.abs(Math.floor(dialRotation / 45)) % BACKGROUND_IMAGES.length;

    const handleGetStarted = () => {
        setPrinted(true);
        // Call the parent callback after a delay to allow animation to start/finish
        // or immediately, depending on desired effect. 
        // The user said "it should do the poloraid animation and it should scrol ldown"
        // Let's invoke the callback immediately or with a slight delay 
        // effectively letting the parent handle the scroll
        if (onGetStarted) {
            // giving it a small moment for the render cycle
            setTimeout(() => {
                onGetStarted();
            }, 200);
        }
    };

    const rotateDial = () => {
        setDialRotation((prev) => prev + 45);
    };

    return (
        <section className="relative w-full h-screen bg-zinc-50 flex items-center justify-center py-16 md:py-20 lg:py-32 px-4 md:px-8 lg:px-16 z-20">

            {/* Background Container - clipped */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Background - Blurred Nature Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-40 pointer-events-none"
                    style={{
                        backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop')"
                    }}
                />
            </div>



            {/* Camera Unit Container */}
            <div
                className="relative w-full max-w-7xl max-h-[calc(100vh-6rem)] aspect-[16/10] flex flex-col animate-reveal-camera"
            >
                {/* --- Top Bumps (Deck) --- */}
                <div className="absolute -top-6 left-0 w-full flex items-end px-12 md:px-24 space-x-4 z-0">
                    {/* Viewfinder Hump */}
                    <div className="w-32 md:w-48 h-8 bg-gradient-to-b from-[#E0DCD0] to-[#C8C4B8] rounded-t-2xl border-t-4 border-l-4 border-r-4 border-white/50 border-b-0 shadow-[0_8px_16px_rgba(0,0,0,0.3)] relative transform translate-y-2">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-500/50 rounded-full shadow-inner" />
                    </div>
                    {/* Dial Bump */}
                    <div className="w-12 h-8 bg-gradient-to-b from-[#E0DCD0] to-[#C8C4B8] rounded-t-lg border-t-2 border-l-2 border-r-2 border-white/50 border-b-0 shadow-[0_8px_16px_rgba(0,0,0,0.3)] transform translate-y-2 ml-auto" />
                </div>
                {/* --- Polaroid Print Out --- */}
                <div
                    className={`absolute -bottom-[10rem] left-1/2 -translate-x-1/2 w-96 h-96 bg-[#eee] p-4 shadow-xl transform rotate-0 z-[100] flex flex-col pointer-events-none ${printed ? 'animate-print-polaroid' : 'opacity-0'}`}
                    style={{ animationDelay: printed ? '0s' : undefined }}
                >
                    <div className="flex-1 bg-black relative overflow-hidden">
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-90 grayscale-[0.2]"
                            style={{
                                backgroundImage: `url('${BACKGROUND_IMAGES[currentImageIndex]}')`
                            }}
                        />
                    </div>
                    <div className="h-10 flex items-center justify-center">
                        <span className="font-handwriting text-gray-500 text-xs transform -rotate-1">deepfake_detected.png</span>
                    </div>
                </div>

                {/* --- Main Camera Body (Split Panels) --- */}
                {/* --- Main Camera Body (Split Panels) --- */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden rounded-[3rem] shadow-[0_25px_60px_rgba(0,0,0,0.35),0_10px_20px_rgba(0,0,0,0.2)] relative z-20 border-8 border-t-[#B8B4A5] border-l-[#A8A495] border-r-[#7A7668] border-b-[#6A6658]">
                    {/* Glossy Metallic Top Edge Hint */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
                    {/* Bottom Edge Shadow Hint */}
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-black/20 to-transparent z-10" />

                    {/* --- LEFT: Screen Area Wrapper --- */}
                    <div className="relative flex-[3] h-full p-4 bg-gradient-to-br from-[#DCD8C9] to-[#C8C4B5]">
                        <div className="relative w-full h-full p-6 md:p-10 flex flex-col justify-center rounded-3xl rounded-r-[3rem] border-6 border-t-white/50 border-l-white/40 border-r-black/10 border-b-black/15 shadow-inner">
                            {/* Main Camera Body Container with rounded edges and border */}
                            <div className="relative w-full h-full bg-gradient-to-br from-[#D8D4C5] to-[#CAC6B7] rounded-3xl p-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.3)] border-6 border-t-white/30 border-l-white/20 border-r-black/10 border-b-black/15">
                                {/* The "Screen" Bezel */}
                                <div className="relative w-full h-full bg-[#151515] rounded-xl p-4 shadow-[inset_0_4px_20px_rgba(0,0,0,0.9),inset_0_-2px_10px_rgba(0,0,0,0.5)] border-[6px] border-t-gray-800 border-l-gray-700 border-r-gray-600 border-b-gray-500">
                                    {/* The Actual LCD Screen */}
                                    {/* Actual LCD Screen */}
                                    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden group shadow-[inset_0_0_30px_rgba(0,0,0,1)]">
                                        {/* Flash Overlay */}
                                        <div className={`absolute inset-0 bg-white z-20 pointer-events-none ${printed ? 'animate-camera-flash' : 'hidden'}`} />

                                        {/* Blurred Nature Background */}
                                        <div
                                            className={`absolute inset-0 bg-cover bg-center md:blur-md group-hover:blur-sm transition-all duration-700 ease-in-out scale-105`}
                                            style={{
                                                backgroundImage: printed ? 'none' : `url('${BACKGROUND_IMAGES[currentImageIndex]}')`
                                            }}
                                        />
                                        {/* Darker Overlay for Text Contrast */}
                                        <div className="absolute inset-0 bg-black/40" />

                                        {/* Screen Content */}
                                        <div className="absolute inset-0 flex flex-col justify-center p-12 md:p-24 items-start text-left z-10">
                                            {/* Cloaked Logo - Top Left of Screen using absolute positioning relative to screen container to avoid layout shifts */}
                                            <div className="absolute top-8 left-8 flex items-center gap-1">
                                                <img src="/logo.png" alt="Cloaked Logo" className="w-13 h-13 object-contain" />
                                                <span className="text-lg font-bold tracking-tight text-white drop-shadow-md">Cloaked</span>
                                            </div>
                                            <motion.div
                                                initial={{ opacity: 1 }}
                                                animate={{ opacity: 1 }}
                                            >
                                                <h1 className="text-4xl md:text-6xl lg:text-7xl font-thin text-white leading-[0.9] tracking-tighter drop-shadow-2xl font-medium">
                                                    Protect Yourself from <br />
                                                    <span className="text-amber-200">AI Deepfakes.</span>
                                                </h1>
                                            </motion.div>

                                            {/* HUD Elements */}
                                            <div className="absolute top-13 right-8 flex gap-3 text-white/70">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="w-8 h-3 border border-white/50 rounded-sm relative">
                                                        <div className="absolute inset-0.5 w-[80%] bg-green-400/80" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="absolute bottom-8 right-8 text-white/60 font-mono text-2xl tracking-widest">
                                                ISO 400
                                            </div>
                                            <div className="absolute bottom-8 left-8 text-white/60 text-base font-mono">
                                                1/2000 F2.8
                                            </div>
                                        </div>

                                        {/* Screen Glare Reflection */}
                                        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/5 via-transparent to-transparent rotate-45 pointer-events-none z-30" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- RIGHT: Controls Area Wrapper --- */}
                    <div className="relative h-full flex-1 md:max-w-[340px] lg:max-w-[400px] p-4 z-20 bg-gradient-to-br from-[#DCD8C9] to-[#C8C4B5]">
                        <div className="relative w-full h-full p-8 flex flex-col items-center justify-between py-12 bg-gradient-to-br from-black/5 to-black/10 backdrop-blur-sm rounded-3xl border-6 border-t-white/50 border-l-white/40 border-r-black/10 border-b-black/15 shadow-inner">

                            {/* Top "Get Started" Button (Shutter-like) */}
                            <div className="relative">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95, y: 2 }}
                                    onClick={handleGetStarted}
                                    className="relative group px-8 py-4 bg-gradient-to-b from-gray-100 to-gray-300 rounded-full shadow-[0_4px_0_rgb(156,163,175),0_10px_10px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1 transition-all flex items-center gap-2 border border-white/50 whitespace-nowrap cursor-pointer"
                                >
                                    <div className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 shadow-inner"></span>
                                    </div>
                                    <span className="text-gray-700 font-bold text-sm tracking-wide group-hover:text-gray-900">GET STARTED</span>
                                </motion.button>
                            </div>

                            {/* Thumb Grip Texture Area */}
                            <div className="w-40 h-24 opacity-30 bg-[radial-gradient(circle,rgba(0,0,0,0.8)_2px,transparent_2.5px)] bg-[length:6px_6px] rounded-2xl shadow-inner border border-white/5" />

                            {/* Action Buttons - Horizontal Above Dial */}
                            <div className="flex gap-8">
                                <ButtonMetallic icon={<Settings size={24} />} label="MENU" />
                                <ButtonMetallic icon={<Maximize2 size={24} />} label="DISP" />
                            </div>

                            {/* Mode Dial - Centered vertically */}
                            <div className="relative group scale-125">
                                <div className="absolute inset-0 rounded-full bg-black/50 blur-md transform translate-y-2" />
                                <motion.div
                                    animate={{ rotate: dialRotation }}
                                    onClick={rotateDial}
                                    className="relative w-32 h-32 rounded-full bg-gradient-to-b from-gray-200 via-gray-100 to-gray-300 shadow-[0_6px_10px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.9)] border-2 border-gray-400 flex items-center justify-center cursor-pointer z-20"
                                >
                                    {/* Knurled Edge */}
                                    <div className="absolute inset-0 rounded-full border-[5px] border-dashed border-gray-400/30 opacity-50" />

                                    {/* Center Button */}
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e0e0e0] to-[#b0b0b0] shadow-inner flex items-center justify-center border border-gray-300">
                                        <span className="font-bold text-gray-500 text-sm">OK</span>
                                    </div>

                                    {/* Active Indicator */}
                                    <div className="absolute top-2 w-2 h-4 bg-amber-600 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                                </motion.div>

                                {/* Text Around Dial */}
                                <div className="absolute -inset-6 pointer-events-none">
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400">AUTO</span>
                                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-400">NL</span>
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">P</span>
                                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">M</span>
                                </div>
                            </div>



                        </div>
                    </div>
                </div>
                {/* Printer Slot Graphic */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-72 h-3 bg-black/40 rounded-full blur-[2px] shadow-inner" />
            </div>

        </section>
    );
}

function ButtonMetallic({ icon, label }: { icon: React.ReactNode, label?: string }) {
    const [rotation, setRotation] = useState(0);

    const handleClick = () => {
        setRotation(prev => prev + 360);
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <motion.button
                whileHover={{ y: 1 }}
                whileTap={{ y: 2, scale: 0.95 }}
                animate={{ rotate: rotation }}
                transition={{ type: "spring", stiffness: 50, damping: 15 }}
                onClick={handleClick}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 shadow-[0_4px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.8)] border border-gray-400 flex items-center justify-center text-gray-600 relative overflow-hidden group cursor-pointer"
            >
                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                {icon}
            </motion.button>
            {label && <span className="text-[11px] font-bold text-gray-500 tracking-widest">{label.toUpperCase()}</span>}
        </div>
    );
}
