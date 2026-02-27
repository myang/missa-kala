function analyzeMenuWithKeywords(textContent) {
  const todaySection = extractTodaySection(textContent);

  if (todaySection.success) {
    const fishItems = searchForFish(todaySection.text);
    if (fishItems.length > 0) {
      return {
        hasFish: true,
        fishItems,
        confidence: { dayDetection: 'high', method: todaySection.method },
        analysisSource: 'keyword'
      };
    }

    const fallbackItems = searchForFish(textContent);
    if (fallbackItems.length > 0) {
      return {
        hasFish: true,
        fishItems: fallbackItems,
        confidence: { dayDetection: 'low', method: 'full-page-fallback' },
        analysisSource: 'keyword'
      };
    }

    return {
      hasFish: false,
      fishItems: [],
      confidence: { dayDetection: 'high', method: todaySection.method },
      analysisSource: 'keyword'
    };
  }

  const fishItems = searchForFish(textContent);
  return {
    hasFish: fishItems.length > 0,
    fishItems,
    confidence: { dayDetection: 'low', method: 'full-page' },
    analysisSource: 'keyword'
  };
}

function pickMoreReliableResult(staticResult, renderedResult) {
  const staticHasFish = staticResult.fishItems.length > 0;
  const renderedHasFish = renderedResult.fishItems.length > 0;
  const staticConfidence = staticResult.confidence?.dayDetection;
  const renderedConfidence = renderedResult.confidence?.dayDetection;

  if (renderedHasFish && !staticHasFish) return renderedResult;
  if (renderedConfidence === 'high' && staticConfidence !== 'high') return renderedResult;
  if (renderedHasFish && staticHasFish && renderedResult.fishItems.length >= staticResult.fishItems.length) return renderedResult;
  if (!renderedHasFish && renderedConfidence === 'high' && staticConfidence === 'low') return renderedResult;

  return staticResult;
}

function extractTodaySection(text) {
  const today = new Date().getDay();
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
  const datePatterns = getDatePatternsForWindow(new Date(), 1);
  const lines = text.split('\n').map(l => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();

    if (todayPatterns.some(pattern => lineHasDayPattern(lowerLine, pattern) && !lowerLine.includes('tomorrow') && !lowerLine.includes('next'))) {
      const sectionLines = [lines[i]];

      for (let j = i + 1; j < lines.length && j - i < 30; j++) {
        const nextLine = lines[j].toLowerCase();
        const isOtherDay = allDayPatterns.some(pattern => lineHasDayPattern(nextLine, pattern) && !todayPatterns.some(tp => lineHasDayPattern(nextLine, tp)));
        if (isOtherDay) break;
        sectionLines.push(lines[j]);
      }

      return { success: true, text: sectionLines.join('\n'), method: 'day-header' };
    }
  }

  for (const datePattern of datePatterns) {
    const dateIndex = text.toLowerCase().indexOf(datePattern.toLowerCase());
    if (dateIndex !== -1) {
      return {
        success: true,
        text: text.substring(Math.max(0, dateIndex - 50), Math.min(text.length, dateIndex + 800)),
        method: 'date-match'
      };
    }
  }

  return { success: false, text, method: 'unknown' };
}

function getDatePatternsForWindow(date, windowDays) {
  const patterns = new Set();

  for (let offset = -windowDays; offset <= windowDays; offset++) {
    const d = new Date(date);
    d.setDate(date.getDate() + offset);
    getDatePatterns(d).forEach(pattern => patterns.add(pattern));
  }

  return Array.from(patterns);
}

function getDatePatterns(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return [
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`,
    `${day}.${month}.${year}`,
    `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    `${day}/${month}/${year}`,
    `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`,
    `${day}.${month}`,
    `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`,
    `${day}.${month}.`,
    `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
    `${day}/${month}`
  ];
}

function searchForFish(text) {
  const fishItems = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length < 5) continue;
    if (isAddressLikeLine(trimmedLine)) continue;

    const lowerLine = trimmedLine.toLowerCase();
    const foundKeywords = FISH_KEYWORDS.filter(keyword => lowerLine.includes(keyword.toLowerCase()));

    if (foundKeywords.length > 0) {
      const cleanLine = trimmedLine.replace(/\s+/g, ' ').substring(0, 200);
      if (!fishItems.includes(cleanLine)) fishItems.push(cleanLine);
      if (fishItems.length >= 5) break;
    }
  }

  return fishItems;
}

function lineHasDayPattern(line, pattern) {
  if (pattern.length <= 3) {
    return new RegExp(`\\b${escapeRegExp(pattern)}\\.?\\b`).test(line);
  }
  return line.includes(pattern);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAddressLikeLine(line) {
  const lowerLine = line.toLowerCase();
  const hasFinnishStreet = /(katu|tie|kuja|polku|bulevardi|väylä)/.test(lowerLine);
  const hasOtherStreet = /\b(gatan|street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd\.)\b/.test(lowerLine);
  const hasNumber = /\b\d{1,4}[a-z]?\b/.test(lowerLine);
  const hasPostalCode = /\b\d{5}\b/.test(lowerLine);

  return ((hasFinnishStreet || hasOtherStreet) && hasNumber) || hasPostalCode;
}
