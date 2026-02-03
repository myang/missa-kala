# Missa Kala Setup Guide

## Quick Start

### 1. Configure Restaurant URLs

Edit `config.js` and replace the example URLs with your actual restaurant websites:

```javascript
const RESTAURANTS = [
  {
    name: "Restaurant Name 1",
    url: "https://restaurant1.com/menu",
    enabled: true
  },
  {
    name: "Restaurant Name 2",
    url: "https://restaurant2.com/daily-menu",
    enabled: true
  },
  // Add your 4 restaurants here
];
```

### 2. Add Icons

Create or download 3 icon files and place them in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

**Quick icon creation:**
- Use [Favicon.io](https://favicon.io/favicon-generator/) to generate icons
- Use an emoji or simple design related to fish
- Or create simple colored squares as placeholders

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `missa-kala` folder
5. The extension should appear in your toolbar

### 4. Use the Extension

1. Click the Missa Kala icon in your Chrome toolbar
2. Click **"Check All Restaurants"** button
3. Wait a few seconds while it fetches all menus
4. See which restaurants have fish! 🐟

## How It Works

1. **Popup Interface** - Click the extension icon to open the popup
2. **Background Worker** - Fetches all 4 restaurant websites simultaneously
3. **Smart Detection** - Searches menu text for fish-related keywords
4. **Visual Results** - Shows green cards for restaurants with fish

## Customizing Fish Keywords

Edit `config.js` to add more fish-related terms:

```javascript
const FISH_KEYWORDS = [
  "fish", "salmon", "cod", "tuna",
  "kala", "lohi", "turska",  // Finnish
  // Add more keywords here
];
```

## Troubleshooting

### Extension doesn't load
- Make sure all icon files exist in the `icons/` folder
- Check Chrome DevTools console for errors

### "Failed to fetch menu"
- Some websites may block cross-origin requests
- Try visiting the restaurant website first in a browser tab
- Check if the URL is correct in `config.js`

### No fish detected but you see fish on the menu
- The keyword might not be in the list
- Add the specific fish name to `FISH_KEYWORDS` in `config.js`
- Some websites use images instead of text (extension can't read images)

### Results are old
- Results are cached
- Click "Check All Restaurants" again to refresh

## Advanced Features

### Automatic Daily Checks

Uncomment the alarm code in `background.js` to enable automatic checking:

```javascript
// Checks every hour and sends notification if fish found
chrome.alarms.create('checkMenus', {
  periodInMinutes: 60
});
```

### Disable Specific Restaurants

Set `enabled: false` in `config.js`:

```javascript
{
  name: "Restaurant 3",
  url: "https://example.com",
  enabled: false  // Won't be checked
}
```

## Privacy

- Extension only fetches the URLs you configure
- No data is sent to external servers
- Results are stored locally in Chrome storage
- No tracking or analytics

## Need Help?

- Check browser console for errors (F12 → Console)
- Verify restaurant URLs are accessible
- Make sure icons exist before loading extension
