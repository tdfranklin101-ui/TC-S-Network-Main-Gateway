import csv
import json
import argparse
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import os

# --- TC-S constants ---
SOLAR_KWH = 4913.0          # 1 Solar = 4,913 kWh
RAYS_PER_SOLAR = 10000.0    # 1 Solar = 10,000 Rays


@dataclass
class PowerSample:
    time_s: float   # seconds
    power_w: float  # watts


def load_power_trace_csv(path: str) -> List[PowerSample]:
    """
    Load a CSV with at least two columns: time_s, power_w.

    Example:
        time_s,power_w
        0.0, 80
        0.01, 95
        0.02, 90
    """
    samples: List[PowerSample] = []

    with open(path, "r", newline="") as f:
        reader = csv.DictReader(f)
        if "time_s" not in reader.fieldnames or "power_w" not in reader.fieldnames:
            raise ValueError("CSV must have columns: time_s,power_w")

        for row in reader:
            # Handle possible spaces
            t = float(row["time_s"].strip())
            p = float(row["power_w"].strip())
            samples.append(PowerSample(time_s=t, power_w=p))

    samples.sort(key=lambda s: s.time_s)
    if len(samples) < 2:
        raise ValueError("Need at least 2 samples to integrate energy.")
    return samples


def integrate_energy_kwh(samples: List[PowerSample]) -> float:
    """
    Integrate power over time using a left Riemann sum.

    Energy (Joules) = sum( P_i * Δt_i )
    kWh = Joules / (1000 * 3600)
    """
    total_joules = 0.0

    for i in range(len(samples) - 1):
        p = samples[i].power_w
        dt = samples[i + 1].time_s - samples[i].time_s
        if dt < 0:
            raise ValueError("Timestamps must be non-decreasing.")
        total_joules += p * dt

    kwh = total_joules / (1000.0 * 3600.0)
    return kwh


def build_power_twin(
    chip_id: str,
    workload_id: str,
    samples: List[PowerSample],
    trace_file: str,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    duration_s = samples[-1].time_s - samples[0].time_s
    if duration_s <= 0:
        duration_s = 0.0

    avg_power_w = (
        sum(s.power_w for s in samples) / len(samples) if samples else 0.0
    )
    peak_power_w = max(s.power_w for s in samples) if samples else 0.0

    energy_kwh = integrate_energy_kwh(samples)
    per_second_kwh = energy_kwh / duration_s if duration_s > 0 else 0.0

    solar = energy_kwh / SOLAR_KWH
    rays = solar * RAYS_PER_SOLAR

    twin = {
        "version": "tcs-power-twin-v1",
        "chip_id": chip_id,
        "workload_id": workload_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "units": {
            "time": "seconds",
            "power": "watts",
            "energy": "kWh",
            "solar": "Solar",
            "rays": "Solar Rays",
        },
        "profile": {
            "duration_s": duration_s,
            "samples": len(samples),
            "avg_power_w": avg_power_w,
            "peak_power_w": peak_power_w,
        },
        "energy": {
            "total_kwh": energy_kwh,
            "per_second_kwh": per_second_kwh,
        },
        "solar_cost": {
            "solar": solar,
            "rays": rays,
        },
        "source": {
            "trace_type": "time_power_csv",
            "trace_file": os.path.basename(trace_file),
            "integration_method": "left_riemann",
            "assumptions": [
                "Power value held constant until next timestamp",
                "Timestamps are monotonically increasing",
            ],
        },
        "metadata": extra_metadata or {},
    }

    return twin


def parse_metadata_args(meta_args: Optional[List[str]]) -> Dict[str, Any]:
    """
    Parse metadata from --meta key=value pairs.
    Example:
      --meta process_node_nm=5 voltage_v=0.85 clock_ghz=2.4
    """
    metadata: Dict[str, Any] = {}
    if not meta_args:
        return metadata

    for pair in meta_args:
        if "=" not in pair:
            continue
        key, value = pair.split("=", 1)
        key = key.strip()
        value = value.strip()

        # Try to coerce into int/float where reasonable
        if value.replace(".", "", 1).isdigit():
            # Contains only digits and at most one dot
            if "." in value:
                try:
                    metadata[key] = float(value)
                    continue
                except ValueError:
                    pass
            else:
                try:
                    metadata[key] = int(value)
                    continue
                except ValueError:
                    pass

        # Fallback: keep as string
        metadata[key] = value

    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="TC-S Power Twin builder: convert a time/power CSV trace into Solar cost."
    )
    parser.add_argument(
        "csv_path",
        type=str,
        help="Path to CSV file with columns: time_s,power_w",
    )
    parser.add_argument(
        "--chip-id",
        type=str,
        default="unknown-chip",
        help="Logical chip identifier (e.g., open-eda-cpu-v1).",
    )
    parser.add_argument(
        "--workload-id",
        type=str,
        default="unknown-workload",
        help="Workload identifier (e.g., resnet50-inference-01).",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="",
        help="Optional output JSON file path. If omitted, prints to stdout.",
    )
    parser.add_argument(
        "--meta",
        nargs="*",
        help="Optional metadata key=value pairs. Example: --meta process_node_nm=5 voltage_v=0.85",
    )

    args = parser.parse_args()

    samples = load_power_trace_csv(args.csv_path)
    metadata = parse_metadata_args(args.meta)
    twin = build_power_twin(
        chip_id=args.chip_id,
        workload_id=args.workload_id,
        samples=samples,
        trace_file=args.csv_path,
        extra_metadata=metadata,
    )

    twin_json = json.dumps(twin, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(twin_json)
        print(f"Power Twin written to {args.out}")
    else:
        print(twin_json)


if __name__ == "__main__":
    main()
