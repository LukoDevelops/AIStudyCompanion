import { findEvidence } from "./concepts.js";
import { shuffle, titleCase, truncate } from "./text.js";
import { studyValue } from './studyQuality.js';

// A conservative local template: ask about explicit definitions, without
// inventing causal explanations or turning arbitrary words into false claims.
function definitionQuestions(corpus, random) {
  const definitions = corpus.sentenceRecords.flatMap(record => {
    if (studyValue(record) < 0) return [];
    const match = record.sentence.match(/^(.{5,80}?)\s+(?:is|are|refers to|means)\s+(.{15,220})[.!?]$/i);
    if (!match || /^(this|that|it|these|those|there|they|we|however|the (?:challenge|result|problem|approach))\b/i.test(match[1])) return [];
    return [{record, subject:match[1], answer:match[2]}];
  });
  return definitions.flatMap(item => {
    const alternatives = definitions.filter(other => other.subject.toLowerCase() !== item.subject.toLowerCase() && other.answer !== item.answer).map(other => other.answer);
    const choices = shuffle(uniqueLabels([item.answer, ...alternatives.slice(0,3)]), random);
    if (choices.length < 2) return [];
    return [{type:'understanding', question:`According to the material, how is “${item.subject}” described?`, choices, answer:item.answer, evidenceId:item.record.id, evidenceExcerpt:item.record.sentence, source:`${item.record.source}, sentence ${item.record.index}`, explanation:`The source explains: ${item.record.sentence}`}];
  });
}

// Only explicit causal clauses support these questions; graph links alone do not.
function causalQuestions(corpus, random) {
  const causes=corpus.sentenceRecords.flatMap(record=>{
    if(studyValue(record)<0) return [];
    const match=record.sentence.match(/^(.{12,160}?)\s+because\s+(.{15,240})[.!?]$/i);
    if(!match || /^(it|this|that|they|these|those)\b/i.test(match[1])) return [];
    return [{record,claim:match[1],reason:match[2]}];
  });
  return causes.flatMap(item=>{
    const other=causes.filter(candidate=>candidate.record.id!==item.record.id && candidate.reason.toLowerCase()!==item.reason.toLowerCase());
    const choices=shuffle(uniqueLabels([item.reason,...other.slice(0,3).map(candidate=>candidate.reason)]),random);
    if(choices.length<2)return [];
    return [{type:'reasoning',question:`What reason does the source give for this statement: “${item.claim}”?`,choices,answer:item.reason,
      evidenceId:item.record.id,evidenceExcerpt:item.record.sentence,source:`${item.record.source}, sentence ${item.record.index}`,
      explanation:`The source explicitly gives this reason: ${item.reason}.`}];
  });
}

function distributeBySource(questions) {
  const sources=new Map();
  for(const question of questions){const source=question.source.replace(/, sentence \d+$/,'');const group=sources.get(source)||[];group.push(question);sources.set(source,group);}
  const result=[];
  for(let i=0;i<questions.length;i++) for(const group of sources.values()) if(group[i])result.push(group[i]);
  return result;
}

function withRetrievedEvidence(concept, corpus, provider) {
  if (!provider) {
    return concept;
  }

  const { record } = findEvidence(corpus, concept.term, provider);
  if (!record) {
    return concept;
  }

  return {
    ...concept,
    evidence: record.sentence,
    evidenceId: record.id,
    evidenceExcerpt: record.sentence,
    source: `${record.source}, sentence ${record.index}`,
  };
}

function uniqueLabels(items) {
  return [...new Set(items.filter(Boolean))];
}

/** Shuffle displayed options without changing the correct answer text. */
export function randomizeQuizChoiceOrder(quiz, random = Math.random) {
  return (quiz || []).map((item) => ({
    ...item,
    choices: Array.isArray(item.choices) ? shuffle([...item.choices], random) : [],
  }));
}

function buildConceptQuestion(concept, distractors, random) {
  const evidence = truncate(concept.evidence, 140);
  const choices = shuffle(
    uniqueLabels([
      concept.term,
      ...distractors.filter((item) => item !== concept.term).slice(0, 3),
    ]),
    random
  );

  if (choices.length < 2) {
    return null;
  }

  return {
    type: "concept-match",
    question: `Which idea does this passage describe? “${evidence}”`,
    choices,
    answer: concept.term,
    source: concept.source,
    evidenceId: concept.evidenceId,
    evidenceExcerpt: concept.evidence,
    explanation: `The passage describes ${concept.term}. Read the linked sentence to check your answer.`,
  };
}

function buildClozeQuestion(concept, distractors, random) {
  const pattern = new RegExp(
    concept.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );

  if (!pattern.test(concept.evidence)) {
    return null;
  }

  const blanked = concept.evidence.replace(pattern, "______");
  const choices = shuffle(
    uniqueLabels([
      concept.term,
      ...distractors.filter((item) => item !== concept.term).slice(0, 3),
    ]),
    random
  );

  if (choices.length < 2) {
    return null;
  }

  return {
    type: "cloze",
    question: `Fill in the blank from the source material: “${truncate(blanked, 180)}”`,
    choices,
    answer: concept.term,
    source: concept.source,
    evidenceId: concept.evidenceId,
    evidenceExcerpt: concept.evidence,
    explanation: `The missing phrase in the source sentence is ${concept.term}.`,
  };
}

function buildSourceQuestion(concept, sourceLabels, random) {
  const sourceName = concept.source.split(",")[0];
  const choices = shuffle(uniqueLabels([sourceName, ...sourceLabels]), random);

  if (choices.length < 2) {
    return null;
  }

  return {
    type: "source",
    question: `Which input source contains this statement: “${truncate(concept.evidence, 140)}”?`,
    choices,
    answer: sourceName,
    source: concept.source,
    evidenceId: concept.evidenceId,
    evidenceExcerpt: concept.evidence,
    explanation: `This sentence was taken from ${sourceName}.`,
  };
}

function buildTrueFalseQuestion(concept, corpus, random) {
  const makeFalse = random() > 0.45 && corpus.sentenceRecords.length > 1;
  const statement = makeFalse
    ? concept.evidence.replace(/\b(not|only|often|still|useful|grounded)\b/i, "never")
    : concept.evidence;

  if (makeFalse && statement === concept.evidence) {
    return {
      type: "true-false",
      question: `True or false: this statement appears in the study material: “${truncate(concept.evidence, 160)}”`,
      choices: ["True", "False"],
      answer: "True",
      source: concept.source,
      evidenceId: concept.evidenceId,
      evidenceExcerpt: concept.evidence,
      explanation: "The statement is an extract from the provided study material.",
    };
  }

  return {
    type: "true-false",
    question: `True or false: this statement appears in the study material: “${truncate(statement, 160)}”`,
    choices: ["True", "False"],
    answer: makeFalse ? "False" : "True",
    source: concept.source,
    evidenceId: concept.evidenceId,
    evidenceExcerpt: concept.evidence,
    explanation: makeFalse
      ? "The wording was altered. Check the original sentence before trusting the claim."
      : "The statement is an extract from the provided study material.",
  };
}

export function buildQuiz(concepts, corpus, options = {}) {
  const { limit = 5, random = Math.random, provider = null } = options;
  const workingConcepts = concepts.map((concept) =>
    withRetrievedEvidence(concept, corpus, provider)
  );
  const distractors = workingConcepts.map((concept) => concept.term);
  const sourceLabels = uniqueLabels(corpus.sources.map((source) => source.label));
  const questions = [];
  const shortImage = corpus.sentenceRecords.length <= 3 && corpus.sources.every(source => ["vision", "cloud-vision", "ocr"].includes(source.origin));
  const usedEvidence = new Set();
  if (!shortImage) distributeBySource([...causalQuestions(corpus, random), ...definitionQuestions(corpus, random)]).slice(0, Math.ceil(limit / 2)).forEach(question => {
    questions.push(question); usedEvidence.add(question.evidenceId);
  });

  workingConcepts.forEach((concept, index) => {
    if (questions.length >= limit) {
      return;
    }
    if (usedEvidence.has(concept.evidenceId)) return;

    const builders = [
      () => buildConceptQuestion(concept, distractors, random),
      () => buildClozeQuestion(concept, distractors, random),
      () => buildClozeQuestion(concept, distractors, random),
      () => buildConceptQuestion(concept, distractors, random),
    ];

    const builder = shortImage ? builders[1] : builders[index % builders.length];
    const question = builder();

    if (question) {
      questions.push(question);
      usedEvidence.add(concept.evidenceId);
    }
  });

  if (!questions.length && workingConcepts[0]) {
    const fallback =
      buildTrueFalseQuestion(workingConcepts[0], corpus, random) ||
      buildConceptQuestion(workingConcepts[0], distractors, random);
    if (fallback) {
      questions.push(fallback);
    }
  }

  const seenQuestions = new Set();
  return randomizeQuizChoiceOrder(questions.filter(question => {
    const key = question.question.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (seenQuestions.has(key)) return false;
    seenQuestions.add(key); return true;
  }).slice(0, limit), random);
}

export function scoreQuiz(quiz, answers) {
  const details = quiz.map((item, index) => {
    const given = answers[index];
    const correct = given === item.answer;
    return {
      given,
      correct,
      answer: item.answer,
    };
  });

  return {
    correct: details.filter((item) => item.correct).length,
    total: quiz.length,
    details,
  };
}

export function labelQuizType(type) {
  const labels = {
    reasoning: 'Reasoning from the source',
    understanding: 'Understanding',
    "concept-match": "Concept",
    cloze: "Fill in the blank",
    source: "Source",
    "true-false": "True or false",
  };

  return labels[type] || titleCase(type || "question");
}
