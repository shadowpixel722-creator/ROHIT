"use client";

import { Box, Check, ChevronsUpDown, Flame, FolderOpen, Home, LogOut, Settings, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { activeItem, classSections, parseClassPath, viewLabel, type ClassView } from "./classes/class-nav";
import { Logo } from "./logo";
import { ThemeSwitcher } from "./theme";
import { cn } from "./ui";

/** The signed-in person's streak and coins, for the chip in the sidebar and top bar. */
export type NavGame = { streak: number; doneToday: boolean; coins: number };

/** `pending`: notes waiting for this teacher to review (0 for everyone else). `owner`: the student head of a room. */
export type NavClass = { id: string; name: string; grade: string | null; kind: string; view: ClassView; owner: boolean; pending?: number };

/** `phone: false`: left off the phone tab bar (too many tabs); reached from another page there. */
export const NAV: { href: string; label: string; Icon: typeof Users; phone?: false }[] = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/classes", label: "Classes", Icon: Users },
  { href: "/lessons", label: "Lessons", Icon: Box },
  { href: "/hero", label: "My hero", Icon: Sparkles },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy, phone: false },
  { href: "/files", label: "My files", Icon: FolderOpen },
  { href: "/settings", label: "Settings", Icon: Settings },
];

/** "8-B Science" → "8B", "Maths club" → "MC". */
const initials = (name: string) => (name.match(/[A-Za-z0-9]+/g) ?? ["?"]).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");
const LAST_KEY = "nav:last-page";

/**
 * Each section remembers the last page you were on in it (for this browser tab), so going
 * Classes → a class's Calendar → Settings → Classes brings you back to that Calendar. Clicking the
 * section you're already in goes to its start page, as usual. Class sections (Learn, Practise…)
 * remember their last page too.
 */
function useLastPages() {
  const path = usePathname();
  const [last, setLast] = useState<Record<string, string>>({});
  useEffect(() => {
    let saved: Record<string, string> = {};
    try { saved = JSON.parse(sessionStorage.getItem(LAST_KEY) ?? "{}") ?? {}; } catch { /* storage blocked: just don't remember */ }
    const top = NAV.find((n) => isActive(path, n.href));
    if (top) saved = { ...saved, [top.href]: path + window.location.search };
    const inClass = parseClassPath(path);
    if (inClass) {
      const { section } = activeItem(classSections("teacher").concat(classSections("student")), inClass.rest);
      saved = { ...saved, [`class:${inClass.id}:${section.id}`]: path };
    }
    try { sessionStorage.setItem(LAST_KEY, JSON.stringify(saved)); } catch { /* ignore */ }
    setLast(saved);
  }, [path]);
  return {
    top: (href: string) => (isActive(path, href) ? href : (last[href] ?? href)),
    section: (classId: string, sectionId: string, fallback: string) => last[`class:${classId}:${sectionId}`] ?? fallback,
  };
}

function useCurrentClass(classes: NavClass[]) {
  const path = usePathname();
  const parsed = parseClassPath(path);
  const cls = parsed ? classes.find((c) => c.id === parsed.id) ?? null : null;
  return { path, parsed, cls };
}

export function Sidebar({ name, email, role, classes, game }: { name: string; email: string; role: string; classes: NavClass[]; game: NavGame | null }) {
  const { path, parsed, cls } = useCurrentClass(classes);
  const links = useLastPages();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex print:!hidden">
      <div className="flex items-center justify-between gap-2 px-3">
        <Link href="/dashboard"><Logo /></Link>
      </div>
      {game && <GameChip game={game} className="mx-3 mt-4" />}
      <nav className="mt-5 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(path, href) && !(href === "/classes" && cls);
          return (
            <Link key={href} href={links.top(href)} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text")}>
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      {cls && parsed && (
        <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-border pt-5">
          <ClassSwitcher classes={classes} current={cls} />
          <ClassNav classId={cls.id} view={cls.view} rest={parsed.rest} pending={cls.pending ?? 0} />
        </div>
      )}
      {!cls && <div className="flex-1" />}

      <div className="space-y-3 border-t border-border px-1 pt-4">
        <ThemeSwitcher />
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name} <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{role === "TEACHER" ? "Teacher" : "Student"}</span></p>
            <p className="truncate text-xs text-faint">{email}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-text" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

/** Streak and coins at a glance; opens My hero. Grey until you've learned something today. */
function GameChip({ game, compact, className }: { game: NavGame; compact?: boolean; className?: string }) {
  return (
    <Link href="/hero" data-testid="game-chip" title={game.doneToday ? `${game.streak} day streak. Done for today!` : "Learn something today to keep your streak"}
      className={cn("flex items-center gap-2 rounded-lg border border-border text-xs font-semibold hover:border-border-strong", compact ? "px-2 py-1" : "justify-between px-3 py-2", className)}>
      <span className={cn("inline-flex items-center gap-1", game.doneToday ? "text-warn" : "text-faint")}><Flame className="size-4" aria-hidden /> {game.streak}<span className="sr-only"> day streak</span>{!compact && <span className="font-normal text-muted"> day streak</span>}</span>
      <span className="inline-flex items-center gap-1 text-text"><span className="inline-block size-2.5 rounded-full bg-[#ffd23a]" aria-hidden /> {game.coins}<span className="sr-only"> coins</span></span>
    </Link>
  );
}

/** The current class's sections and pages, in the sidebar. */
function ClassNav({ classId, view, rest, pending }: { classId: string; view: ClassView; rest: string; pending: number }) {
  const sections = classSections(view);
  const { item } = activeItem(sections, rest);
  const base = `/classes/${classId}`;
  return (
    <nav aria-label="Class sections" className="no-scrollbar mt-3 -mr-1 flex-1 space-y-4 overflow-y-auto pr-1">
      {sections.map((s) => (
        <div key={s.id}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{s.label}</p>
          <ul className="space-y-0.5">
            {s.items.map((i) => {
              const on = i === item;
              return (
                <li key={i.slug}>
                  <Link href={i.slug ? `${base}/${i.slug}` : base} prefetch={false} aria-current={on ? "page" : undefined}
                    className={cn("flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      on ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
                    <i.Icon className={cn("size-4", on ? "text-primary" : "text-faint")} aria-hidden />
                    <span className="flex-1">{i.label}</span>
                    {i.slug === "review" && pending > 0 && <span className="rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn">{pending}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** The class name at the top of the class menu; opens a list to jump to another class. */
function ClassSwitcher({ classes, current }: { classes: NavClass[]; current: NavClass }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" data-testid="class-switcher"
        className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-bg px-2.5 py-2 text-left hover:border-border-strong">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-fg">{initials(current.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{current.name}</span>
          <span className="block text-xs text-muted">{current.grade ? `Class ${current.grade}` : current.kind === "CLASS" ? "Class" : current.kind === "ROOM" ? "Student room" : "Personal"} · {viewLabel(current.kind, current.view, current.owner)}</span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" aria-label="Your classes" className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/classes/${c.id}`} role="option" aria-selected={c.id === current.id}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.id === current.id && <Check className="size-4 text-primary" aria-hidden />}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-1"><Link href="/classes" className="block rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface-2">All classes…</Link></li>
        </ul>
      )}
    </div>
  );
}

export function MobileTopBar({ classes, game }: { classes: NavClass[]; game: NavGame | null }) {
  const { cls } = useCurrentClass(classes);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur lg:hidden print:hidden">
      {cls ? (
        <Link href="/classes" className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{cls.name}</span>
          <span className="block text-xs text-muted">{cls.grade ? `Class ${cls.grade} · ` : ""}All classes</span>
        </Link>
      ) : <Link href="/dashboard"><Logo /></Link>}
      <div className="flex items-center gap-2">{game && <GameChip game={game} compact />}<ThemeSwitcher compact /></div>
    </header>
  );
}

/** Phones: the app's sections, or, inside a class, Home plus the class's sections. */
export function MobileTabBar({ classes }: { classes: NavClass[] }) {
  const { path, parsed, cls } = useCurrentClass(classes);
  const links = useLastPages();
  const items = cls && parsed
    ? [{ href: "/dashboard", label: "Home", Icon: Home, on: false },
       ...classSections(cls.view).map((s) => {
         const base = `/classes/${cls.id}`;
         const first = s.items[0].slug ? `${base}/${s.items[0].slug}` : base;
         return { href: links.section(cls.id, s.id, first), label: s.label, Icon: s.Icon, on: activeItem(classSections(cls.view), parsed.rest).section.id === s.id };
       })]
    : NAV.filter((n) => n.phone !== false).map((n) => ({ href: links.top(n.href), label: n.label, Icon: n.Icon, on: isActive(path, n.href) }));
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, Icon, on }) => (
          <li key={label}>
            <Link href={href} aria-current={on ? "page" : undefined}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors", on ? "text-primary" : "text-faint hover:text-text")}>
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
