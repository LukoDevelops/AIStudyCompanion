// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { bindDropzone, hideAllDropzones } from '../src/ui/dropzone.js';
let zone, cleanup, onFiles;
const fire = (type, types=['Files'], files=[]) => {
  const event = new Event(type,{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{types,files,dropEffect:'none'}});
  zone.dispatchEvent(event);return event;
};
beforeEach(()=>{document.body.innerHTML='<div id="zone"><span>Drop here</span></div>';zone=document.querySelector('#zone');onFiles=vi.fn();cleanup=bindDropzone(zone,{onFiles});});
afterEach(()=>cleanup());
it('clears the overlay after a file drop',()=>{fire('dragenter');expect(zone.classList.contains('is-dropping')).toBe(true);const file=new File(['notes'],'notes.txt');fire('drop',['Files'],[file]);expect(onFiles).toHaveBeenCalledWith([file]);expect(zone.classList.contains('is-dropping')).toBe(false);});
it('does not interpret a text drag as a file upload',()=>{const event=fire('dragenter',['text/plain']);expect(event.defaultPrevented).toBe(false);expect(zone.classList.contains('is-dropping')).toBe(false);});
it('keeps the overlay while nested drag targets are active',()=>{fire('dragenter');fire('dragenter');fire('dragleave');expect(zone.classList.contains('is-dropping')).toBe(true);fire('dragleave');expect(zone.classList.contains('is-dropping')).toBe(false);});
it('can clear an overlay after a cancelled drag',()=>{fire('dragenter');hideAllDropzones();expect(zone.classList.contains('is-dropping')).toBe(false);fire('dragenter');fire('dragleave');expect(zone.classList.contains('is-dropping')).toBe(false);});
it('drops all incoming files in one call and prevents navigation',()=>{const files=[new File(['one'],'one.txt'),new File(['two'],'two.md')];const event=fire('drop',['Files'],files);expect(onFiles).toHaveBeenCalledOnce();expect(onFiles).toHaveBeenCalledWith(files);expect(event.defaultPrevented).toBe(true);});
it('removes listeners and overlay on cleanup',()=>{cleanup();fire('dragenter');expect(zone.querySelector('.drop-overlay')).toBeNull();expect(zone.classList.contains('is-dropping')).toBe(false);});
