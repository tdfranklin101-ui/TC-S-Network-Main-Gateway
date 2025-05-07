/**
 * Enhanced AI Wallet Assistant for The Current-See
 * 
 * This module extends the voice assistant with specialized capabilities for:
 * - Carbon footprint evaluation of specific products
 * - Energy-based pricing for farm-to-table produce
 * - Supply chain energy cost analysis
 * - Econometric calculations based on energy consumption
 */

class WalletAIAssistant {
  constructor(options = {}) {
    // Extend from the base voice assistant if available
    this.baseAssistant = window.voiceAssistant;
    
    // Configuration options
    this.options = {
      apiEndpoint: '/api/wallet-assistant',
      productDatabaseEndpoint: '/api/products',
      energyPricingEndpoint: '/api/energy-pricing',
      containerId: 'wallet-assistant-container',
      triggerButtonId: 'wallet-assistant-trigger',
      defaultLanguage: 'en',
      ...options
    };
    
    // Database of carbon footprint metrics for common product categories
    this.carbonFootprintData = {
      electronics: {
        smartphone: { 
          avgCO2kg: 60, // Average CO2 in kg for production
          avgLifespanYears: 2.5,
          avgEnergyConsumptionKwh: 5.5, // Per year
          recyclingOffsetPercent: 30
        },
        laptop: { 
          avgCO2kg: 330,
          avgLifespanYears: 4,
          avgEnergyConsumptionKwh: 65, // Per year
          recyclingOffsetPercent: 25
        },
        television: { 
          avgCO2kg: 400,
          avgLifespanYears: 7,
          avgEnergyConsumptionKwh: 150, // Per year
          recyclingOffsetPercent: 20
        }
      },
      clothing: {
        cotton_tshirt: { 
          avgCO2kg: 5.5,
          avgLifespanYears: 2,
          waterUseLifters: 2700,
          organicReductionPercent: 45
        },
        jeans: { 
          avgCO2kg: 33.4,
          avgLifespanYears: 4,
          waterUseLifters: 8000,
          organicReductionPercent: 40
        },
        polyester_jacket: { 
          avgCO2kg: 17,
          avgLifespanYears: 3,
          waterUseLifters: 900,
          recycledReductionPercent: 60
        }
      },
      food: {
        beef: { 
          avgCO2kgPerKg: 60,
          waterUseLiftersPerKg: 15400,
          landUseM2PerKg: 326,
          localReductionPercent: 10
        },
        chicken: { 
          avgCO2kgPerKg: 6,
          waterUseLiftersPerKg: 4325,
          landUseM2PerKg: 12,
          localReductionPercent: 10
        },
        rice: { 
          avgCO2kgPerKg: 4,
          waterUseLiftersPerKg: 2500,
          landUseM2PerKg: 2.5,
          localReductionPercent: 25
        },
        vegetables: { 
          avgCO2kgPerKg: 0.4,
          waterUseLiftersPerKg: 322,
          landUseM2PerKg: 0.3,
          localReductionPercent: 30,
          seasonalReductionPercent: 20
        },
        fruit: { 
          avgCO2kgPerKg: 0.7,
          waterUseLiftersPerKg: 962,
          landUseM2PerKg: 0.9,
          localReductionPercent: 30,
          seasonalReductionPercent: 20
        }
      },
      transportation: {
        car_petrol: { 
          avgCO2kgPerKm: 0.21,
          energyConsumptionKwhPerKm: 0.8,
          avgOccupancy: 1.5,
          evAlternativeReductionPercent: 60
        },
        bus: { 
          avgCO2kgPerKm: 0.105,
          energyConsumptionKwhPerKm: 0.4,
          avgOccupancy: 12,
          electricBusReductionPercent: 75
        },
        train: { 
          avgCO2kgPerKm: 0.041,
          energyConsumptionKwhPerKm: 0.15,
          avgOccupancy: 40,
          highSpeedTrainIncrementPercent: 20
        },
        plane: { 
          avgCO2kgPerKm: 0.255,
          energyConsumptionKwhPerKm: 0.9,
          avgOccupancy: 80,
          biofuelReductionPercent: 40
        }
      }
    };
    
    // Database of farm-to-table energy metrics
    this.farmToTableEnergyData = {
      // Base energy required to grow 1kg of produce (kWh)
      baseGrowingEnergy: {
        leafy_greens: 0.5,
        root_vegetables: 0.7,
        tomatoes: 2.1,
        berries: 3.0,
        tree_fruits: 1.2,
        grains: 1.8
      },
      
      // Transportation energy cost multipliers by distance
      transportMultipliers: {
        local: 1.0,      // < 50 miles
        regional: 2.5,   // 50-500 miles
        national: 6.0,   // 500-2000 miles
        international: 15.0 // > 2000 miles
      },
      
      // Storage energy cost (kWh per day per kg)
      storageCosts: {
        room_temp: 0.001,
        refrigerated: 0.05,
        frozen: 0.14
      },
      
      // Processing energy cost (kWh per kg)
      processingCosts: {
        none: 0,
        minimal: 0.5,    // cleaning, sorting
        moderate: 2.0,   // cutting, canning
        heavy: 5.0       // cooking, complex packaging
      },
      
      // Seasonal adjustment factors
      seasonalFactors: {
        in_season: 1.0,
        near_season: 1.4,
        off_season: 2.2,
        greenhouse: 3.0
      }
    };
    
    // Initialize the assistant
    document.addEventListener('DOMContentLoaded', () => this.init());
  }
  
  /**
   * Initialize the wallet AI assistant
   */
  init() {
    // Only create new UI if we're not extending the base assistant
    if (!this.baseAssistant) {
      this.setupDOMElements();
    } else {
      console.log('Extending base voice assistant with wallet capabilities');
      // Add our specialized knowledge to the base assistant
      this.extendBaseAssistant();
    }
    
    // Set up event listeners for wallet-specific interactions
    this.setupEventListeners();
  }
  
  /**
   * Extend the base voice assistant with wallet capabilities
   */
  extendBaseAssistant() {
    if (!this.baseAssistant) return;
    
    // Add our specialized query handler to intercept relevant queries
    const originalProcessQuery = this.baseAssistant.processQuery;
    
    this.baseAssistant.processQuery = async (query) => {
      // Check if this is a wallet-specific query
      const walletResponse = await this.handleWalletQuery(query);
      
      // If we have a wallet-specific response, return it
      if (walletResponse) {
        return walletResponse;
      }
      
      // Otherwise, fall back to the original query processor
      return originalProcessQuery.call(this.baseAssistant, query);
    };
  }
  
  /**
   * Handle wallet-specific queries
   */
  async handleWalletQuery(query) {
    query = query.toLowerCase();
    
    // Check for carbon footprint evaluation requests
    if (query.includes('carbon footprint') || 
        query.includes('environmental impact') || 
        query.includes('eco-friendly') ||
        query.includes('sustainable')) {
      return this.evaluateCarbonFootprint(query);
    }
    
    // Check for farm-to-table pricing queries
    if (query.includes('farm to table') || 
        query.includes('produce pricing') || 
        query.includes('food energy') ||
        query.includes('price of produce')) {
      return this.calculateFarmToTablePricing(query);
    }
    
    // Check for supply chain energy queries
    if (query.includes('supply chain') || 
        query.includes('energy cost') || 
        query.includes('distribution energy')) {
      return this.analyzeSupplyChainEnergy(query);
    }
    
    // Check for R. Buckminster Fuller queries
    if (query.includes('buckminster fuller') || 
        query.includes('bucky fuller') || 
        query.includes('dymaxion') || 
        query.includes('geodesic') ||
        query.includes('spaceship earth')) {
      return this.provideBuckyFullerInsights(query);
    }
    
    // Check for 1028 Atoms and longevity science queries
    if (query.includes('1028atoms') || 
        query.includes('1028 atoms') || 
        query.includes('longevity') || 
        query.includes('life extension') ||
        query.includes('terry franklin longevity')) {
      return this.provideLongevityInsights(query);
    }
    
    // Return null if not a wallet-specific query
    return null;
  }
  
  /**
   * Provide insights based on R. Buckminster Fuller's principles
   */
  provideBuckyFullerInsights(query) {
    // Collection of R. Buckminster Fuller quotes and principles
    const fullerPrinciples = [
      {
        concept: "Ephemeralization",
        definition: "Doing more with less, continuously increasing efficiency through technological advancement.",
        quote: "More and more with less and less until eventually you can do everything with nothing.",
        application: "The Current-See ecosystem embodies ephemeralization by creating value from the ever-increasing efficiency of solar energy collection and distribution."
      },
      {
        concept: "Spaceship Earth",
        definition: "The metaphor describing Earth as a vessel with finite resources traveling through space.",
        quote: "We are all astronauts on a little spaceship called Earth.",
        application: "Our SOLAR token system represents an energy accounting system for fairly distributing the resources of our shared planetary vessel."
      },
      {
        concept: "Comprehensive Anticipatory Design Science",
        definition: "Applying scientific principles to solve problems while anticipating future needs.",
        quote: "The best way to predict the future is to design it.",
        application: "The Current-See platform anticipates the transition to renewable energy by building the economic infrastructure needed for an equitable energy future."
      },
      {
        concept: "Synergetics",
        definition: "The study of systems and their behavior as wholes, rather than collections of parts.",
        quote: "Synergy means behavior of whole systems unpredicted by the behavior of their parts.",
        application: "The distributed nature of our solar energy tracking creates system-wide benefits greater than the sum of individual contributions."
      },
      {
        concept: "Tensegrity",
        definition: "Structural integrity through balanced tension and compression components.",
        quote: "Don't fight forces, use them.",
        application: "Our economic model doesn't fight against existing systems but creates a parallel structure that naturally demonstrates advantages through efficiency and fairness."
      }
    ];
    
    // Select relevant principles based on query keywords
    let relevantPrinciples = [];
    
    if (query.includes('ephemeralization') || query.includes('efficiency') || query.includes('more with less')) {
      relevantPrinciples.push(fullerPrinciples[0]);
    }
    
    if (query.includes('spaceship earth') || query.includes('resources') || query.includes('finite')) {
      relevantPrinciples.push(fullerPrinciples[1]);
    }
    
    if (query.includes('design') || query.includes('anticipatory') || query.includes('future')) {
      relevantPrinciples.push(fullerPrinciples[2]);
    }
    
    if (query.includes('synergy') || query.includes('system') || query.includes('whole')) {
      relevantPrinciples.push(fullerPrinciples[3]);
    }
    
    if (query.includes('tensegrity') || query.includes('structure') || query.includes('forces')) {
      relevantPrinciples.push(fullerPrinciples[4]);
    }
    
    // If no specific principles matched, provide a general overview
    if (relevantPrinciples.length === 0) {
      relevantPrinciples = [fullerPrinciples[0], fullerPrinciples[1]]; // Default to first two
    }
    
    // Generate response based on matched principles
    let response = `R. Buckminster Fuller (1895-1983) was a visionary systems theorist, architect, engineer, and inventor whose work deeply influences The Current-See philosophy.\n\n`;
    
    relevantPrinciples.forEach(principle => {
      response += `${principle.concept}: ${principle.definition}\n`;
      response += `"${principle.quote}"\n\n`;
      response += `Application to The Current-See: ${principle.application}\n\n`;
    });
    
    response += `Fuller's vision of "making the world work for 100% of humanity" through resource efficiency directly inspires our approach to universal energy access and equitable distribution of solar resources.`;
    
    if (query.includes('wallet') || query.includes('solar token') || query.includes('economy')) {
      response += `\n\nIn the context of your wallet, the SOLAR token system embodies Fuller's concept of "energy accounting" as the true basis for economic value, rather than artificial monetary systems. Each SOLAR token represents real energy potential and contributes to the creation of a more equitable global energy economy.`;
    }
    
    return response;
  }

  /**
   * Provide insights about 1028atoms.com and longevity science
   */
  provideLongevityInsights(query) {
    // Information about 1028atoms.com and longevity science
    const longevityInfo = {
      website: {
        name: "1028 Atoms",
        url: "https://www.1028atoms.com",
        description: "A platform dedicated to longevity science, exploring how to extend healthy human lifespan through scientific advances and holistic approaches."
      },
      foundingPrinciple: "The name '1028 Atoms' represents the approximate number of atoms in the human body (10^28) and symbolizes the deep understanding of human biology needed to address aging at its most fundamental level.",
      keyAreas: [
        {
          area: "Biological Aging Research",
          description: "Investigating the fundamental cellular and molecular mechanisms of aging, including telomere shortening, senescent cells, and mitochondrial dysfunction."
        },
        {
          area: "Longevity Interventions",
          description: "Exploring scientifically-backed approaches to extending healthy lifespan, including caloric restriction, intermittent fasting, and targeted supplementation."
        },
        {
          area: "Age-Related Disease Prevention",
          description: "Addressing the root causes of conditions like cardiovascular disease, neurodegenerative disorders, and diabetes through comprehensive preventative strategies."
        },
        {
          area: "Holistic Health Optimization",
          description: "Integrating nutrition, exercise, sleep, stress management, and environmental factors for comprehensive longevity enhancement."
        }
      ],
      connectionToCurrentSee: "Both 1028 Atoms and The Current-See share the founding vision of Terry D. Franklin, applying systems thinking to some of humanity's greatest challenges. While The Current-See addresses economic and energy equity through solar distribution, 1028 Atoms tackles the fundamental challenge of human health and longevity, both working toward a more sustainable and prosperous future."
    };
    
    // Determine what aspect of longevity to focus on
    let response = "";
    
    if (query.includes('1028atoms') || query.includes('1028 atoms') || query.includes('website')) {
      response = `${longevityInfo.website.name} (${longevityInfo.website.url})\n\n${longevityInfo.website.description}\n\n${longevityInfo.foundingPrinciple}\n\n`;
    } else {
      response = `Longevity Science and 1028 Atoms:\n\n${longevityInfo.website.description}\n\n`;
    }
    
    // Add key areas based on query focus
    let relevantAreas = [];
    
    if (query.includes('aging') || query.includes('biology') || query.includes('cellular')) {
      relevantAreas.push(longevityInfo.keyAreas[0]);
    }
    
    if (query.includes('interventions') || query.includes('extending') || query.includes('fasting')) {
      relevantAreas.push(longevityInfo.keyAreas[1]);
    }
    
    if (query.includes('disease') || query.includes('prevention') || query.includes('conditions')) {
      relevantAreas.push(longevityInfo.keyAreas[2]);
    }
    
    if (query.includes('holistic') || query.includes('nutrition') || query.includes('exercise')) {
      relevantAreas.push(longevityInfo.keyAreas[3]);
    }
    
    // If no specific areas matched, provide overview of all areas
    if (relevantAreas.length === 0) {
      relevantAreas = longevityInfo.keyAreas;
    }
    
    // Add relevant areas to response
    response += "Key Research Areas:\n\n";
    relevantAreas.forEach(area => {
      response += `${area.area}: ${area.description}\n\n`;
    });
    
    // Add connection to Current-See if relevant
    if (query.includes('current-see') || query.includes('connection') || query.includes('terry') || query.includes('franklin')) {
      response += `Connection to The Current-See: ${longevityInfo.connectionToCurrentSee}`;
    }
    
    return response;
  }
  
  /**
   * Evaluate carbon footprint of products
   */
  evaluateCarbonFootprint(query) {
    // Extract product type from query
    const productType = this.extractProductType(query);
    
    if (!productType) {
      return `I can evaluate the carbon footprint of specific products. Please specify what product you're interested in, for example: "What's the carbon footprint of a smartphone?" or "How sustainable are cotton t-shirts?"`;
    }
    
    // Look up the product in our database
    const category = this.findProductCategory(productType);
    const product = category ? this.carbonFootprintData[category][productType] : null;
    
    if (!product) {
      return `I don't have specific carbon footprint data for ${productType}. I can provide information about electronics (smartphones, laptops, TVs), clothing (t-shirts, jeans), food (beef, chicken, vegetables), and transportation modes.`;
    }
    
    // Generate response based on product type
    switch (category) {
      case 'electronics':
        return this.formatElectronicsFootprint(productType, product);
      case 'clothing':
        return this.formatClothingFootprint(productType, product);
      case 'food':
        return this.formatFoodFootprint(productType, product);
      case 'transportation':
        return this.formatTransportationFootprint(productType, product);
      default:
        return `I have information about ${productType}, but I need to organize it better. Please ask about a specific aspect like CO2 emissions or energy consumption.`;
    }
  }
  
  /**
   * Extract product type from query
   */
  extractProductType(query) {
    // List of all products we have data for
    const allProducts = [
      'smartphone', 'laptop', 'television', 'tv',
      'cotton_tshirt', 't-shirt', 'tshirt', 'jeans', 'polyester_jacket', 'jacket',
      'beef', 'chicken', 'rice', 'vegetables', 'fruit',
      'car', 'petrol', 'gas', 'bus', 'train', 'plane', 'flight'
    ];
    
    // Simple extraction - find the first product mentioned
    for (const product of allProducts) {
      if (query.includes(product)) {
        // Map common terms to our database keys
        if (product === 'tv') return 'television';
        if (product === 't-shirt' || product === 'tshirt') return 'cotton_tshirt';
        if (product === 'petrol' || product === 'gas') return 'car_petrol';
        if (product === 'flight') return 'plane';
        return product;
      }
    }
    
    return null;
  }
  
  /**
   * Find the category for a given product
   */
  findProductCategory(productType) {
    for (const category in this.carbonFootprintData) {
      if (this.carbonFootprintData[category][productType]) {
        return category;
      }
    }
    return null;
  }
  
  /**
   * Format carbon footprint information for electronics
   */
  formatElectronicsFootprint(productType, data) {
    const displayName = productType.replace('_', ' ');
    const annualFootprint = (data.avgCO2kg / data.avgLifespanYears).toFixed(1);
    const lifetimeEnergy = (data.avgEnergyConsumptionKwh * data.avgLifespanYears).toFixed(1);
    const solarHours = (lifetimeEnergy / 1.5).toFixed(1); // Assuming 1.5 kWh per hour of solar generation
    
    return `
Carbon Footprint Analysis: ${displayName.toUpperCase()}

• Production Emissions: ${data.avgCO2kg} kg CO2e
• Average Lifespan: ${data.avgLifespanYears} years
• Annual Carbon Footprint: ${annualFootprint} kg CO2e per year
• Lifetime Energy Consumption: ${lifetimeEnergy} kWh
• Solar Equivalence: ${solarHours} hours of solar panel operation

The most significant environmental impact occurs during manufacturing (about 80% of lifetime emissions). Extending the device's lifespan by ${Math.round(data.avgLifespanYears * 0.5)} more years would reduce your annual carbon footprint by approximately 30%.

Proper recycling can offset up to ${data.recyclingOffsetPercent}% of the manufacturing emissions by recovering valuable materials.

To convert this to SOLAR tokens: 1 SOLAR represents approximately 2.5 kWh of clean energy production, so this ${displayName}'s lifetime energy consumption equals approximately ${(lifetimeEnergy / 2.5).toFixed(1)} SOLAR tokens.
`;
  }
  
  /**
   * Format carbon footprint information for clothing
   */
  formatClothingFootprint(productType, data) {
    const displayName = productType.replace('_', ' ');
    const annualFootprint = (data.avgCO2kg / data.avgLifespanYears).toFixed(1);
    
    return `
Carbon Footprint Analysis: ${displayName.toUpperCase()}

• Production Emissions: ${data.avgCO2kg} kg CO2e
• Water Usage: ${(data.waterUseLifters / 1000).toFixed(1)} cubic meters
• Average Lifespan: ${data.avgLifespanYears} years
• Annual Carbon Footprint: ${annualFootprint} kg CO2e per year

Choosing organic or recycled materials can reduce the environmental impact by approximately ${data.organicReductionPercent || data.recycledReductionPercent}%.

The fashion industry accounts for about 10% of global carbon emissions and is the second-largest consumer of water. Extending garment life and buying fewer, higher-quality items significantly reduces environmental impact.

To offset this product's carbon footprint with SOLAR tokens: approximately ${(data.avgCO2kg * 0.4).toFixed(1)} SOLAR tokens would represent the clean energy equivalent needed to offset its production emissions.
`;
  }
  
  /**
   * Format carbon footprint information for food
   */
  formatFoodFootprint(productType, data) {
    const displayName = productType.replace('_', ' ');
    
    return `
Carbon Footprint Analysis: ${displayName.toUpperCase()} (per kg)

• Production Emissions: ${data.avgCO2kgPerKg} kg CO2e
• Water Usage: ${(data.waterUseLiftersPerKg / 1000).toFixed(1)} cubic meters
• Land Usage: ${data.landUseM2PerKg} square meters

Food choices have a significant impact on your carbon footprint. Buying locally grown ${displayName} can reduce transportation emissions by approximately ${data.localReductionPercent}%.

${data.seasonalReductionPercent ? `Eating seasonally can further reduce the carbon footprint by approximately ${data.seasonalReductionPercent}% due to reduced need for energy-intensive greenhouse growing or long-term storage.` : ''}

For comparison, beef has a carbon footprint approximately ${data.avgCO2kgPerKg < 60 ? (60 / data.avgCO2kgPerKg).toFixed(0) + ' times higher' : 'equivalent'} than ${displayName}.

In terms of SOLAR tokens: producing 1kg of ${displayName} requires energy equivalent to approximately ${(data.avgCO2kgPerKg * 0.4).toFixed(2)} SOLAR tokens.
`;
  }
  
  /**
   * Format carbon footprint information for transportation
   */
  formatTransportationFootprint(productType, data) {
    const displayName = productType.replace('_', ' ');
    
    return `
Carbon Footprint Analysis: ${displayName.toUpperCase()} (per km per person)

• Emissions: ${data.avgCO2kgPerKm} kg CO2e per kilometer
• Energy Consumption: ${data.energyConsumptionKwhPerKm} kWh per kilometer
• Typical Occupancy: ${data.avgOccupancy} people

A 100km journey by ${displayName} would generate approximately ${(data.avgCO2kgPerKm * 100).toFixed(1)} kg CO2e per person.

${data.evAlternativeReductionPercent ? `Switching to an electric alternative could reduce emissions by approximately ${data.evAlternativeReductionPercent}%, depending on your electricity source.` : ''}

For comparison, a train journey of the same distance would produce approximately ${(0.041 * 100).toFixed(1)} kg CO2e per person, ${(data.avgCO2kgPerKm / 0.041).toFixed(1)} times less than ${displayName}.

In terms of SOLAR tokens: a 100km journey by ${displayName} requires energy equivalent to approximately ${(data.energyConsumptionKwhPerKm * 100 * 0.4).toFixed(1)} SOLAR tokens per person.
`;
  }
  
  /**
   * Calculate farm-to-table pricing based on energy metrics
   */
  calculateFarmToTablePricing(query) {
    // Extract produce type from query
    const produceType = this.extractProduceType(query);
    
    if (!produceType) {
      return `I can calculate energy-based pricing for farm-to-table produce. Please specify what produce you're interested in, for example: "What's the energy cost of local tomatoes?" or "Calculate kWh pricing for winter berries."`;
    }
    
    // Extract other relevant parameters from query
    const isLocal = query.includes('local');
    const isOrganic = query.includes('organic');
    const isSeasonal = !(query.includes('winter') || query.includes('off season') || query.includes('out of season'));
    const transportType = isLocal ? 'local' : 
                         (query.includes('regional') ? 'regional' : 
                         (query.includes('national') ? 'national' : 'regional'));
    const processingLevel = query.includes('processed') ? 'moderate' : 
                           (query.includes('fresh') ? 'minimal' : 'minimal');
    const storageType = query.includes('frozen') ? 'frozen' : 
                       (query.includes('refrigerated') ? 'refrigerated' : 'refrigerated');
    
    // Calculate the energy costs
    const baseEnergy = this.farmToTableEnergyData.baseGrowingEnergy[produceType] || 1.0;
    const transportMultiplier = this.farmToTableEnergyData.transportMultipliers[transportType];
    const storageEnergy = this.farmToTableEnergyData.storageCosts[storageType] * 5; // Assuming 5 days of storage
    const processingEnergy = this.farmToTableEnergyData.processingCosts[processingLevel];
    const seasonalFactor = isSeasonal ? 
                          this.farmToTableEnergyData.seasonalFactors.in_season : 
                          this.farmToTableEnergyData.seasonalFactors.off_season;
    
    // Total energy in kWh per kg
    const totalEnergy = (baseEnergy * seasonalFactor) + (baseEnergy * transportMultiplier * 0.3) + storageEnergy + processingEnergy;
    
    // Convert energy to price (assuming $0.12 per kWh electricity cost)
    const energyCost = totalEnergy * 0.12;
    
    // Add base produce cost (very simplified model)
    const baseProduceCost = {
      leafy_greens: 2.50,
      root_vegetables: 1.80,
      tomatoes: 3.20,
      berries: 5.50,
      tree_fruits: 3.00,
      grains: 1.20
    }[produceType] || 2.50;
    
    // Adjust for organic (25% premium)
    const organicMultiplier = isOrganic ? 1.25 : 1.0;
    
    // Final price per kg
    const finalPrice = (baseProduceCost * organicMultiplier) + energyCost;
    
    // Convert to SOLAR tokens (assuming 1 SOLAR = 2.5 kWh = $0.30)
    const solarTokens = totalEnergy / 2.5;
    
    const displayName = produceType.replace('_', ' ');
    
    return `
Energy-Based Pricing Analysis: ${displayName.toUpperCase()} (${isLocal ? 'Local' : transportType}, ${isSeasonal ? 'In-Season' : 'Off-Season'}, ${isOrganic ? 'Organic' : 'Conventional'})

• Growing Energy: ${(baseEnergy * seasonalFactor).toFixed(2)} kWh/kg
• Transportation Energy: ${(baseEnergy * transportMultiplier * 0.3).toFixed(2)} kWh/kg
• Storage Energy: ${storageEnergy.toFixed(2)} kWh/kg
• Processing Energy: ${processingEnergy.toFixed(2)} kWh/kg
• Total Energy Footprint: ${totalEnergy.toFixed(2)} kWh/kg

Based on energy costs, the environmental component of the price is $${energyCost.toFixed(2)}/kg.
With base produce cost of $${baseProduceCost.toFixed(2)}/kg, the energy-adjusted price is $${finalPrice.toFixed(2)}/kg.

In SOLAR token economy: ${solarTokens.toFixed(2)} SOLAR tokens represent the energy required to produce 1kg of these ${displayName}.

${this.generateFarmToTableInsight(produceType, isLocal, isSeasonal, totalEnergy)}
`;
  }
  
  /**
   * Generate insights for farm-to-table pricing
   */
  generateFarmToTableInsight(produceType, isLocal, isSeasonal, totalEnergy) {
    // Generate insights based on parameters
    if (!isLocal && !isSeasonal) {
      return `Insight: Out-of-season, non-local ${produceType.replace('_', ' ')} has approximately 4-5 times the energy footprint of local, seasonal options. Consider alternatives or account for this higher environmental cost in your purchasing decisions.`;
    } else if (!isLocal && isSeasonal) {
      return `Insight: While these ${produceType.replace('_', ' ')} are in season, transportation energy accounts for about ${Math.round(totalEnergy * 0.4)} kWh/kg of the total footprint. Local alternatives would significantly reduce this energy cost.`;
    } else if (isLocal && !isSeasonal) {
      return `Insight: Off-season production typically requires greenhouse growing or long-distance imports. Even when sourced locally, off-season ${produceType.replace('_', ' ')} has a higher energy footprint due to climate-controlled growing environments.`;
    } else {
      return `Insight: Local, seasonal ${produceType.replace('_', ' ')} represent the most energy-efficient choice. The Current-See system can properly value such sustainable choices by accounting for their lower energy requirements.`;
    }
  }
  
  /**
   * Extract produce type from query
   */
  extractProduceType(query) {
    // List of produce types we have data for
    const produceTypes = {
      'leafy_greens': ['lettuce', 'spinach', 'kale', 'greens', 'leafy'],
      'root_vegetables': ['carrot', 'potato', 'onion', 'beet', 'root'],
      'tomatoes': ['tomato', 'tomatoes'],
      'berries': ['berry', 'berries', 'strawberry', 'blueberry', 'raspberry'],
      'tree_fruits': ['apple', 'orange', 'peach', 'pear', 'fruit'],
      'grains': ['wheat', 'rice', 'oat', 'grain', 'corn']
    };
    
    // Check for each produce type in the query
    for (const [type, keywords] of Object.entries(produceTypes)) {
      for (const keyword of keywords) {
        if (query.includes(keyword)) {
          return type;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Analyze supply chain energy costs
   */
  analyzeSupplyChainEnergy(query) {
    // This is a simplified version - in a real implementation, 
    // we would parse the query for specific supply chain parameters
    
    return `
Supply Chain Energy Analysis

Energy consumption across the supply chain varies significantly by product type, distance, and transportation mode:

• Production: 15-30% of total energy 
• Processing: 10-25% of total energy
• Transportation: 20-40% of total energy 
• Storage: 5-15% of total energy
• Retail: 10-20% of total energy

The Current-See ecosystem can track and tokenize this energy usage through SOLAR tokens, creating transparency about the true energy costs embedded in products.

Average energy intensity by transportation mode (for 1 ton-kilometer):
• Sea freight: 0.01-0.05 kWh 
• Rail: 0.05-0.2 kWh
• Truck: 0.3-0.9 kWh
• Air freight: 4-8 kWh

By optimizing transportation modes and distances, supply chain energy consumption can be reduced by 30-60%. The Current-See platform incentivizes this optimization by making energy costs explicit through SOLAR token pricing.

Would you like a detailed analysis of a specific product's supply chain energy usage? I can calculate the energy footprint for various items from production to consumer.
`;
  }
  
  /**
   * Set up event listeners for wallet-specific interactions
   */
  setupEventListeners() {
    // If we're extending the base assistant, no need for separate listeners
    if (this.baseAssistant) return;
    
    document.addEventListener('DOMContentLoaded', () => {
      // Add event listeners for our custom trigger button
      const triggerButton = document.getElementById(this.options.triggerButtonId);
      if (triggerButton) {
        triggerButton.addEventListener('click', () => {
          this.togglePanel();
        });
      }
    });
  }
}

// Create a global instance
document.addEventListener('DOMContentLoaded', () => {
  // Check if we already have the base voice assistant
  if (window.voiceAssistant) {
    // Extend it with wallet capabilities
    window.walletAIAssistant = new WalletAIAssistant();
    console.log('Extended base voice assistant with wallet AI capabilities');
  } else {
    // Create a standalone wallet assistant if no base assistant exists
    console.warn('Base voice assistant not found, creating standalone wallet assistant');
    window.walletAIAssistant = new WalletAIAssistant({
      containerId: 'wallet-ai-container',
      triggerButtonId: 'wallet-ai-trigger'
    });
  }
});