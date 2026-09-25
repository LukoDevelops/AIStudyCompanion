import { expect, it, vi } from 'vitest';
import { extractPdfPages } from '../src/adapters/pdfAdapter.js';
const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ getDocument, GlobalWorkerOptions: {} }));
vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'worker-url' }));
it('destroys the loading task even when a malformed PDF fails to open', async () => {
  const destroy = vi.fn().mockResolvedValue();
  getDocument.mockReturnValue({ promise: Promise.reject(new Error('Invalid PDF')), destroy });
  await expect(extractPdfPages({ arrayBuffer: async () => new ArrayBuffer(8) })).rejects.toThrow('Invalid PDF');
  expect(destroy).toHaveBeenCalledOnce();
});
