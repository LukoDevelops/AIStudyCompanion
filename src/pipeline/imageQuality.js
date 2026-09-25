import { normalise } from "./text.js";
import { collapseRepeats } from "./ocr.js";

/** Reject damaged output before it becomes evidence for summaries or questions. */
export function cleanImageDescription(raw) {
  const original = String(raw || "");
  if (original.includes("\uFFFD")) return "";
  const text = normalise(original.replace(/<\/?s>|<pad>|<\|[^>]+\|>/g, " "));
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  if (words.length < 4 || words.join("").length / Math.max(1, text.length) < .5) return "";
  const clean = collapseRepeats(text).replace(/\.{2,}/g, ".");
  if (clean.split(/\s+/).length < words.length * .6) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

export function usableOcr(ocr) {
  return Boolean(ocr.text && !ocr.text.includes("\uFFFD") && ocr.meanConfidence >= 62);
}
