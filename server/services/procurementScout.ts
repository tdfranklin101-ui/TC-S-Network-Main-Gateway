import { eq } from "drizzle-orm";
import { db } from "../db";
import { marketRequests, procurementRecommendations } from "@shared/schema";

const ALLOWED_PORTALS = [
  { name: "Amazon (manual/affiliate)", baseUrl: "https://www.amazon.com/s?k=" },
  { name: "Walmart", baseUrl: "https://www.walmart.com/search?q=" },
  { name: "eBay", baseUrl: "https://www.ebay.com/sch/i.html?_nkw=" },
];

function encodeQ(q: string) {
  return encodeURIComponent(q.trim());
}

export async function runProcurementScoutForRequest(requestId: string) {
  try {
    await db.update(marketRequests).set({ status: "SCOUTING" }).where(eq(marketRequests.id, requestId));

    const [req] = await db.select().from(marketRequests).where(eq(marketRequests.id, requestId)).limit(1);
    if (!req) {
      console.error(`Procurement scout: Request ${requestId} not found`);
      return;
    }

    const q = req.query;

    const recs = ALLOWED_PORTALS.map((p, i) => ({
      requestId,
      vendorName: p.name,
      productTitle: `Top match candidate for: ${q}`,
      sourceUrl: `${p.baseUrl}${encodeQ(q)}`,
      priceEstimateFiat: null as any,
      shippingNotes: "Review portal listing for shipping details.",
      kwhEstimate: "0",
      fitScore: 80 - i * 10,
      agentRationale: "Portal search link generated for human review; no procurement executed.",
      riskFlags: [] as string[],
    }));

    await db.insert(procurementRecommendations).values(recs);

    await db.update(marketRequests).set({ status: "REVIEW_READY" }).where(eq(marketRequests.id, requestId));
    console.log(`Procurement scout: Request ${requestId} ready for review`);
  } catch (error) {
    console.error(`Procurement scout failed for request ${requestId}:`, error);
    try {
      await db.update(marketRequests).set({ status: "REVIEW_READY" }).where(eq(marketRequests.id, requestId));
    } catch (recoveryError) {
      console.error(`Failed to recover request ${requestId} status:`, recoveryError);
    }
    throw error;
  }
}
