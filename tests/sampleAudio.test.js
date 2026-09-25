import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseWav, pcmWav} from '../scripts/sample-audio.mjs';

describe('sample audio containers', () => {
  it('round-trips PCM data and format', () => {
    const data = Buffer.from([0, 1, 2, 3]);
    const result = parseWav(pcmWav(data, 22050, 2));
    expect(result.format).toEqual({sampleRate:22050, channels:2, bitsPerSample:16});
    expect(result.data).toEqual(data);
  });
  it.each([Buffer.alloc(0), Buffer.from('not audio'), Buffer.alloc(44)])('rejects non-WAV data %#', data => {
    expect(() => parseWav(data)).toThrow('Not a WAV file');
  });
  it('rejects a chunk that extends beyond the file', () => {
    const wav = pcmWav(Buffer.alloc(2));
    wav.writeUInt32LE(99,40);
    expect(() => parseWav(wav)).toThrow('Truncated WAV chunk');
  });
  it('rejects unsupported sample encoding', () => {
    const wav = pcmWav(Buffer.alloc(2));
    wav.writeUInt16LE(3,20);
    expect(() => parseWav(wav)).toThrow('Expected PCM audio');
  });
  it('ships three seconds of silent PCM', () => {
    const {format,data} = parseWav(readFileSync(new URL('../samples/edge-cases/silence.wav',import.meta.url)));
    expect(data.length / (format.sampleRate * format.channels * 2)).toBe(3);
    expect(data.every(value => value === 0)).toBe(true);
  });
  it('ships twenty minutes of repeated audio below the per-file byte limit', () => {
    const wav = readFileSync(new URL('../samples/edge-cases/apollo-repeated-20min.wav',import.meta.url));
    const {format,data} = parseWav(wav);
    expect(data.length / (format.sampleRate * format.channels * 2)).toBe(1200);
    expect(wav.length).toBeLessThan(100 * 1024 ** 2);
    expect(data.some(value => value !== 0)).toBe(true);
  });
});
