# Missa Kala 🐟

A Chrome extension that checks multiple restaurant websites to find which ones have fish on today's menu.

## What It Does

**"Missa Kala"** (Finnish for "Where's the Fish?") helps you quickly find restaurants serving fish without visiting each website individually. Just click the extension icon and it checks all configured restaurants simultaneously.

## Features

- 🚀 Check multiple restaurant menus at once
- 🐟 Smart fish detection using keywords
- 🎨 Beautiful popup interface with color-coded results
- 💾 Caches results for quick access
- 🌍 Supports multiple languages (English, Finnish, easily extensible)
- ⚙️ Easy configuration via config file

## Project Structure

```
missa-kala/
├── manifest.json      # Extension configuration
├── config.js          # Restaurant URLs and fish keywords
├── background.js      # Service worker that fetches menus
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── popup.css          # Popup styles
├── icons/            # Extension icons (16, 48, 128px)
├── SETUP.md          # Detailed setup guide
└── README.md         # This file
```

## Quick Start

See **[SETUP.md](SETUP.md)** for detailed instructions.

### 1. Configure Restaurants

Edit `config.js` with your restaurant URLs:

```javascript
const RESTAURANTS = [
  {
    name: "Your Restaurant",
    url: "https://restaurant.com/menu",
    enabled: true
  }
];
```

### 2. Add Icons

Place three icon files in the `icons/` folder:
- `icon16.png`, `icon48.png`, `icon128.png`

Use [Favicon.io](https://favicon.io/) to create them quickly.

### 3. Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `missa-kala` folder

### 4. Use It!

Click the extension icon → Click "Check All Restaurants" → See results! 🎉

## How It Works

1. **Popup UI** - Simple interface opened by clicking the extension icon
2. **Background Worker** - Fetches all restaurant websites in parallel
3. **Smart Detection** - Searches page content for fish-related keywords
4. **Color-Coded Results**:
   - 🟢 Green = Fish found
   - 🟡 Yellow = No fish
   - 🔴 Red = Error fetching menu

## Customization

### Add More Fish Keywords

Edit `FISH_KEYWORDS` in `config.js`:

```javascript
const FISH_KEYWORDS = [
  "salmon", "cod", "tuna",
  "lohi", "turska",  // Finnish
  "salmón", "bacalao"  // Spanish
];
```

### Disable a Restaurant

Set `enabled: false` in `config.js`:

```javascript
{
  name: "Restaurant 3",
  url: "https://example.com",
  enabled: false
}
```

## Limitations

- Cannot detect fish in images, only text
- Some websites may block cross-origin requests
- Results depend on keyword matching accuracy
- Requires manual icon creation

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
