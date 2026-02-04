# JavaScript Rendering Solution for Missa Kala

## Problem Statement

The current implementation uses `fetch()` to retrieve HTML content, which only gets the initial server response. Modern restaurant websites often use JavaScript frameworks (React, Vue, Angular) that render menu content dynamically after page load. This means:

- ❌ `fetch()` gets: `<div id="root"></div>`
- ✅ Browser sees: Fully rendered menu with all items

## Solution Comparison

### Option 1: Offscreen Documents API (RECOMMENDED)

**Best balance of reliability and user experience**

#### How it works:
1. Create an invisible offscreen document
2. Navigate it to the restaurant URL
3. Wait for JavaScript to execute and render
4. Extract DOM content from the rendered page
5. Search for fish keywords

#### Pros:
- ✅ No visible UI changes
- ✅ Works with ANY JavaScript framework
- ✅ Sees exactly what users see
- ✅ Native Manifest V3 solution
- ✅ Can wait for specific elements to load

#### Cons:
- ⚠️ Requires `offscreen` permission
- ⚠️ Slightly slower than fetch (needs page load)
- ⚠️ More complex implementation

#### Implementation:

**1. Update manifest.json:**
```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "offscreen",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

**2. Create offscreen.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Missa Kala Offscreen</title>
</head>
<body>
  <iframe id="target-frame"></iframe>
  <script src="offscreen.js"></script>
</body>
</html>
```

**3. Create offscreen.js:**
```javascript
// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchRenderedPage') {
    fetchRenderedPage(request.url, request.keywords)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Async response
  }
});

async function fetchRenderedPage(url, keywords) {
  return new Promise((resolve, reject) => {
    const iframe = document.getElementById('target-frame');

    // Set timeout for page load
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Page load timeout'));
    }, 10000); // 10 second timeout

    function cleanup() {
      clearTimeout(timeout);
      iframe.onload = null;
      iframe.src = 'about:blank';
    }

    iframe.onload = () => {
      try {
        // Wait a bit for dynamic content to load
        setTimeout(() => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const bodyText = doc.body.innerText || doc.body.textContent;

            // Search for keywords
            const fishItems = findFishKeywords(bodyText, keywords);

            cleanup();
            resolve({
              success: true,
              text: bodyText,
              fishItems: fishItems
            });
          } catch (error) {
            cleanup();
            reject(error);
          }
        }, 2000); // Wait 2 seconds for JS to execute
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    // Load the page
    iframe.src = url;
  });
}

function findFishKeywords(text, keywords) {
  const fishItems = [];
  const lines = text.split('\n');
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      // Find lines containing this keyword
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length >= 5 &&
            trimmedLine.toLowerCase().includes(keyword.toLowerCase())) {
          const cleanLine = trimmedLine.replace(/\s+/g, ' ').substring(0, 200);
          if (!fishItems.includes(cleanLine) && fishItems.length < 5) {
            fishItems.push(cleanLine);
          }
        }
      }
    }
  }

  return fishItems;
}
```

**4. Update background.js:**
```javascript
// At the top
let offscreenDocumentCreated = false;

async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Parse restaurant menus from JavaScript-rendered pages'
    });
    offscreenDocumentCreated = true;
  } catch (error) {
    console.error('Error creating offscreen document:', error);
  }
}

async function checkRestaurantMenu(restaurant) {
  try {
    // First try regular fetch (fast for static pages)
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
    let fishItems = findFishInMenu(html);

    // If no fish found and page looks like SPA, try offscreen rendering
    if (fishItems.length === 0 && looksLikeSPA(html)) {
      console.log(`${restaurant.name} appears to be JS-rendered, using offscreen document`);

      await ensureOffscreenDocument();

      const result = await chrome.runtime.sendMessage({
        action: 'fetchRenderedPage',
        url: restaurant.url,
        keywords: FISH_KEYWORDS
      });

      if (result.success) {
        fishItems = result.fishItems;
      }
    }

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

function looksLikeSPA(html) {
  // Heuristics to detect if page is likely a SPA
  const indicators = [
    /<div id="root"><\/div>/,
    /<div id="app"><\/div>/,
    /react/i,
    /vue\.js/i,
    /angular/i,
    /<script[^>]*src="[^"]*bundle/i,
    /<script[^>]*src="[^"]*app\.js/i
  ];

  return indicators.some(pattern => pattern.test(html));
}
```

---

### Option 2: Hybrid Approach with Tab Injection

**Fallback when offscreen documents aren't suitable**

#### How it works:
1. Try `fetch()` first
2. If no keywords found, create a hidden tab
3. Inject content script to extract DOM
4. Close the tab

#### Pros:
- ✅ Works reliably
- ✅ Simpler than offscreen documents
- ✅ Can reuse existing code

#### Cons:
- ⚠️ Creates visible tabs (unless properly hidden)
- ⚠️ More resource intensive
- ⚠️ Tab management complexity

#### Implementation:

**Update manifest.json:**
```json
{
  "permissions": [
    "storage",
    "tabs",
    "scripting"
  ]
}
```

**Update background.js:**
```javascript
async function fetchWithContentScript(url, keywords) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a new tab
      const tab = await chrome.tabs.create({
        url: url,
        active: false // Don't focus the tab
      });

      // Wait for page to load
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          // Give extra time for JS to render
          setTimeout(async () => {
            try {
              // Inject script to extract content
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractPageContent,
                args: [keywords]
              });

              // Close the tab
              await chrome.tabs.remove(tab.id);

              resolve(results[0].result);
            } catch (error) {
              await chrome.tabs.remove(tab.id);
              reject(error);
            }
          }, 2000); // Wait 2 seconds
        }
      });

      // Timeout safety
      setTimeout(async () => {
        try {
          await chrome.tabs.remove(tab.id);
          reject(new Error('Timeout'));
        } catch (e) {}
      }, 15000);

    } catch (error) {
      reject(error);
    }
  });
}

// This function runs in the context of the page
function extractPageContent(keywords) {
  const bodyText = document.body.innerText || document.body.textContent;
  const fishItems = [];
  const lines = bodyText.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length < 5) continue;

    const lowerLine = trimmedLine.toLowerCase();
    const hasKeyword = keywords.some(keyword =>
      lowerLine.includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      const cleanLine = trimmedLine.replace(/\s+/g, ' ').substring(0, 200);
      if (!fishItems.includes(cleanLine) && fishItems.length < 5) {
        fishItems.push(cleanLine);
      }
    }
  }

  return { fishItems };
}
```

---

### Option 3: API Endpoint Discovery

**Most efficient but requires per-site configuration**

#### How it works:
1. Research each restaurant's website
2. Find the API endpoint they use (e.g., `/api/menu/today`)
3. Fetch JSON directly
4. Parse structured data

#### Pros:
- ✅ Extremely fast
- ✅ Most reliable
- ✅ Gets clean structured data
- ✅ No HTML parsing needed

#### Cons:
- ⚠️ Requires research for each restaurant
- ⚠️ APIs may change or require authentication
- ⚠️ Not a generic solution

#### Example:

**Update config.js:**
```javascript
const RESTAURANTS = [
  {
    name: "Factory Salmisaari",
    url: "https://ravintolafactory.com/lounasravintolat/ravintolat/helsinki-salmisaari/",
    apiUrl: "https://api.ravintolafactory.com/menu/123", // If available
    apiType: "json", // or "html"
    enabled: true
  }
];
```

---

## Recommended Implementation Strategy

**Phase 1: Hybrid Fetch + Detection**
1. Keep current `fetch()` approach
2. Add SPA detection heuristics
3. Add fallback mechanism indicator

**Phase 2: Add Offscreen Documents**
1. Implement offscreen document for detected SPAs
2. Test with known JS-rendered sites
3. Monitor performance

**Phase 3: Optimize Per-Site (Optional)**
1. Identify which restaurants need special handling
2. Research API endpoints for problematic sites
3. Add site-specific configuration

## Testing Strategy

1. **Test with static sites**: Verify `fetch()` still works
2. **Test with React sites**: Use offscreen document
3. **Test with Vue/Angular**: Verify generic solution works
4. **Performance testing**: Measure load times
5. **Error handling**: Test timeout scenarios

## Performance Considerations

| Method | Speed | Reliability | Resource Usage |
|--------|-------|-------------|----------------|
| fetch() | ~100ms | Low for SPAs | Minimal |
| Offscreen | ~3-5s | High | Medium |
| Tab injection | ~3-5s | High | High |
| API endpoint | ~100ms | Very high | Minimal |

## Conclusion

**Recommended Approach:**
- Start with **Offscreen Documents API** (Option 1)
- Use hybrid detection to avoid unnecessary overhead
- Fall back to regular fetch for static sites
- This provides the best balance of reliability and performance

The offscreen document approach is the modern Manifest V3 solution and handles all JavaScript-rendered pages without creating visible UI changes.
