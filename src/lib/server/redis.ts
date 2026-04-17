// Server-only redis client. Reused across requests so we don't reconnect
// per /api/sim-status call.
import { createClient, type RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379/0";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const c = createClient({ url: REDIS_URL }) as RedisClientType;
    c.on("error", (e) => {
      console.error("[redis] client error:", e);
    });
    await c.connect();
    client = c;
    connecting = null;
    return c;
  })();

  return connecting;
}
