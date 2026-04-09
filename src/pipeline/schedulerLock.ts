import crypto from 'crypto';
import { getRedisClient } from '../utils/redisClient';

export interface LockHandle {
  key: string;
  token: string;
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
 * The heartbeat fires at ttlSeconds/2 intervals to renew the lock TTL.
 * If the lock is lost mid-run (e.g. Redis restart), the operation is NOT
 * interrupted but a warning is logged so the caller can detect it.
 *
 * @param handle    The lock handle returned by acquireDistributedLock
 * @param ttlSeconds The original lock TTL (renewal interval = ttlSeconds/2)
 * @param fn        The long-running operation to protect
 */
export async function runWithLockHeartbeat<T>(
  handle: LockHandle,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const intervalMs = Math.max(1000, Math.floor((ttlSeconds / 2) * 1000));
  let lockLost = false;

  const heartbeat = setInterval(async () => {
    try {
      const renewed = await renewDistributedLock(handle, ttlSeconds);
      if (!renewed) {
        lockLost = true;
        // Do not throw — allow the operation to finish; caller decides the policy.
        clearInterval(heartbeat);
      }
    } catch {
      // Non-fatal: ignore transient Redis errors during renewal.
    }
  }, intervalMs);

  try {
    const result = await fn();
    if (lockLost) {
      throw new Error(`Lock ${handle.key} was lost during execution — another process may have taken over.`);
    }
    return result;
  } finally {
    clearInterval(heartbeat);
  }
}
