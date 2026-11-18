import { BookOpenCheck, MessagesSquare, NotebookPen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

// `soon` marks features that are planned but not built yet, so the page never over-promises.
const FEATURES = [
  { Icon: ShieldCheck, title: "Classes with a join code", text: "Teachers create a class and set up its subjects and chapters. Students join with a short code.", soon: false },
  { Icon: NotebookPen, title: "One class notebook", text: "Students share notebook pages by subject and chapter, and the teacher approves each one.", soon: true },
  { Icon: MessagesSquare, title: "Learn together", text: "Discuss pages and ask questions about the class notes.", soon: true },
  { Icon: BookOpenCheck, title: "Homework from your notes", text: "Practice questions and homework built from what your class actually wrote.", soon: true },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <Link href="/login" className="hidden px-3 text-sm font-medium text-muted hover:text-text sm:inline">Sign in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="animate-fade-in py-16 sm:py-24">
          <p className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">For classes and teachers</p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Your class&apos;s notebooks, together in one place.</h1>
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">Teachers create a class and share a join code. Students will share their notebook pages, the teacher approves them, and the whole class learns from them.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register">Get started, it&apos;s free</ButtonLink>
            <ButtonLink href="/login" variant="secondary">I have an account</ButtonLink>
          </div>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {FEATURES.map(({ Icon, title, text, soon }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-primary" aria-hidden />
                {soon && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Coming soon</span>}
              </div>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
