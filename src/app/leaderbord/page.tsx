import type { Metadata } from "next";
import LeaderboardScreen from "@/components/leaderboard-screen";

export const metadata: Metadata = {
  title: "Leaderbord | Goblintown",
  description: "Global Goblintown leaderboard ranked by total collected coins.",
};

export default async function LeaderbordPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;

  return <LeaderboardScreen embedded={params.embed === "1"} />;
}
