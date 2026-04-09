export interface RetryPolicyOptions {
  maxRetries?: number;
  retryDelayMs?: number | (() => number);
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

const defaultIsRetryable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('econnreset') ||
    normalized.includes('econnrefused') ||
    normalized.includes('etimedout') ||
    normalized.includes('timeout') ||
    normalized.includes('network') ||
    normalized.includes('chrome') ||
    normalized.includes('renderer')
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryPolicyOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 5000;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const canRetry = attempt < maxRetries && isRetryable(error);
      if (!canRetry) {
        throw error;
      }

      options.onRetry?.(attempt + 1, error);
      let delay = typeof retryDelayMs === 'function' ? retryDelayMs() : retryDelayMs;
      await wait(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry policy failed without explicit error');
}
