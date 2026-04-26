import crypto from 'crypto';
import { getRedisClient, isRedisUrlConfigured } from '../utils/redisClient';
import Logger from '../utils/logger';

export interface LockHandle {
  key: string;
  token: string;
}

/**
 * Acquire a distributed lock using Redis SET NX EX (single round-trip, atomic).
 * Requires REDIS_URL — callers should use `isRedisUrlConfigured()` and skip locking when Redis is absent.
 */
export async function acquireDistributedLock(key: string, ttlSeconds: number): Promise<LockHandle | null> {
  if (!isRedisUrlConfigured()) {
    throw new Error('acquireDistributedLock requires REDIS_URL');
  }
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

/**
 * Renew the TTL of an existing lock only if the token still matches.
 * Returns true if the renewal succeeded (lock still owned), false otherwise.
 */
export async function renewDistributedLock(handle: LockHandle, ttlSeconds: number): Promise<boolean> {
  const client = await getRedisClient();
  // Renew only when the token still belongs to this process
  const renewScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  const renewed = await client.eval(renewScript, {
    keys: [handle.key],
    arguments: [handle.token, String(ttlSeconds)],
  });

  return Number(renewed) === 1;
}

/**
 * Run an async operation while keeping the lock alive via a heartbeat.
 * The heartbeat fires at ttlSeconds/3 intervals to renew the lock TTL.
 * If the lock is lost mid-run (e.g. Redis restart), renewal fails: the `AbortSignal`
 * is aborted and, after `fn` settles, this helper throws if the lock was lost so the
 * caller does not treat the run as cleanly serialized.
 *
 * @param handle    The lock handle returned by acquireDistributedLock
 * @param ttlSeconds The original lock TTL (renewal interval = ttlSeconds/3)
 * @param fn        The long-running operation to protect
 */
export async function runWithLockHeartbeat<T>(
  handle: LockHandle,
  ttlSeconds: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const intervalMs = Math.max(1000, Math.floor((ttlSeconds / 3) * 1000));
  let lockLost = false;
  const logger = new Logger();
  const controller = new AbortController();

  let renewInFlight = false;
  const heartbeat = setInterval(() => {
    void (async () => {
      if (renewInFlight) {
        return;
      }
      renewInFlight = true;
      try {
        const renewed = await renewDistributedLock(handle, ttlSeconds);
        if (!renewed) {
          lockLost = true;
          controller.abort(new Error(`Distributed lock lost for key ${handle.key}`));
          clearInterval(heartbeat);
        }
      } catch (error) {
        lockLost = true;
        controller.abort(new Error(`Distributed lock heartbeat failed for key ${handle.key}`));
        logger.error('scheduler-lock', 'Heartbeat renewal failed — lock may have expired', {
          lockKey: handle.key,
          error: error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
        });
        clearInterval(heartbeat);
      } finally {
        renewInFlight = false;
      }
    })();
  }, intervalMs);

  try {
    const result = await fn(controller.signal);
    if (lockLost) {
      throw new Error(`Lock ${handle.key} was lost during execution — another process may have taken over.`);
    }
    return result;
  } finally {
    clearInterval(heartbeat);
  }
}
