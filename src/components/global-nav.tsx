import Link from "next/link";

export default function GlobalNav() {
  return (
    <nav className="fixed top-4 left-4 z-[1000]">
      <Link
        href="/leaderbord"
        className="inline-flex min-w-28 items-center justify-center px-4 py-2 text-white transition hover:text-zinc-300"
      >
        Leaderbord
      </Link>
    </nav>
  );
}
