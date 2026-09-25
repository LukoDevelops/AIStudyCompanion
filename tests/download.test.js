// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { downloadBlob } from '../src/export/download.js';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('attaches the download anchor and delays object URL cleanup',()=>{
  vi.useFakeTimers();const revoke=vi.fn();vi.stubGlobal('URL',{createObjectURL:()=> 'blob:qa-file',revokeObjectURL:revoke});
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){expect(this.isConnected).toBe(true);expect(this.download).toBe('pack.json');});
  downloadBlob(new Blob(['{}']),'pack.json');expect(click).toHaveBeenCalledOnce();expect(document.querySelector('a')).toBeNull();expect(revoke).not.toHaveBeenCalled();vi.advanceTimersByTime(30000);expect(revoke).toHaveBeenCalledWith('blob:qa-file');
});
