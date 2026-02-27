async function fetchStaticPageData(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const text = stripHtmlForHeuristics(html);

  return {
    html,
    text,
    isSpaLike: looksLikeSPA(html)
  };
}

function shouldUseRenderedFallback(html, heuristicResult) {
  const plainText = stripHtmlForHeuristics(html);
  const plainTextLength = plainText.length;
  const lowConfidence = heuristicResult.confidence?.dayDetection !== 'high';

  if (looksLikeSPA(html)) return true;
  if (isLikelyShellHtml(html, plainText)) return true;
  if (plainTextLength < 250) return true;

  return lowConfidence;
}

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

function isLikelyShellHtml(html, plainText) {
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const divCount = (html.match(/<div\b/gi) || []).length;
  const textDensity = plainText.length / Math.max(html.length, 1);

  return (scriptCount >= 8 && textDensity < 0.08) || (divCount >= 40 && plainText.length < 600);
}

function stripHtmlForHeuristics(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRenderedPageText(url) {
  let tabId;

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    await waitForTabComplete(tabId, 12000);
    let bestText = '';
    const attempts = 4;

    for (let attempt = 0; attempt < attempts; attempt++) {
      await delay(attempt === 0 ? 1800 : 1200);

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractVisibleTextFromPage
      });

      const text = results?.[0]?.result || '';
      if (text.length > bestText.length) bestText = text;

      if (bestText.length >= 450) return bestText;
    }

    return bestText;
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

function extractVisibleTextFromPage() {
  function collectText(node) {
    if (!node) return '';
    let text = '';

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return '';
    }

    const element = node;
    if (element.tagName && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) {
      return '';
    }

    for (const child of element.childNodes || []) {
      text += collectText(child);
      if (child.nodeType === Node.ELEMENT_NODE && ['DIV', 'P', 'LI', 'TR', 'SECTION', 'ARTICLE', 'BR', 'H1', 'H2', 'H3', 'H4'].includes(child.tagName)) {
        text += '\n';
      }
    }

    if (element.shadowRoot) {
      text += '\n' + collectText(element.shadowRoot) + '\n';
    }

    return text;
  }

  const bodyText = document.body ? (document.body.innerText || document.body.textContent || '') : '';
  const deepText = collectText(document.body || document.documentElement);

  return `${bodyText}\n${deepText}`.replace(/\n{3,}/g, '\n\n').trim();
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

    chrome.tabs.get(tabId).then(tab => {
      if (tab?.status === 'complete') {
        cleanup();
        resolve();
      }
    }).catch(error => {
      cleanup();
      reject(error);
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
