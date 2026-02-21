const OFFICIAL_CATEGORIES = [
  'Computronium', 'Culture', 'Basic Needs', 'Rent', 'Energy',
  'Music', 'Songs', 'Video', 'Videos', 'Art', 'Photo',
  'Writing', 'AI Tools', 'AI Create', 'Software', 'Docs',
  'Games', 'Utilities', 'Education', '3D Printing', 'Health & Wellness',
  'Community'
];

const CATEGORY_MAP = {
  'Basic Needs': { category: 'Basic Needs', subcategory: null },
  'Games': { category: 'Games', subcategory: null },
  'Computronium': { category: 'Computronium', subcategory: null },
  'Education': { category: 'Education', subcategory: null },
  'Video': { category: 'Video', subcategory: null },
  'Videos': { category: 'Videos', subcategory: null },
  'Music': { category: 'Music', subcategory: null },
  'AI Tools': { category: 'AI Tools', subcategory: null },
  'Energy': { category: 'Energy', subcategory: null },
  'AI Create': { category: 'AI Create', subcategory: null },
  'Culture': { category: 'Culture', subcategory: null },
  'Writing': { category: 'Writing', subcategory: null },
  'Rent': { category: 'Rent', subcategory: null },
  'Utilities': { category: 'Utilities', subcategory: null },
  'Photo': { category: 'Photo', subcategory: null },
  '3D Printing': { category: '3D Printing', subcategory: null },
  'Software': { category: 'Software', subcategory: null },
  'Art': { category: 'Art', subcategory: null },
  'Health & Wellness': { category: 'Health & Wellness', subcategory: null },
  'Docs': { category: 'Docs', subcategory: null },
  'Songs': { category: 'Songs', subcategory: null },
  'Community': { category: 'Community', subcategory: null },

  'utilities': { category: 'Utilities', subcategory: null },
  'games': { category: 'Games', subcategory: null },
  'education': { category: 'Education', subcategory: null },
  'video': { category: 'Video', subcategory: null },
  'videos': { category: 'Videos', subcategory: null },
  'writing': { category: 'Writing', subcategory: null },
  'art': { category: 'Art', subcategory: null },
  'arts': { category: 'Art', subcategory: null },
  'culture': { category: 'Culture', subcategory: null },
  'music': { category: 'Music', subcategory: null },
  'health-and-wellness': { category: 'Health & Wellness', subcategory: null },

  'Creative & Media': { category: 'Art', subcategory: 'Creative & Media' },
  'creative & media': { category: 'Art', subcategory: 'Creative & Media' },
  'ai-tools': { category: 'AI Tools', subcategory: null },
  'productivity': { category: 'Utilities', subcategory: 'Productivity' },
  'Digital Art': { category: 'Art', subcategory: 'Digital Art' },
  'Community Resources': { category: 'Community', subcategory: 'Community Resources' },
  'Digital Assets': { category: 'Software', subcategory: 'Digital Assets' },
  'real-estate': { category: 'Rent', subcategory: 'Real Estate' },
  'AI & Machine Learning': { category: 'AI Tools', subcategory: 'AI & Machine Learning' },
  'Audio & Music': { category: 'Songs', subcategory: 'Audio & Music' },
  'Community Support': { category: 'Community', subcategory: 'Community Support' },
  'Photography': { category: 'Photo', subcategory: 'Photography' },
  'Digital Art & Design': { category: 'Art', subcategory: 'Digital Art & Design' },
  'Videos': { category: 'Videos', subcategory: null },
  'Art & Design': { category: 'Art', subcategory: 'Art & Design' },
  'Graphics & Design': { category: 'Art', subcategory: 'Graphics & Design' },
  'Community & Sustainability': { category: 'Community', subcategory: 'Community & Sustainability' },
  'Graphic Design': { category: 'Art', subcategory: 'Graphic Design' },
  'creative-tools': { category: 'AI Create', subcategory: 'Creative Tools' },
  'System Monitoring Tools': { category: 'Utilities', subcategory: 'System Monitoring Tools' },
  'Art & Culture': { category: 'Art', subcategory: 'Art & Culture' },
  'Computronium Polymath': { category: 'Computronium', subcategory: 'Computronium Polymath' },
  'Software Development': { category: 'Software', subcategory: 'Software Development' },
  'Orchestrator': { category: 'Computronium', subcategory: 'Orchestrator' },
  'Community Support / Basic Needs': { category: 'Community', subcategory: null },
  'Education & Training': { category: 'Education', subcategory: 'Education & Training' },
  'Digital Goods': { category: 'Software', subcategory: 'Digital Goods' },
  'Development Tools': { category: 'Software', subcategory: 'Development Tools' },
  'Creative Tools': { category: 'AI Create', subcategory: 'Creative Tools' },
  'Basic Needs / Community Support': { category: 'Basic Needs', subcategory: null },
  'Music & Sound Effects': { category: 'Songs', subcategory: 'Sound Effects' },
  'Digital Art & Graphics': { category: 'Art', subcategory: 'Digital Art & Graphics' },
  'Networking Tools': { category: 'Utilities', subcategory: 'Networking Tools' },
  'Health & Nutrition': { category: 'Health & Wellness', subcategory: 'Health & Nutrition' },
  'Public Goods': { category: 'Community', subcategory: 'Public Goods' },
  'Community Health & Wellness': { category: 'Health & Wellness', subcategory: 'Community Health & Wellness' },
  'Games & Entertainment': { category: 'Games', subcategory: 'Games & Entertainment' },
  'AI Tools & Frameworks': { category: 'AI Tools', subcategory: 'AI Tools & Frameworks' },
  'Solar Technology': { category: 'Energy', subcategory: 'Solar Technology' },
  'Public Goods / Community Resources': { category: 'Community', subcategory: 'Public Goods' },
  'community-development': { category: 'Community', subcategory: 'Community Development' },
  'Music & Audio': { category: 'Songs', subcategory: 'Music & Audio' },
  'community-sustainability': { category: 'Community', subcategory: 'Sustainability' },
  'Basic Needs & Community Resources': { category: 'Basic Needs', subcategory: null },
  'Photography & Digital Art': { category: 'Photo', subcategory: 'Photography & Digital Art' },
  'Community Development': { category: 'Community', subcategory: 'Community Development' },
  'Art & Photography': { category: 'Art', subcategory: 'Art & Photography' },
  'community-support': { category: 'Community', subcategory: 'Community Support' },
  'Public Goods / Basic Needs': { category: 'Basic Needs', subcategory: 'Public Goods' },
  'Creative Assets': { category: 'Art', subcategory: 'Creative Assets' },
  'Public Goods / Community Support': { category: 'Community', subcategory: 'Public Goods' },
  'IoT Solutions': { category: 'Software', subcategory: 'IoT Solutions' },
  'Transportation': { category: 'Rent', subcategory: 'Transportation' },
  'housing': { category: 'Rent', subcategory: 'Housing' },
  'Sustainable Goods': { category: 'Community', subcategory: 'Sustainable Goods' },
  'Sustainable Living': { category: 'Community', subcategory: 'Sustainable Living' },
  'Educational Resources': { category: 'Education', subcategory: 'Educational Resources' },
  'Gaming Assets': { category: 'Games', subcategory: 'Gaming Assets' },
  'Gaming & Development': { category: 'Games', subcategory: 'Gaming & Development' },

  'Data Visualization Tools': { category: 'Software', subcategory: 'Data Visualization' },
  'Audio': { category: 'Songs', subcategory: 'Audio' },
  'Sustainability & Environment': { category: 'Community', subcategory: 'Sustainability & Environment' },
  'Safety & Emergency Preparedness': { category: 'Health & Wellness', subcategory: 'Safety & Emergency Preparedness' },
  'Real Estate Management': { category: 'Rent', subcategory: 'Real Estate Management' },
  'Gaming Community Resources': { category: 'Games', subcategory: 'Gaming Community Resources' },
  'housing, rental, utilities': { category: 'Rent', subcategory: 'Housing & Rental' },
  'Safety & Community Resources': { category: 'Community', subcategory: 'Safety & Community Resources' },
  'Digital Art Publications': { category: 'Art', subcategory: 'Digital Art Publications' },
  'community, sustainability, food co-ops': { category: 'Community', subcategory: 'Sustainability & Food Co-ops' },
  'Cultural Heritage': { category: 'Culture', subcategory: 'Cultural Heritage' },
  'Blockchain Tools': { category: 'Computronium', subcategory: 'Blockchain Tools' },
  'Game Development / Simulation Enhancements': { category: 'Games', subcategory: 'Game Development' },
  'Data Processing Tools': { category: 'Software', subcategory: 'Data Processing Tools' },
  'Audio & Sound Design': { category: 'Songs', subcategory: 'Audio & Sound Design' },
  'Technical Resources': { category: 'Docs', subcategory: 'Technical Resources' },
  'Digital Assets > Images': { category: 'Photo', subcategory: 'Digital Images' },
  'Network Optimization Tools': { category: 'Utilities', subcategory: 'Network Optimization Tools' },
  'Digital Art / SVG Artwork': { category: 'Art', subcategory: 'SVG Artwork' },
  'Finance & Investment Tools': { category: 'Software', subcategory: 'Finance & Investment Tools' },
  'Digital Art / Graphics': { category: 'Art', subcategory: 'Digital Graphics' },
  'Audio/ Music': { category: 'Songs', subcategory: null },
  'Shelter Management Tools': { category: 'Basic Needs', subcategory: 'Shelter Management' },
  'Music & Sound Healing': { category: 'Songs', subcategory: 'Sound Healing' },
  'Digital Art / Graphic Design': { category: 'Art', subcategory: 'Graphic Design' },
  'Community & Public Goods': { category: 'Community', subcategory: 'Public Goods' },
  'Sustainability & Energy': { category: 'Energy', subcategory: 'Sustainability & Energy' },
  'creative-media': { category: 'Art', subcategory: 'Creative Media' },
  'Blockchain Technology': { category: 'Computronium', subcategory: 'Blockchain Technology' },
  'Energy Credits': { category: 'Energy', subcategory: 'Energy Credits' },
  'community engagement': { category: 'Community', subcategory: 'Community Engagement' },
  'Digital Art / Photography': { category: 'Photo', subcategory: 'Digital Art Photography' },
  'Software/Development Tools': { category: 'Software', subcategory: 'Development Tools' },
  'AI & Machine Learning Resources': { category: 'AI Tools', subcategory: 'Machine Learning Resources' },
  'Data Assets': { category: 'Software', subcategory: 'Data Assets' },
  'Audio Tools': { category: 'Music', subcategory: 'Audio Equipment' },
  'Digital Assets > Graphics > SVG Files': { category: 'Art', subcategory: 'SVG Files' },
  'AI Tools & Modules': { category: 'AI Tools', subcategory: 'AI Modules' },
  'Digital Assets > Vouchers & Coupons': { category: 'Basic Needs', subcategory: 'Vouchers & Coupons' },
  'Data Science / AI Tools': { category: 'AI Tools', subcategory: 'Data Science' },
  'Gaming Resources': { category: 'Games', subcategory: 'Gaming Resources' },
  'Graphics': { category: 'Art', subcategory: 'Graphics' },
  'Marketplace Goods': { category: 'Basic Needs', subcategory: 'Marketplace Goods' },
  'Digital Tools / Creative Software': { category: 'AI Create', subcategory: 'Creative Software' },
  'Digital Assets / Software Tools': { category: 'Software', subcategory: 'Software Tools' },
  'Software Tools': { category: 'Software', subcategory: 'Software Tools' },
  'Stock Footage': { category: 'Videos', subcategory: 'Stock Footage' },
  'Music Production': { category: 'Music', subcategory: 'Music Production' },
  'Community Support / Public Goods': { category: 'Community', subcategory: 'Public Goods' },
  'Games & Puzzles': { category: 'Games', subcategory: 'Games & Puzzles' },
  'Energy Management': { category: 'Energy', subcategory: 'Energy Management' },
  'Developer Tools': { category: 'Software', subcategory: 'Developer Tools' },
  'Creative Software': { category: 'AI Create', subcategory: 'Creative Software' },
  'Game Development / JSON Files': { category: 'Games', subcategory: 'Game Development' },
  'Public Goods / Transportation': { category: 'Community', subcategory: 'Transportation' },
  'Software Development Tools': { category: 'Software', subcategory: 'Software Development Tools' },
  'Community & Social Impact': { category: 'Community', subcategory: 'Social Impact' },
  'Community & Social Initiatives': { category: 'Community', subcategory: 'Social Initiatives' },
  'Textures & Patterns': { category: 'Art', subcategory: 'Textures & Patterns' },
  'Technology / Software Development': { category: 'Software', subcategory: 'Technology' },
  'Solar Infrastructure Tools': { category: 'Energy', subcategory: 'Solar Infrastructure' },
  'Software Development Kits (SDKs)': { category: 'Software', subcategory: 'SDKs' },
  'Gaming & Entertainment': { category: 'Games', subcategory: 'Gaming & Entertainment' },
  'Photography Presets': { category: 'Photo', subcategory: 'Photography Presets' },
  'Education & Learning': { category: 'Education', subcategory: 'Education & Learning' },
  'Transportation & Mobility': { category: 'Rent', subcategory: 'Transportation & Mobility' },
  'Blockchain Utilities': { category: 'Computronium', subcategory: 'Blockchain Utilities' },
  'Cultural Heritage & Education': { category: 'Culture', subcategory: 'Cultural Heritage & Education' },
  'Health & Safety': { category: 'Health & Wellness', subcategory: 'Health & Safety' },
  'Software Development / Data Analysis': { category: 'Software', subcategory: 'Data Analysis' },
  'Solar Infrastructure Data': { category: 'Energy', subcategory: 'Solar Infrastructure Data' },
  'Digital Assets / Game Development / Avatars': { category: 'Games', subcategory: 'Avatars' },
  'healthcare': { category: 'Health & Wellness', subcategory: 'Healthcare' },
  'Emergency Preparedness': { category: 'Health & Wellness', subcategory: 'Emergency Preparedness' },
  'Blockchain Assets': { category: 'Computronium', subcategory: 'Blockchain Assets' },
  'Safety & Security': { category: 'Utilities', subcategory: 'Safety & Security' },
  'Basic Needs / Transportation': { category: 'Basic Needs', subcategory: 'Transportation' },
  'Audio Assets': { category: 'Songs', subcategory: 'Audio Assets' },
  'Cultural Heritage & Art Resources': { category: 'Culture', subcategory: 'Cultural Heritage & Art' },
  'Community Support Tools': { category: 'Community', subcategory: 'Support Tools' },
  'AI Art Tools': { category: 'AI Create', subcategory: 'AI Art Tools' },
  'Graphic Design / Templates': { category: 'Art', subcategory: 'Design Templates' },
  'Cultural Heritage & Storytelling': { category: 'Culture', subcategory: 'Cultural Storytelling' },
  'Food & Agriculture': { category: 'Basic Needs', subcategory: 'Food & Agriculture' },
  'Digital Art / Community Resources': { category: 'Art', subcategory: 'Community Art Resources' },
  'Data & Analytics': { category: 'Software', subcategory: 'Data & Analytics' },
  'Media & Entertainment': { category: 'Videos', subcategory: 'Media & Entertainment' },
  'Music Equipment': { category: 'Music', subcategory: 'Music Equipment' },
  'Studio Equipment': { category: 'Music', subcategory: 'Studio Equipment' },
  'Instruments': { category: 'Music', subcategory: 'Instruments' },
  'Camera Equipment': { category: 'Video', subcategory: 'Camera Equipment' },
  'Production Equipment': { category: 'Video', subcategory: 'Production Equipment' },
  'Video Equipment': { category: 'Video', subcategory: 'Video Equipment' },
  'artwork, public goods': { category: 'Art', subcategory: 'Public Art' },
  'Visual Art & Photography': { category: 'Art', subcategory: 'Visual Art & Photography' },
  'Digital Art / Media Assets': { category: 'Art', subcategory: 'Digital Media Assets' },
  'Security Tools': { category: 'Utilities', subcategory: 'Security Tools' },
  'Textures & Backgrounds': { category: 'Art', subcategory: 'Textures & Backgrounds' },
  'Gardening & Sustainability': { category: 'Community', subcategory: 'Gardening & Sustainability' },
  'Non-Profit Tools': { category: 'Community', subcategory: 'Non-Profit Tools' },
  'real estate': { category: 'Rent', subcategory: 'Real Estate' },
  'Audio Loops': { category: 'Songs', subcategory: 'Audio Loops' },
  'Agriculture Technology': { category: 'Energy', subcategory: 'Agriculture Technology' },
  'Digital Assets / Graphic Design': { category: 'Art', subcategory: 'Graphic Design' },
  'community-support, food-access, sustainability': { category: 'Community', subcategory: 'Food Access & Sustainability' },
  'AI Tools & Creative Assets': { category: 'AI Tools', subcategory: 'Creative Assets' },
  'real estate, utilities': { category: 'Rent', subcategory: 'Real Estate & Utilities' },
  'Data Analysis & Simulation': { category: 'Software', subcategory: 'Data Analysis & Simulation' },
  'Digital Art & Resources': { category: 'Art', subcategory: 'Digital Art Resources' },
  'Basic Needs / Nutrition': { category: 'Basic Needs', subcategory: 'Nutrition' },
  'Sustainability & Resource Management': { category: 'Community', subcategory: 'Resource Management' },
  'Academic Research': { category: 'Education', subcategory: 'Academic Research' },
  'Design & Development': { category: 'Software', subcategory: 'Design & Development' },
  'Machine Learning Tools': { category: 'AI Tools', subcategory: 'Machine Learning Tools' },
  'Solar Energy Solutions': { category: 'Energy', subcategory: 'Solar Energy Solutions' },
  'Energy & Utilities': { category: 'Energy', subcategory: 'Energy & Utilities' },
  'Digital Content': { category: 'Docs', subcategory: 'Digital Content' },
  'Sustainability & Housing': { category: 'Rent', subcategory: 'Sustainability & Housing' },
  'real-estate, marketplace': { category: 'Rent', subcategory: 'Real Estate Marketplace' },
  'Games & Toys': { category: 'Games', subcategory: 'Games & Toys' },
  'Software Development / Quantum Computing': { category: 'Computronium', subcategory: 'Quantum Computing' },
  'Game Development': { category: 'Games', subcategory: 'Game Development' },
  'Cultural Heritage / Digital Assets': { category: 'Culture', subcategory: 'Cultural Heritage Digital' },
  'Digital Art Tools': { category: 'AI Create', subcategory: 'Digital Art Tools' },
  'Graphics & Illustrations': { category: 'Art', subcategory: 'Graphics & Illustrations' },
  'APIs': { category: 'Software', subcategory: 'APIs' },
  'Workspace Solutions': { category: 'Utilities', subcategory: 'Workspace Solutions' },
  'Media & Photography': { category: 'Photo', subcategory: 'Media & Photography' },
  'Gaming Content Expansion': { category: 'Games', subcategory: 'Content Expansion' },
  'Network Security Tools': { category: 'Utilities', subcategory: 'Network Security' },
  'Infrastructure & Performance': { category: 'Utilities', subcategory: 'Infrastructure & Performance' },
  'community-tools': { category: 'Community', subcategory: 'Community Tools' },
  'Data Management': { category: 'Software', subcategory: 'Data Management' },
  'Digital Resources': { category: 'Docs', subcategory: 'Digital Resources' },
  'Resource Packs': { category: 'Games', subcategory: 'Resource Packs' },
  'art & culture': { category: 'Art', subcategory: 'Art & Culture' },
  'automation': { category: 'Utilities', subcategory: 'Automation' },
  'Community Support / Digital Assets': { category: 'Community', subcategory: 'Digital Assets' },
  'Energy & Sustainability': { category: 'Energy', subcategory: 'Energy & Sustainability' },
  'Public Goods / Community Services': { category: 'Community', subcategory: 'Community Services' },
  'Software Components': { category: 'Software', subcategory: 'Software Components' },
  'Cultural Resources': { category: 'Culture', subcategory: 'Cultural Resources' },
  'Smart Energy Management': { category: 'Energy', subcategory: 'Smart Energy Management' },
  'Renewable Energy / Solar Technology': { category: 'Energy', subcategory: 'Renewable Energy' },
  'cultural exchange': { category: 'Culture', subcategory: 'Cultural Exchange' },
  'Resource Management': { category: 'Utilities', subcategory: 'Resource Management' },
  'Song': { category: 'Songs', subcategory: null },
  'song': { category: 'Songs', subcategory: null },
  'songs': { category: 'Songs', subcategory: null },
  'Recording': { category: 'Songs', subcategory: 'Recording' },
  'recording': { category: 'Songs', subcategory: 'Recording' },
  'Track': { category: 'Songs', subcategory: 'Track' },
  'track': { category: 'Songs', subcategory: 'Track' },
  'Album': { category: 'Songs', subcategory: 'Album' },
  'album': { category: 'Songs', subcategory: 'Album' },
  'Music Recording': { category: 'Songs', subcategory: 'Music Recording' },
  'Video Recording': { category: 'Videos', subcategory: 'Video Recording' },
  'Film': { category: 'Videos', subcategory: 'Film' },
  'film': { category: 'Videos', subcategory: 'Film' },
  'Footage': { category: 'Videos', subcategory: 'Footage' },
  'footage': { category: 'Videos', subcategory: 'Footage' },
  'Documentary': { category: 'Videos', subcategory: 'Documentary' },
  'documentary': { category: 'Videos', subcategory: 'Documentary' },
  'Instrument': { category: 'Music', subcategory: 'Instrument' },
  'instrument': { category: 'Music', subcategory: 'Instrument' },
  'Camera': { category: 'Video', subcategory: 'Camera' },
  'camera': { category: 'Video', subcategory: 'Camera' },
};

const CATEGORY_ICONS = {
  'Computronium': '⚡',
  'Culture': '🎭',
  'Basic Needs': '🏠',
  'Rent': '🔑',
  'Energy': '☀️',
  'Music': '🎵',
  'Songs': '🎶',
  'Video': '🎥',
  'Videos': '📹',
  'Art': '🎨',
  'Photo': '📸',
  'Writing': '✍️',
  'AI Tools': '🤖',
  'AI Create': '🪄',
  'Software': '💻',
  'Docs': '📄',
  'Games': '🎮',
  'Utilities': '🔧',
  'Education': '📚',
  '3D Printing': '🖨️',
  'Health & Wellness': '💚',
  'Community': '🌍',
};

const CATEGORY_LABELS = {
  'Songs': 'Songs (Recordings)',
  'Music': 'Music (Equipment)',
  'Videos': 'Videos (Recordings)',
  'Video': 'Video (Equipment)',
};

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

const KEYWORD_MAP = [
  { keywords: ['health', 'wellness', 'safety', 'emergency', 'nutrition', 'medical', 'fitness'], cat: 'Health & Wellness' },
  { keywords: ['community', 'public good', 'mutual aid', 'social', 'volunteer', 'civic', 'sustainab'], cat: 'Community' },
  { keywords: ['instrument', 'mixer', 'amplifier', 'studio gear', 'microphone', 'headphones', 'speaker', 'turntable'], cat: 'Music' },
  { keywords: ['song', 'single', 'track', 'album', 'recording', 'beats', 'loop', 'audio', 'sound', 'music'], cat: 'Songs' },
  { keywords: ['art', 'design', 'graphic', 'visual', 'creative', 'illustration', 'drawing'], cat: 'Art' },
  { keywords: ['photo', 'photography', 'image', 'picture'], cat: 'Photo' },
  { keywords: ['camera', 'tripod', 'lighting', 'editing rig', 'lens', 'gimbal', 'production gear'], cat: 'Video' },
  { keywords: ['video', 'film', 'footage', 'cinema', 'movie', 'documentary', 'clip'], cat: 'Videos' },
  { keywords: ['game', 'gaming', 'puzzle', 'rpg', 'arcade'], cat: 'Games' },
  { keywords: ['software', 'develop', 'tool', 'api', 'sdk', 'code', 'program'], cat: 'Software' },
  { keywords: ['ai', 'machine learn', 'neural', 'model', 'inference'], cat: 'AI Tools' },
  { keywords: ['generat', 'diffusion', 'synthe'], cat: 'AI Create' },
  { keywords: ['educat', 'learn', 'course', 'tutorial', 'academ', 'school'], cat: 'Education' },
  { keywords: ['energy', 'solar', 'renewable', 'power', 'grid', 'watt'], cat: 'Energy' },
  { keywords: ['housing', 'rent', 'real estate', 'shelter', 'transport'], cat: 'Rent' },
  { keywords: ['culture', 'heritage', 'tradition', 'folk'], cat: 'Culture' },
  { keywords: ['3d', 'print', 'mesh', 'stl'], cat: '3D Printing' },
  { keywords: ['doc', 'guide', 'manual', 'blueprint'], cat: 'Docs' },
  { keywords: ['utility', 'convert', 'backup', 'scan', 'monitor'], cat: 'Utilities' },
  { keywords: ['blockchain', 'crypto', 'quantum', 'compute'], cat: 'Computronium' },
  { keywords: ['write', 'essay', 'novel', 'poetry', 'blog', 'story'], cat: 'Writing' },
];

const CASE_INSENSITIVE_MAP = {};
for (const [key, value] of Object.entries(CATEGORY_MAP)) {
  CASE_INSENSITIVE_MAP[key.toLowerCase()] = value;
}

function normalizeCategory(rawCategory) {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return { category: 'Basic Needs', subcategory: null };
  }

  const trimmed = rawCategory.trim();

  if (CATEGORY_MAP[trimmed]) {
    return { ...CATEGORY_MAP[trimmed] };
  }

  const lower = trimmed.toLowerCase();

  if (CASE_INSENSITIVE_MAP[lower]) {
    return { ...CASE_INSENSITIVE_MAP[lower] };
  }

  const officialMatch = OFFICIAL_CATEGORIES.find(
    c => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)
  );
  if (officialMatch) {
    if (OFFICIAL_CATEGORIES.includes(trimmed)) {
      return { category: trimmed, subcategory: null };
    }
    return { category: officialMatch, subcategory: trimmed };
  }

  for (const { keywords, cat } of KEYWORD_MAP) {
    if (keywords.some(k => lower.includes(k))) {
      return { category: cat, subcategory: trimmed };
    }
  }

  return { category: 'Docs', subcategory: trimmed };
}

function getOfficialCategories() {
  return [...OFFICIAL_CATEGORIES];
}

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '📦';
}

function getCategoryWithSubcategories() {
  const result = {};
  for (const cat of OFFICIAL_CATEGORIES) {
    result[cat] = [];
  }
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (value.subcategory && !result[value.category].includes(value.subcategory)) {
      result[value.category].push(value.subcategory);
    }
  }
  return result;
}

module.exports = {
  OFFICIAL_CATEGORIES,
  CATEGORY_MAP,
  CATEGORY_LABELS,
  normalizeCategory,
  getOfficialCategories,
  getCategoryIcon,
  getCategoryLabel,
  getCategoryWithSubcategories,
};
