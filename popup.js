// Popup script for Missa Kala extension

document.addEventListener('DOMContentLoaded', function() {
  const checkButton = document.getElementById('checkMenus');
  const loading = document.getElementById('loading');
  const resultsContainer = document.getElementById('results');
  const lastCheckedElement = document.getElementById('lastChecked');

  // Show initial empty state
  showEmptyState();

  // Check menus when button is clicked
  checkButton.addEventListener('click', checkAllMenus);

  // Load cached results if available
  loadCachedResults();

  async function checkAllMenus() {
    // Disable button and show loading
    checkButton.disabled = true;
    loading.classList.remove('hidden');
    resultsContainer.innerHTML = '';

    try {
      const hasPermissions = await ensureHostPermissions();
      if (!hasPermissions) {
        showError('Missing permissions to access restaurant sites. Please allow access and try again.');
        return;
      }

      // Send message to background script to check menus
      const response = await chrome.runtime.sendMessage({ action: 'checkMenus' });

      if (response && response.results) {
        displayResults(response.results);
        updateTimestamp();

        // Cache results
        chrome.storage.local.set({
          lastResults: response.results,
          lastChecked: new Date().toISOString()
        });
      } else {
        showError('Failed to check menus. Please try again.');
      }
    } catch (error) {
      console.error('Error checking menus:', error);
      showError('An error occurred. Please try again.');
    } finally {
      checkButton.disabled = false;
      loading.classList.add('hidden');
    }
  }

  function displayResults(results) {
    resultsContainer.innerHTML = '';

    if (!results || results.length === 0) {
      showEmptyState();
      return;
    }

    // Sort results: fish first, then no fish, then errors
    const sorted = [...results].sort((a, b) => {
      if (a.hasFish && !b.hasFish) return -1;
      if (!a.hasFish && b.hasFish) return 1;
      return 0;
    });

    sorted.forEach(result => {
      const card = createRestaurantCard(result);
      resultsContainer.appendChild(card);
    });
  }

  function createRestaurantCard(result) {
    const card = document.createElement('div');
    card.className = 'restaurant-card';

    // Get confidence info
    const confidence = result.confidence || { dayDetection: 'unknown', method: 'unknown' };
    const confidenceInfo = getConfidenceInfo(confidence);

    if (result.error) {
      card.classList.add('error');
      const nameRow = createNameRow('❌', result.name);
      const errorMessage = createEl('div', 'error-message', result.error || 'Unknown error');
      const details = createEl('div', 'restaurant-details');
      details.appendChild(createLink(result.url, 'Visit website'));

      card.appendChild(nameRow);
      card.appendChild(errorMessage);
      card.appendChild(details);
    } else if (result.hasFish) {
      card.classList.add('has-fish');
      const nameRow = createNameRow('🐟', result.name);
      if (confidenceInfo.showWarning) {
        const badge = createEl('span', 'confidence-badge', confidenceInfo.badge);
        badge.title = confidenceInfo.tooltip;
        nameRow.appendChild(badge);
      }

      const details = createEl('div', 'restaurant-details');
      const strong = document.createElement('strong');
      strong.textContent = 'Fish found!';
      details.appendChild(strong);
      details.appendChild(document.createTextNode(` ${result.fishItems.length} item(s)`));

      card.appendChild(nameRow);
      card.appendChild(details);

      if (Array.isArray(result.fishItems) && result.fishItems.length > 0) {
        const items = createEl('div', 'fish-items');
        result.fishItems.forEach(item => {
          items.appendChild(createEl('div', 'fish-item', item));
        });
        card.appendChild(items);
      }

      if (confidenceInfo.showWarning) {
        card.appendChild(createEl('div', 'confidence-warning', confidenceInfo.warning));
      }

      const linkDetails = createEl('div', 'restaurant-details');
      linkDetails.style.marginTop = '10px';
      linkDetails.appendChild(createLink(result.url, 'View full menu'));
      card.appendChild(linkDetails);
    } else {
      card.classList.add('no-fish');
      const nameRow = createNameRow('⚪', result.name);
      const details = createEl('div', 'restaurant-details', 'No fish found in today\'s menu');
      const linkDetails = createEl('div', 'restaurant-details');
      linkDetails.appendChild(createLink(result.url, 'Check manually'));

      card.appendChild(nameRow);
      card.appendChild(details);
      card.appendChild(linkDetails);
    }

    return card;
  }

  function getConfidenceInfo(confidence) {
    const dayDetection = confidence.dayDetection || 'unknown';
    const method = confidence.method || 'unknown';

    if (dayDetection === 'high') {
      return {
        showWarning: false,
        badge: '',
        tooltip: '',
        warning: ''
      };
    } else if (dayDetection === 'low' || dayDetection === 'unknown') {
      return {
        showWarning: true,
        badge: '⚠️',
        tooltip: 'Could not detect today\'s menu - result may include other days',
        warning: '⚠️ Could not detect today\'s menu. Please verify manually.'
      };
    } else {
      return {
        showWarning: false,
        badge: '',
        tooltip: '',
        warning: ''
      };
    }
  }

  function showEmptyState() {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p>👆 Click the button above to check which restaurants have fish on today's menu.</p>
        <p style="font-size: 12px; margin-top: 20px;">Make sure to configure restaurant URLs in <code>config.js</code></p>
      </div>
    `;
  }

  function showError(message) {
    resultsContainer.innerHTML = `
      <div class="restaurant-card error">
        <div class="restaurant-name">
          <span class="status-icon">❌</span>
          <span>Error</span>
        </div>
        <div class="error-message">${message}</div>
      </div>
    `;
  }

  function updateTimestamp() {
    const now = new Date();
    lastCheckedElement.textContent = `Last checked: ${now.toLocaleTimeString()}`;
  }

  async function loadCachedResults() {
    try {
      const data = await chrome.storage.local.get(['lastResults', 'lastChecked']);

      if (data.lastResults) {
        displayResults(data.lastResults);
      }

      if (data.lastChecked) {
        const lastCheck = new Date(data.lastChecked);
        lastCheckedElement.textContent = `Last checked: ${lastCheck.toLocaleTimeString()}`;
      }
    } catch (error) {
      console.error('Error loading cached results:', error);
    }
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function createNameRow(icon, name) {
    const row = createEl('div', 'restaurant-name');
    row.appendChild(createEl('span', 'status-icon', icon));
    row.appendChild(createEl('span', '', name || 'Unknown'));
    return row;
  }

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function createLink(url, label) {
    const link = document.createElement('a');
    link.textContent = label;
    const safeUrl = normalizeUrl(url);
    if (safeUrl) {
      link.href = safeUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.href = '#';
      link.addEventListener('click', event => event.preventDefault());
    }
    return link;
  }

  function getRestaurantOrigins() {
    if (typeof RESTAURANTS === 'undefined') return [];

    const origins = new Set();
    for (const restaurant of RESTAURANTS) {
      if (!restaurant || !restaurant.enabled || !restaurant.url) continue;
      const safeUrl = normalizeUrl(restaurant.url);
      if (!safeUrl) continue;
      const origin = new URL(safeUrl).origin;
      origins.add(`${origin}/*`);
    }

    return Array.from(origins);
  }

  async function ensureHostPermissions() {
    try {
      const origins = getRestaurantOrigins();
      if (origins.length === 0) return true;

      const missing = [];
      for (const origin of origins) {
        const granted = await chrome.permissions.contains({ origins: [origin] });
        if (!granted) missing.push(origin);
      }

      if (missing.length === 0) return true;
      return await chrome.permissions.request({ origins: missing });
    } catch (error) {
      console.error('Error requesting host permissions:', error);
      return false;
    }
  }
});
