// lib/wpc.js
// WPC (Watts Per Compute) - Energy efficiency measurement for compute operations

// Estimate FLOPs for different compute types
function estimateFlops({ model = "llm", tokens = 50, resolution = 512 }) {
  switch (model) {
    case "llm":
      return tokens * 50e9; // 50 GFLOPs per token
    case "vision":
      return resolution * resolution * 1e6; // approx FLOPs scaling
    case "diffusion":
      return resolution * resolution * 30e9; // large models like Sora
    default:
      return 1e9;
  }
}

// Joules = Watts × Seconds
function estimateEnergy(powerWatts = 60, seconds = 0.07) {
  return powerWatts * seconds;
}

// WPC = Joules per FLOP
function computeWPC(joules, flops) {
  return joules / flops;
}

// Convert Joules → kWh → Solar (4913 kWh per Solar)
function joulesToSolar(joules) {
  const kWh = joules / 3_600_000;
  return kWh / 4913;
}

module.exports = {
  estimateFlops,
  estimateEnergy,
  computeWPC,
  joulesToSolar,
};
