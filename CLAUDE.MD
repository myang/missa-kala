# CLAUDE.MD - AI Assistant Guide

## Project Overview

**Missa Kala** (Finnish: "Where's the Fish?") is a Chrome extension that checks multiple restaurant websites simultaneously to find which ones have fish on today's menu. It's a Manifest V3 extension built with vanilla JavaScript.

## Architecture

### Core Components

1. **manifest.json** - Extension configuration (Manifest V3)
2. **config.js** - Restaurant URLs and fish keyword configuration
3. **background.js** - Service worker handling menu fetching and caching
4. **popup.html/js/css** - User interface for displaying results
5. **icons/** - Extension icons in three sizes (16, 48, 128px)

### Data Flow

```
User clicks extension icon
    ↓
popup.js loads cached results
    ↓
User clicks "Check All Restaurants"
    ↓
popup.js sends message to background.js
    ↓
background.js fetches all restaurant URLs in parallel
    ↓
Searches HTML content for fish keywords
    ↓
Caches results with timestamp
    ↓
Sends results back to popup
    ↓
popup.js displays color-coded results
```

## Key Files Explained

### config.js
- **RESTAURANTS**: Array of restaurant objects with `name`, `url`, and `enabled` flag
- **FISH_KEYWORDS**: Array of fish-related keywords in multiple languages
- Simple ES6 module pattern

### background.js
- Service worker (runs in background)
- Handles message passing from popup
- Implements parallel fetching with `Promise.all()`
- Caches results in chrome.storage.local
- CORS handling via fetch API

### popup.js
- Manages popup UI state
- Communicates with background worker via chrome.runtime.sendMessage
- Updates UI based on results (green/yellow/red indicators)
- Handles cache display and refresh

## Development Guidelines

### Code Style
- Vanilla JavaScript (no frameworks)
- ES6+ syntax (arrow functions, const/let, async/await)
- Clear variable naming (UPPER_CASE for constants)
- Comments for complex logic

### Chrome Extension Patterns
- Uses Manifest V3 (service workers, not background pages)
- Message passing between popup and background
- chrome.storage.local for persistent data
- host_permissions for cross-origin fetching

### Testing Approach
Manual testing workflow:
1. Load unpacked extension in Chrome
2. Click extension icon to open popup
3. Click "Check All Restaurants" button
4. Verify results display correctly
5. Check console for errors (F12 in popup)
6. Inspect background worker logs (chrome://extensions → Inspect views)

## Common Tasks

### Adding a New Restaurant
Edit `config.js`:
```javascript
{
  name: "Restaurant Name",
  url: "https://restaurant.com/menu",
  enabled: true
}
```

### Adding Fish Keywords
Edit `FISH_KEYWORDS` in `config.js`:
```javascript
const FISH_KEYWORDS = [
  "fish", "salmon", "cod",
  "kala", "lohi", "turska"  // Finnish
];
```

### Debugging
- Popup console: Right-click popup → Inspect
- Background worker: chrome://extensions → Inspect views: service worker
- Check chrome.storage: background.js console → `chrome.storage.local.get(console.log)`

### Updating Icons
Replace files in `icons/` folder:
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

Use tools like [Favicon.io](https://favicon.io/) for generation.

## Important Constraints

### ⚠️ JavaScript Rendering Limitation (CRITICAL)
**This is the biggest limitation of the current implementation.**

- Current approach uses `fetch()` which only gets initial HTML
- **JavaScript-rendered pages (React/Vue/Angular) will fail to detect fish**
- If a restaurant uses a Single Page Application (SPA), the menu content is rendered by JavaScript AFTER page load
- `fetch()` sees: `<div id="root"></div>` (empty container)
- Browser sees: Full menu with all fish items
- **Result**: False negatives - shows "No fish" when fish is actually on the menu

**Affected Sites**: Any restaurant using modern JavaScript frameworks (increasingly common)
**Solution**: See `JAVASCRIPT_RENDERING_SOLUTION.md` for implementation options

### CORS Limitations
- Some websites block cross-origin requests
- Extension uses `host_permissions: ["<all_urls>"]` to bypass most restrictions
- If a site blocks: Result shows as "Error fetching menu" (red)

### Detection Limitations
- Only searches text content, not images
- Keyword-based (not AI/NLP)
- May have false positives/negatives
- Case-insensitive search using `.toLowerCase()`
- **Cannot detect dynamically rendered content** (see JavaScript limitation above)

### Performance
- All restaurants checked in parallel (not sequential)
- Results cached with timestamp
- No rate limiting implemented
- Cache expiry handled manually by user

## Code Patterns

### Message Passing
```javascript
// popup.js
chrome.runtime.sendMessage({action: "checkRestaurants"}, response => {
  // handle response
});

// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkRestaurants") {
    // process and sendResponse()
  }
});
```

### Fetch Pattern
```javascript
const response = await fetch(url);
const html = await response.text();
const hasMatch = FISH_KEYWORDS.some(keyword =>
  html.toLowerCase().includes(keyword.toLowerCase())
);
```

### Storage Pattern
```javascript
// Save
chrome.storage.local.set({key: value});

// Load
chrome.storage.local.get(['key'], result => {
  const value = result.key;
});
```

## Known Issues & Future Improvements

### Critical Issues

#### ⚠️ JavaScript-Rendered Pages Not Supported
**THE BIGGEST LIMITATION**: The current implementation uses `fetch()` which only retrieves the initial HTML. Modern restaurant websites often use React, Vue, or Angular, where menu content is rendered by JavaScript AFTER the page loads. This means:

- `fetch()` gets: `<div id="root"></div>` (empty)
- Browser shows: Full menu with all items

**Impact**: Extension will show "No fish found" even when fish is on the menu if the restaurant uses a JavaScript framework.

**Solution**: See `JAVASCRIPT_RENDERING_SOLUTION.md` for detailed implementation options:
1. **Offscreen Documents API** (recommended) - Creates invisible iframe to render JS
2. **Tab Injection** - Opens hidden tabs with content scripts
3. **API Discovery** - Direct API calls (requires per-site configuration)

**Reference**: background.js:51-62 (current fetch implementation)

### Current Limitations
- ❌ **JavaScript-rendered pages fail** (see above - CRITICAL)
- No error retry logic
- No timeout handling for slow sites
- No rate limiting (could spam servers)
- No notification system
- Icons must be manually created

### Potential Enhancements
- 🔥 **FIX: Implement offscreen documents for JS-rendered pages** (HIGH PRIORITY)
- Add popup notifications when fish is found
- Implement retry logic with exponential backoff
- Add loading indicators per restaurant
- Support for scheduled checks
- Export results to CSV/JSON
- Advanced keyword configuration (regex support)
- Multi-language UI
- Settings page for configuration
- Per-restaurant rendering strategy configuration

## Extension Publishing

Not currently published to Chrome Web Store. To distribute:
1. Update version in manifest.json
2. Test thoroughly
3. Create .zip of project folder
4. Submit to Chrome Web Store Developer Dashboard
5. Follow Chrome Web Store policies

## Security Considerations

- Uses `host_permissions: ["<all_urls>"]` - very permissive
- No user data collection
- No external API calls
- All processing happens locally
- No analytics or tracking

## File Structure Reference

```
missa-kala/
├── manifest.json                        # Extension metadata & permissions
├── config.js                            # User configuration
├── background.js                        # Service worker (menu fetching)
├── popup.html                           # Popup UI structure
├── popup.js                             # Popup logic & event handlers
├── popup.css                            # Popup styling
├── icons/
│   ├── icon16.png                      # Toolbar icon
│   ├── icon48.png                      # Extension management
│   └── icon128.png                     # Chrome Web Store
├── screenshot/                          # For documentation
├── README.md                            # User-facing documentation
├── SETUP.md                             # Detailed setup guide
├── CLAUDE.MD                            # This file - AI assistant guide
└── JAVASCRIPT_RENDERING_SOLUTION.md     # Solution for JS-rendered pages
```

## AI Assistant Notes

When working on this project:
- Always test changes by reloading the extension (chrome://extensions)
- Check both popup console and background worker console
- Be careful with CORS issues - not all websites can be fetched
- Keep configuration in config.js (don't hardcode)
- Maintain Manifest V3 compliance (no eval, inline scripts)
- Preserve the simple, lightweight nature of the extension
- Follow existing code style and patterns

## Questions to Ask User

If implementing new features, confirm:
- Should this work for all restaurants or be configurable?
- Should results be cached? For how long?
- Are there specific error handling requirements?
- Should there be user notifications?
- Are there performance constraints?

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
