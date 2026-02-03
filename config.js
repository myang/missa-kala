// Configuration for Missa Kala - Restaurant Menu Checker

const RESTAURANTS = [
  {
    name: "Factory Salmisaari",
    url: "https://ravintolafactory.com/lounasravintolat/ravintolat/helsinki-salmisaari/",
    enabled: true
  },
  {
    name: "Factory Ruoholahti",
    url: "https://ravintolafactory.com/lounasravintolat/ravintolat/factory-ruoholahti/",
    enabled: true
  },
  {
    name: "The Local Kitchen Poijut",
    url: "https://www.compass-group.fi/en/ravintolat-ja-ruokalistat/food--co/kaupungit/helsinki/the-local-kitchen-poijut/",
    enabled: true
  },
  {
    name: "Food & Co Ruoholahti",
    url: "https://www.compass-group.fi/en/ravintolat-ja-ruokalistat/food--co/kaupungit/helsinki/ruoholahti/",
    enabled: true
  }
];

// Keywords to search for fish dishes (case-insensitive)
// Add more fish-related terms in different languages if needed
const FISH_KEYWORDS = [
  // English
  "fish", "salmon", "cod", "tuna", "trout", "halibut", "haddock", "mackerel",
  "sea bass", "sea bream", "sardine", "herring", "tilapia", "catfish",

  // Finnish (add more if needed)
  "kala", "lohi", "turska", "tonnikala", "taimen", "ahven", "kuha", "siika",
  "silakka", "silakkapihvi", "kalaruoka", "kalaviikko",

  // Generic terms
  "seafood", "fillet", "grilled fish", "baked fish", "fried fish"
];

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RESTAURANTS, FISH_KEYWORDS };
}
