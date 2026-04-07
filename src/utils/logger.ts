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

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export class Logger {
  private runId: string;
  private logFile: string;

  constructor(runId?: string) {
    this.runId = runId || `run-${Date.now()}`;
    this.logFile = path.join(LOG_DIR, `${this.runId}.log.json`);
  }

  private write(entry: LogEntry) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${entry.level}] [${entry.step}] ${entry.message}`;

    // Console output
    const color =
      entry.level === 'ERROR' ? '\x1b[31m' :
      entry.level === 'WARN' ? '\x1b[33m' :
      entry.level === 'DEBUG' ? '\x1b[36m' :
      '\x1b[32m';
    
    console.log(`${color}${logMessage}\x1b[0m`);
    
    if (entry.data !== undefined) {
      console.log(`${color}[data] ${safeStringify(entry.data)}\x1b[0m`);
    }

    // File output (JSON lines format)
    try {
      const logEntry = {
        ...entry,
        timestamp,
        runId: this.runId,
      };
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
