"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/lib/convex/api";
import { isConvexConfigured, type LeaderboardEntry } from "@/lib/convex/auth";

export default function LeaderboardScreen({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const convexConfigured = isConvexConfigured();
  const entries = useQuery(
    api.users.getLeaderboard,
    convexConfigured ? {} : "skip",
  ) as LeaderboardEntry[] | undefined;
  const loading = convexConfigured && entries === undefined;
  const error = convexConfigured
    ? null
    : "Convex is not configured. Run convex dev and keep it running.";

  return (
    <main
      className={`min-h-screen bg-[#00C] text-white ${embedded ? "py-8" : "py-20"}`}
    >
      <div className="flex min-h-screen w-full flex-col gap-6 border border-white/20 bg-[#00C] p-6 sm:p-8">
        {embedded ? (
          <h1 className="text-3xl text-white">Top Coin Collectors</h1>
        ) : (
          <header className="flex flex-col gap-3">
            <div>
              <Link
                href="/?login=1"
                className="inline-flex min-w-24 items-center justify-center px-3 py-2 text-white transition hover:text-zinc-300"
              >
                Back
              </Link>
            </div>
            <p className="text-zinc-400">Global leaderboard</p>
            <h1 className="text-3xl text-white">Top Coin Collectors</h1>
            <p className="text-zinc-400">
              Ranked by total coins collected across all play sessions.
            </p>
          </header>
        )}

        {loading ? <p>Loading leaderboard...</p> : null}
        {error ? <p className="text-red-300">{error}</p> : null}

        {!loading && !error ? (
          <div className="overflow-hidden border border-white/15">
            <div className="grid grid-cols-[5rem_1fr_10rem] bg-white/10 px-4 py-3 text-left text-zinc-200">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-right">Coins</span>
            </div>

            {entries?.length ? (
              entries.map((entry, index) => (
                <div
                  key={entry.username}
                  className="grid grid-cols-[5rem_1fr_10rem] border-t border-white/10 px-4 py-3"
                >
                  <span>#{index + 1}</span>
                  <span>{entry.username}</span>
                  <span className="text-right">
                    {entry.totalCoinsCollected}
                  </span>
                </div>
              ))
            ) : (
              <div className="border-t border-white/10 px-4 py-6 text-zinc-400">
                No players on the leaderboard yet.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
