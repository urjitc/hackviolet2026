"use client";

import { useEffect, useRef } from "react";

interface LightRay {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  opacity: number;
  maxOpacity: number;
  fadeSpeed: number;
  fadingIn: boolean;
  drift: number;
}

export function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raysRef = useRef<LightRay[]>([]);
  const animationRef = useRef<number>(0);
  const grainPhaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initRays();
    };

    const initRays = () => {
      // Create soft diagonal light rays
      const rayCount = 4;
      raysRef.current = Array.from({ length: rayCount }, (_, i) => ({
        x: (canvas.width / (rayCount + 1)) * (i + 1) + (Math.random() - 0.5) * 200,
        y: -100,
        width: Math.random() * 150 + 100, // 100-250px wide
        length: canvas.height + 400,
        angle: Math.PI / 6 + (Math.random() - 0.5) * 0.2, // ~30 degrees with variation
        opacity: 0,
        maxOpacity: Math.random() * 0.03 + 0.02, // Very subtle: 0.02-0.05
        fadeSpeed: Math.random() * 0.0008 + 0.0004, // Very slow fade
        fadingIn: Math.random() > 0.5,
        drift: (Math.random() - 0.5) * 0.1, // Slow horizontal drift
      }));
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw light rays
      raysRef.current.forEach((ray) => {
        // Fade animation
        if (ray.fadingIn) {
          ray.opacity += ray.fadeSpeed;
          if (ray.opacity >= ray.maxOpacity) {
            ray.fadingIn = false;
          }
        } else {
          ray.opacity -= ray.fadeSpeed;
          if (ray.opacity <= 0) {
            ray.fadingIn = true;
            ray.opacity = 0;
          }
        }

        // Slow drift
        ray.x += ray.drift;
        if (ray.x < -ray.width) ray.x = canvas.width + ray.width;
        if (ray.x > canvas.width + ray.width) ray.x = -ray.width;

        // Draw diagonal light beam
        ctx.save();
        ctx.translate(ray.x, ray.y);
        ctx.rotate(ray.angle);

        // Create gradient for soft edges
        const gradient = ctx.createLinearGradient(-ray.width / 2, 0, ray.width / 2, 0);
        gradient.addColorStop(0, `rgba(255, 250, 240, 0)`);
        gradient.addColorStop(0.3, `rgba(255, 250, 240, ${ray.opacity})`);
        gradient.addColorStop(0.5, `rgba(255, 248, 235, ${ray.opacity * 1.2})`);
        gradient.addColorStop(0.7, `rgba(255, 250, 240, ${ray.opacity})`);
        gradient.addColorStop(1, `rgba(255, 250, 240, 0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(-ray.width / 2, 0, ray.width, ray.length);
        ctx.restore();
      });

      // Subtle film grain shimmer overlay
      grainPhaseRef.current += 0.02;
      const grainOpacity = 0.015 + Math.sin(grainPhaseRef.current) * 0.008; // Pulses between 0.007-0.023

      // Create noise pattern
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Sample fewer pixels for performance (every 4th pixel)
      for (let i = 0; i < data.length; i += 16) {
        const noise = (Math.random() - 0.5) * 25 * grainOpacity;
        data[i] = Math.min(255, Math.max(0, data[i] + noise)); // R
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise)); // G
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise)); // B
      }

      ctx.putImageData(imageData, 0, 0);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[1]"
      aria-hidden="true"
    />
  );
}
