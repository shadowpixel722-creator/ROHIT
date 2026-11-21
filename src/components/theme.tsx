"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./ui";

export type ThemePref = "light" | "dark" | "system";
const KEY = "ep-theme";
/** Knowa's black-and-blue look is the default; people can still pick Light or System. */
const DEFAULT_THEME: ThemePref = "dark";

/** Runs before paint (inlined in <head>) to avoid a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${KEY}')||'dark';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark')}})();`;

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(DEFAULT_THEME);
  useEffect(() => {
    let stored: ThemePref = DEFAULT_THEME;
    try {
      stored = (localStorage.getItem(KEY) as ThemePref) || DEFAULT_THEME;
    } catch {}
    setPref(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: ThemePref = DEFAULT_THEME;
      try {
        current = (localStorage.getItem(KEY) as ThemePref) || DEFAULT_THEME;
      } catch {}
      if (current === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const set = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    apply(p);
  };
  return { pref, set };
}

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { pref, set } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl border border-border bg-surface-2 p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          title={label}
          onClick={() => set(value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium transition-colors",
            pref === value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {!compact && label}
          {compact && <span className="sr-only">{label}</span>}
        </button>
      ))}
    </div>
  );
}

/** Records the browser time zone in a cookie so the server knows the student's "today". */
export function TimeZoneCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.includes(`ep_tz=${encodeURIComponent(tz)}`)) {
        document.cookie = `ep_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {}
  }, []);
  return null;
}
