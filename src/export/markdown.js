import { downloadBlob } from './download.js';

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function toMarkdown(result) {
  const summary = result.summary
    .map(
      (item, index) =>
        `${index + 1}. ${item.text}\n   - Source: ${item.source} (${item.confidence} confidence)`
    )
    .join("\n");

  const concepts = result.concepts
    .map(
      (item) =>
        `- **${item.term}** (score ${item.score})\n  - ${item.source}\n  - Evidence: ${item.evidenceExcerpt}${
          item.related?.length ? `\n  - Related: ${item.related.join(", ")}` : ""
        }`
    )
    .join("\n");

  const quiz = result.quiz
    .map((item, index) => {
      const choices = (item.choices || [])
        .map((choice) => `  - ${choice}`)
        .join("\n");
      return `${index + 1}. ${item.question}\n${choices}\n   - Answer: ${item.answer}\n   - ${item.source}`;
    })
    .join("\n\n");

  return [
    "# AI Study Companion revision pack",
    "",
    `Generated: ${result.generatedAt}`,
    `Engine: ${result.engine}`,
    `Retrieval: ${result.retrieval || result.checks.retrieval || "n/a"}`,
    `Sources: ${result.sourceCount}`,
    `Sentence coverage: ${result.checks.coveragePct || 0}%`,
    "",
    "## Summary",
    summary,
    "",
    "## Key concepts",
    concepts,
    "",
    "## Quiz",
    quiz,
    "",
    "## Recommended next steps",
    list(result.nextSteps),
    "",
    "## Source-grounding checks",
    `- Evidence links: ${result.checks.groundingCoverage}%`,
    `- Mean grounding: ${result.checks.meanGroundingScore || 0}%`,
    `- Sentences processed: ${result.checks.sentenceCount}`,
    `- Concepts extracted: ${result.checks.conceptCount}`,
    "",
    "### Limitations",
    list(result.checks.prototypeLimitations),
    "",
  ].join("\n");
}

export function downloadMarkdown(result, filename = "ai-study-companion-revision-pack.md") {
  const blob = new Blob([toMarkdown(result)], { type: "text/markdown" });
  downloadBlob(blob, filename);
}
