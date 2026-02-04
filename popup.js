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
      card.innerHTML = `
        <div class="restaurant-name">
          <span class="status-icon">❌</span>
          <span>${result.name}</span>
        </div>
        <div class="error-message">${result.error}</div>
        <div class="restaurant-details">
          <a href="${result.url}" target="_blank">Visit website</a>
        </div>
      `;
    } else if (result.hasFish) {
      card.classList.add('has-fish');
      card.innerHTML = `
        <div class="restaurant-name">
          <span class="status-icon">🐟</span>
          <span>${result.name}</span>
          ${confidenceInfo.showWarning ? `<span class="confidence-badge" title="${confidenceInfo.tooltip}">${confidenceInfo.badge}</span>` : ''}
        </div>
        <div class="restaurant-details">
          <strong>Fish found!</strong> ${result.fishItems.length} item(s)
        </div>
        ${result.fishItems.length > 0 ? `
          <div class="fish-items">
            ${result.fishItems.map(item => `
              <div class="fish-item">${item}</div>
            `).join('')}
          </div>
        ` : ''}
        ${confidenceInfo.showWarning ? `
          <div class="confidence-warning">${confidenceInfo.warning}</div>
        ` : ''}
        <div class="restaurant-details" style="margin-top: 10px;">
          <a href="${result.url}" target="_blank">View full menu</a>
        </div>
      `;
    } else {
      card.classList.add('no-fish');
      card.innerHTML = `
        <div class="restaurant-name">
          <span class="status-icon">⚪</span>
          <span>${result.name}</span>
        </div>
        <div class="restaurant-details">No fish found in today's menu</div>
        <div class="restaurant-details">
          <a href="${result.url}" target="_blank">Check manually</a>
        </div>
      `;
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
});
