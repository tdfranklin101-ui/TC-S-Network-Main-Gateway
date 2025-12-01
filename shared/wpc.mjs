/**
 * TC-S Shared WPC Engine (ESM)
 */

export function estimateFlops({ model = "llm", tokens = 50, resolution = 512 }) {
  switch (model) {
    case "llm":
      return tokens * 50e9;
    case "vision":
      return resolution * resolution * 1e6;
    case "diffusion":
      return resolution * resolution * 30e9;
    default:
      return 1e9;
  }
}

export function estimateEnergy(watts = 60, seconds = 0.07) {
  return watts * seconds;
}

export function computeWPC(joules, flops) {
  return joules / flops;
}

export function joulesToKWh(joules) {
  return joules / 3_600_000;
}

export function kWhToSolar(kWh) {
  return kWh / 4913;
}

export function efficiencyGrade(wpc) {
  if (wpc < 1e-12) return "A+";
  if (wpc < 5e-12) return "A";
  if (wpc < 1e-11) return "B";
  if (wpc < 5e-11) return "C";
  return "D";
}

export function computeAll(params) {
  const flops = estimateFlops(params);
  const joules = estimateEnergy(params.powerWatts, params.seconds);
  const wpc = computeWPC(joules, flops);
  const kWh = joulesToKWh(joules);
  const solar = kWhToSolar(kWh);
  const rays = solar * 1000;

  return {
    flops,
    joules,
    kWh,
    wpc,
    solar,
    rays,
    grade: efficiencyGrade(wpc),
  };
}
