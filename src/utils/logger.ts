/**
 * Logger Utility - Centralized logging for the pipeline
 * Logs to console and optionally to file
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || './logs';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  step: string;
  message: string;
  data?: any;
}

const SENSITIVE_KEYS = new Set([
  'sessionid',
  'csrftoken',
  'cookie',
  'authorization',
  'apikey',
  'api_key',
  'token',
  'secret',
  'password',
  'passwd',
  'credential',
  'key',
  'access_token',
  'refresh_token',
]);

const SENSITIVE_QUERY_KEYS = new Set([
  'apikey',
  'api_key',
  'key',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'password',
  'auth',
  'authorization',
]);

const SECRET_TEXT_PATTERNS = [
  /((?:apikey|api_key|access_token|refresh_token|token|secret|password|authorization)=)([^&\s]+)/gi,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
];

export function redactSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, depth + 1));
  }

  if (typeof value !== 'object') {
    return value;
  }

  const input = value as Record<string, unknown>;
  const entries = Object.entries(input).map(([key, nestedValue]) => {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(normalizedKey)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactSensitiveFields(nestedValue, depth + 1)];
  });

  return Object.fromEntries(entries);
}

export function redactSensitiveText(value: string): string {
  return SECRET_TEXT_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, (_match, prefix) => `${prefix}[REDACTED]`),
    value
  );
}

export function sanitizeUrlForLogging(value: string): string {
  try {
    const parsed = new URL(value);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return redactSensitiveText(value);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function shouldUseJsonConsole(): boolean {
  return process.env.LOG_FORMAT === 'json'
    || process.env.NODE_ENV === 'production'
    || Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);
}

export class Logger {
  private runId: string;
  private logFile: string;
  private context: Record<string, unknown>;

  constructor(runId?: string, context: Record<string, unknown> = {}) {
    this.runId = runId || `run-${Date.now()}`;
    this.logFile = path.join(LOG_DIR, `${this.runId}.log.json`);
    this.context = context;
  }

  private write(entry: LogEntry) {
    const timestamp = new Date().toISOString();
    const redactedMessage = redactSensitiveText(entry.message);
    const logMessage = `[${timestamp}] [${entry.level}] [${this.runId}] [${entry.step}] ${redactedMessage}`;
    const redactedData = entry.data !== undefined ? redactSensitiveFields(entry.data) : undefined;
    const logEntry = {
      ...entry,
      message: redactedMessage,
      data: redactedData,
      timestamp,
      runId: this.runId,
      ...this.context,
    };

    // Console output
    if (shouldUseJsonConsole()) {
      console.log(JSON.stringify(logEntry));
    } else {
      const color =
        entry.level === 'ERROR' ? '\x1b[31m' :
        entry.level === 'WARN' ? '\x1b[33m' :
        entry.level === 'DEBUG' ? '\x1b[36m' :
        '\x1b[32m';

      console.log(`${color}${logMessage}\x1b[0m`);

      if (redactedData !== undefined) {
        console.log(`${color}[data] ${safeStringify(redactedData)}\x1b[0m`);
      }
    }

    // File output (JSON lines format)
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  info(step: string, message: string, data?: any) {
    this.write({ timestamp: '', level: 'INFO', step, message, data });
  }

  debug(step: string, message: string, data?: any) {
    if (process.env.DEBUG) {
      this.write({ timestamp: '', level: 'DEBUG', step, message, data });
    }
  }

  warn(step: string, message: string, data?: any) {
    this.write({ timestamp: '', level: 'WARN', step, message, data });
  }

  error(step: string, message: string, error?: any) {
    this.write({
      timestamp: '',
      level: 'ERROR',
      step,
      message,
      data: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    });
  }

  getLogPath(): string {
    return this.logFile;
  }

  getRun (): string {
    return this.runId;
  }
}

export default Logger;
