# Evaluation log

I began AI Study Companion in May 2026 and kept developing and testing it through September. This log follows the project from its proposal and first browser prototype to the fuller study workspace and final checks. I have included the problems I found as well as the things that worked, because a passing test or a source link does not guarantee a useful answer.

## May 2026 - concept and initial prototype

- **18 May:** I began the proposal, project concept and previous-work research. I chose *Orchestrating AI models to achieve a goal* as the template and focused the idea on turning several kinds of study material into one revision workflow.
- **22 May:** I worked through the problem an independent learner faces when notes, spoken explanations and diagrams sit in different places. I wanted one route from those materials to summary points, concepts and questions, rather than a general-purpose chatbot.
- **25 May:** I considered how a revision item should lead back to the student's own material. Source grounding became part of the scope, while a claim that the tool improved learning would need stronger evidence than an early prototype could provide.
- **28 May:** I planned three input lanes: typed notes, an audio transcript and an image or diagram description. Supplied text could stand in for the latter two while I worked out the common processing flow.
- **29 May:** I reviewed the first feature set and how to evaluate it. Sentence-level labels, concept extraction and revision outputs gave me a small enough scope for a working prototype.

My preliminary report, dated 21 May, and the prototype write-up capture the early version of the idea. I was still working out how to make the outputs useful for revision without making the tool look more certain than it was.

## June 2026 - design and feature-prototype work

- **4 June:** I worked on the mixed-input study task and its design. The challenge was to connect several processing steps without hiding the material behind a revision item.
- **9 June:** I focused on collecting the three text-based lanes into one processing path. Transcript and image-description fields represented media content for now; live audio and image inference were separate later tasks.
- **12 June:** I worked on the local text baseline: clean the input, split it into sentences and score repeated terms or phrases. That gave the workflow something usable without requiring an external model.
- **18 June:** I worked through the outputs the pack should contain: summary points, key concepts, questions and next steps. I wanted the visible pipeline to make the route from source material to those outputs understandable.
- **25 June:** I connected the feature-prototype design to the fuller application plan. Recordings and diagrams would need adapter stages that turn them into reviewable text before they enter the common pipeline.
- **26 June:** I reviewed what the prototype's source labels and sentence numbers could actually show. They made basic source checks possible, but a working link alone could not prove that a generated statement was accurate or useful.
- **29 June:** I continued moving from the feature prototype toward fuller development and revisited the preliminary-report plan. I kept the text-first path as a fallback in case later media or model integration proved unreliable.

At this point, the transcript and image-description fields stood in for later model adapters. I could develop and check the core text workflow while live transcription, image processing and cloud generation were still ahead.

## July 2026 - strengthening the application plan

- **9 July:** I returned to the application after the June work period. I focused on extending the input-to-pack flow without losing the source labels that made outputs checkable.
- **14 July:** I worked through how to keep input collection, text preparation, pack generation and interface state as understandable responsibilities. Clearer code organization was important before adding more components.
- **15 July:** I kept the text baseline central. Cleaning, sentence records and concept selection gave pasted notes or transcripts a usable route even if heavier media adapters were unavailable.
- **22 July:** I considered what happens after generation. A learner should be able to read the summary or answer a question, then inspect the passage supporting that item.
- **23 July:** I looked at how source identity should survive the workflow. A source label and sentence number only help if they remain attached after normalization and make sense when the learner opens the evidence.
- **29 July:** I planned the next implementation and evaluation steps: basic workflow tests, stronger code organization and a path for adding realistic speech and image processing later.

My development-sprint plan focused on clearer code structure, basic tests and a stronger path from input to revision pack. I treated realistic speech and image processing as later stages, so the text workflow could remain usable on its own.

## August 2026 - prototype extension and draft report

- **4 August:** I worked on the broader browser workflow around the prototype. The route from providing material to generating a pack and inspecting its useful parts still needed to feel connected.
- **5 August:** I focused on collecting and normalizing text from different input lanes. Notes, supplied transcripts and supplied image descriptions could then enter one shared pack workflow.
- **6 August:** I looked at how the outputs could lead to action. Readable summaries and concepts mattered, but questions and next steps would make the pack useful for practice rather than only passive reading.
- **10 August:** I planned how media adapters and retrieval would fit around the text-first pipeline. Live speech and image processing still needed to be connected and tested.
- **11 August:** I worked on separating input, processing and presentation concerns. I wanted source checking to stay visible instead of hiding every intermediate step behind one generate button.
- **13 August:** I reviewed the application against its aims and the evidence needed in the draft report. I kept a clear distinction between a working browser prototype and the fuller system I still wanted to build.
- **18 August:** I continued report and application work around the draft milestone. The browser prototype still used supplied transcripts and image descriptions, so those were not yet proof of live media processing.
- **20 August:** I kept working on stronger input handling and clearer evidence inspection. Replacing the simulated media stages remained part of the next development period.
- **21 August:** I reviewed how pack content led back to source material. I wanted learners to check a passage behind an output rather than accept it only because the wording sounded fluent.
- **26 August:** I refined what the final application needed to demonstrate: workflow behavior, source traceability, failure handling and usability. A controlled learning-outcome study was beyond the evaluation I could complete.
- **27 August:** I set priorities for final integration: preserve the working text path, make model stages reviewable, and test awkward or failed inputs as well as successful ones.

My August draft describes a browser prototype, with supplied transcripts and image descriptions still standing in for live media processing. After the draft, I kept working toward the fuller application and a more demanding evaluation.

## September 2026 - integration and recorded QA

- **3 September:** I worked on bringing the fuller application flow together after the draft. The main integration question was how different input types could share the same revision-pack and source-inspection stages.
- **4 September:** I reviewed the boundaries between document input, text processing and the output views. I wanted a failed source to produce a warning without discarding other usable material.
- **8 September:** I focused on the source-linked study experience. Learners should be able to move from an output back to the corresponding material rather than trust an answer they cannot inspect.
- **9 September:** I continued implementation and review of input status, generated outputs and navigation. These parts needed to stay coherent as the application grew beyond the original form.
- **10 September:** I worked on interaction and failure-handling concerns. An import or model failure should leave a recoverable path and keep valid material from the same session.
- **11 September:** I continued final integration around the text-first local route, which remained the fallback against which heavier model and cloud paths could be compared.

I continued testing as I built the application. The later entries include fuller saved browser observations and test totals alongside the development work.

- **12 September (recorded QA):** The built-in sample completed with the local and baseline engines. Browser checks covered evidence links, quiz feedback, history, reset, empty-input warnings, multiple attachments, image previews, engine comparison and both concept views. Desktop and roughly 375-pixel layouts were inspected; automated cases covered PDF and Word parsing, subtitles, retrieval and pagination. Keyboard checks covered the inspected fields and evidence controls, not a full accessibility audit.

- **14 September (recorded QA):** Worker and generation checks passed 107 tests across 26 files; a later mixed-input and cloud pass reached 124 tests across 29 files. Production builds passed. Real Word and PDF imports completed. Whisper first failed to fetch its model, then transcribed an MP3 on retry. A local image completed OCR and description; cancelling an image run retained its attachment. Semantic Explorer ran with model-backed retrieval. A separate cloud run generated a pack and processed a diagram, while explanation polishing completed; an HTTP 503 overload was observed and a retry succeeded. A 64 MiB WAV with a `JUNK` chunk tested file-size handling, while a six-minute repeated-speech WAV completed in about 77 seconds with a PDF and image description. These were not natural-lecture benchmarks. An unattributed `MutationObserver` error appeared in the instrumented browser; the tested paths completed, but its origin remained unresolved.

- **17 September (recorded QA):** The study-workspace pass reached 160 tests across 34 files; a later mixed-file pass reached 181 across 38 files. Builds and all 30 offline benchmark runs passed. An eleven-file mixed batch produced eleven sources and 101 retained sentences without structural issues; a separate four-minute stereo WAV batch produced three sources and 69 sentences. The WAV repeated synthesized speech, so it tested decoding and duration rather than lecture accuracy. A 297-page NASA handbook exceeded the extracted-character limit and was skipped with a warning, while a novel reached the sentence-retention cap. Corrupt PDF and Word files, empty content and silent audio were checked alongside valid notes: usable material survived and warnings became explicit. Oversized text stopped safely; subtitle metadata, stale worker messages, duplicate outputs and practice-score updates received regression cases. The image model added questionable details to a cat photograph, and Whisper misheard a noisy Apollo phrase; valid source IDs did not make those outputs factually correct.

- **18 September (recorded QA):** Production-browser checks and 190 tests across 42 files passed, along with the build and 30 offline benchmark runs. The dependency audit found no known vulnerabilities at that time, which was not a security certification. An eight-file mixed batch retained eight sources and 80 sentences; a damaged-file batch kept the valid note and warned about four unusable inputs. Checks covered cancellation, saved-pack reload, practice feedback, source search, graph navigation, missing cloud keys and Semantic Explorer. Export previews and copying worked, image-preview focus returned on close, and the export dialog fitted a 390-by-844 viewport. The browser tool did not confirm downloaded-file completion, and the unattributed console error remained unresolved.

- **20 September (recorded QA):** Quiz checks found that a fixed random-number function put the correct answer in the same slot. Live generation switched to `Math.random`, practice-session starts reshuffled choices, and browser questions showed different correct-answer positions. The fix passed 195 tests across 43 files. Practice continuation then reached 206 tests across 44 files, exercising try again, missed-question retry, new questions, weaker-source follow-up, related ideas and new flashcards. New sets preferred uncited passages and reported exhaustion or reuse. Search, reset and a 390-by-844 layout check passed; cloud and raw-media inference were not rerun in this pass.

- **21 September (recorded QA):** Release and report-preparation checks passed 228 tests across 51 files, a production build and 30 offline benchmark runs. The synthetic benchmark cases had valid output links and no structural issues, but were not a held-out educational dataset. The Source and Usage menus had changed labels without filtering because their state keys did not match search state. That mapping was repaired and exact-record tests were added. All twelve filter combinations were checked on the built-in sample: eleven sentences, four cited and seven uncited. Source changes reset pagination; keyboard selection and returning to the view retained filters. Six study views, both themes, practice actions, charts, saved history, export previews and mixed-input failures were inspected. A fresh production-console check showed no application warning or error; it did not diagnose the earlier unattributed error or prove every browser error-free.

- **22 September (recorded QA):** The sample-library refresh passed 245 tests across 53 files, a production build and 30 offline benchmark runs. The dependency audit found no known runtime vulnerabilities; all 28 manifest files passed size and checksum checks. A NASA paper exposed a PDF reading-order bug that joined text across two columns. The adapter now detects repeated central gaps and reads clear columns separately; regression cases cover headings, prose, short table cells and missing widths. This is a heuristic, not general layout recognition. NASA's original rover diagram exceeded the 10 MiB image limit, so its smaller official web rendition was used. A production-preview run imported an eight-page NASA PDF, Word abstract, Landsat subtitles and rover diagram: four sources and 474 retained sentences had no structural issues. Adding an Apollo WAV completed local transcription with five sources and valid evidence links. Image descriptions still carried an accuracy warning. Source and Usage filters worked in both themes; the Landsat transcript had 71 sentences, five cited and 66 uncited, with uncited pagination working. No production-console warning appeared, although the earlier development-server history had Lit warnings. Separate audio formats decoded, but the full 20-minute podcast was not transcribed end to end. The large-audio script produced its padded and repeated-speech fixtures; Word parsing succeeded, but its visual layout was not checked in Word or LibreOffice. None of these checks was a controlled learning study.

## Informal feedback

I also drew on feedback from my mother, father, adult sibling and a software-developer friend. Their comments influenced file attachment, clearer controls, source checking, visual presentation and the cursor effect. I did not keep exact session dates, transcripts, questionnaire scores or learning-outcome measures, so I treat this as informal design feedback rather than a controlled user study.

## Limits of this evidence

Most of my browser checks used one Windows environment. I emulated narrow layouts rather than testing on physical phones. Live model runs checked that integrations could complete; many failure paths were tested with mocks. I did not run a controlled study of learning gains or compare speech and vision checkpoints on a matched dataset. A passing software test should be read in light of those limits.
