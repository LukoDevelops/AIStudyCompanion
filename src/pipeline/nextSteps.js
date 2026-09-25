export function buildNextSteps(corpus, concepts, extras = {}) {
  const steps = [
    "Review the key concepts against your original study material.",
    "Use the questions as a first self-test, then rewrite missed answers in your own words.",
    "Check any low-confidence or unclear statements before relying on them for revision.",
  ];

  if (corpus.sources.length < 3) {
    steps.push(
      "Add another input—a transcript, audio file, or diagram—to give the pack more coverage."
    );
  }

  if (concepts.length < 5) {
    steps.push(
      "Add a little more detail to your notes so the pack can find stronger concepts."
    );
  }

  if (extras.usedFallback) {
    steps.push(
      "Check the processing notes below. If a file could not be read, try a clearer copy or add your own description."
    );
  }

  if (extras.unusedCount > 0) {
    steps.push(
      `${extras.unusedCount} source sentence${extras.unusedCount === 1 ? "" : "s"} were not cited. Open the coverage chart to see what was left out.`
    );
  }

  if (extras.engine === "baseline") {
    steps.push(
      "You used the keyword baseline. Try Hybrid Focus to compare it with the improved local retrieval."
    );
  }

  return steps;
}
