const artifacts = [
  // 🧠 Computronium Missions
  {
    id: "mission-gaia-001",
    title: "Gaia Restoration Mission",
    category: "computronium_missions",
    teaser: "Direct Solar Rays to regenerative compute for reforestation.",
    price_solar_rays: 1,
    energy_kwh: 4.913,
    manifestUrl: "/manifests/mission-gaia-001.json"
  },

  // 🎨 Culture
  {
    id: "culture-equinox-track",
    title: "Equinox Track Drop",
    category: "culture",
    teaser: "Limited seasonal music drop powered by Solar Rays.",
    price_solar_rays: 0.1,
    energy_kwh: 0.4913,
    manifestUrl: "/manifests/culture-equinox-track.json"
  },

  // 🌿 Basic Needs
  {
    id: "basic-water-001",
    title: "Clean Water — 50L",
    category: "basic_needs",
    teaser: "Solar-powered water filtration credit for 50 liters.",
    price_solar_rays: 0.1,
    energy_kwh: 0.4913,
    manifestUrl: "/manifests/basic-water-001.json"
  },

  // 🧰 Rent Anything
  {
    id: "rent-bike-001",
    title: "Rent: Solar E-Bike (24h)",
    category: "rent_anything",
    teaser: "Scan QR to rent a fully charged solar e-bike.",
    price_solar_rays: 0.5,
    energy_kwh: 2.4565,
    qr_code_url: "/qr/rent-bike-001.svg",
    manifestUrl: "/manifests/rent-bike-001.json"
  },

  // ⚡ Energy Trading (listing artifacts)
  {
    id: "energy-listing-demo-001",
    title: "REC Offer: 100 kWh @ 0.15 Rays/kWh",
    category: "energy_trading",
    teaser: "List REC energy or post PPA demand to trade Solar-backed power.",
    kwh: 100,
    pricePerKwh: 0.15,
    type: "REC"
  }
];

module.exports = { artifacts };
