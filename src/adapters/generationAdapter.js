import { googleGenerate, parseCloudJson } from './googleClient.js';
import { normalise } from "../pipeline/text.js";

const STORAGE_KEY = "aiStudyCompanion.freeModelKey";

export function readStoredKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function storeKey(key) {
  try {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore quota or private-mode failures.
  }
}

export async function polishQuizExplanations(pack, key, onStatus = () => {}) {
  const token = normalise(key);

  if (!token) {
    throw new Error("No free-model key was provided.");
  }

  onStatus("Sending the quiz questions and their source passages to Google to improve the explanations.");

  const payload = {
    contents: [
      {
        parts: [
          {
            text: [
              "Rewrite these quiz explanations in clearer student language.",
              "Do not add facts that are not already in the question, answer, or excerpt.",
              "Return JSON only: {\"explanations\":[\"...\"] } in the same order.",
              JSON.stringify(
                pack.quiz.map((item) => ({
                  question: item.question,
                  answer: item.answer,
                  excerpt: item.evidenceExcerpt,
                  explanation: item.explanation,
                }))
              ),
            ].join("\n"),
          },
        ],
      },
    ],
  };

  payload.generationConfig = {responseMimeType:'application/json', responseSchema:{type:'OBJECT',required:['explanations'],properties:{explanations:{type:'ARRAY',items:{type:'STRING'}}}}};
  const parsed = parseCloudJson(await googleGenerate(token, payload, onStatus));
  const explanations = parsed.explanations;
  if (!Array.isArray(explanations) || explanations.length !== pack.quiz.length || explanations.some(text => typeof text !== 'string' || !text.trim() || text.length > 2000 || text.includes('\uFFFD'))) {
    throw new Error('The cloud explanations were incomplete or unreadable. Your previous quiz was kept.');
  }

  return {
    ...pack,
    quiz: pack.quiz.map((item, index) => ({
      ...item,
      explanation: explanations[index] || item.explanation,
    })),
    checks: {
      ...pack.checks,
      prototypeLimitations: [
        "Cloud polishing was used for quiz explanations. Questions and supporting source excerpts were sent to Google.",
        ...pack.checks.prototypeLimitations,
      ],
    },
  };
}
