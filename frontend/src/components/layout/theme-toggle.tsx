"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Dark/light toggle. The icon is switched with the CSS `dark:` variant
 * (driven by the same class next-themes sets), so there is no mounted
 * state and no hydration mismatch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle between dark and light mode"
      title="Toggle between dark and light mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-full"
    >
      <motion.span
        initial={{ rotate: -40, opacity: 0.4 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex"
      >
        <Sun className="hidden size-5 dark:block" aria-hidden />
        <Moon className="block size-5 dark:hidden" aria-hidden />
      </motion.span>
      <span className="sr-only">Toggle between dark and light mode</span>
    </Button>
  );
}
