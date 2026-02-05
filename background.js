// Background service worker for Missa Kala extension

// Import config (note: in service workers, we need to use importScripts)
importScripts('config.js');

// Listen for messages from popup and offscreen document
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
    // First, try regular fetch (fast for static pages)
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

    // Parse HTML and search for fish keywords (with day detection)
    const staticResult = findFishInMenu(html);

    // Check if page looks like a SPA
    const isSPA = looksLikeSPA(html);

    // If we found fish in static HTML and page doesn't look like SPA, return result
    if (staticResult.fishItems.length > 0 && !isSPA) {
      return {
        name: restaurant.name,
        url: restaurant.url,
        hasFish: true,
        fishItems: staticResult.fishItems,
        confidence: staticResult.confidence,
        error: null
      };
    }

    // If no fish found and page looks like SPA, try JS-rendered extraction
    if (staticResult.fishItems.length === 0 && isSPA) {
      console.log(`${restaurant.name} appears to be JS-rendered, using hidden tab extraction`);

      try {
        const renderedText = await fetchRenderedPageText(restaurant.url);
        const renderedResult = findFishInText(renderedText);

        return {
          name: restaurant.name,
          url: restaurant.url,
          hasFish: renderedResult.fishItems.length > 0,
          fishItems: renderedResult.fishItems,
          confidence: renderedResult.confidence,
          error: null
        };
      } catch (renderError) {
        console.warn(`Rendered extraction failed for ${restaurant.name}:`, renderError);
        // Fall back to static result
      }
    }

    // Return static result (with confidence indicator)
    return {
      name: restaurant.name,
      url: restaurant.url,
      hasFish: staticResult.fishItems.length > 0,
      fishItems: staticResult.fishItems,
      confidence: staticResult.confidence,
      error: null
    };
  } catch (error) {
    throw error;
  }
}

// Detect if page is likely a Single Page Application
function looksLikeSPA(html) {
  const spaIndicators = [
    /<div id="root"><\/div>/,
    /<div id="app"><\/div>/,
    /<div id="__next"><\/div>/,
    /react/i,
    /vue\.js/i,
    /angular/i,
    /<script[^>]*src="[^"]*bundle/i,
    /<script[^>]*src="[^"]*app\.js/i,
    /<script[^>]*src="[^"]*main\.js/i,
    /window\.__INITIAL_STATE__/,
    /data-reactroot/,
    /ng-app/
  ];

  return spaIndicators.some(pattern => pattern.test(html));
}

function findFishInMenu(html) {
  // Remove HTML tags using regex (since DOMParser isn't available in service workers)
  let textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove style tags and content
    .replace(/<br\s*\/?>/gi, '\n')                     // Convert <br> to newlines
    .replace(/<\/div>/gi, '\n')                        // Convert </div> to newlines
    .replace(/<\/p>/gi, '\n')                          // Convert </p> to newlines
    .replace(/<\/h[1-6]>/gi, '\n')                     // Convert header endings to newlines
    .replace(/<[^>]+>/g, ' ')                          // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')                           // Replace &nbsp;
    .replace(/&amp;/g, '&')                            // Replace &amp;
    .replace(/&lt;/g, '<')                             // Replace &lt;
    .replace(/&gt;/g, '>')                             // Replace &gt;
    .replace(/&quot;/g, '"');                          // Replace &quot;

  return findFishInText(textContent);
}

function findFishInText(textContent) {
  // Try to extract today's section
  const todaySection = extractTodaySection(textContent);

  if (todaySection.success) {
    // Search only today's section
    const fishItems = searchForFish(todaySection.text);
    return {
      fishItems: fishItems,
      confidence: {
        dayDetection: 'high',
        method: todaySection.method
      }
    };
  }

  // Fallback: search entire page
  console.warn('Could not identify today\'s section, searching entire page');
  const fishItems = searchForFish(textContent);
  return {
    fishItems: fishItems,
    confidence: {
      dayDetection: 'low',
      method: 'full-page'
    }
  };
}

async function fetchRenderedPageText(url) {
  let tabId;

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    await waitForTabComplete(tabId, 10000);
    await delay(2000);

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const body = document.body;
        return body ? (body.innerText || body.textContent || '') : '';
      }
    });

    return results?.[0]?.result || '';
  } finally {
    if (tabId !== undefined) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (error) {
        console.warn('Failed to close hidden tab:', error);
      }
    }
  }
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Page load timeout'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }

    function onUpdated(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        cleanup();
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractTodaySection(text) {
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Define day patterns in multiple languages
  const dayPatterns = {
    0: ['sunday', 'sunnuntai', 'söndag', 'sonntag', 'su', 'sun'],
    1: ['monday', 'maanantai', 'måndag', 'montag', 'ma', 'mon'],
    2: ['tuesday', 'tiistai', 'tisdag', 'dienstag', 'ti', 'tue'],
    3: ['wednesday', 'keskiviikko', 'onsdag', 'mittwoch', 'ke', 'wed'],
    4: ['thursday', 'torstai', 'torsdag', 'donnerstag', 'to', 'thu'],
    5: ['friday', 'perjantai', 'fredag', 'freitag', 'pe', 'fri'],
    6: ['saturday', 'lauantai', 'lördag', 'samstag', 'la', 'sat']
  };

  const todayPatterns = dayPatterns[today] || [];
  const allDayPatterns = Object.values(dayPatterns).flat();

  // Also try date-based matching
  const todayDate = new Date();
  const datePatterns = getDatePatterns(todayDate);

  const lines = text.split('\n').map(l => l.trim());

  // Strategy 1: Find today by day name
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();

    // Check if line contains today's day
    if (todayPatterns.some(pattern =>
        lowerLine.includes(pattern) &&
        !lowerLine.includes('tomorrow') &&
        !lowerLine.includes('next')
    )) {
      // Found today's marker, extract content until next day
      let sectionLines = [lines[i]];
      let endIndex = i + 1;

      for (let j = i + 1; j < lines.length && endIndex - i < 30; j++) {
        const nextLine = lines[j].toLowerCase();

        // Stop if we hit another day marker (that's not today)
        const isOtherDay = allDayPatterns.some(pattern =>
          nextLine.includes(pattern) &&
          !todayPatterns.some(tp => nextLine.includes(tp))
        );

        if (isOtherDay) {
          break;
        }

        sectionLines.push(lines[j]);
        endIndex = j;
      }

      return {
        success: true,
        text: sectionLines.join('\n'),
        method: 'day-header'
      };
    }
  }

  // Strategy 2: Find today by date
  for (const datePattern of datePatterns) {
    const dateIndex = text.toLowerCase().indexOf(datePattern.toLowerCase());
    if (dateIndex !== -1) {
      // Extract section around this date
      const sectionStart = Math.max(0, dateIndex - 50);
      const sectionEnd = Math.min(text.length, dateIndex + 800);

      return {
        success: true,
        text: text.substring(sectionStart, sectionEnd),
        method: 'date-match'
      };
    }
  }

  // Could not identify today's section
  return {
    success: false,
    text: text,
    method: 'unknown'
  };
}

function getDatePatterns(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return [
    // ISO format
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,

    // European formats
    `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`,
    `${day}.${month}.${year}`,
    `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    `${day}/${month}/${year}`,
  ];
}

function searchForFish(text) {
  const fishItems = [];
  const lines = text.split('\n');

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
