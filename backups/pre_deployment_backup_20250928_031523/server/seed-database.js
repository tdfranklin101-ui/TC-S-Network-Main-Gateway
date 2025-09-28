/**
 * Comprehensive Value-for-Value Seed Database
 * These seeds are rotated across different locations in HTML pages
 * to keep SEO content fresh and organic while maintaining The Current-See's philosophy
 */

const SEED_DATABASE = {
  // VALUE-FOR-VALUE SEEDS: Core economic philosophy
  VALUE_FOR_VALUE: [
    "Value received = value returned = system stability",
    "Every node consumes and creates; no node is idle",
    "Price in energy reveals truth; price in fiat hides it",
    "A market is a map; fairness is the legend",
    "Value flows where attention goes",
    "Contribution begets compensation",
    "What you take, you must give back to the network",
    "Exchange creates stability; hoarding creates fragility",
    "True wealth circulates; false wealth accumulates",
    "Every transaction is a vote for the future"
  ],

  // HUMAN-AS-NODE SEEDS: Individual empowerment within the network
  HUMAN_AS_NODE: [
    "One human = one Solar = one vote of direction",
    "Consumption is not waste; it is signal",
    "Curation is computation with human context",
    "Each choice ripples through the entire network",
    "Humans don't just use networks; they are networks",
    "Individual agency scales to collective intelligence",
    "Every person is both consumer and creator",
    "Your needs teach the system how to serve everyone",
    "Human dignity encoded as daily energy",
    "Personal choice becomes planetary change"
  ],

  // SYSTEMIC TRUTH SEEDS: Fundamental principles of abundance
  SYSTEMIC_TRUTH: [
    "Scarcity is a design; abundance is physics",
    "Energy is the invariant ledger beneath currency",
    "No ledger can be larger than the sun",
    "The sun settles all accounts",
    "Physics doesn't negotiate; economics do",
    "Energy flows downhill; value flows where it's needed",
    "The universe trends toward maximum entropy and maximum creativity",
    "Information wants to be free; energy wants to be useful",
    "Complexity emerges from simplicity; abundance from efficiency",
    "The greatest truths are written in physics, not policy"
  ],

  // ANTI-CAPTURE SEEDS: Protection against centralization and ego
  ANTI_CAPTURE: [
    "No ego can be larger than the system",
    "No product can be larger than the people",
    "Checks and balances prevent checks from being balanced only upward",
    "Power distributed is power preserved",
    "When networks serve egos, egos destroy networks",
    "The moment you think you own the system, the system owns you",
    "Platforms rise when they serve users; they fall when users serve them",
    "Concentration of power is concentration of failure points",
    "True leaders make more leaders, not more followers",
    "The system that can't replace its creator will die with them"
  ],

  // FUTURES SEEDS: Vision of post-scarcity society
  FUTURES: [
    "First, provide basics. Then, unleash creation",
    "Every day, one Solar: dignity by design",
    "Daily issuance is dignity encoded as energy",
    "When survival is guaranteed, creativity flourishes",
    "Post-scarcity is pre-abundance",
    "The future measures wealth in time, not tokens",
    "Automation serves liberation, not exploitation",
    "When machines do the work, humans do the dreaming",
    "Basic income is basic dignity",
    "Universal provision enables universal creativity"
  ],

  // SHORT FRAGMENTS: Concise key concepts
  SHORT_FRAGMENTS: [
    "Universal Basic Income, Global Basic Income, Value-for-Value",
    "Solar Standard: 1 token = 4,913 kWh",
    "One Solar per human per day",
    "Solar-powered global basic income",
    "Energy-pegged exchange rate",
    "Renewable energy monetization",
    "Solar token economy",
    "Value flows where attention goes",
    "Daily dignity, solar-powered",
    "Energy abundance creates economic abundance"
  ],

  // NETWORK THEORY SEEDS: How systems self-organize
  NETWORK_THEORY: [
    "The smallest choice reroutes the largest network",
    "Networks that reward participation outcompete networks that extract value",
    "Emergence happens at the edges, not the center",
    "The most resilient networks have no single points of failure",
    "Information cascades; energy accumulates; wisdom circulates",
    "Every artifact is a footprint; every footprint is a truth",
    "The network effect multiplies value, not just connections",
    "Feedback loops create the future from the present",
    "Nodes that share become nodes that scale",
    "The whole system is smarter than its smartest part"
  ],

  // ECONOMIC PHILOSOPHY SEEDS: Deeper economic insights
  ECONOMIC_PHILOSOPHY: [
    "Economies that serve life outcompete economies that extract from it",
    "The best economy is the one you don't have to think about",
    "Efficiency without equity is entropy",
    "Markets discover value; communities create it",
    "The circular economy is the only economy that lasts",
    "Waste is a design flaw, not an inevitability",
    "True cost accounting includes the cost to the planet",
    "Sustainable prosperity requires sustainable systems",
    "The economy should serve the ecology, not replace it",
    "Regenerative systems heal as they grow"
  ]
};

/**
 * Get all seeds from all categories
 * @returns {Array} Array of all available seeds
 */
function getAllSeeds() {
  const allSeeds = [];
  Object.values(SEED_DATABASE).forEach(category => {
    allSeeds.push(...category);
  });
  return allSeeds;
}

/**
 * Get seeds from specific categories
 * @param {Array} categories - Array of category names to include
 * @returns {Array} Array of seeds from specified categories
 */
function getSeedsByCategories(categories) {
  const seeds = [];
  categories.forEach(category => {
    if (SEED_DATABASE[category]) {
      seeds.push(...SEED_DATABASE[category]);
    }
  });
  return seeds;
}

/**
 * Get a random seed from a specific category
 * @param {string} category - Category name
 * @returns {string} Random seed from the category
 */
function getRandomSeedFromCategory(category) {
  const categorySeeds = SEED_DATABASE[category];
  if (!categorySeeds || categorySeeds.length === 0) {
    return null;
  }
  return categorySeeds[Math.floor(Math.random() * categorySeeds.length)];
}

/**
 * Get multiple random seeds (ensuring no duplicates)
 * @param {number} count - Number of seeds to return
 * @param {Array} excludeCategories - Categories to exclude (optional)
 * @returns {Array} Array of unique random seeds
 */
function getRandomSeeds(count, excludeCategories = []) {
  const allSeeds = getAllSeeds();
  const filteredSeeds = excludeCategories.length > 0 
    ? allSeeds.filter(seed => {
        return !excludeCategories.some(category => 
          SEED_DATABASE[category] && SEED_DATABASE[category].includes(seed)
        );
      })
    : allSeeds;
  
  const shuffled = filteredSeeds.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get seeds optimized for specific target locations
 * @param {string} targetType - Type of target location (meta, tooltip, comment, etc.)
 * @returns {Array} Array of seeds suitable for the target type
 */
function getSeedsForTarget(targetType) {
  switch (targetType) {
    case 'meta_description':
    case 'meta_keywords':
      return getSeedsByCategories(['SHORT_FRAGMENTS', 'VALUE_FOR_VALUE']);
    
    case 'tooltip':
    case 'alt_text':
      return getSeedsByCategories(['HUMAN_AS_NODE', 'FUTURES', 'SHORT_FRAGMENTS']);
    
    case 'html_comment':
    case 'css_comment':
      return getSeedsByCategories(['SYSTEMIC_TRUTH', 'ANTI_CAPTURE', 'NETWORK_THEORY']);
    
    case 'title_variation':
      return getSeedsByCategories(['VALUE_FOR_VALUE', 'ECONOMIC_PHILOSOPHY']);
    
    default:
      return getAllSeeds();
  }
}

module.exports = {
  SEED_DATABASE,
  getAllSeeds,
  getSeedsByCategories,
  getRandomSeedFromCategory,
  getRandomSeeds,
  getSeedsForTarget
};