export function parseWav(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a WAV file');
  let format, data;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > buffer.length) throw new Error('Truncated WAV chunk');
    if (kind === 'fmt ') {
      if (size < 16 || buffer.readUInt16LE(start) !== 1) throw new Error('Expected PCM audio');
      format = {channels:buffer.readUInt16LE(start + 2), sampleRate:buffer.readUInt32LE(start + 4), bitsPerSample:buffer.readUInt16LE(start + 14)};
    }
    if (kind === 'data') data = buffer.subarray(start, start + size);
    offset = start + size + size % 2;
  }
  if (!format || !data || format.bitsPerSample !== 16 || !format.channels || !format.sampleRate) throw new Error('Expected 16-bit PCM with format and data chunks');
  return {format, data};
}

export function pcmWav(data, sampleRate = 16000, channels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
