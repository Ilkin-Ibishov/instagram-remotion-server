/**
 * Shared Redis client singleton.
 * All modules that need Redis (scheduler lock, news cache, etc.) should import
 * getRedisClient from here rather than creating their own connection.
 */
import { createClient } from 'redis';

let redisClientPromise: Promise<ReturnType<typeof createClient>> | null = null;

export async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  if (redisClientPromise) {
    return redisClientPromise;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  const client = createClient({ url: redisUrl });
  redisClientPromise = client.connect().then(() => client as any);
  return redisClientPromise;
}
