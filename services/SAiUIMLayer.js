// ====================================================================
// SAi UIM Backend Integration — TC-S Market
// Calls the SAi UIM Energetic Ethical Layer for the LifeLens alignment metric.
// CommonJS module (the TC-S Market server runs as CommonJS via `node main.js`).
// ====================================================================

const UIM_API_BASE_URL =
  process.env.UIM_API_BASE_URL || "https://s-ai-uim-layer-tdfranklin101.replit.app";

// Shared-secret token for the LifeLens UIM metric endpoint.
// Leave empty for open-mode testing; set it once the layer has UIM_SHARED_SECRET.
const UIM_SHARED_SECRET = process.env.UIM_SHARED_SECRET || "";

/**
 * Request the UIM alignment metric for an already identified & priced artifact.
 * @param {Object} artifact { artifact_id, transaction_id?, name?, category?,
 *   energy_footprint_kwh?, solar_price?, attributes? }
 * @param {("create"|"list"|"purchase"|"search_voucher_request")} [context]
 * @param {Object} [opts] { indices_override?, idempotency_key?, strict? }
 * @returns {Promise<Object>} { uim_metric, lifelens_report_patch, artifact_record_patch,
 *   rendered_text, order_id, idempotent_replay }
 */
async function requestUimMetric(artifact, context = "unspecified", opts = {}) {
  const headers = { "Content-Type": "application/json", "Accept": "application/json" };
  if (UIM_SHARED_SECRET) headers["X-UIM-Token"] = UIM_SHARED_SECRET;

  const body = { artifact, context };
  if (opts.indices_override) body.indices_override = opts.indices_override;
  if (opts.idempotency_key) body.idempotency_key = opts.idempotency_key;

  try {
    const response = await fetch(`${UIM_API_BASE_URL}/lifelens/uim_metric`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`UIM Metric API Error: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    console.log("🌞 UIM Metric:", {
      artifact_id: artifact.artifact_id,
      score: result.uim_metric?.alignment_score,
      approved: result.uim_metric?.approved,
      indices_live: result.uim_metric?.indices_freshness?.live,
      replay: result.idempotent_replay,
    });
    return result;
  } catch (error) {
    console.error("❌ UIM Metric request failed:", error.message);
    if (opts.strict) throw error; // STRICT: let the caller block on failure.
    // PERMISSIVE (default): clearly-marked error envelope, no silent/fake score.
    return {
      error: true,
      message: error.message,
      uim_metric: null,
      lifelens_report_patch: { uim_alignment: { error: error.message } },
      artifact_record_patch: null,
      rendered_text: `🌞 UIM Energetic-Ethical Alignment: UNAVAILABLE (${error.message})`,
    };
  }
}

/** Merge a UIM metric result into an existing LifeLens report object. */
function mergeUimMetricIntoReport(lifeLensReport, metricResult) {
  const report = { ...(lifeLensReport || {}) };
  Object.assign(report, metricResult?.lifelens_report_patch || {});
  if (metricResult?.rendered_text) report.uim_rendered = metricResult.rendered_text;
  return report;
}

/** Call after LifeLens identifies & prices an artifact (create/list/search). */
async function attachUimMetricToLifeLensReport(lifeLensReport, artifact, context) {
  const result = await requestUimMetric(artifact, context, { strict: false });
  const report = mergeUimMetricIntoReport(lifeLensReport, result);
  return { report, artifactRecordPatch: result.artifact_record_patch, raw: result };
}

/** Optional: pull dashboard stats (includes category_breakdown across 16 categories). */
async function getUIMStatistics() {
  try {
    const r = await fetch(`${UIM_API_BASE_URL}/dashboard/summary`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`UIM API Error: ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error("❌ Failed to fetch UIM statistics:", e.message);
    return null;
  }
}

module.exports = {
  requestUimMetric,
  mergeUimMetricIntoReport,
  attachUimMetricToLifeLensReport,
  getUIMStatistics,
  UIM_API_BASE_URL,
};
