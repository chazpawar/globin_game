import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex/api";

const SESSION_STORAGE_KEY = "joan-jump-session";

type AuthMode = "login" | "signup";

export type AuthSuccess = {
  mode: AuthMode;
  sessionToken: string;
  totalCoinsCollected?: number;
  userId: string;
  username: string;
};

export type LeaderboardEntry = {
  totalCoinsCollected: number;
  username: string;
};

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL?.trim() || null;
}

function createClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    return null;
  }

  return new ConvexHttpClient(convexUrl);
}

export function isConvexConfigured() {
  return !!getConvexUrl();
}

export async function authenticateWithConvex(
  username: string,
  password: string,
) {
  const client = createClient();

  if (!client) {
    throw new Error(
      "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL and run convex dev.",
    );
  }

  return client.mutation(api.users.authenticate, {
    password,
    username,
  }) as Promise<AuthSuccess>;
}

export async function addCollectedCoins(sessionToken: string, amount = 1) {
  const client = createClient();

  if (!client) {
    throw new Error(
      "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL and run convex dev.",
    );
  }

  return client.mutation(api.users.addCollectedCoins, {
    amount,
    sessionToken,
  }) as Promise<{ totalCoinsCollected: number; username: string }>;
}

export async function fetchLeaderboard() {
  const client = createClient();

  if (!client) {
    throw new Error(
      "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL and run convex dev.",
    );
  }

  return client.query(api.users.getLeaderboard, {}) as Promise<
    LeaderboardEntry[]
  >;
}

export function saveSession(auth: AuthSuccess) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth));
}

export function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSuccess;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}
