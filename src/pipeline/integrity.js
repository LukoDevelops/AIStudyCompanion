// Structural provenance checks, deliberately not a claim of semantic truth.
const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const percent = (part, total) => total ? Math.round(part / total * 100) : 0;

export function auditIntegrity(corpus, { summary = [], concepts = [], quiz = [] } = {}) {
  const records = new Map(corpus.sentenceRecords.map(record => [record.id, record]));
  const issues = [];
  const sections = {};
  const represented = new Set();
  let validLinks = 0, quotations = 0, matchingQuotes = 0;
  for (const [section, items] of Object.entries({ summary, concepts, quiz })) {
    let valid = 0;
    const seen = new Set();
    items.forEach((item, index) => {
      const issue = (code, message) => issues.push({ section, index, code, message });
      const record = records.get(item.evidenceId);
      if (!record) issue('missing-evidence', 'The citation does not resolve to a retained source sentence.');
      else { valid++; validLinks++; represented.add(record.source); }
      const quote = normalize(item.evidenceExcerpt ?? item.evidence);
      if (quote) {
        quotations++;
        if (record && normalize(record.sentence).includes(quote)) matchingQuotes++;
        else issue('quote-mismatch', 'The quoted evidence does not match the cited sentence.');
      }
      const label = normalize(item.text ?? item.term ?? item.question);
      if (!label) issue('empty-output', 'The output has no readable text.');
      else if (seen.has(label)) issue('duplicate-output', 'This output repeats another item in the same section.');
      seen.add(label);
      if (/\uFFFD/.test(`${item.text ?? ''} ${item.term ?? ''} ${item.question ?? ''} ${item.answer ?? ''}`)) {
        issue('damaged-text', 'The output contains a replacement character; check the original extraction.');
      }
      if (section === 'quiz') {
        const choices = Array.isArray(item.choices) ? item.choices : [];
        const labels = choices.map(normalize);
        if (choices.length < 2 || labels.some(label => !label) || new Set(labels).size !== labels.length) {
          issue('invalid-choices', 'A quiz needs at least two distinct, nonempty choices.');
        }
        if (!choices.includes(item.answer)) issue('invalid-answer', 'The answer is not one of the displayed choices.');
      }
    });
    sections[section] = { total: items.length, validLinks: valid, linkCoverage: percent(valid, items.length) };
  }
  const sources = [...new Set(corpus.sentenceRecords.map(record => record.source))];
  const total = summary.length + concepts.length + quiz.length;
  return {
    total, validLinks, linkCoverage: percent(validLinks, total), quotations, matchingQuotes,
    quoteMatchPct: quotations ? percent(matchingQuotes, quotations) : null,
    sourceRepresentationPct: percent(represented.size, sources.length),
    uncitedSources: sources.filter(source => !represented.has(source)),
    sections, issues, passed: issues.length === 0,
  };
}
