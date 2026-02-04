// Offscreen document for rendering JavaScript-heavy pages
// and extracting today's menu content

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchRenderedPage') {
    fetchRenderedPage(request.url, request.keywords)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));
    return true; // Async response
  }
});

async function fetchRenderedPage(url, keywords) {
  return new Promise((resolve, reject) => {
    const iframe = document.getElementById('target-frame');

    // Set timeout for page load
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Page load timeout (10s)'));
    }, 10000); // 10 second timeout

    function cleanup() {
      clearTimeout(timeout);
      iframe.onload = null;
      iframe.src = 'about:blank';
    }

    iframe.onload = () => {
      // Wait for dynamic content to load
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;

          if (!doc || !doc.body) {
            cleanup();
            reject(new Error('Could not access iframe document'));
            return;
          }

          // Extract today's menu section
          const todaySection = extractTodaySection(doc);
          const bodyText = todaySection || doc.body.innerText || doc.body.textContent;

          // Search for fish keywords
          const fishItems = findFishKeywords(bodyText, keywords);

          // Determine confidence
          const confidence = todaySection ? 'high' : 'low';
          const method = todaySection ? 'day-detected' : 'full-page';

          cleanup();
          resolve({
            success: true,
            text: bodyText,
            fishItems: fishItems,
            confidence: {
              dayDetection: confidence,
              method: method
            }
          });
        } catch (error) {
          cleanup();
          reject(error);
        }
      }, 2000); // Wait 2 seconds for JS to execute
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error('Failed to load page in iframe'));
    };

    // Load the page
    iframe.src = url;
  });
}

function extractTodaySection(doc) {
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Strategy 1: Look for elements with "today" class or attribute
  let todayElement = doc.querySelector('.today, .active, [data-today="true"], [data-active="true"]');
  if (todayElement) {
    console.log('Found today by CSS class/attribute');
    return todayElement.innerText;
  }

  // Strategy 2: Look for day headers and extract today's section
  const dayPatterns = getDayPatterns(today);
  const allDayPatterns = getAllDayPatterns();

  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, .header, .title, [class*="day"], [class*="date"]');

  for (let i = 0; i < headers.length; i++) {
    const headerText = headers[i].innerText?.toLowerCase() || '';

    // Check if this header contains today's day name
    if (dayPatterns.some(pattern => headerText.includes(pattern))) {
      console.log('Found today by day header:', headers[i].innerText);

      // Get content until next day header
      let content = headers[i].innerText + '\n';
      let nextElement = headers[i].nextElementSibling;

      while (nextElement) {
        const nextText = nextElement.innerText?.toLowerCase() || '';

        // Stop if we hit another day header
        if (allDayPatterns.some(pattern => nextText.includes(pattern))) {
          break;
        }

        content += nextElement.innerText + '\n';
        nextElement = nextElement.nextElementSibling;

        // Safety limit
        if (content.length > 3000) break;
      }

      return content;
    }
  }

  // Strategy 3: Look for date headers matching today
  const todayDate = new Date();
  const datePatterns = getDatePatterns(todayDate);

  const allElements = doc.querySelectorAll('*');
  for (const el of allElements) {
    const text = el.innerText?.toLowerCase() || '';

    // Check if element contains today's date
    if (datePatterns.some(pattern => text.includes(pattern.toLowerCase()))) {
      console.log('Found today by date:', el.innerText);

      // Get parent or sibling content
      let content = el.innerText + '\n';
      let parent = el.parentElement;

      if (parent) {
        content = parent.innerText;
      }

      // Limit length
      if (content.length > 3000) {
        content = content.substring(0, 3000);
      }

      return content;
    }
  }

  // Strategy 4: Look in data attributes
  const dayElements = doc.querySelectorAll('[data-day], [data-date]');
  for (const el of dayElements) {
    const dayAttr = (el.getAttribute('data-day') || '').toLowerCase();
    const dateAttr = (el.getAttribute('data-date') || '').toLowerCase();

    if (dayPatterns.some(p => dayAttr.includes(p))) {
      console.log('Found today by data-day attribute');
      return el.innerText;
    }

    if (datePatterns.some(p => dateAttr.includes(p.toLowerCase()))) {
      console.log('Found today by data-date attribute');
      return el.innerText;
    }
  }

  // Could not identify today's section
  console.warn('Could not identify today\'s section, using full page');
  return null;
}

function getDayPatterns(dayOfWeek) {
  const patterns = {
    0: ['sunday', 'sunnuntai', 'söndag', 'sonntag', 'su', 'sun'],
    1: ['monday', 'maanantai', 'måndag', 'montag', 'ma', 'mon'],
    2: ['tuesday', 'tiistai', 'tisdag', 'dienstag', 'ti', 'tue'],
    3: ['wednesday', 'keskiviikko', 'onsdag', 'mittwoch', 'ke', 'wed'],
    4: ['thursday', 'torstai', 'torsdag', 'donnerstag', 'to', 'thu'],
    5: ['friday', 'perjantai', 'fredag', 'freitag', 'pe', 'fri'],
    6: ['saturday', 'lauantai', 'lördag', 'samstag', 'la', 'sat']
  };

  return patterns[dayOfWeek] || [];
}

function getAllDayPatterns() {
  const allPatterns = [];
  for (let i = 0; i <= 6; i++) {
    allPatterns.push(...getDayPatterns(i));
  }
  return allPatterns;
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

    // Month names (English)
    `${day} ${getMonthName(month, 'en')}`,
    `${getMonthName(month, 'en')} ${day}`,

    // Month names (Finnish)
    `${day}. ${getMonthName(month, 'fi')}`,
    `${getMonthName(month, 'fi')} ${day}`,
  ];
}

function getMonthName(month, lang) {
  const months = {
    en: ['january', 'february', 'march', 'april', 'may', 'june',
         'july', 'august', 'september', 'october', 'november', 'december'],
    fi: ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu',
         'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu']
  };

  return months[lang]?.[month - 1] || '';
}

function findFishKeywords(text, keywords) {
  const fishItems = [];
  const lines = text.split('\n');
  const lowerText = text.toLowerCase();

  // First check if any keyword exists
  let hasAnyFish = false;
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      hasAnyFish = true;
      break;
    }
  }

  if (!hasAnyFish) {
    return [];
  }

  // Find lines containing fish keywords
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty or very short lines
    if (trimmedLine.length < 5) continue;

    const lowerLine = trimmedLine.toLowerCase();
    const hasKeyword = keywords.some(keyword =>
      lowerLine.includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      // Clean up the line
      const cleanLine = trimmedLine
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .substring(0, 200);     // Limit length

      // Avoid duplicates
      if (!fishItems.includes(cleanLine) && fishItems.length < 5) {
        fishItems.push(cleanLine);
      }

      // Limit to max 5 items
      if (fishItems.length >= 5) break;
    }
  }

  return fishItems;
}
