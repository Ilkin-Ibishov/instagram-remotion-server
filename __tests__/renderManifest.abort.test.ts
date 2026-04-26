import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@remotion/bundler', () => ({
  bundle: vi.fn().mockResolvedValue('https://example-bundle'),
}));

vi.mock('@remotion/renderer', () => ({
  selectComposition: vi.fn().mockResolvedValue({ durationInFrames: 10 }),
  renderStill: vi.fn().mockResolvedValue(undefined),
  renderMedia: vi.fn().mockResolvedValue(undefined),
}));

import { renderManifest, __testing as renderTesting } from '../src/render/renderService';

describe('renderManifest AbortSignal', () => {
  beforeEach(() => {
    renderTesting.resetBundleState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    renderTesting.resetBundleState();
  });

  it('does not start rendering when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort(new Error('lock lost'));

    const { selectComposition } = await import('@remotion/renderer');

    await expect(
      renderManifest(
        {
          globalBranding: { accentColor: '#fff', handle: '@x', effects: [] },
          format: 'png',
          carousel: [
            {
              templateId: 'HOOK_A',
              data: { headline: 'H', subheadline: 'S' },
            },
          ],
        },
        'batch-abort',
        ac.signal
      )
    ).rejects.toThrow('lock lost');

    expect(selectComposition).not.toHaveBeenCalled();
  });
});
