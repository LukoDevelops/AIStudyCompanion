import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const wav=readFileSync(new URL('../samples/audio/apollo-landing-extended.wav',import.meta.url));
const output=Buffer.alloc(64*1024**2);
wav.copy(output);
output.write('JUNK',wav.length);
output.writeUInt32LE(output.length-wav.length-8,wav.length+4);
output.writeUInt32LE(output.length-8,4);
const dir=mkdtempSync(join(tmpdir(),'study-audio-qa-'));
const path=join(dir,'large-container.wav');
writeFileSync(path,output);
console.log(path);
let dataOffset, dataLength, byteRate;
for(let offset=12; offset+8<=wav.length;) {
  const size=wav.readUInt32LE(offset+4), kind=wav.toString('ascii',offset,offset+4);
  if(kind==='fmt ') byteRate=wav.readUInt32LE(offset+16);
  if(kind==='data') {dataOffset=offset+8; dataLength=size; break;}
  offset+=8+size+(size%2);
}
if(!byteRate || !dataOffset) throw new Error('Expected a PCM WAV fixture');
const longData=Buffer.alloc(byteRate*360);
const speech=wav.subarray(dataOffset,dataOffset+dataLength);
for(let offset=0;offset<longData.length;offset+=speech.length) speech.copy(longData,offset);
const longWav=Buffer.concat([wav.subarray(0,dataOffset),longData]);
longWav.writeUInt32LE(longWav.length-8,4);
longWav.writeUInt32LE(longData.length,dataOffset-4);
const longPath=join(dir,'six-minute-speech.wav');
writeFileSync(longPath,longWav);
console.log(longPath);
