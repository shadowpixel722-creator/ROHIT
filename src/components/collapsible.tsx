"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * A card that opens and closes with a dropdown arrow (native <details>, so it works before the page
 * finishes loading). It starts as `defaultOpen` and then keeps whatever the user chose, even when the
 * page refreshes its data after a save.
 */
export function Collapsible({ title, meta, icon, defaultOpen = false, children, className, bodyClassName, id, "data-testid": testId }: {
  title: ReactNode; meta?: ReactNode; icon?: ReactNode; defaultOpen?: boolean; children: ReactNode; className?: string; bodyClassName?: string; id?: string; "data-testid"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Arriving on a link to this section (e.g. "#lesson-…") opens it.
  useEffect(() => { if (id && window.location.hash === `#${id}`) setOpen(true); }, [id]);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} id={id} data-testid={testId} className={clsx("rounded-2xl border border-border bg-surface shadow-card", className)}>
      <summary className="flex cursor-pointer items-center gap-3 rounded-2xl px-5 py-4 select-none hover:bg-surface-2/40">
        {icon && <span className="shrink-0 text-primary">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-tight text-text">{title}</span>
          {meta && <span className="block truncate text-sm text-muted">{meta}</span>}
        </span>
        <ChevronDown className="chevron size-5 shrink-0 text-faint" aria-hidden />
      </summary>
      <div className={clsx("px-5 pb-5", bodyClassName)}>{children}</div>
    </details>
  );
}
