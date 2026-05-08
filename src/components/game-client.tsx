"use client";

import Link from "next/link";
import { useEffect } from "react";
import { mountJoanJump } from "@/lib/joan/game";

const introText = String.raw`\`GOBLINTOWN\`

> Press \`ENTER\` to start playing
             ,      ,
            /(.-""-.)\\
        |\\  \/      \/  /|
        | \\ / =.  .= \\ / |
        \\( \\   o\/o   / )/
         \\_, '-/  \\-' ,_/
           /   \\__/   \\
           \\ \\__/\\__/ /
         ___\\ \\|--|/ /___
       /\`    \\      /    \`\\
      /       '----'       \\

Controls
--------

    Arrow left  -> Moving left 
    Arrow right -> Moving right 
    Arrow up    -> Jumping and double jumps
    Shift       -> Running
    Space       -> Antigravity dogerolling
`;

export default function GameClient() {
  useEffect(() => mountJoanJump(), []);

  return (
    <div id="wrapper">
      <Link
        id="leaderbord-link"
        href="/leaderbord"
        className="fixed top-4 left-4 z-[1000] min-w-28 px-4 py-2 text-center text-white transition hover:text-zinc-300"
        style={{ display: "none" }}
      >
        Leaderboard
      </Link>
      <Link
        id="home-link"
        href="#"
        className="fixed top-4 right-4 z-[1000] min-w-24 px-4 py-2 text-center text-white transition hover:text-zinc-300"
        style={{ display: "none" }}
      >
        Home
      </Link>
      {/* biome-ignore lint/a11y/useMediaCaption: hidden audio nodes are controlled programmatically for game sound playback. */}
      <audio id="music" loop />
      {/* biome-ignore lint/a11y/useMediaCaption: hidden audio nodes are controlled programmatically for game sound playback. */}
      <audio id="fx" />
      <pre id="decor" />
      <pre id="ground" />
      <pre id="entities" />
      <pre id="infos">{introText}</pre>
    </div>
  );
}
