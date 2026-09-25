import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/visionAdapter.js', () => ({
  describeImage: vi.fn(),
  readImageText: vi.fn(),
}));

import { describeImage } from '../src/adapters/visionAdapter.js';
import { collectImageSources } from '../src/adapters/imageAdapter.js';

describe('image recovery', () => {
  it('keeps a malformed image as a warning source instead of aborting the batch', async () => {
    describeImage.mockRejectedValueOnce(new Error('invalid image header'));
    const sources = await collectImageSources({
      files: [new File(['not an image'], 'broken.png', { type: 'image/png' })],
      useLocalCaption: false,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].origin).toBe('image');
    expect(sources[0].text).toBe('');
    expect(sources[0].warning).toMatch(/broken\.png.*invalid image header/i);
  });
});
