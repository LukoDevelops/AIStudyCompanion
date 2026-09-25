# Testing guide

Run the following from the repository root:

```bash
npm ci
npm test
npm run samples
npm run build
npm run benchmark
```

The tests cover parsing, retrieval, evidence links, quiz and flashcard state, storage, export, workers and failure recovery. File tests import the shipped PDF, DOCX and subtitle samples. The sample command checks manifest completeness and hashes. The benchmark compares Keyword Scout and Hybrid Focus over five small, seeded cases; its results are structural checks, not accuracy scores.

## Browser checks

Use a separate local origin when testing so you do not overwrite packs you want to keep. `npm run dev -- --port 5174` starts a separate development instance. Do not paste private documents or API keys into a test report.

1. Build a pack from **Try an example**, then visit all six study views.
2. In Sources, try every Source and Usage combination. Check the returned passages, not just the label. Search, change pages, then change a filter; pagination should reset. Repeat with the keyboard in both display modes.
3. Answer a question, inspect its source, finish a round, retry missed questions and start another set. Reveal and rate a flashcard. Reload and confirm saved progress is restored.
4. Open graph evidence, change chart options, and compare engines. These actions must not reset practice scores.
5. Import the small space/AI batch in `samples/README.md`. Confirm that each file is represented and that subtitle timing does not appear as study text. Treat duplicate-format transcripts as duplicate content.
6. Add one corrupt or empty file alongside a valid note. Check the warning and the surviving source. Test silence and oversized text separately.
7. Start a recording or image job, then stop it. Inputs and the previous pack should remain. Reset should cancel pending previews as well as generation.
8. Open JSON and Markdown previews, copy the content and download each file. Check the actual saved files in a regular browser, not only the preview text.
9. Inspect a narrow viewport and keyboard focus. Check both daylight and night modes, menus, dialogs, scrolling and reduced motion. Viewport emulation does not replace a physical-device or screen-reader test.

## Model checks

The first local run downloads model files. Record whether a result used Whisper, OCR, image description, embeddings or a pasted fallback. Keep the original recording/image beside its output and note recognition mistakes. A successful request is not evidence of accurate recognition.

Cloud testing needs an explicitly chosen free-tier project and its key. Check the missing-key path without sending a request first. Live provider errors and quotas can differ from mocked tests. Never store a key, raw provider response or private source content in the public log.

## Record results

Add the actual check date, environment, inputs, expected result, observed result and any limitation to `EVALUATION_LOG.md`. Keep a failed attempt and its successful retry distinct. If you did not record the date of a feedback conversation, say so; the date you wrote down the feedback is not necessarily the date the conversation happened.

Passing tests does not establish complete browser coverage, factual accuracy, security certification or improved learning. These require different evidence.
