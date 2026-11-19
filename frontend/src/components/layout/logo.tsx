/**
 * LinkLens logo mark (visual redesign): a geometric lens — a ring
 * with an offset dot — drawn in the current text color, next to the
 * plain wordmark. No shield, no tile, no accent color: the identity
 * is typographic and monochrome like the rest of the system.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="15" cy="15" r="10.5" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="18.5" cy="13" r="4" fill="currentColor" />
      <path
        d="M22.5 22.5 L28 28"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoWordmark() {
  return (
    <span className="text-base font-semibold tracking-tight sm:text-lg">
      LinkLens
    </span>
  );
}
