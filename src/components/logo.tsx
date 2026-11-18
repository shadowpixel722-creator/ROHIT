export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-text ${className}`}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path d="M9 20.5c2.5-1.2 4.7-1.2 7 0s4.5 1.2 7 0M9 15.5c2.5-1.2 4.7-1.2 7 0s4.5 1.2 7 0M9 10.5c2.5-1.2 4.7-1.2 7 0s4.5 1.2 7 0" stroke="var(--primary-fg)" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".95" />
      </svg>
      <span className="text-[17px]">Class Notebooks</span>
    </span>
  );
}
