async function analyzeRestaurantMenu(restaurant) {
  const { html, text: staticText } = await fetchStaticPageData(restaurant.url);

  const staticResult = analyzeMenuWithKeywords(staticText);
  let bestHeuristic = staticResult;
  let renderedText = '';

  if (shouldUseRenderedFallback(html, staticResult)) {
    try {
      renderedText = await fetchRenderedPageText(restaurant.url);
      if (renderedText) {
        const renderedResult = analyzeMenuWithKeywords(renderedText);
        bestHeuristic = pickMoreReliableResult(staticResult, renderedResult);
      }
    } catch (error) {
      console.warn(`Rendered extraction failed for ${restaurant.name}:`, error);
    }
  }

  const llmCandidateText = renderedText || staticText;
  const llmResult = await analyzeMenuWithLLM({
    restaurant,
    menuText: llmCandidateText,
    html
  });

  const finalResult = chooseFinalResult(bestHeuristic, llmResult);

  return {
    name: restaurant.name,
    url: restaurant.url,
    hasFish: finalResult.hasFish,
    fishItems: finalResult.fishItems,
    confidence: finalResult.confidence,
    analysisSource: finalResult.analysisSource,
    llmReason: finalResult.llmReason || null,
    error: null
  };
}

function chooseFinalResult(heuristicResult, llmResult) {
  if (!llmResult) return heuristicResult;

  // Prefer LLM if it is confident, or heuristic confidence is low.
  const llmConfident = (llmResult.llmConfidenceScore || 0) >= (LLM_BACKEND.minConfidenceToUse || 0.65);
  const heuristicLowConfidence = heuristicResult.confidence?.dayDetection !== 'high';

  if (llmConfident || heuristicLowConfidence) {
    return llmResult;
  }

  return heuristicResult;
}
