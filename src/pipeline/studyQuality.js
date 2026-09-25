export function studyValue(record) {
  const text = record.sentence || '';
  if (/^(references|bibliography|acknowledg|funding|competing interests)/i.test(record.heading || '')) return -10;
  if (/https?:\/\/|doi:|all rights reserved|corresponding author|creative commons/i.test(text)) return -6;
  const words = text.split(/\s+/).length;
  if (words < 6 || words > 110) return -2;
  let score = 0;
  if (/abstract|conclusion|discussion|results|findings|summary/i.test(record.heading || '')) score += 2;
  if (/\b(found|showed|suggests|demonstrat|because|therefore|however|compared|increase|decrease|defined|refers to|means that|aim|objective|limitation|conclude|results)\b/i.test(text)) score += 1.5;
  if (/\b\d+(?:\.\d+)?\s*%/.test(text)) score += .5;
  if ((text.match(/\[\d+\]/g) || []).length > 3) score -= 2;
  return score;
}

/** Round-robin section selection keeps the end of long papers represented. */
export function selectStudyEvidence(records, {maxChars=45000, maxRecords=100}={}) {
  const sections = new Map();
  records.filter(record => studyValue(record) >= 0).forEach(record => {
    const key = record.section || record.source;
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(record);
  });
  const sourceSections = new Map();
  for (const group of sections.values()) {
    const source = group[0].source;
    if (!sourceSections.has(source)) sourceSections.set(source, []);
    sourceSections.get(source).push(group.sort((a,b)=>studyValue(b)-studyValue(a)));
  }
  const groups = [...sourceSections.values()].map(sectionGroups => {
    const ordered = [];
    for (let i=0; i<Math.max(...sectionGroups.map(group=>group.length)); i++) {
      sectionGroups.forEach(group=>{ if (group[i]) ordered.push(group[i]); });
    }
    return ordered;
  });
  const selected = []; let chars=0;
  for (let i=0; selected.length<maxRecords; i++) {
    let found=false;
    for (const group of groups) {
      if (!group[i]) continue; found=true;
      const record=group[i];
      if (chars+record.sentence.length>maxChars || selected.length>=maxRecords) continue;
      selected.push(record); chars+=record.sentence.length;
    }
    if (!found) break;
  }
  return selected;
}
