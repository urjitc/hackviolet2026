"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 md:pt-5 md:pb-6 bg-transparent">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-full" />
                </div>
                <span className="text-xl font-bold tracking-tight text-gray-900">Cloaked</span>
            </div>

            {/* Navigation Links (Positioned to align with Hero Tab) */}
            <div className="absolute left-1/2 -translate-x-1/2 top-5 hidden md:flex items-center gap-1 bg-white p-1 rounded-full shadow-sm border border-gray-100/50">
                {["Features", "How it Works", "Pricing"].map((item) => (
                    <Link
                        key={item}
                        href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                        className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all"
                    >
                        {item}
                    </Link>
                ))}
            </div>

            {/* Contact Button */}
            <Button>
                Get Started
            </Button>
        </nav>
    );
}
