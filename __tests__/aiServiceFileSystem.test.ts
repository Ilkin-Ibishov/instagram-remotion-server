import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureParentDirectoryExists } from '../src/pipeline/aiService';

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0, createdDirs.length)) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('ensureParentDirectoryExists', () => {
  it('creates parent directories recursively for a file path', () => {
    const baseDir = path.join(os.tmpdir(), `ai-service-test-${Date.now()}-${Math.random()}`);
    const nestedFilePath = path.join(baseDir, 'nested', 'deeper', 'debug.txt');
    createdDirs.push(baseDir);

    ensureParentDirectoryExists(nestedFilePath);

    expect(fs.existsSync(path.dirname(nestedFilePath))).toBe(true);
  });
});
