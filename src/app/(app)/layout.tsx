import { MobileTabBar, MobileTopBar, Sidebar, type NavClass } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGame } from "@/lib/game-server";

/** The classes shown in the sidebar's class switcher: ones you teach (own or co-teach) or have joined. */
async function navClasses(userId: string): Promise<NavClass[]> {
  const rows = await db.classroom.findMany({
    where: { OR: [{ teacherId: userId }, { members: { some: { userId, status: "ACTIVE" } } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, grade: true, teacherId: true, members: { where: { userId }, select: { role: true } }, _count: { select: { notes: { where: { status: "PENDING" } } } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, grade: c.grade, teacher: c.teacherId === userId || c.members.some((m) => m.role === "TEACHER") })).map((c, i) => ({ ...c, pending: c.teacher ? rows[i]._count.notes : 0 }));
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
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
