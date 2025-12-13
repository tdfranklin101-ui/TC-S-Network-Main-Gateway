// Night Market Juggler Gumball Generator
// MCP-COMPILE Bundle: Prompt gumballs with 10 remix options and MCP runbook

export interface GumballRemix {
  id: string;
  name: string;
  suffix: string;
}

export interface GumballGenerator {
  id: string;
  title: string;
  type: string;
  promptMain: string;
  remixes: GumballRemix[];
  mcpRunbook: {
    version: string;
    steps: { action: string; provider: string; input?: string }[];
  };
}

// Night Market Juggler - A mesmerizing glass sphere balanced on a midnight performer's palm
export const nightMarketJuggler: GumballGenerator = {
  id: "night-market-juggler",
  title: "Night Market Juggler",
  type: "video",
  promptMain: `A hyper-detailed transparent glass gumball sphere balanced on the fingertips of a mysterious midnight street performer. The sphere contains swirling liquid light that pulses like a heartbeat. Rain-slicked cobblestones reflect neon signs from surrounding night market stalls. The performer wears flowing dark robes with subtle iridescent threading. Steam rises from nearby food carts. The sphere slowly rotates, casting prismatic light patterns across the scene. Cinematic 4K, shallow depth of field, Blade Runner meets Studio Ghibli aesthetic.`,
  remixes: [
    {
      id: "aurora-swirl",
      name: "Aurora Swirl",
      suffix: "The liquid inside the sphere transforms into Northern Lights patterns - ribbons of green, purple, and pink dancing in slow motion. Snowflakes drift past."
    },
    {
      id: "solar-ember",
      name: "Solar Ember",
      suffix: "The sphere contains a miniature sun with solar flares licking the glass walls. The performer's face glows orange. Sparks drift upward like fireflies."
    },
    {
      id: "deep-ocean",
      name: "Deep Ocean",
      suffix: "Bioluminescent sea creatures swim inside the sphere - tiny jellyfish, glowing plankton, a miniature whale shark. Blue-green light pulses from within."
    },
    {
      id: "neon-speckle",
      name: "Neon Speckle",
      suffix: "Thousands of tiny neon dots swirl inside like a digital galaxy. Hot pink, electric blue, and toxic green create a cyberpunk constellation effect."
    },
    {
      id: "crystal-clear",
      name: "Crystal Clear",
      suffix: "The sphere is perfectly clear with geometric crystal formations growing inside. Light refracts into rainbow prisms. The crystals slowly rotate."
    },
    {
      id: "frosted-mint",
      name: "Frosted Mint",
      suffix: "Ice crystals form on the inside of the sphere. Cool mint-green fog swirls within. Frost creeps across the glass in intricate fractal patterns."
    },
    {
      id: "galaxy-core",
      name: "Galaxy Core",
      suffix: "A miniature spiral galaxy rotates inside the sphere. Stars are born and die in tiny supernovas. A black hole pulses at the center with an accretion disk."
    },
    {
      id: "citrus-pop",
      name: "Citrus Pop",
      suffix: "Bright orange and yellow liquids swirl together like a living sunset. Tiny bubbles rise through the mixture. Warm golden light spills out."
    },
    {
      id: "cherry-chrome",
      name: "Cherry Chrome",
      suffix: "The sphere has a chrome finish that reflects the night market. Deep cherry red liquid inside creates shifting patterns. Highly reflective metallic surface."
    },
    {
      id: "marble-classic",
      name: "Marble Classic",
      suffix: "Classic marble patterns swirl inside - white and grey veins snake through like living stone. Subtle gold flecks catch the light."
    }
  ],
  mcpRunbook: {
    version: "1.0",
    steps: [
      { action: "compose_prompt", provider: "LOCAL", input: "base + selected_remix" },
      { action: "render", provider: "SORA_MANUAL", input: "composed_prompt" },
      { action: "deliver", provider: "MANUAL", input: "video_url + thumbnail_url" }
    ]
  }
};

// Compose the full prompt by combining base prompt with selected remix
export function composePrompt(generator: GumballGenerator, remixId: string): string {
  const remix = generator.remixes.find(r => r.id === remixId);
  if (!remix) {
    return generator.promptMain;
  }
  return `${generator.promptMain}\n\n${remix.suffix}`;
}

// Get all available gumball generators
export function getAvailableGenerators(): GumballGenerator[] {
  return [nightMarketJuggler];
}

// Get a random gumball from available generators
export function getRandomGumball(): GumballGenerator {
  const generators = getAvailableGenerators();
  return generators[Math.floor(Math.random() * generators.length)];
}
