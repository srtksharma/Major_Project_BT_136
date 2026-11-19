"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

// Semicircle geometry: r = 52, arc length = π × r ≈ 163.4
const ARC_LENGTH = 163.4;

/** Percentage that counts up (or snaps, under reduced motion). */
function CountUpPercent({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const text = useTransform(motionValue, (v) => `${Math.round(v)}%`);

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 1,
      delay: 0.15,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [motionValue, value, reduceMotion]);

  return <motion.span>{text}</motion.span>;
}

/**
 * Needle gauge (shared by the result view and the home sample card):
 * a thick arc filled in the verdict color — the only place the
 * verdict color appears — over a light track, a dotted inner ring,
 * and a dark needle pointing at the score. The percentage counts up
 * below the dial. Arc, needle and number snap instantly under
 * reduced motion. `className` carries the verdict text color class
 * (text-safe / text-suspicious / text-phishing).
 */
export function NeedleGauge({
  value,
  className,
  size = "default",
}: {
  value: number;
  className?: string;
  size?: "default" | "sm";
}) {
  const reduceMotion = useReducedMotion();
  const offset = ARC_LENGTH * (1 - value / 100);
  const needleAngle = -90 + (value / 100) * 180;

  return (
    <div
      className="flex shrink-0 flex-col items-center"
      role="img"
      aria-label={`Model confidence: ${value} percent`}
    >
      <svg
        viewBox="0 0 120 70"
        className={size === "sm" ? "h-24 w-44" : "h-[120px] w-[216px]"}
        fill="none"
        aria-hidden
      >
        {/* Track */}
        <path
          d="M 8 62 A 52 52 0 0 1 112 62"
          strokeWidth="10"
          strokeLinecap="butt"
          className="stroke-foreground/10"
        />
        {/* Arc fill — verdict color only */}
        <motion.path
          d="M 8 62 A 52 52 0 0 1 112 62"
          strokeWidth="10"
          strokeLinecap="butt"
          stroke="currentColor"
          className={className}
          strokeDasharray={ARC_LENGTH}
          initial={reduceMotion ? false : { strokeDashoffset: ARC_LENGTH }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {/* Dotted inner ring */}
        <path
          d="M 20 62 A 40 40 0 0 1 100 62"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.5 5"
          className="stroke-muted-foreground/50"
        />
        {/* Dark needle */}
        <motion.g
          initial={reduceMotion ? false : { rotate: -90 }}
          animate={{ rotate: needleAngle }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
          style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
          className="text-foreground"
        >
          <path d="M 60 20 L 62.5 62 L 57.5 62 Z" fill="currentColor" />
        </motion.g>
        <circle
          cx="60"
          cy="62"
          r="5"
          className="fill-foreground"
          stroke="var(--color-card)"
          strokeWidth="1.5"
        />
      </svg>
      <p
        className={cn(
          "mt-2.5 text-center font-display font-semibold tracking-tight",
          size === "sm" ? "text-xl" : "text-2xl",
        )}
        aria-hidden
      >
        <CountUpPercent value={value} />
      </p>
    </div>
  );
}
