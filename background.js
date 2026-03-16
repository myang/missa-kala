// Background service worker for Missa Kala extension

// Load config + modules (MV3 service worker uses importScripts)
importScripts(
  'config.js',
  'menu-keyword-analyzer.js',
  'menu-fetcher.js',
  'llm-client.js',
  'menu-analysis-orchestrator.js'
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkMenus') {
    checkAllRestaurantMenus()
      .then(results => sendResponse({ results }))
      .catch(error => {
        console.error('Error in checkAllRestaurantMenus:', error);
        sendResponse({ error: error.message });
      });

    return true; // async response
  }

  if (request.action === 'saveApiKey') {
    chrome.storage.local.set({ geminiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getApiKey') {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      sendResponse({ apiKey: result.geminiApiKey || '' });
    });
    return true;
  }
});

async function checkAllRestaurantMenus() {
  const results = [];

  for (const restaurant of RESTAURANTS) {
    if (!restaurant.enabled) continue;

    try {
      const result = await analyzeRestaurantMenu(restaurant);
      results.push(result);
    } catch (error) {
      console.error(`Error checking ${restaurant.name}:`, error);
      results.push({
        name: restaurant.name,
        url: restaurant.url,
        hasFish: false,
        fishItems: [],
        confidence: { dayDetection: 'unknown', method: 'error' },
        analysisSource: 'error',
        error: error.message || 'Failed to fetch menu'
      });
    }
  }

  return results;
}
