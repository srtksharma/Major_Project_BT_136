import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PhasePlaceholderProps {
  icon: LucideIcon;
  title: string;
  phase: string;
  children: ReactNode;
}

/**
 * Honest placeholder for routes whose UI is scheduled for a later
 * phase — states what will be built and on which API, instead of
 * fake content or lorem ipsum.
 */
export function PhasePlaceholder({
  icon: Icon,
  title,
  phase,
  children,
}: PhasePlaceholderProps) {
  return (
    <section className="mx-auto max-w-2xl py-10 sm:py-14">
      <div className="glass-card p-6 text-center sm:p-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">
          {phase}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
        <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </section>
  );
}
