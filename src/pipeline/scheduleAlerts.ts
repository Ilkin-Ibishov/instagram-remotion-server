import type { ScheduleState } from './scheduleState';
import { recordAlertSent } from './scheduleState';
import Logger from '../utils/logger';

const log = new Logger('pipeline-alert');

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (60 * 60 * 1000);
}

function looksLikeSessionFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('session file') ||
    m.includes('session validation') ||
    m.includes('re-authentication') ||
    m.includes('instagram session') ||
    (m.includes('session') && m.includes('expir'))
  );
}

export type PipelineAlertPayload = {
  type: 'pipeline_alert';
  accountId: string;
  reason: 'session_preflight' | 'consecutive_failures' | 'stale_success_then_failure';
  consecutiveFailureCount: number;
  lastErrorMessage: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  nextRunAt: string;
};

/**
 * POST a minimal JSON alert when the scheduler records a failure and thresholds match.
 * Uses PIPELINE_ALERT_WEBHOOK_URL; optional PIPELINE_ALERT_WEBHOOK_SECRET as Bearer token.
 * Deduplicated with PIPELINE_ALERT_COOLDOWN_HOURS vs schedule_state.last_alert_sent_at.
 */
export async function maybeSendPipelineFailureAlert(
  accountId: string,
  stateAfterFailure: ScheduleState,
  now: Date = new Date()
): Promise<void> {
  const url = (process.env.PIPELINE_ALERT_WEBHOOK_URL || '').trim();
  if (!url) {
    return;
  }

  const consecutiveThreshold = parsePositiveInt(process.env.PIPELINE_ALERT_CONSECUTIVE_FAILURES, 3);
  const maxHoursWithoutSuccess = parsePositiveInt(process.env.PIPELINE_ALERT_MAX_HOURS_WITHOUT_SUCCESS, 48);
  const cooldownHours = parsePositiveInt(process.env.PIPELINE_ALERT_COOLDOWN_HOURS, 6);

  const errMsg = stateAfterFailure.lastErrorMessage || '';
  const sessionHit = looksLikeSessionFailure(errMsg);
  const count = stateAfterFailure.consecutiveFailureCount;
  const staleSuccess =
    stateAfterFailure.lastSuccessAt != null &&
    hoursBetween(stateAfterFailure.lastSuccessAt, now) >= maxHoursWithoutSuccess;

  let reason: PipelineAlertPayload['reason'] | null = null;
  if (sessionHit) {
    reason = 'session_preflight';
  } else if (count >= consecutiveThreshold) {
    reason = 'consecutive_failures';
  } else if (staleSuccess && count >= 1) {
    reason = 'stale_success_then_failure';
  }

  if (!reason) {
    return;
  }

  if (stateAfterFailure.lastAlertSentAt) {
    const sinceAlertH = hoursBetween(stateAfterFailure.lastAlertSentAt, now);
    if (sinceAlertH < cooldownHours) {
      log.debug('pipeline-alert', 'Skipping alert due to cooldown', {
        accountId,
        sinceAlertHours: Math.round(sinceAlertH * 100) / 100,
        cooldownHours,
      });
      return;
    }
  }

  const payload: PipelineAlertPayload = {
    type: 'pipeline_alert',
    accountId,
    reason,
    consecutiveFailureCount: count,
    lastErrorMessage: stateAfterFailure.lastErrorMessage,
    lastSuccessAt: stateAfterFailure.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: stateAfterFailure.lastErrorAt?.toISOString() ?? null,
    nextRunAt: stateAfterFailure.nextRunAt.toISOString(),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'instagram-remotion-server/pipeline-alert',
  };
  const secret = (process.env.PIPELINE_ALERT_WEBHOOK_SECRET || '').trim();
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const snippet = (await res.text()).slice(0, 200);
      log.warn('pipeline-alert', 'Webhook returned non-OK', {
        accountId,
        status: res.status,
        bodySnippet: snippet,
      });
      return;
    }
    await recordAlertSent(accountId, now);
    log.info('pipeline-alert', 'Alert webhook delivered', { accountId, reason });
  } catch (err) {
    log.warn('pipeline-alert', 'Webhook request failed', {
      accountId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
