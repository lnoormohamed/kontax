import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { getRedis } from "~/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep each dependency check bounded so a hung DB/Redis connection can't
// hold the health check (and therefore Coolify's restart decision) open.
const CHECK_TIMEOUT_MS = 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("health check timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function checkDb(): Promise<boolean> {
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

// null = Redis isn't configured for this deploy (dev/staging without
// REDIS_URL) — that's not a degraded state, unlike an unreachable Redis.
async function checkRedis(): Promise<boolean | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const reply = await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
    return reply === "PONG";
  } catch {
    return false;
  }
}

export async function GET() {
  const [dbOk, redisOk] = await Promise.all([checkDb(), checkRedis()]);

  if (dbOk && redisOk !== false) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  return NextResponse.json(
    { status: "degraded", db: dbOk, redis: redisOk },
    { status: 503 },
  );
}
