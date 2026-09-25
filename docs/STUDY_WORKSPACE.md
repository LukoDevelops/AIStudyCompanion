# Study workspace

## Scope

The workspace extends the existing source-grounded revision project. It does not replace the generation engines, add paid services, or claim measured improvements in learning. Load an existing pack or generate a new one to open the study desk.

## Views

- Overview: pack counts, integrity caveat and source-coverage collection. After a practice round, source cards can mark which inputs still need another look. Clicking a source opens a filtered evidence search.
- Read: existing summary, concepts, checks and source-linked evidence. The old inline quiz is hidden to avoid two conflicting practice scores.
- Practice: a question-at-a-time session with first-attempt scores for the current round, optional confidence ratings (Brier calibration), missed-question retry, and a **Try again** restart that reshuffles the same deck. After a finished round the desk can also build **New questions**, **Weaker sources**, or **Related ideas**. New sets prefer uncited sentences, select with unused-first MMR, rank distractors with BM25 over the evidence, and say so when leftover material is exhausted or reused. Keyboard: 1–4 answer, N next, E source. The original pack quiz is not rewritten; later sets are a session copy only.
- Flashcards within Practice: deduplicated concept prompts reveal the original linked source sentence. Self-ratings feed a simple in-session Leitner box (1–3), not a validated spaced-repetition study. **New flashcards** prefer previously uncited sentences and report when none remain. Review weaker cards jumps to box 1.
- Explore: existing graph, 3D map, provenance and engine-comparison views.
- Sources: BM25-ranked lexical search over retained sentences, source and citation-state filters, eight results per page, and navigation to the original evidence. Filters survive view changes. Search is not generative QA and is not a semantic search model.
- Edit inputs: returns to the existing controls, pipeline and saved history without discarding the pack.

## State and privacy

Practice attempts, flashcard ratings and the current desk view are stored locally per generated pack. Reloading the same pack restores the current question queue and flashcard state; generating or loading a different pack starts a separate progress record. Search filters remain in the current JavaScript session. Existing pack history remains in browser storage. No additional external requests or credentials are required by the workspace. Source content is escaped before rendering.

## Algorithm changes

Local generation can form reasoning questions from explicit `because` clauses when another distinct source-derived answer is available as a distractor. No causal inference is performed from graph edges. Definitions with vague subjects such as “the challenge” are excluded. The initial definition/reasoning candidate pool is interleaved across sources before selection. These are deterministic templates, not a new trained model, and distractor ambiguity still requires human review.

## Verification

DOM integration tests cover view changes, answer persistence, retry statistics, flashcard navigation, filters, reset and HTML escaping. See the [testing guide](TESTING.md) for repeatable browser checks and the [evaluation log](EVALUATION_LOG.md) for dated results and limitations.
