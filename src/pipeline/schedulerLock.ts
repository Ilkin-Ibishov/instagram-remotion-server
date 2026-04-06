import { createClient } from 'redis';
import crypto from 'crypto';

export interface LockHandle {
  key: string;
  token: string;
}

let redisClientPromise: Promise<any> | null = null;

async function getRedisClient(): Promise<any> {
  if (redisClientPromise) {
    return redisClientPromise;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for scheduler lock');
  }

  const client = createClient({ url: redisUrl });
  redisClientPromise = client.connect().then(() => client);
  return redisClientPromise;
}

export async function acquireDistributedLock(key: string, ttlSeconds: number): Promise<LockHandle | null> {
  const client = await getRedisClient();
  const token = crypto.randomUUID();
  const result = await client.set(key, token, {
    NX: true,
    EX: ttlSeconds,
  });

  if (result !== 'OK') {
    return null;
  }

  return { key, token };
}

export async function releaseDistributedLock(handle: LockHandle): Promise<boolean> {
  const client = await getRedisClient();
  const releaseScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const deleted = await client.eval(releaseScript, {
    keys: [handle.key],
    arguments: [handle.token],
  });

  return Number(deleted) === 1;
}
