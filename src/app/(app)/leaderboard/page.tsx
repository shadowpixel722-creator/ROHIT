import { CheckCheck, Coins, Star, Trophy } from "lucide-react";
import { Card, CardHeader, cn, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canSeeLeaderboard, leaderboards, type Metric } from "@/lib/leaderboard";

export const metadata = { title: "Leaderboard" };

const META: Record<Metric, { title: string; description: string; unit: string; Icon: typeof Trophy }> = {
  xp: { title: "XP", description: "From practice, quizzes, lessons and boss fights", unit: "XP", Icon: Star },
  coins: { title: "Coins", description: "Coins held now (spending them in the shop lowers this)", unit: "coins", Icon: Coins },
  perfect: { title: "Perfect answers", description: "Multiple-choice answers right, plus written answers marked fully correct", unit: "perfect", Icon: CheckCheck },
};

/** The app-wide leaderboard: XP, coins and perfect answers. Teachers can switch it off for their class. */
export default async function LeaderboardPage() {
  const user = await requireUser();
  if (!(await canSeeLeaderboard(user.id, user.role))) {
    return (
      <div className="space-y-5">
        <PageHeader title="Leaderboard" />
        <Card><EmptyState icon={<Trophy className="size-5" />} title="The leaderboard is off for your class" description="Your teacher has switched it off. Your XP, coins and streak are still on My hero." /></Card>
      </div>
    );
  }
  const boards = await leaderboards(user.id);
  return (
    <div className="space-y-5" data-testid="leaderboard">
      <PageHeader title="Leaderboard" description="Top students across the whole app. Teachers can switch the leaderboard off for their class in Settings." />
      <div className="grid gap-4 lg:grid-cols-3">
        {boards.map((b) => {
          const m = META[b.metric];
          return (
            <Card key={b.metric} data-testid={`board-${b.metric}`}>
              <CardHeader icon={<m.Icon className="size-5" />} title={m.title} description={m.description} />
              <div className="px-5 pb-5">
                {b.rows.length === 0 ? <p className="text-sm text-muted">Nobody yet. Be the first!</p> : (
                  <ol className="divide-y divide-border">
                    {b.rows.map((r, i) => (
                      <li key={i} className={cn("flex items-center gap-3 py-2 text-sm", r.you && "-mx-2 rounded-lg bg-primary-soft px-2 font-semibold")}>
                        <span className={cn("w-6 text-right tabular-nums", r.rank <= 3 ? "font-semibold text-warn" : "text-muted")}>{r.rank}</span>
                        <span className="min-w-0 flex-1 truncate">{r.name}{r.you && " (you)"}</span>
                        <span className="tabular-nums">{r.value.toLocaleString("en-IN")}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {user.role !== "TEACHER" && !b.rows.some((r) => r.you) && (
                  <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm" data-testid="my-rank">
                    {b.you ? <>You&apos;re <b>#{b.you.rank}</b> with {b.you.value.toLocaleString("en-IN")} {m.unit}.</> : <>You&apos;re not on this board yet. Keep learning!</>}
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
