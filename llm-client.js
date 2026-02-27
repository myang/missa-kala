function isLlmEnabled() {
  return Boolean(LLM_BACKEND && LLM_BACKEND.enabled && LLM_BACKEND.endpoint);
}

async function analyzeMenuWithLLM({ restaurant, menuText, html }) {
  if (!isLlmEnabled()) return null;

  const payload = {
    restaurantName: restaurant.name,
    restaurantUrl: restaurant.url,
    localeHint: 'fi-FI',
    todayIsoDate: new Date().toISOString().slice(0, 10),
    fishKeywords: FISH_KEYWORDS,
    menuText: truncateForLlm(menuText || '', LLM_BACKEND.maxInputChars || 12000),
    rawHtmlSnippet: truncateForLlm(html || '', 4000)
  };

  try {
    if (LLM_BACKEND.provider === 'openai-compatible') {
      return await callOpenAiCompatible(payload);
    }

    return await callCustomJsonBackend(payload);
  } catch (error) {
    console.warn(`LLM analysis failed for ${restaurant.name}:`, error);
    return null;
  }
}

async function callCustomJsonBackend(payload) {
  const response = await fetch(LLM_BACKEND.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(LLM_BACKEND.apiKey ? { 'Authorization': `Bearer ${LLM_BACKEND.apiKey}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`LLM backend HTTP ${response.status}`);
  }

  const data = await response.json();
  return normalizeLlmResult(data);
}

async function callOpenAiCompatible(payload) {
  if (!LLM_BACKEND.model) throw new Error('Missing LLM_BACKEND.model for openai-compatible provider');
  if (!LLM_BACKEND.apiKey) throw new Error('Missing LLM_BACKEND.apiKey for openai-compatible provider');

  const response = await fetch(LLM_BACKEND.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_BACKEND.apiKey}`
    },
    body: JSON.stringify({
      model: LLM_BACKEND.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict menu parser. Return JSON only.'
        },
        {
          role: 'user',
          content: buildLlmPrompt(payload)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  const parsed = safeJsonParse(content) || {};
  return normalizeLlmResult(parsed);
}

function buildLlmPrompt(payload) {
  return [
    'Determine whether TODAY\'S menu includes fish dishes.',
    'Rules:',
    '- Use today date and day names in any language to select only today menu entries.',
    '- Ignore weekly summaries unless today can be identified.',
    '- Return JSON with keys: hasFish(boolean), fishItems(array of strings), confidence(number 0-1), reason(string).',
    `Today date: ${payload.todayIsoDate}`,
    `Restaurant: ${payload.restaurantName}`,
    '',
    'Menu text:',
    payload.menuText,
    '',
    'Raw HTML snippet:',
    payload.rawHtmlSnippet
  ].join('\n');
}

function normalizeLlmResult(result) {
  if (!result || typeof result !== 'object') return null;

  const hasFish = Boolean(result.hasFish);
  const fishItems = Array.isArray(result.fishItems)
    ? result.fishItems.map(item => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];

  const confidenceRaw = Number(result.confidence);
  const confidenceScore = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.5;

  const dayDetection = confidenceScore >= 0.75 ? 'high' : 'low';

  return {
    hasFish,
    fishItems: hasFish ? fishItems : [],
    confidence: {
      dayDetection,
      method: 'llm'
    },
    llmReason: typeof result.reason === 'string' ? result.reason.slice(0, 400) : '',
    analysisSource: 'llm',
    llmConfidenceScore: confidenceScore
  };
}

function truncateForLlm(value, maxChars) {
  if (!value) return '';
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}
