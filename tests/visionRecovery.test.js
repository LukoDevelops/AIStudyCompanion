import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => ({ createWorker: vi.fn(), recognize: vi.fn() }));

import { createWorker, recognize } from 'tesseract.js';
import { collectImageSources } from '../src/adapters/imageAdapter.js';
import { describeImage, readImageText } from '../src/adapters/visionAdapter.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('live image adapter recovery', () => {
  it('rejects undecodable images before starting OCR and keeps a pasted description', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Invalid image')));
    const sources = await collectImageSources({
      description: 'The rover has six wheels.',
      files: [new File(['broken'], 'corrupt-image.png', { type: 'image/png' })],
    });
    expect(sources[0].text).toBe('The rover has six wheels.');
    expect(sources[1].warning).toMatch(/corrupt-image\.png.*could not be decoded/);
    expect(createWorker).not.toHaveBeenCalled();
  });

  it('handles rejected OCR requests without an extra uncaught worker error', async () => {
    const terminate = vi.fn();
    createWorker.mockResolvedValue({ recognize: vi.fn().mockRejectedValue(new Error('Bad image')), terminate });
    recognize.mockRejectedValue(new Error('Bad image'));
    await expect(readImageText({ name: 'broken.png' })).rejects.toThrow('Bad image');
    expect(terminate).toHaveBeenCalledOnce();
    const options = createWorker.mock.calls[0][2];
    expect(() => options.errorHandler('Bad image')).not.toThrow();
    expect(recognize).toHaveBeenCalledWith({ name: 'broken.png' }, 'eng', options);
  });

  it('closes the validation bitmap and keeps OCR failures as readable warnings', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close }));
    createWorker.mockRejectedValue('OCR unavailable');
    recognize.mockRejectedValue('OCR unavailable');
    const result = await describeImage({ name: 'diagram.png' }, { useLocalCaption: false });
    expect(close).toHaveBeenCalledOnce();
    expect(result.text).toBe('');
    expect(result.warnings).toEqual(['We could not read text from diagram.png with OCR (OCR unavailable).']);
  });
});
