// Background service worker for Missa Kala extension

// Import config (note: in service workers, we need to use importScripts)
importScripts('config.js');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkMenus') {
    checkAllRestaurantMenus().then(results => {
      sendResponse({ results });
    }).catch(error => {
      console.error('Error in checkAllRestaurantMenus:', error);
      sendResponse({ error: error.message });
    });

    // Return true to indicate async response
    return true;
  }
});

async function checkAllRestaurantMenus() {
  const results = [];

  // Check each restaurant
  for (const restaurant of RESTAURANTS) {
    if (!restaurant.enabled) {
      continue;
    }

    try {
      const result = await checkRestaurantMenu(restaurant);
      results.push(result);
    } catch (error) {
      console.error(`Error checking ${restaurant.name}:`, error);
      results.push({
        name: restaurant.name,
        url: restaurant.url,
        hasFish: false,
        fishItems: [],
        error: error.message || 'Failed to fetch menu'
      });
    }
  }

  return results;
}

async function checkRestaurantMenu(restaurant) {
  try {
    // Fetch the restaurant's menu page
    const response = await fetch(restaurant.url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML and search for fish keywords
    const fishItems = findFishInMenu(html);

    return {
      name: restaurant.name,
      url: restaurant.url,
      hasFish: fishItems.length > 0,
      fishItems: fishItems,
      error: null
    };
  } catch (error) {
    throw error;
  }
}

function findFishInMenu(html) {
  const fishItems = [];

  // Remove HTML tags using regex (since DOMParser isn't available in service workers)
  let textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove style tags and content
    .replace(/<[^>]+>/g, ' ')                          // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')                           // Replace &nbsp;
    .replace(/&amp;/g, '&')                            // Replace &amp;
    .replace(/&lt;/g, '<')                             // Replace &lt;
    .replace(/&gt;/g, '>')                             // Replace &gt;
    .replace(/&quot;/g, '"');                          // Replace &quot;

  // Split into lines
  const lines = textContent.split('\n');

  // Search each line for fish keywords
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines or very short lines
    if (trimmedLine.length < 5) continue;

    // Check if line contains any fish keyword
    const lowerLine = trimmedLine.toLowerCase();
    const foundKeywords = FISH_KEYWORDS.filter(keyword =>
      lowerLine.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length > 0) {
      // Clean up the line and add it if it's not already added
      const cleanLine = trimmedLine
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .substring(0, 200);     // Limit length

      if (!fishItems.includes(cleanLine)) {
        fishItems.push(cleanLine);
      }

      // Limit to max 5 items per restaurant
      if (fishItems.length >= 5) break;
    }
  }

  return fishItems;
}

// Optional: Set up alarm to check menus periodically
// Uncomment if you want automatic checking at a specific time
/*
chrome.alarms.create('checkMenus', {
  when: Date.now() + 1000,
  periodInMinutes: 60  // Check every hour
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMenus') {
    checkAllRestaurantMenus().then(results => {
      // Store results or send notification
      chrome.storage.local.set({
        lastResults: results,
        lastChecked: new Date().toISOString()
      });

      // Optional: Show notification if fish found
      const restaurantsWithFish = results.filter(r => r.hasFish);
      if (restaurantsWithFish.length > 0) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Missa Kala - Fish Found!',
          message: `${restaurantsWithFish.length} restaurant(s) have fish today!`
        });
      }
    });
  }
});
*/
