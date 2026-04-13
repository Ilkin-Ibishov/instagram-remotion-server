/**
 * Shared Redis client singleton.
 * All modules that need Redis (scheduler lock, news cache, etc.) should import
 * getRedisClient from here rather than creating their own connection.
 */
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<RedisClient> | null = null;

function resetCachedClient(): void {
  redisClientPromise = null;
}

export async function getRedisClient(): Promise<RedisClient> {
  if (redisClientPromise) {
    return redisClientPromise;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  const client = createClient({ url: redisUrl });
  redisClientPromise = client.connect()
    .then(() => client as RedisClient)
    .catch((error) => {
      resetCachedClient();
      try {
        if (client.isOpen) {
          client.disconnect();
        }
      } catch {
        // Ignore cleanup errors after failed connect attempts.
      }
      throw error;
    });
  return redisClientPromise;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClientPromise) {
    return;
  }

  try {
    const client = await redisClientPromise;
    if (client.isOpen) {
      await client.quit();
    }
  } catch {
    try {
      const client = await redisClientPromise;
      if (client.isOpen) {
        client.disconnect();
      }
    } catch {
      // Ignore cleanup errors during process shutdown.
    }
  } finally {
    resetCachedClient();
  }
}

export const __testing = {
  resetCachedClient,
};
