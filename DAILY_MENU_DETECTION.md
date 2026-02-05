# Daily Menu Detection - Finding Today's Menu

## Problem Statement

Many restaurant websites display the **entire week's menu** (Monday-Friday) on a single page, not just today's menu. The current implementation searches the entire page for fish keywords without any day-of-week awareness.

**Critical Issue:**
```
Page shows:
  Monday: Pasta Carbonara
  Tuesday: Grilled Salmon ← Fish found here!
  Wednesday: Chicken Curry
  Thursday: Beef Stew
  Friday: Caesar Salad

Today is Friday
Extension shows: "🐟 Fish found!" ← FALSE POSITIVE
Reality: No fish today
```

**Reference**: background.js:79-125 (`findFishInMenu` function)

## The Challenge

Restaurant websites structure weekly menus in various ways:

### Structure Variations

**1. Day Headers (Most Common)**
```html
<h2>Maanantai / Monday</h2>
<p>Pasta Carbonara</p>

<h2>Tiistai / Tuesday</h2>
<p>Grilled Salmon</p>
```

**2. Date Headers**
```html
<h3>4.2.2024</h3>
<div>Beef Stew</div>

<h3>5.2.2024</h3>
<div>Salmon Soup</div>
```

**3. CSS Classes**
```html
<div class="menu-item" data-day="monday">...</div>
<div class="menu-item active today" data-day="tuesday">...</div>
```

**4. Structured Tables**
```html
<table>
  <tr><td>Mon</td><td>Pasta</td></tr>
  <tr><td>Tue</td><td>Salmon</td></tr>
  <tr class="today"><td>Wed</td><td>Chicken</td></tr>
</table>
```

**5. JavaScript-Rendered Tabs**
```html
<div class="tabs">
  <button>Mon</button>
  <button class="active">Tue</button>
  ...
</div>
<div class="menu-content">Grilled Salmon</div>
```

## Solution Strategies

### Strategy 1: Smart Text Parsing (Quick Implementation)

Parse the HTML to identify sections by day and extract only today's section.

**Algorithm:**
1. Get current day of week (0=Sunday, 1=Monday, etc.)
2. Find day markers in the text (Monday, Maanantai, Mon, Ma, etc.)
3. Extract text between today's marker and the next day marker
4. Search only that section for fish keywords

**Implementation:**

```javascript
function findFishInMenu(html) {
  // Get today's day
  const today = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Try to extract today's section
  const todaySection = extractTodaySection(html, today);

  if (todaySection) {
    // Search only today's section
    return searchForFish(todaySection);
  } else {
    // Fallback: search entire page (with warning)
    console.warn('Could not identify today\'s section, searching entire page');
    return searchForFish(html);
  }
}

function extractTodaySection(html, todayDayOfWeek) {
  // Define day patterns in multiple languages
  const dayPatterns = {
    1: ['monday', 'maanantai', 'måndag', 'montag', 'ma', 'mon'],
    2: ['tuesday', 'tiistai', 'tisdag', 'dienstag', 'ti', 'tue'],
    3: ['wednesday', 'keskiviikko', 'onsdag', 'mittwoch', 'ke', 'wed'],
    4: ['thursday', 'torstai', 'torsdag', 'donnerstag', 'to', 'thu'],
    5: ['friday', 'perjantai', 'fredag', 'freitag', 'pe', 'fri'],
    6: ['saturday', 'lauantai', 'lördag', 'samstag', 'la', 'sat'],
    0: ['sunday', 'sunnuntai', 'söndag', 'sonntag', 'su', 'sun']
  };

  // Also try date-based matching
  const todayDate = new Date();
  const datePatterns = [
    todayDate.toISOString().split('T')[0], // 2024-02-04
    formatDate(todayDate, 'DD.MM.YYYY'),    // 04.02.2024
    formatDate(todayDate, 'D.M.YYYY'),      // 4.2.2024
    formatDate(todayDate, 'DD/MM/YYYY'),    // 04/02/2024
  ];

  // Clean HTML to text
  let textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  const lines = textContent.split('\n').map(l => l.trim());

  // Find today's section by day name
  const todayPatterns = dayPatterns[todayDayOfWeek] || [];
  const allDayPatterns = Object.values(dayPatterns).flat();

  let todayStartIndex = -1;
  let todayEndIndex = -1;

  // Search for today's day marker
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();

    // Check if line contains today's day
    if (todayPatterns.some(pattern =>
        lowerLine.includes(pattern) &&
        !lowerLine.includes('tomorrow') &&
        !lowerLine.includes('next')
    )) {
      todayStartIndex = i;

      // Find where today's section ends (next day marker or end)
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].toLowerCase();

        // Check if this line is another day marker
        if (allDayPatterns.some(pattern =>
            nextLine.includes(pattern) &&
            !todayPatterns.some(tp => nextLine.includes(tp))
        )) {
          todayEndIndex = j;
          break;
        }
      }

      if (todayEndIndex === -1) {
        todayEndIndex = Math.min(i + 20, lines.length); // Take next 20 lines
      }

      break;
    }
  }

  // If found by day name, return section
  if (todayStartIndex !== -1) {
    const section = lines.slice(todayStartIndex, todayEndIndex).join('\n');
    console.log('Found today\'s section by day name');
    return section;
  }

  // Try date-based matching as fallback
  for (const datePattern of datePatterns) {
    const dateIndex = textContent.toLowerCase().indexOf(datePattern.toLowerCase());
    if (dateIndex !== -1) {
      // Extract section around this date
      const sectionStart = Math.max(0, dateIndex - 50);
      const sectionEnd = Math.min(textContent.length, dateIndex + 500);
      console.log('Found today\'s section by date');
      return textContent.substring(sectionStart, sectionEnd);
    }
  }

  // Could not identify today's section
  return null;
}

function formatDate(date, format) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return format
    .replace('DD', String(day).padStart(2, '0'))
    .replace('D', String(day))
    .replace('MM', String(month).padStart(2, '0'))
    .replace('M', String(month))
    .replace('YYYY', String(year));
}

function searchForFish(text) {
  const fishItems = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length < 5) continue;

    const lowerLine = trimmedLine.toLowerCase();
    const foundKeywords = FISH_KEYWORDS.filter(keyword =>
      lowerLine.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length > 0) {
      const cleanLine = trimmedLine
        .replace(/\s+/g, ' ')
        .substring(0, 200);

      if (!fishItems.includes(cleanLine)) {
        fishItems.push(cleanLine);
      }

      if (fishItems.length >= 5) break;
    }
  }

  return fishItems;
}
```

**Pros:**
- ✅ Works with static HTML (no extra rendering needed)
- ✅ Fast execution
- ✅ Handles multiple languages
- ✅ Fallback to full-page search if day detection fails

**Cons:**
- ⚠️ May fail on unusual page structures
- ⚠️ Requires maintenance for new patterns
- ⚠️ Heuristic-based (not 100% accurate)

---

### Strategy 2: DOM-Based Parsing (More Reliable)

For JS-rendered pages, use DOM parsing inside an injected script (via a hidden tab) to find today's section.

**Implementation:**

```javascript
// In injected script (runs in page context)
function extractTodayMenu(doc) {
  const today = new Date().getDay();

  // Strategy 1: Look for elements with "today" class
  let todayElement = doc.querySelector('.today, .active, [data-today="true"]');
  if (todayElement) {
    return todayElement.innerText;
  }

  // Strategy 2: Look for highlighted/styled elements
  const allElements = doc.querySelectorAll('[class*="menu"], [class*="day"]');
  for (const el of allElements) {
    const computedStyle = window.getComputedStyle(el);
    // Check if element is visually highlighted (bold, different color, etc.)
    if (computedStyle.fontWeight === 'bold' ||
        computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      return el.innerText;
    }
  }

  // Strategy 3: Look for day headers
  const dayPatterns = getDayPatterns(today);
  const headers = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, .header, .title');

  for (let i = 0; i < headers.length; i++) {
    const headerText = headers[i].innerText.toLowerCase();

    if (dayPatterns.some(pattern => headerText.includes(pattern))) {
      // Found today's header, get content until next header
      let content = headers[i].innerText + '\n';
      let nextElement = headers[i].nextElementSibling;

      while (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
        content += nextElement.innerText + '\n';
        nextElement = nextElement.nextElementSibling;

        // Safety limit
        if (content.length > 2000) break;
      }

      return content;
    }
  }

  // Strategy 4: Look in data attributes
  const dayElements = doc.querySelectorAll('[data-day], [data-date]');
  for (const el of dayElements) {
    const dayAttr = el.getAttribute('data-day');
    const dateAttr = el.getAttribute('data-date');

    if (dayAttr && dayPatterns.some(p => dayAttr.toLowerCase().includes(p))) {
      return el.innerText;
    }

    if (dateAttr && isToday(dateAttr)) {
      return el.innerText;
    }
  }

  // Fallback: return full page
  return doc.body.innerText;
}

function isToday(dateString) {
  const today = new Date();
  const patterns = [
    today.toISOString().split('T')[0],
    `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`,
    // Add more patterns
  ];

  return patterns.some(pattern => dateString.includes(pattern));
}

function getDayPatterns(dayOfWeek) {
  const patterns = {
    1: ['monday', 'maanantai', 'måndag', 'ma', 'mon'],
    2: ['tuesday', 'tiistai', 'tisdag', 'ti', 'tue'],
    3: ['wednesday', 'keskiviikko', 'onsdag', 'ke', 'wed'],
    4: ['thursday', 'torstai', 'torsdag', 'to', 'thu'],
    5: ['friday', 'perjantai', 'fredag', 'pe', 'fri'],
    6: ['saturday', 'lauantai', 'lördag', 'la', 'sat'],
    0: ['sunday', 'sunnuntai', 'söndag', 'su', 'sun']
  };

  return patterns[dayOfWeek] || [];
}
```

**Pros:**
- ✅ More accurate than text parsing
- ✅ Can use CSS selectors and DOM structure
- ✅ Can detect visual styling (bold, colors)
- ✅ Works with complex HTML

**Cons:**
- ⚠️ Requires tab + scripting permissions
- ⚠️ Slower than simple fetch
- ⚠️ Still needs fallback handling

---

### Strategy 3: Per-Restaurant Configuration

For maximum reliability, configure day-detection strategy per restaurant.

**config.js:**
```javascript
const RESTAURANTS = [
  {
    name: "Factory Salmisaari",
    url: "https://ravintolafactory.com/lounasravintolat/ravintolat/helsinki-salmisaari/",
    enabled: true,
    dayDetection: {
      strategy: "css-selector",
      selector: ".menu-day.active",
      fallback: "day-header"
    }
  },
  {
    name: "Food & Co Ruoholahti",
    url: "https://www.compass-group.fi/en/ravintolat-ja-ruokalistat/food--co/kaupungit/helsinki/ruoholahti/",
    enabled: true,
    dayDetection: {
      strategy: "day-header",
      headerTag: "h3",
      language: "fi"
    }
  },
  {
    name: "Generic Restaurant",
    url: "https://example.com/menu",
    enabled: true,
    dayDetection: {
      strategy: "auto" // Try all strategies
    }
  }
];
```

**Pros:**
- ✅ 100% accurate for configured restaurants
- ✅ Can optimize per-site
- ✅ Clear documentation of how each site works

**Cons:**
- ⚠️ Requires manual configuration
- ⚠️ Breaks if restaurant changes site structure
- ⚠️ Not scalable to many restaurants

---

## Recommended Implementation

**Phase 1: Add Smart Text Parsing (Strategy 1)**
- Quick to implement
- Works with current fetch-based approach
- Provides immediate improvement
- Add confidence score to results

**Phase 2: Enhance with DOM Parsing (Strategy 2)**
- Implement with hidden tab extraction
- Use as primary method for JS-rendered sites
- More reliable than text parsing

**Phase 3: Add Configuration (Strategy 3 - Optional)**
- For restaurants where auto-detection fails
- Document known patterns
- Allow per-site overrides

## Testing Strategy

### Test Cases

1. **Week-long menu with day headers**
   - Verify it finds only today's section
   - Test all 7 days of week
   - Test with Finnish and English day names

2. **Date-based headers**
   - Test with various date formats (DD.MM.YYYY, YYYY-MM-DD, etc.)
   - Test timezone edge cases (midnight)

3. **CSS-styled "today" indicators**
   - Test with class="today", class="active"
   - Test with data-day attributes

4. **Single-day menus**
   - Verify still works when only today shown
   - Should not break existing functionality

5. **Unstructured pages**
   - Test fallback behavior
   - Ensure graceful degradation

### Manual Testing

For each restaurant in config:
1. Visit their menu page
2. Document HTML structure
3. Identify how they mark today's menu
4. Test extension on different days
5. Verify no false positives from other days

## Result Confidence Scoring

Add confidence score to results:

```javascript
return {
  name: restaurant.name,
  url: restaurant.url,
  hasFish: fishItems.length > 0,
  fishItems: fishItems,
  confidence: {
    dayDetection: 'high' | 'medium' | 'low' | 'unknown',
    method: 'day-header' | 'date-match' | 'css-class' | 'full-page'
  },
  error: null
};
```

Display in UI:
- 🐟 High confidence: Green
- 🐟 Medium confidence: Yellow (with warning icon)
- 🐟 Low confidence: Orange (suggest manual check)
- ⚠️ Could not detect day: Show warning

## Error Cases to Handle

1. **Weekend menus**: Some restaurants don't open on weekends
2. **Holiday menus**: Special menus on public holidays
3. **No menu today**: Restaurant closed or menu not published yet
4. **Multiple locations**: Same page shows menus for different restaurants
5. **Next week's menu**: Some sites show upcoming week on Friday

## Performance Impact

- Text parsing: +10-50ms per restaurant
- DOM parsing: +100-200ms per restaurant
- Both are acceptable for user experience

## Summary

**Current State:**
- ❌ Searches entire page
- ❌ Returns false positives from other days
- ❌ No day-of-week awareness

**With Day Detection:**
- ✅ Extracts only today's section
- ✅ Reduces false positives
- ✅ Provides confidence scores
- ✅ Fallback for unusual structures

**Priority:** HIGH - This is equally critical as the JavaScript rendering issue
