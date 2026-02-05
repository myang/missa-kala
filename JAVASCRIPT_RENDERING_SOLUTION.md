# JavaScript Rendering Solution for Missa Kala

## Problem Statement

The current implementation uses `fetch()` to retrieve HTML content, which only gets the initial server response. Modern restaurant websites often use JavaScript frameworks (React, Vue, Angular) that render menu content dynamically after page load. This means:

- ❌ `fetch()` gets: `<div id="root"></div>`
- ✅ Browser sees: Fully rendered menu with all items

## Solution Comparison

### Option 1: Hidden Tab + Script Injection (RECOMMENDED)

**Best balance of reliability and practical cross‑origin access**

#### How it works:
1. Try `fetch()` first for fast static pages
2. If no results and the page looks like a SPA, open a hidden tab
3. Wait for the page to fully render
4. Inject a script to extract `document.body.innerText`
5. Close the tab and search for fish keywords

#### Pros:
- ✅ Works with ANY JavaScript framework
- ✅ Sees exactly what users see
- ✅ Works on arbitrary external sites
- ✅ No offscreen documents required

#### Cons:
- ⚠️ Requires `tabs` + `scripting` permissions
- ⚠️ Slightly slower than fetch (needs page load)
- ⚠️ Tab management complexity

#### Implementation:

**1. Update manifest.json:**
```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "tabs",
    "scripting"
  ],
  "host_permissions": [
    "https://ravintolafactory.com/*",
    "https://www.compass-group.fi/*"
  ],
  "optional_host_permissions": [
    "<all_urls>"
  ]
}
```

**2. Update background.js:**
```javascript
async function fetchRenderedPageText(url) {
  const tab = await chrome.tabs.create({ url, active: false });

  await waitForTabComplete(tab.id, 10000);
  await delay(2000);

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const body = document.body;
      return body ? (body.innerText || body.textContent || '') : '';
    }
  });

  await chrome.tabs.remove(tab.id);
  return results?.[0]?.result || '';
}
```

**3. Use it as a fallback after `fetch()` and SPA detection:**
```javascript
if (staticResult.fishItems.length === 0 && looksLikeSPA(html)) {
  const renderedText = await fetchRenderedPageText(restaurant.url);
  const renderedResult = findFishInText(renderedText);
  // return renderedResult
}
```

---

### Option 2: API Endpoint Discovery

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

**Phase 2: Add Hidden Tab Extraction**
1. Implement tab-based extraction for detected SPAs
2. Test with known JS-rendered sites
3. Monitor performance

**Phase 3: Optimize Per-Site (Optional)**
1. Identify which restaurants need special handling
2. Research API endpoints for problematic sites
3. Add site-specific configuration

## Testing Strategy

1. **Test with static sites**: Verify `fetch()` still works
2. **Test with React sites**: Use hidden tab extraction
3. **Test with Vue/Angular**: Verify generic solution works
4. **Performance testing**: Measure load times
5. **Error handling**: Test timeout scenarios

## Performance Considerations

| Method | Speed | Reliability | Resource Usage |
|--------|-------|-------------|----------------|
| fetch() | ~100ms | Low for SPAs | Minimal |
| Hidden tab + scripting | ~3-5s | High | High |
| API endpoint | ~100ms | Very high | Minimal |

## Conclusion

**Recommended Approach:**
- Start with **Hidden Tab + Script Injection** (Option 1)
- Use hybrid detection to avoid unnecessary overhead
- Fall back to regular fetch for static sites
- This provides the best balance of reliability and performance for arbitrary external sites.
