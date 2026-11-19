"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Page transition (Phase 10): templates remount on every navigation,
 * so this gives each route a short fade-and-rise entrance. Instant
 * (opacity only, no movement) under prefers-reduced-motion.
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
