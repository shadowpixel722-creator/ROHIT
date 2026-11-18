import { HeroShop } from "@/components/game/hero-shop";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getGame } from "@/lib/game-server";

export const metadata = { title: "My hero" };

export default async function HeroPage() {
  const user = await requireUser();
  const game = await getGame(user.id);
  return (
    <div className="space-y-5">
      <PageHeader title="My hero" description="Your streak, level and coins, and the shop for your Boss Battle hero. Coins come from learning: practice, quizzes, lessons and boss fights. Nothing here costs real money." />
      <HeroShop game={game} />
    </div>
  );
}
