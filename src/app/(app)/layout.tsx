import { classView } from "@/components/classes/class-nav";
import { MobileTabBar, MobileTopBar, Sidebar, type NavClass } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGame } from "@/lib/game-server";
import { ensurePersonalSpace } from "@/lib/rooms";

/** The class switcher: your own space first, then classes you teach (own or co-teach) or joined, and student rooms. */
async function navClasses(userId: string): Promise<NavClass[]> {
  const rows = await db.classroom.findMany({
    where: { OR: [{ teacherId: userId }, { members: { some: { userId, status: "ACTIVE" } } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, grade: true, kind: true, teacherId: true, members: { where: { userId }, select: { role: true } }, _count: { select: { notes: { where: { status: "PENDING" } } } } },
  });
  return rows.map((c) => {
    const role = c.kind === "CLASS" && c.teacherId === userId ? "TEACHER" : c.members[0]?.role === "TEACHER" ? (c.kind === "CLASS" ? "TEACHER" : "SUPERVISOR") : "STUDENT";
    const view = classView(c.kind, role);
    return { id: c.id, name: c.name, grade: c.grade, kind: c.kind, view, owner: c.teacherId === userId, pending: view === "teacher" ? c._count.notes : 0 };
  }).sort((a, b) => Number(b.kind === "PERSONAL") - Number(a.kind === "PERSONAL"));
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensurePersonalSpace(user);
  const [classes, game] = await Promise.all([navClasses(user.id), getGame(user.id)]);
  // Teachers don't get the streak chip (they can still open My hero).
  const chip = user.role === "TEACHER" ? null : { streak: game.streak, doneToday: game.doneToday, coins: game.coins };
  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <Sidebar name={user.name} email={user.email} role={user.role} classes={classes} game={chip} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar classes={classes} game={chip} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-8 sm:pt-8 lg:pb-12">{children}</main>
        </div>
        <MobileTabBar classes={classes} />
      </div>
    </ToastProvider>
  );
}
