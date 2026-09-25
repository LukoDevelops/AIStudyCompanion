import { describe, it, expect } from 'vitest';
import { stripSubtitleMarkup, transcribeAudioFile } from '../src/adapters/audioAdapter.js';

describe('subtitle metadata boundaries', () => {
  it('rejects silent PCM before loading a speech model', async () => {
    await expect(transcribeAudioFile({name:'silence.wav',pcm:new Float32Array(16000)})).rejects.toThrow(/silent/);
  });
  it('removes metadata, named cues and settings while retaining speech', () => {
    expect(stripSubtitleMarkup('WEBVTT\nKind: captions\n\nNOTE author-only note\nignore this\n\nSTYLE\n::cue { color: red; }\n\nintro\n00:00:00.000 --> 00:00:05.000 align:start\n<v Speaker>Water &amp; energy matter.</v>\n\nREGION\nid:top'))
      .toBe('Water & energy matter.');
  });
  it('keeps numeric content in ordinary transcripts', () => {
    expect(stripSubtitleMarkup('The year was\n2026\nand the budget was 40.')).toContain('2026');
  });
  it('reads CRLF SRT and preserves numeric speech', () => {
    expect(stripSubtitleMarkup('1\r\n00:00:01,000 --> 00:00:03,000\r\n2026\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\nA new year.')).toBe('2026\nA new year.');
  });
});
