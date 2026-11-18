import { notFound } from "next/navigation";
import { BossLobby } from "@/components/game/boss-lobby";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { bossLobby } from "@/lib/boss-queries";
import { getGame } from "@/lib/game-server";

export const metadata = { title: "Boss Battles" };

export default async function BossPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await getClassAccess(user.id, id))) notFound();
  const [lobby, game] = await Promise.all([bossLobby(user.id, id), getGame(user.id)]);
  return <BossLobby lobby={lobby} look={game.look} streak={game.streak} coins={game.coins} />;
}
