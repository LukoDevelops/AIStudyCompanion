let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }

  return pdfjsPromise;
}

/** Rebuild text rows and read clear two-column layouts column by column. */
export function groupItemsIntoLines(items, { tolerance = 2.4 } = {}) {
  const rows = [];

  items.forEach((item) => {
    const text = String(item.str || "");

    if (!text.trim()) {
      return;
    }

    const y = Array.isArray(item.transform) ? item.transform[5] : 0;
    const x = Array.isArray(item.transform) ? item.transform[4] : 0;
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= tolerance);

    if (row) {
      row.parts.push({ x, text, width: Number(item.width) || 0 });
      return;
    }

    rows.push({ y, parts: [{ x, text, width: Number(item.width) || 0 }] });
  });

  rows.sort((left, right) => right.y - left.y);
  rows.forEach(row => row.parts.sort((left, right) => left.x - right.x));
  const line = parts => parts.map(part => part.text).join(' ').replace(/\s+/g, ' ').trim();
  const parts = rows.flatMap(row => row.parts);
  if (!parts.length || parts.some(part => part.width <= 0)) return rows.map(row => line(row.parts)).filter(Boolean);

  const leftEdge = Math.min(...parts.map(part => part.x));
  const rightEdge = Math.max(...parts.map(part => part.x + part.width));
  const middle = (leftEdge + rightEdge) / 2;
  const span = rightEdge - leftEdge;
  const gaps = [];
  for (const row of rows) {
    for (let i = 1; i < row.parts.length; i++) {
      const before = row.parts.slice(0, i), after = row.parts.slice(i);
      const end = Math.max(...before.map(part => part.x + part.width));
      const start = after[0].x;
      if (start - end >= 12 && end < middle + span * .08 && start > middle - span * .08
          && line(before).length >= 30 && line(after).length >= 30) gaps.push((end + start) / 2);
    }
  }
  if (gaps.length < 5) return rows.map(row => line(row.parts)).filter(Boolean);
  gaps.sort((a, b) => a - b);
  const split = gaps[Math.floor(gaps.length / 2)];
  if (gaps.filter(gap => Math.abs(gap - split) < 12).length < 5) return rows.map(row => line(row.parts)).filter(Boolean);

  const output = [];
  let leftColumn = [], rightColumn = [];
  const flush = () => {output.push(...leftColumn, ...rightColumn); leftColumn = []; rightColumn = [];};
  for (const row of rows) {
    const left = row.parts.filter(part => part.x < split);
    const right = row.parts.filter(part => part.x >= split);
    const crosses = left.some(part => part.x + part.width > split)
      || (left.length && right.length && right[0].x - Math.max(...left.map(part => part.x + part.width)) < 12);
    if (crosses) {
      flush();
      output.push(line(row.parts));
    } else {
      if (left.length) leftColumn.push(line(left));
      if (right.length) rightColumn.push(line(right));
    }
  }
  flush();
  return output.filter(Boolean);
}

export async function extractPdfPages(file, onStatus = () => {}) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  // The loading task owns cleanup. Font rendering is unnecessary for extraction.
  const task = pdfjs.getDocument({ data, isEvalSupported: false, verbosity: 0 });
  const pages = [];
  let characterCount = 0;

  try {
    const document = await task.promise;
    if (document.numPages > 300) throw new Error('This PDF exceeds the 300-page safety limit. Split it into smaller readings.');
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (document.numPages > 4) {
        onStatus(`Reading ${file.name} · page ${pageNumber} of ${document.numPages}…`);
      }

      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = groupItemsIntoLines(content.items);
      characterCount += lines.reduce((count, line) => count + line.length, 0);
      if (characterCount > 600000) throw new Error('This PDF has more than 600,000 extracted characters. Try splitting it into smaller readings.');
      pages.push(lines);
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  const characters = pages.flat().join("").length;

  if (characters < 40) {
    throw new Error(
      "That PDF has almost no selectable text. It may be a scan—try the image field or paste the notes instead."
    );
  }

  return pages;
}
