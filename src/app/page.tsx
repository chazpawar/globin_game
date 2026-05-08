import type { Metadata } from "next";
import GameClient from "@/components/game-client";

export const metadata: Metadata = {
  title: "goblintown",
  description: "goblintown",
};

export default function Home() {
  return <GameClient />;
}
