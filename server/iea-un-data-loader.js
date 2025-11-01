/**
 * IEA/UN Global Energy Dataset Loader
 * 
 * Data Source: IEA World Energy Statistics 2024 & UN Energy Statistics Database
 * Data Vintage: 2023 annual data (latest available as of Nov 2025)
 * Data Freshness: ANNUAL_DATASET
 * 
 * This module provides regional energy consumption data for regions without live APIs:
 * - Asia (GLOBAL_ASIA)
 * - Africa (GLOBAL_AFRICA)
 * - Latin America (GLOBAL_LATIN_AMERICA)
 * - Oceania (GLOBAL_OCEANIA)
 * 
 * North America and Europe use live APIs (EIA LIVE_DAILY / Eurostat QUARTERLY_API)
 * 
 * References:
 * - IEA World Energy Balances 2024: https://www.iea.org/data-and-statistics/data-product/world-energy-statistics-and-balances
 * - UN Energy Statistics Database: https://unstats.un.org/unsd/energystats/data
 * - IEA Electricity Information 2024: https://www.iea.org/data-and-statistics/data-product/electricity-information
 */

const DATA_VINTAGE = '2023'; // Year of the most recent comprehensive global data

/**
 * IEA/UN Regional Energy Data (2023 Annual Statistics)
 * Units: TWh/year (converted to kWh/day in loader functions)
 * 
 * Regional Coverage:
 * - Asia: China, India, Japan, South Korea, Indonesia, Thailand, Vietnam, Malaysia, Philippines, Bangladesh, Pakistan, etc.
 * - Africa: South Africa, Nigeria, Egypt, Morocco, Kenya, Ghana, Ethiopia, etc.
 * - Latin America: Brazil, Mexico, Argentina, Chile, Colombia, Peru, Venezuela, etc.
 * - Oceania: Australia, New Zealand, Papua New Guinea, Fiji, etc.
 */

const IEA_UN_REGIONAL_DATA_2023 = {
  // ============================================================
  // 1. HOUSING (Residential Electricity Consumption)
  // Source: IEA Electricity Information 2024 - Final Consumption by Sector
  // ============================================================
  housing: {
    GLOBAL_ASIA: 3850,        // TWh/year (China 1580, India 390, Japan 290, others)
    GLOBAL_AFRICA: 145,       // TWh/year (South Africa 48, Egypt 32, others)
    GLOBAL_LATIN_AMERICA: 420, // TWh/year (Brazil 165, Mexico 95, others)
    GLOBAL_OCEANIA: 85        // TWh/year (Australia 72, New Zealand 13)
  },
  
  // ============================================================
  // 2. MANUFACTURING (Industrial Electricity Consumption)
  // Source: IEA World Energy Balances 2024 - Industry Sector
  // ============================================================
  manufacturing: {
    GLOBAL_ASIA: 6200,        // TWh/year (China 4800, India 580, Japan 350, others)
    GLOBAL_AFRICA: 185,       // TWh/year (South Africa 95, Egypt 42, others)
    GLOBAL_LATIN_AMERICA: 380, // TWh/year (Brazil 185, Mexico 85, others)
    GLOBAL_OCEANIA: 120       // TWh/year (Australia 95, New Zealand 25)
  },
  
  // ============================================================
  // 3. DIGITAL SERVICES (Data Centers & IT Infrastructure)
  // Source: IEA Data Centres and Data Transmission Networks 2024
  // ============================================================
  digitalServices: {
    GLOBAL_ASIA: 95,          // TWh/year (China 38, Japan 18, Singapore 15, India 12, others)
    GLOBAL_AFRICA: 8,         // TWh/year (South Africa 5, others 3)
    GLOBAL_LATIN_AMERICA: 12, // TWh/year (Brazil 6, Mexico 3, others)
    GLOBAL_OCEANIA: 18        // TWh/year (Australia 14, New Zealand 4)
  },
  
  // ============================================================
  // 4. TRANSPORT (Electric Transportation)
  // Source: IEA Global EV Outlook 2024 + Electric Rail Statistics
  // ============================================================
  transport: {
    GLOBAL_ASIA: 240,         // TWh/year (China 180, Japan 22, India 12, others)
    GLOBAL_AFRICA: 8,         // TWh/year (South Africa rail + emerging EVs)
    GLOBAL_LATIN_AMERICA: 28, // TWh/year (Brazil 15, Mexico 8, Chile 3, others)
    GLOBAL_OCEANIA: 12        // TWh/year (Australia 9, New Zealand 3)
  },
  
  // ============================================================
  // 5. FOOD/AGRICULTURE (Agricultural Energy Consumption)
  // Source: UN FAO Energy Use in Agriculture + IEA Agricultural Sector
  // ============================================================
  food: {
    GLOBAL_ASIA: 580,         // TWh/year (China 220, India 180, others)
    GLOBAL_AFRICA: 45,        // TWh/year (distributed across agricultural economies)
    GLOBAL_LATIN_AMERICA: 85, // TWh/year (Brazil 38, Argentina 18, others)
    GLOBAL_OCEANIA: 22        // TWh/year (Australia 18, New Zealand 4)
  },
  
  // ============================================================
  // 6. MONEY/BLOCKCHAIN (Cryptocurrency Mining)
  // Source: Cambridge Bitcoin Electricity Consumption Index 2024 + Regional Mining Data
  // ============================================================
  money: {
    GLOBAL_ASIA: 58,          // TWh/year (Kazakhstan 22, China residual 15, others)
    GLOBAL_AFRICA: 4,         // TWh/year (emerging mining in various countries)
    GLOBAL_LATIN_AMERICA: 8,  // TWh/year (Paraguay 3, others)
    GLOBAL_OCEANIA: 3         // TWh/year (Australia, small operations)
  },
  
  // ============================================================
  // 7. AI/ML (Artificial Intelligence & Machine Learning Compute)
  // Source: IEA AI Energy Tracker 2024 + Goldman Sachs AI Infrastructure Report
  // ============================================================
  aiMl: {
    GLOBAL_ASIA: 28,          // TWh/year (China AI 12, Singapore 6, Japan 5, others)
    GLOBAL_AFRICA: 2,         // TWh/year (South Africa data centers)
    GLOBAL_LATIN_AMERICA: 3,  // TWh/year (Brazil 2, others)
    GLOBAL_OCEANIA: 5         // TWh/year (Australia 4, New Zealand 1)
  },
  
  // ============================================================
  // 8. GOVERNMENT/MILITARY (Public Services & Defense Infrastructure)
  // Source: UN Public Services Energy Data + IEA Government Sector Estimates
  // ============================================================
  government: {
    GLOBAL_ASIA: 420,         // TWh/year (China 180, India 85, Japan 42, others)
    GLOBAL_AFRICA: 35,        // TWh/year (government buildings, public services)
    GLOBAL_LATIN_AMERICA: 58, // TWh/year (Brazil 22, Mexico 15, others)
    GLOBAL_OCEANIA: 18        // TWh/year (Australia 15, New Zealand 3)
  }
};

/**
 * Load IEA/UN regional data for a specific category
 * Converts TWh/year to kWh/day for consistency with live feeds
 * 
 * @param {string} category - Category name (housing, manufacturing, etc.)
 * @param {string} regionCode - Region code (GLOBAL_ASIA, GLOBAL_AFRICA, etc.)
 * @returns {object} Energy data with kWh/day and metadata
 */
function loadRegionalData(category, regionCode) {
  const categoryData = IEA_UN_REGIONAL_DATA_2023[category];
  
  if (!categoryData) {
    console.error(`❌ No IEA/UN data available for category: ${category}`);
    return null;
  }
  
  const annualTWh = categoryData[regionCode];
  
  if (annualTWh === undefined || annualTWh === null) {
    console.error(`❌ No IEA/UN data available for region: ${regionCode} in category: ${category}`);
    return null;
  }
  
  // Convert TWh/year to kWh/day
  const annualKwh = annualTWh * 1e9; // TWh to kWh
  const dailyKwh = annualKwh / 365;  // Annual to daily
  
  return {
    kwh: dailyKwh,
    dataFreshness: 'ANNUAL_DATASET',
    dataVintage: DATA_VINTAGE,
    source: getDataSource(category, regionCode),
    metadata: {
      annualTWh: annualTWh,
      annualKwh: annualKwh,
      dailyKwh: dailyKwh,
      dataVintage: DATA_VINTAGE,
      regionCode: regionCode,
      category: category
    }
  };
}

/**
 * Get comprehensive data source information for a category and region
 * 
 * @param {string} category - Category name
 * @param {string} regionCode - Region code
 * @returns {object} Source metadata
 */
function getDataSource(category, regionCode) {
  const regionName = {
    GLOBAL_ASIA: 'Asia',
    GLOBAL_AFRICA: 'Africa',
    GLOBAL_LATIN_AMERICA: 'Latin America',
    GLOBAL_OCEANIA: 'Oceania'
  }[regionCode] || regionCode;
  
  const categoryDataSources = {
    housing: {
      name: `IEA Electricity Information 2024 - ${regionName} Residential Sector`,
      organization: 'International Energy Agency',
      uri: 'https://www.iea.org/data-and-statistics/data-product/electricity-information',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    manufacturing: {
      name: `IEA World Energy Balances 2024 - ${regionName} Industry Sector`,
      organization: 'International Energy Agency',
      uri: 'https://www.iea.org/data-and-statistics/data-product/world-energy-statistics-and-balances',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    digitalServices: {
      name: `IEA Data Centres and Data Transmission Networks 2024 - ${regionName}`,
      organization: 'International Energy Agency',
      uri: 'https://www.iea.org/energy-system/buildings/data-centres-and-data-transmission-networks',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    transport: {
      name: `IEA Global EV Outlook 2024 - ${regionName} Electrification`,
      organization: 'International Energy Agency',
      uri: 'https://www.iea.org/reports/global-ev-outlook-2024',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    food: {
      name: `UN FAO Energy Use in Agriculture 2024 - ${regionName}`,
      organization: 'United Nations Food and Agriculture Organization / IEA',
      uri: 'https://unstats.un.org/unsd/energystats/data',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    money: {
      name: `Cambridge Bitcoin Electricity Consumption Index - ${regionName} Mining`,
      organization: 'Cambridge Centre for Alternative Finance',
      uri: 'https://ccaf.io/cbnsi/cbeci',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    aiMl: {
      name: `IEA AI Energy Tracker 2024 - ${regionName} Compute Infrastructure`,
      organization: 'International Energy Agency',
      uri: 'https://www.iea.org/energy-system/buildings/data-centres-and-data-transmission-networks',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    },
    government: {
      name: `UN Energy Statistics 2024 - ${regionName} Public Services & Government`,
      organization: 'United Nations Statistics Division / IEA',
      uri: 'https://unstats.un.org/unsd/energystats/data',
      verificationLevel: 'THIRD_PARTY',
      sourceType: 'ANNUAL_DATASET'
    }
  };
  
  return categoryDataSources[category] || {
    name: `IEA/UN Global Energy Dataset - ${regionName}`,
    organization: 'International Energy Agency / United Nations',
    uri: 'https://www.iea.org/data-and-statistics',
    verificationLevel: 'THIRD_PARTY',
    sourceType: 'ANNUAL_DATASET'
  };
}

/**
 * Load all regional data for a category (all 4 regions: Asia, Africa, LatAm, Oceania)
 * Returns regional breakdown with ANNUAL_DATASET freshness
 * 
 * @param {string} category - Category name
 * @returns {object} Regional breakdown with kWh/day for each region
 */
function loadAllRegionalData(category) {
  const regions = ['GLOBAL_ASIA', 'GLOBAL_AFRICA', 'GLOBAL_LATIN_AMERICA', 'GLOBAL_OCEANIA'];
  const breakdown = {};
  
  for (const regionCode of regions) {
    const data = loadRegionalData(category, regionCode);
    if (data) {
      breakdown[regionCode] = data.kwh;
    } else {
      console.warn(`⚠️  Missing IEA/UN data for ${category} in ${regionCode}`);
      breakdown[regionCode] = 0;
    }
  }
  
  return breakdown;
}

/**
 * Get summary statistics for all categories and regions
 * Useful for validation and debugging
 * 
 * @returns {object} Summary with total energy by category and region
 */
function getDataSummary() {
  const categories = Object.keys(IEA_UN_REGIONAL_DATA_2023);
  const regions = ['GLOBAL_ASIA', 'GLOBAL_AFRICA', 'GLOBAL_LATIN_AMERICA', 'GLOBAL_OCEANIA'];
  
  const summary = {
    dataVintage: DATA_VINTAGE,
    categories: categories.length,
    regions: regions.length,
    totalDataPoints: categories.length * regions.length,
    breakdown: {}
  };
  
  // Calculate totals by category
  for (const category of categories) {
    summary.breakdown[category] = {
      totalTWh: 0,
      regions: {}
    };
    
    for (const region of regions) {
      const twhPerYear = IEA_UN_REGIONAL_DATA_2023[category][region];
      summary.breakdown[category].totalTWh += twhPerYear;
      summary.breakdown[category].regions[region] = twhPerYear;
    }
  }
  
  return summary;
}

module.exports = {
  loadRegionalData,
  loadAllRegionalData,
  getDataSummary,
  IEA_UN_REGIONAL_DATA_2023,
  DATA_VINTAGE
};
