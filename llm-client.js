function getStoredApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      resolve(result.geminiApiKey || '');
    });
  });
}

async function analyzeMenuWithLLM({ restaurant, menuText, html }) {
  const apiKey = await getStoredApiKey();
  if (!apiKey) return null;

  const truncatedText = (menuText || '').substring(0, 4000);
  if (truncatedText.length < 20) return null;

  const prompt = `You are analyzing a restaurant menu to determine if there are any real fish dishes available today.

Restaurant: ${restaurant.name}
Today: ${new Date().toISOString().slice(0, 10)}

Menu text:
${truncatedText}

Rules:
- Look for dishes where fish is the MAIN protein (e.g., grilled salmon, pan-fried pike-perch, baked cod)
- EXCLUDE dishes where fish is only a minor ingredient or flavoring (e.g., fish sauce, fish ball, fish stock in soup, caesar salad with anchovy dressing)
- EXCLUDE sushi and raw fish dishes unless they are clearly a main course
- Consider Finnish fish names: lohi (salmon), kuha (pike-perch), siika (whitefish), ahven (perch), silakka (Baltic herring), turska (cod), taimen (trout), hauki (pike)
- If the menu is in Finnish, translate the dish names to English in your response
- Use today's date and day names to identify today's menu if the page shows multiple days

Respond in this exact JSON format (no markdown, no code blocks):
{"hasFish": true/false, "fishItems": ["Dish name 1 - brief description", "Dish name 2"], "confidence": 0.9, "reason": "brief explanation"}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const parsed = safeJsonParse(content) || safeJsonParse((content.match(/\{[\s\S]*\}/) || [])[0]);
    if (!parsed) throw new Error('Could not parse Gemini response');

    return normalizeLlmResult(parsed);
  } catch (error) {
    console.warn(`Gemini analysis failed for ${restaurant.name}:`, error);
    return null;
  }
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
      method: 'ai'
    },
    llmReason: typeof result.reason === 'string' ? result.reason.slice(0, 400) : '',
    analysisSource: 'ai',
    llmConfidenceScore: confidenceScore
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}
