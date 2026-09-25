import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { groupItemsIntoLines } from "../src/adapters/pdfAdapter.js";
import { normaliseDocument } from "../src/pipeline/document.js";
import { preprocessSources } from "../src/pipeline/preprocess.js";
import { parseWav } from "../scripts/sample-audio.mjs";

const samples = resolve(dirname(fileURLToPath(import.meta.url)), "..", "samples");
const pdfPath = join(samples, "text", "nasa-ai-exploration.pdf");
const docxPath = join(samples, "text", "nasa-ai-abstract.docx");
const wavPath = join(samples, "audio", "apollo-landing-extended.wav");


async function pdfPages() {
  // No workerSrc is set, so pdfjs falls back to its in-process fake worker.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(readFileSync(pdfPath)),
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const document = await task.promise;
  const pages = [];

  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push(groupItemsIntoLines(content.items));
  }

  await task.destroy();
  return pages;
}

describe("space and AI sample files", () => {
  it("produces a multi-page PDF whose text can be extracted", async () => {
    const pages = await pdfPages();

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].join(" ").normalize('NFKC')).toContain("Powering Human Exploration");
    expect(pages[0].join(" ")).toContain("NASA Ames Research Center");
  });

  it("preserves the research paper's content during cleanup", async () => {
    const { blocks } = normaliseDocument({ pages: await pdfPages() });
    const text = blocks.map((block) => block.text).join(" ");

    expect(text).toContain("Gateway");
    expect(text).toContain("Autonomy");
    expect(text).not.toContain('\ufffd');
  });

  it('keeps the two-column NASA introduction in reading order', async () => {
    const pages = await pdfPages();
    const text = normaliseDocument({pages}).text;
    expect(text).toContain('including the first woman and the next man');
    expect(text).toContain('NASA is committed to landing American astronauts');
    expect(text).not.toContain('astronauts, inperformed');
  });

  it("turns the extracted PDF into sectioned sentence records", async () => {
    const document = normaliseDocument({ pages: await pdfPages() });
    const corpus = preprocessSources([
      {
        label: "nasa-ai-exploration.pdf",
        text: document.text,
        origin: "pdf",
        adapter: "text",
        blocks: document.blocks,
      },
    ]);

    expect(corpus.sentenceRecords.length).toBeGreaterThan(10);
    expect(corpus.sections.length).toBeGreaterThanOrEqual(2);
    expect(corpus.sentenceRecords.some((record) => record.heading)).toBe(true);
    expect(
      corpus.sentenceRecords.every((record) => !/^Page \d+ of \d+$/.test(record.sentence))
    ).toBe(true);
  });

  it("produces a Word file that mammoth can read", async () => {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToMarkdown({
      buffer: readFileSync(docxPath),
    });

    expect(result.value).toContain("Powering Human Exploration");
    expect(result.value).toMatch(/^#+ /m);
    expect(result.value).toContain("Crew Autonomy");
  });

  it("produces spoken audio in a readable wav container", () => {
    const { format, data } = parseWav(readFileSync(wavPath));

    expect(format.bitsPerSample).toBe(16);
    expect(format.sampleRate).toBeGreaterThanOrEqual(8000);
    expect(data.length).toBeGreaterThan(16000);
  });
});
