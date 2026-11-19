"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CircleCheck,
  CircleExclamationPoint,
  Info,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal toast system (Phase 10): a provider + useToast() hook.
 * Toasts confirm small actions (copy, download, export, cancel) and
 * surface errors without interrupting the page. Auto-dismiss after
 * 4s; polite live region for success/info, assertive for errors.
 */

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const ToastContext = createContext<{
  toast: (message: string, variant?: ToastVariant) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const VARIANT_ICON = {
  success: CircleCheck,
  error: CircleExclamationPoint,
  info: Info,
} as const;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-safe/40 text-safe",
  error: "border-phishing/40 text-phishing",
  info: "border-primary/40 text-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const reduceMotion = useReducedMotion();

  const toast = useCallback((message: string, variant: ToastVariant = "success") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((item) => {
            const Icon = VARIANT_ICON[item.variant];
            return (
              <motion.div
                key={item.id}
                layout={!reduceMotion}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                role={item.variant === "error" ? "alert" : "status"}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card p-3.5 text-sm shadow-card",
                  VARIANT_CLASSES[item.variant],
                )}
              >
                <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
                <p className="leading-snug text-foreground">{item.message}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
