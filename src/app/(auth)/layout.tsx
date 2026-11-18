import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/classes");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/"><Logo /></Link>
        <ThemeSwitcher compact />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">{children}</main>
    </div>
  );
}
