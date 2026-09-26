# Sample files

I picked these examples because I enjoy space and AI. There are NASA research papers, mission recordings, podcast audio and images to try in the app. Start with one or two files, then mix formats if you like. The `edge-cases` folder is for testing errors and limits, not for a normal study pack.

## Where to put each file

- `text`: research papers, abstracts and transcripts in one place. Use the Text notes input for PDF, DOCX, MD and TXT. Use the Audio transcript input for VTT and SRT captions, or TXT transcripts.
- `audio`: NASA-distributed MP3 recordings and a converted WAV copy of the extended Apollo excerpt. The filenames distinguish the original download from the converted copy.
- `images`: a labelled Perseverance instrument diagram, a Landsat/machine-learning illustration, and the real Sun looking like a Halloween pumpkin.
- `edge-cases`: empty, corrupt, silent, oversized or repeated material for checking recovery and limits.

## Good first combinations

1. **AI in space:** `text/nasa-ai-abstract.md`, `text/landsat-machine-learning.vtt` and `images/landsat-machine-learning.png`. This mixes short research text, a substantial transcript and an image without downloading speech models.
2. **Read the research:** `text/nasa-ai-exploration.pdf` on its own. This is Jeremy D. Frank's eight-page 2019 paper about AI for human exploration of the Moon and Mars. Its plans and dates describe the paper's historical context, not today's mission schedule.
3. **Listen to NASA:** `audio/nasa-ai-podcast.mp3`, an interview with Brian Thomas from *Small Steps, Giant Leaps*, episode 6. Compare the output with the transcript on the linked episode page.
4. **Archival radio:** try `audio/apollo-landing-extended-nasa.mp3` or `audio/apollo-landing-extended-16khz-mono.wav`. Expect static and difficult names. The MP3 is NASA's download; the WAV is a converted copy of that same recording. Import both only if you want to check how the app handles duplicates.
5. **Images:** the Perseverance diagram has useful labels for OCR. The pumpkin Sun is a real ultraviolet composite, not a scientific claim that the Sun has a face. Check whether a model mistakes that visual pattern for a literal object.

The Kennedy file is a short excerpt, not the complete Rice University speech. The Apollo landing-site captions include an opening radio line and a music cue; the longer Landsat captions are more useful for an ordinary study pack. TXT, VTT and SRT versions of the same transcript are alternatives, not independent evidence.

## Edge cases

- `empty.txt`: expect a warning that there is no readable content.
- `corrupt-pdf.pdf`, `corrupt-word.docx`, `corrupt-audio.wav`, `corrupt-image.png`: files that deliberately have the wrong contents for their extensions. Add one alongside a valid note and check that the warning names it.
- `silence.wav`: three seconds of silence. Do not accept invented speech as evidence.
- `oversized-text.txt`: over 600,000 characters of repeated telemetry wording. Importing the file may collapse the repetition into a short passage; pasting its full contents tests the pasted-text size limit.
- `negation-and-unicode.txt`: invented sensor values for checking symbols, numbers and negative statements. This is explicitly not NASA mission data.
- `apollo-repeated-20min.wav`: a real Apollo excerpt repeated to 20 minutes, about 36.6 MiB. Use it separately for duration, memory and cancellation checks. It is not a continuous recording or a recognition-quality benchmark. Combining it with other recordings may exceed the 30-minute total limit.

For an optional 64 MiB padded WAV and a six-minute repeated-audio file, run `node scripts/make-large-audio-qa.mjs`. It prints a temporary folder. The padded file tests container size, not speech duration.

## Sources and reuse

Original source URLs, credits, byte sizes and SHA-256 checksums are recorded per file in `manifest.json`. The download catalog is `scripts/sample-sources.json`.

- [NASA research paper and abstract](https://ntrs.nasa.gov/citations/20190032627): NASA NTRS marks this record `GOV_PUBLIC_USE_PERMITTED`. The PDF is the original paper; TXT is NASA's text extraction. The Markdown and Word files reformat its abstract and repair line-break hyphenation. They are not separate research papers or original publisher Word files.
- [NASA AI podcast](https://www.nasa.gov/podcasts/small-steps-giant-leaps/small-steps-giant-leaps-episode-6-artificial-intelligence/): NASA APPEL Knowledge Services, 19 March 2019.
- [Historical audio](https://www.nasa.gov/historical-sounds/): Apollo recordings and the Kennedy excerpt. The WAV is a 16 kHz mono conversion, not new speech.
- [Landsat and machine learning](https://svs.gsfc.nasa.gov/14336/): NASA Scientific Visualization Studio, 2023. Original captions and title image.
- [Apollo landing-site captions](https://svs.gsfc.nasa.gov/4185/): NASA Goddard Scientific Visualization Studio, 2014.
- [Perseverance instrument diagram](https://science.nasa.gov/resource/science-instruments-on-nasas-perseverance-mars-rover/): NASA/JPL-Caltech.
- [Pumpkin Sun](https://svs.gsfc.nasa.gov/11711/): NASA/GSFC/SDO, observations from 8 October 2014.

Material is included for educational use under [NASA's media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA has not reviewed or endorsed this app. Generated summaries, transcriptions and image descriptions are outputs of AI Study Companion, not NASA publications; NASA is not responsible for their accuracy. Retain source credits and any third-party notices, and check the guidelines before reusing material in other contexts.

## Verify or rebuild

The files are ready to use after cloning. `npm run samples` verifies their checksums without network access. Text checksums use LF line endings so Windows checkouts work too.

To restore missing downloads and rebuild format conversions, install Python with `python-docx` and FFmpeg, then run `npm run samples:refresh`. Set `SAMPLE_PYTHON` and `SAMPLE_FFMPEG` to their executable paths when they are not on PATH. Existing downloads are preserved; named converted files and edge cases are rebuilt. The script never erases user additions.

After an intentional library edit, `node scripts/sample-library.mjs --manifest` updates the manifest. Review those changes before committing them. A checksum verifies the file's identity, not the accuracy of its contents or a model's interpretation.
