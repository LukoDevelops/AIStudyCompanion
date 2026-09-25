import { normaliseDocument } from "../pipeline/document.js";
import { normalise } from "../pipeline/text.js";
import { extractDocxText } from "./docxAdapter.js";
import { extractPdfPages } from "./pdfAdapter.js";

const PLAIN_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".log", ".rtf"];

export function classifyTextFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();

  if (name.endsWith(".pdf") || type === "application/pdf") {
    return "pdf";
  }

  if (name.endsWith(".docx") || type.includes("wordprocessingml")) {
    return "docx";
  }

  if (name.endsWith(".doc")) {
    return "legacy-doc";
  }

  if (PLAIN_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "plain";
  }

  return type.startsWith("text/") || !type ? "plain" : "unsupported";
}

async function readFileContent(file, onStatus) {
  const kind = classifyTextFile(file);
  onStatus(`Reading ${file.name}…`);

  if (kind === "pdf") {
    return { pages: await extractPdfPages(file, onStatus), origin: "pdf" };
  }

  if (kind === "docx") {
    return { text: await extractDocxText(file), origin: "docx" };
  }

  if (kind === "legacy-doc") {
    throw new Error(
      "Old .doc files are not supported. Save it as .docx or .pdf and try again."
    );
  }

  if (kind === "unsupported") {
    throw new Error(`${file.name} is not a text, PDF, or Word document.`);
  }

  const raw = await file.text();

  if (/^\s*%PDF-/.test(raw)) {
    return { pages: await extractPdfPages(file, onStatus), origin: "pdf" };
  }

  return { text: raw, origin: "file" };
}

/**
 * Readable text for the notes box. Paragraph breaks stay, so several files
 * can be stacked with headings instead of collapsing into one line.
 */
export async function extractTextForInsert(file, onStatus = () => {}) {
  const { pages, text } = await readFileContent(file, onStatus);
  const document = normaliseDocument(pages ? { pages } : { text });
  return String(document.text || "").trim();
}

export function formatCompiledNotes(parts) {
  return (parts || [])
    .filter((part) => part?.name && String(part.text || "").trim())
    .map((part) => `--- ${part.name} ---\n\n${String(part.text).trim()}`)
    .join("\n\n");
}

/** Notes the learner typed, with any auto-compiled file block removed. */
export function notesBeyondCompiled(notes, compiled) {
  const text = String(notes || "");
  const block = String(compiled || "");

  if (!block.trim()) {
    return text.trim();
  }

  if (text.trim() === block.trim()) {
    return "";
  }

  return text.split(block).join("").replace(/\n{3,}/g, "\n\n").trim();
}

function buildSource({ label, input, origin, warning = null }) {
  const document = normaliseDocument(input);
  const text = normalise(document.text);

  if (!text) {
    return warning
      ? { label, text: "", origin, adapter: "text", warning, blocks: [] }
      : null;
  }

  return {
    label,
    text,
    origin,
    adapter: "text",
    warning,
    blocks: document.blocks,
    documentStats: document.stats,
  };
}

export async function collectTextSources({
  notes,
  files = [],
  onStatus = () => {},
}) {
  const sources = [];
  const pasted = normalise(notes);

  if (pasted) {
    sources.push(
      buildSource({ label: "Text notes", input: { text: notes }, origin: "paste" })
    );
  }

  for (const file of files) {
    try {
      const { pages, text, origin } = await readFileContent(file, onStatus);
      const source = buildSource({label:file.name,input:pages ? {pages} : {text},origin});
      sources.push(
        source || {label:file.name,text:'',origin,adapter:'text',warning:`${file.name} contained no readable study text and was skipped.`,blocks:[]}
      );
    } catch (error) {
      sources.push({
        label: file.name,
        text: "",
        origin: "file",
        adapter: "text",
        warning: `${file.name} could not be read (${error.message})`,
        blocks: [],
      });
    }
  }

  return sources.filter(Boolean);
}

export async function collectTextSource({ notes, file, files, onStatus }) {
  const list = files || (file ? [file] : []);
  const collected = await collectTextSources({ notes, files: list, onStatus });

  if (!collected.length) {
    return null;
  }

  const withText = collected.find((source) => source.text);
  return withText || collected[0];
}
