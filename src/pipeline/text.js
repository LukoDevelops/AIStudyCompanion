export const stopWords = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "while",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "from",
  "with",
  "about",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "into",
  "than",
  "their",
  "there",
  "they",
  "them",
  "we",
  "you",
  "your",
  "our",
  "can",
  "could",
  "should",
  "would",
  "will",
  "may",
  "might",
  "not",
  "no",
  "yes",
  "only",
  "just",
  "do",
  "does",
  "did",
  "done",
  "have",
  "has",
  "had",
  "also",
  "more",
  "most",
  "some",
  "such",
  "using",
  "use",
  "used",
  "based",
  "between",
  "within",
  "through",
  "which",
  "what",
  "how",
  "why",
  "where",
  "who",
  "because",
  "therefore",
  "however",
  "overall",
  "very",
  "each",
  "other",
  "one",
  "two",
  "three",
  "first",
  "second",
  "third",
]);

export const weakConceptWords = new Set([
  ...stopWords,
  "good",
  "final",
  "useful",
  "actual",
  "different",
  "several",
  "often",
  "still",
  "need",
  "needs",
  "make",
  "makes",
  "made",
  "thing",
  "things",
  "content",
  "example",
  "including",
  "include",
  "includes",
  "allow",
  "allows",
  "before",
  "after",
  "only",
  "just",
  "really",
  "much",
  "many",
  "like",
  "well",
  "able",
]);

export function normalise(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function splitSentences(text, { minLength = 25 } = {}) {
  const parts = normalise(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const longEnough = parts.filter((sentence) => sentence.length > minLength);

  if (longEnough.length) {
    return longEnough;
  }

  const whole = normalise(text);
  return whole.length > 10 ? [whole] : [];
}

export function tokenize(text) {
  return normalise(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function contentTokens(text) {
  return tokenize(text).filter((token) => !stopWords.has(token) && token.length > 2);
}

export function titleCase(text) {
  return String(text || "").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function truncate(text, max) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shuffle(values, random = Math.random) {
  const copy = [...values];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function slug(text) {
  return normalise(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
