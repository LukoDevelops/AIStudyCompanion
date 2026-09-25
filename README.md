# AI Study Companion

Turn notes, recordings and images into a revision pack you can check against its sources. Read a summary, practice with questions and flashcards, explore connected ideas, and open the passage behind an answer.

[Open the app](https://lukodevelops.github.io/AIStudyCompanion/) · [How the study workspace works](docs/STUDY_WORKSPACE.md)

[![CI](https://github.com/LukoDevelops/AIStudyCompanion/actions/workflows/ci.yml/badge.svg)](https://github.com/LukoDevelops/AIStudyCompanion/actions/workflows/ci.yml)

## Getting started

Choose **Try an example** for a quick look, or add your own material and select **Build my revision pack**. The study desk has six views: Overview, Read, Practice, Explore, Sources and Edit inputs.

- Import TXT, Markdown, PDF and Word documents, or paste notes.
- Upload recordings for local speech recognition, or add TXT, VTT and SRT transcripts.
- Add images for OCR and image description, or paste a description yourself.
- Follow source links, search retained passages and filter by source or citation status.
- Answer questions, retry missed ones, reveal flashcards and revisit weaker topics.
- Save packs in this browser or export them as JSON and Markdown.

Start with a small batch from [the space and AI sample library](samples/README.md). Its source credits distinguish original NASA material, format conversions and deliberately invalid test files.

## Choose an engine

- **Keyword Scout** is a lightweight keyword-based baseline.
- **Hybrid Focus**, the default, combines BM25 and TF-IDF retrieval with extractive summaries.
- **Semantic Explorer** adds MiniLM embeddings for meaning-aware retrieval. It does not write new answers with a language model.
- **Study Reasoner** optionally uses Gemini to write summaries and comprehension questions. It requires your own Google AI Studio key and validates source identifiers and quoted evidence.

Local speech recognition uses Whisper base.en for English. Local image processing combines Tesseract OCR with Florence-2 and a smaller caption fallback. Models download on first use. The interface reports which processing steps completed and when pasted text was used instead.

Source links help you check an output; they do not guarantee it is correct. Speech recognition can mishear recordings, captions can add unsupported details, and questions can have weak or ambiguous distractors. Check important claims against the original material.

## Privacy and limits

The local engines process your material in the browser. Saved packs, practice progress and an optional API key use local browser storage. They are not encrypted by the app, so avoid shared devices for private material.

Cloud features send selected passages, images or question excerpts to Google. Free-tier data handling, eligibility and quotas are subject to the provider's terms. Do not send sensitive material. The app asks you to confirm that billing is disabled; it cannot verify your account settings and does not switch to a paid fallback.

Each run accepts up to 16 files and 256 MiB combined, with limits of 25 MiB per document, 10 MiB per image, 100 MiB per recording, 30 minutes of combined audio, 300 PDF pages and 600,000 extracted characters. A long PDF can reach the text limit before the page limit. Processing can be stopped without losing the inputs or the previous pack. Large model runs may still need smaller batches on slower devices.

## Run locally

Use Node.js 24 LTS, then run:

```bash
npm ci
npm run dev
```

Open the address printed by Vite. To test and build:

```bash
npm test
npm run samples
npm run build
npm run benchmark
```

`npm run samples` checks the shipped files against their manifest without downloading anything. Rebuilding the sample library is optional; see its README for dependencies and instructions.

The application uses vanilla JavaScript modules, cancellable workers and Shoelace web components. GitHub Actions runs tests, the production build and the offline benchmark; successful pushes to `main` publish the static app through GitHub Pages.

## Testing and implementation

[Testing guide](docs/TESTING.md) explains repeatable checks and their limits. [Evaluation log](docs/EVALUATION_LOG.md) records the observed results and known limitations. The offline benchmark measures structural integrity and selected lexical properties, not factual accuracy or learning outcomes.

Built as a University of London / Goldsmiths CM3070 project using the CM3020 template *Orchestrating AI models to achieve a goal*. Third-party libraries and pretrained models remain the work of their respective authors; dependency versions are recorded in `package-lock.json`.
