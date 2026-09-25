import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pcmWav, parseWav} from './sample-audio.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'samples');
const catalog = JSON.parse(readFileSync(new URL('./sample-sources.json', import.meta.url), 'utf8'));
const bytes = name => {
  const data = readFileSync(join(dest, name));
  return /\.(txt|md|vtt|srt|json)$/i.test(name) ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n')) : data;
};
const hash = data => createHash('sha256').update(data).digest('hex');
const put = (name, data) => {const path = join(dest, name); mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, data);};

async function download(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > 50 * 1024 ** 2) throw new Error(`Unexpected download size: ${url}`);
  return data;
}

if (process.argv.includes('--refresh')) {
  for (const entry of catalog) {
    if (!existsSync(join(dest, entry.file))) put(entry.file, await download(entry.url));
    console.log('Ready:', entry.file);
  }
  const metadataPath = join(root, 'tmp', 'nasa-ai-metadata.json');
  mkdirSync(dirname(metadataPath), {recursive:true});
  writeFileSync(metadataPath, await download('https://ntrs.nasa.gov/api/citations/20190032627'));
  execFileSync(process.env.SAMPLE_PYTHON || 'python', [join(root, 'scripts', 'sample-documents.py'), metadataPath], {stdio:'inherit'});
  execFileSync(process.env.SAMPLE_FFMPEG || 'ffmpeg', ['-hide_banner','-loglevel','error','-y','-i',join(dest,'audio/apollo-landing-extended.mp3'),'-ar','16000','-ac','1','-c:a','pcm_s16le',join(dest,'audio/apollo-landing-extended.wav')], {stdio:'inherit'});
  for (const name of ['apollo-landing-site','landsat-machine-learning']) {
    const captions = readFileSync(join(dest,`text/${name}.vtt`),'utf8');
    const transcript = captions.split(/\r?\n/).filter(line => line.trim() && !/^(WEBVTT|\d+$|\d\d:.*-->)/.test(line)).join(' ').replace(/<[^>]+>/g, '');
    put(`text/${name}.txt`, transcript + '\n');
  }
  put('edge-cases/empty.txt', '');
  for (const ext of ['pdf','docx','wav','png']) put(`edge-cases/corrupt.${ext}`, `Damaged mission file: intentionally not a valid ${ext.toUpperCase()} container.\n`);
  put('edge-cases/oversized-text.txt', 'Repeated space mission telemetry for a size-limit check, not scientific observations.\n'.repeat(8000));
  put('edge-cases/negation-and-unicode.txt', 'Space mission QA exercise — invented values, not NASA mission data.\nThe sensor reads 18 °C, not 28 °C. An alert does not prove a spacecraft fault. The signal increased from 40% to 60%, a change of 20 percentage points. The spacecraft did not detect water.\n');
  put('edge-cases/silence.wav', pcmWav(Buffer.alloc(16000 * 2 * 3)));
  const {format, data} = parseWav(bytes('audio/apollo-landing-extended.wav'));
  const repeated = Buffer.alloc(format.sampleRate * format.channels * 2 * 1200);
  for (let offset = 0; offset < repeated.length; offset += data.length) data.copy(repeated, offset);
  put('edge-cases/apollo-repeated-20min.wav', pcmWav(repeated, format.sampleRate, format.channels));
}

const derived = {
  'text/nasa-ai-abstract.md': {source:'https://ntrs.nasa.gov/citations/20190032627', credit:'NASA NTRS abstract, with line-break hyphenation repaired; formatted as Markdown. Not a new research paper.'},
  'text/nasa-ai-abstract.docx': {source:'https://ntrs.nasa.gov/citations/20190032627', credit:'NASA NTRS abstract, reformatted as Word. Not an original publisher DOCX.'},
  'text/apollo-landing-site.txt': {source:'https://svs.gsfc.nasa.gov/4185/', credit:'NASA SVS captions with timing and cue markup removed.'},
  'text/landsat-machine-learning.txt': {source:'https://svs.gsfc.nasa.gov/14336/', credit:'NASA SVS captions with timing and cue markup removed.'},
  'audio/apollo-landing-extended.wav': {source:'https://www.nasa.gov/historical-sounds/', credit:'NASA Apollo 11 audio decoded to 16 kHz mono PCM WAV; same recording as the MP3.'},
  'edge-cases/apollo-repeated-20min.wav': {source:'https://www.nasa.gov/historical-sounds/', credit:'NASA Apollo 11 excerpt repeated to 20 minutes. Artificial stress input, not a continuous mission recording.'},
};
const walk = (dir, prefix = '') => readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(join(dir,entry.name),prefix+entry.name+'/') : [prefix+entry.name]);
if (process.argv.includes('--refresh') || process.argv.includes('--manifest')) {
  const entries = walk(dest).filter(name => name !== 'manifest.json').sort().map(file => {
    const data = bytes(file);
    return {file, bytes:data.length, sha256:hash(data), ...(catalog.find(item => item.file === file) || derived[file] || {kind:file.startsWith('edge-cases/') ? 'Deliberate QA input; not source research' : 'Library guide'})};
  });
  put('manifest.json', JSON.stringify(entries,null,2)+'\n');
}
const entries = JSON.parse(readFileSync(join(dest,'manifest.json'),'utf8'));
for (const entry of entries) {
  const data = bytes(entry.file);
  if (data.length !== entry.bytes || hash(data) !== entry.sha256) throw new Error(`Sample differs from manifest: ${entry.file}`);
  const limit = entry.file.startsWith('images/') ? 10 : entry.file.startsWith('audio/') ? 100 : 25;
  if (!entry.file.startsWith('edge-cases/') && data.length > limit * 1024 ** 2) throw new Error(`Sample exceeds its input limit: ${entry.file}`);
}
const actual = walk(dest).filter(name => name !== 'manifest.json').sort();
if (JSON.stringify(actual) !== JSON.stringify(entries.map(entry => entry.file).sort())) throw new Error('Manifest does not cover the complete library');
console.log(`Verified ${entries.length} sample-library files. No downloads or model inference are needed for this check.`);
