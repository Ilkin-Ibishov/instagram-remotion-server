/**
 * Platform Adapter Registry
 * 
 * Central registry for all platform adapters.
 */

import { InstagramAdapter } from './instagram';
import { TikTokAdapter } from './tiktok';
import { YouTubeAdapter } from './youtube';
import type { Platform, PlatformAdapter } from '../types';

const adapters = new Map<Platform, PlatformAdapter>([
  ['instagram', new InstagramAdapter()],
  ['tiktok', new TikTokAdapter()],
  ['youtube_shorts', new YouTubeAdapter()],
]);

export function getAdapter(platform: Platform): PlatformAdapter | null {
  return adapters.get(platform) ?? null;
}

export function listAdapters(): PlatformAdapter[] {
  return Array.from(adapters.values());
}
