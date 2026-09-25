let mammothPromise = null;

async function loadMammoth() {
  if (!mammothPromise) {
    mammothPromise = import("mammoth/mammoth.browser.js").then(
      (module) => module.default || module
    );
  }

  return mammothPromise;
}

/**
 * Mammoth returns markdown-flavoured text, which keeps heading and list markers
 * that the document normaliser already understands.
 */
export async function extractDocxText(file) {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  let result;
  try {
    result = await mammoth.convertToMarkdown({ arrayBuffer });
  } catch {
    throw new Error('This Word file could not be opened. It may be damaged or password-protected. Save a fresh .docx or paste its text.');
  }
  const text = String(result?.value || "")
    .replace(/\\([^\w\s])/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();

  if (text.length < 20) {
    throw new Error("That Word file had almost no readable text. Paste the notes instead.");
  }

  return text;
}
