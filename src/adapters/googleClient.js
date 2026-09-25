export const CLOUD_MODEL = 'gemini-3.8-flash';

// Never echo server messages: they can contain request content or credentials.
export function cloudError(status) {
  const explanations = {
    400: 'Google rejected the request. Check the key and model settings.',
    401: 'Google could not authenticate this API key.',
    403: 'Google denied access. Check the key restrictions and whether the Gemini API is available for your project and region.',
    404: 'This Gemini model is not available to your API project.',
    429: 'Google reports a rate or quota limit. Check the free-tier limits in AI Studio, or try again later.',
    500: 'Google encountered an internal server error.',
    503: 'Google is temporarily overloaded or unavailable. This does not by itself mean your key or quota is wrong.',
  };
  return new Error(`${explanations[status] || 'The Google request failed.'} (HTTP ${status}; ${CLOUD_MODEL}). You can choose a local engine instead; there is no paid fallback.`);
}

export async function googleGenerate(key, payload, onStatus = () => {}) {
  if (!key?.trim()) throw new Error('A Google AI Studio key is required.');
  const signal = AbortSignal.timeout(120000);
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CLOUD_MODEL}:generateContent`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key.trim()},
        signal, body: JSON.stringify({ ...payload, generationConfig: {
          maxOutputTokens: 12000, thinkingConfig: {thinkingLevel: 'low'}, ...payload.generationConfig,
        }}),
      });
    } catch {
      throw new Error(signal.aborted ? 'Google did not respond within two minutes. Retry or use a local engine.' : 'Could not reach Google. Check your connection or browser network restrictions.');
    }
    if ([500, 503].includes(response.status) && attempt < 2) {
      onStatus(`Google is busy. Trying again with the same model (${attempt + 1}/2)…`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw cloudError(response.status);
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    if (data?.promptFeedback?.blockReason || (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason))) {
      throw new Error('Google blocked or could not complete this response. Review your input or use a local engine.');
    }
    if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('Google reached its response-length limit. Use fewer passages or retry; the incomplete result was not used.');
    const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('').trim();
    if (!text) throw new Error('Google returned no usable text. Retry or use a local engine.');
    return text;
  }
}

export function parseCloudJson(text) {
  try { return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('Google returned malformed or incomplete JSON. Your previous results were kept. Retry or use a local engine.'); }
}
