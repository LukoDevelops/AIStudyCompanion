const BULLET_MARKERS = /[\u2022\u2023\u25E6\u2043\u2219\u00b7\u25aa\u25cf\u25a0\u2013\u2014]/;
const BULLET_SPLIT = /\s*[\u2022\u2023\u25E6\u2043\u2219\u00b7\u25aa\u25cf\u25a0]\s*/;
const LEADING_BULLET = /^\s*(?:[\u2022\u2023\u25E6\u2043\u2219\u00b7\u25aa\u25cf\u25a0*\-\u2013\u2014]|\d{1,2}[.)])\s+/;
const MARKDOWN_HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const SETEXT_UNDERLINE = /^\s{0,3}(={3,}|-{3,})\s*$/;
const NUMBERED_HEADING = /^\s*(?:chapter|section|part|appendix|figure|table)\s+[\divxlc]+\b/i;
const DECIMAL_HEADING = /^\s*\d+(?:\.\d+){0,3}[.)]?\s+\S/;
const PAGE_FURNITURE = [
  /^\s*page\s+\d+\s*(?:of\s+\d+)?\s*$/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,
  /^\s*[-–—]?\s*\d{1,4}\s*[-–—]?\s*$/,
  /^\s*(?:confidential|draft)\s*$/i,
];

const ABBREVIATIONS = [
  "e.g",
  "i.e",
  "etc",
  "vs",
  "cf",
  "al",
  "fig",
  "no",
  "vol",
  "pp",
  "ed",
  "eds",
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "st",
  "approx",
  "ca",
  "inc",
  "ltd",
];

function cleanLine(line) {
  return String(line || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function toPages(input) {
  if (Array.isArray(input)) {
    return input.map((page) => splitLines(page));
  }

  if (input && Array.isArray(input.pages)) {
    return input.pages.map((page) => splitLines(page));
  }

  return [splitLines(input && input.text != null ? input.text : input)];
}

function splitLines(page) {
  if (Array.isArray(page)) {
    return page.map(cleanLine).filter(Boolean);
  }

  if (page && Array.isArray(page.lines)) {
    return page.lines.map(cleanLine).filter(Boolean);
  }

  const text = page && page.text != null ? page.text : page;
  return String(text || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
}

function maskDigits(line) {
  return line.replace(/\d+/g, "#").toLowerCase();
}

function isPageFurniture(line) {
  return PAGE_FURNITURE.some((pattern) => pattern.test(line));
}

/**
 * Running headers repeat on most pages. The page number inside them changes,
 * so frequency is counted against a digit-masked form.
 */
export function findRunningFurniture(pages, { minPages = 3, ratio = 0.34 } = {}) {
  if (pages.length < minPages) {
    return new Set();
  }

  const seen = new Map();

  pages.forEach((lines) => {
    const edges = new Set([
      ...lines.slice(0, 2),
      ...lines.slice(-2),
    ]);

    edges.forEach((line) => {
      if (line.length > 120) {
        return;
      }

      const key = maskDigits(line);
      seen.set(key, (seen.get(key) || 0) + 1);
    });
  });

  const threshold = Math.max(2, Math.ceil(pages.length * ratio));
  const furniture = new Set();

  seen.forEach((count, key) => {
    if (count >= threshold) {
      furniture.add(key);
    }
  });

  return furniture;
}

export function rejoinHyphenatedLines(lines) {
  const output = [];

  for (const line of lines) {
    const previous = output[output.length - 1];

    if (previous && /[A-Za-z]-$/.test(previous) && /^[a-z]/.test(line)) {
      output[output.length - 1] = previous.slice(0, -1) + line;
      continue;
    }

    output.push(line);
  }

  return output;
}

function endsSentence(line) {
  return /[.!?:;"']\s*$/.test(line);
}

function medianLength(lines) {
  if (!lines.length) {
    return 0;
  }

  const sorted = lines.map((line) => line.length).sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Infer headings from text shape because extraction loses font styles.
 * A short, unpunctuated line before a capitalised paragraph can be a heading.
 */
function makeHeadingTest(lines) {
  const typical = medianLength(lines);

  return function isHeading(line, nextLine = "") {
    if (MARKDOWN_HEADING.test(line)) {
      return true;
    }

    if (line.length > 90) {
      return false;
    }

    if (NUMBERED_HEADING.test(line) && line.length < 80) {
      return true;
    }

    const words = line.split(" ").filter(Boolean);

    if (!words.length || words.length > 12 || endsSentence(line)) {
      return false;
    }

    if (DECIMAL_HEADING.test(line) && words.length <= 10) {
      return true;
    }

    const letters = line.replace(/[^A-Za-z]/g, "");

    if (letters.length > 3 && letters === letters.toUpperCase()) {
      return true;
    }

    const capitalised = words.filter((word) => /^[A-Z0-9]/.test(word)).length;

    if (words.length >= 2 && capitalised / words.length >= 0.75) {
      return true;
    }

    const shorterThanBody = typical > 40 && line.length < typical * 0.72;
    const followedByNewLine = !nextLine || /^[A-Z0-9"'([]/.test(nextLine);

    return shorterThanBody && followedByNewLine;
  };
}

/**
 * PDF extraction returns one line per rendered row, so a paragraph arrives as
 * many fragments. Rows are merged back together unless the break looks real.
 */
function mergeWrappedLines(lines, isHeading) {
  const output = [];

  lines.forEach((line, index) => {
    const nextLine = lines[index + 1] || "";
    const previous = output[output.length - 1];
    const startsNewBlock = LEADING_BULLET.test(line) || isHeading(line, nextLine);

    if (
      previous &&
      !startsNewBlock &&
      !endsSentence(previous) &&
      !isHeading(previous, line) &&
      previous.length < 400
    ) {
      output[output.length - 1] = `${previous} ${line}`;
      return;
    }

    output.push(line);
  });

  return output;
}

function expandInlineBullets(line) {
  const stripped = line.replace(LEADING_BULLET, "");

  if (!BULLET_MARKERS.test(stripped)) {
    return [line];
  }

  const parts = stripped
    .split(BULLET_SPLIT)
    .map((part) => cleanLine(part))
    .filter((part) => part.length > 1);

  return parts.length > 1 ? parts : [line];
}

export function normaliseDocument(input, options = {}) {
  const { keepFurniture = false } = options;
  const pages = toPages(input);
  const furniture = keepFurniture ? new Set() : findRunningFurniture(pages);
  const blocks = [];
  const stats = {
    pageCount: pages.length,
    removedFurniture: 0,
    headingCount: 0,
  };

  pages.forEach((rawLines, pageIndex) => {
    const kept = rawLines.filter((line) => {
      if (isPageFurniture(line) || furniture.has(maskDigits(line))) {
        stats.removedFurniture += 1;
        return false;
      }

      return true;
    });

    const joined = rejoinHyphenatedLines(kept);
    const isHeading = makeHeadingTest(joined);
    const merged = mergeWrappedLines(joined, isHeading);

    merged.forEach((line, mergedIndex) => {
      const markdown = line.match(MARKDOWN_HEADING);

      if (markdown) {
        stats.headingCount += 1;
        blocks.push({
          kind: "heading",
          text: cleanLine(markdown[2]),
          page: pageIndex + 1,
        });
        return;
      }

      if (SETEXT_UNDERLINE.test(line)) {
        const previous = blocks[blocks.length - 1];
        if (previous && previous.kind === "text") {
          previous.kind = "heading";
          stats.headingCount += 1;
        }
        return;
      }

      if (isHeading(line, merged[mergedIndex + 1] || "")) {
        stats.headingCount += 1;
        blocks.push({ kind: "heading", text: line, page: pageIndex + 1 });
        return;
      }

      const isBullet = LEADING_BULLET.test(line);

      expandInlineBullets(line).forEach((part) => {
        const text = cleanLine(part.replace(LEADING_BULLET, ""));

        if (text.length < 2) {
          return;
        }

        blocks.push({
          kind: isBullet || part !== line ? "bullet" : "text",
          text,
          page: pageIndex + 1,
        });
      });
    });
  });

  const deduped = [];
  const seenBlocks = new Set();

  blocks.forEach((block) => {
    const key = `${block.kind}:${block.text.toLowerCase()}`;

    if (seenBlocks.has(key) && block.text.length > 24) {
      return;
    }

    seenBlocks.add(key);
    deduped.push(block);
  });

  let heading = null;

  const withSections = deduped.map((block) => {
    if (block.kind === "heading") {
      heading = block.text;
      return { ...block, heading: block.text };
    }

    return { ...block, heading };
  });

  return {
    blocks: withSections,
    stats,
    text: withSections.map((block) => block.text).join("\n"),
  };
}

function protectAbbreviations(text) {
  let output = text;

  ABBREVIATIONS.forEach((abbreviation) => {
    const escaped = abbreviation.replace(/\./g, "\\.");
    const pattern = new RegExp(`\\b${escaped}\\.`, "gi");
    output = output.replace(pattern, (match) => match.replaceAll(".", "\u0001"));
  });

  return output
    .replace(/\b([A-Z])\./g, "$1\u0001")
    .replace(/(\d)\.(\d)/g, "$1\u0001$2");
}

function restoreAbbreviations(text) {
  return text.replace(/\u0001/g, ".");
}

/**
 * Sentence splitter that survives abbreviations, decimals, and list items.
 */
export function splitDocumentSentences(text, { minLength = 20 } = {}) {
  const guarded = protectAbbreviations(cleanLine(text));
  const parts = guarded
    .split(/(?<=[.!?])["')\]]?\s+(?=[A-Z0-9"'(\[])/)
    .map((part) => restoreAbbreviations(part).trim())
    .filter(Boolean);

  const usable = parts.filter((part) => part.length >= minLength);
  return usable.length ? usable : parts;
}
