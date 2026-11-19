import { AuthForm } from "@/components/auth-form";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Create account" };

/** `?add=1`: sign in to another account and keep the current one signed in, to switch between them. */
export default async function Page({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const me = await getCurrentUser();
  if (me && add !== "1") redirect("/classes"); // already signed in
  return <AuthForm mode="register" adding={me ? { name: me.name } : undefined} />;
}
