import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  marketItems,
  marketRequests,
  procurementRecommendations,
  procurementReviews,
} from "@shared/schema";

import { runProcurementScoutForRequest } from "../services/procurementScout";

const r = Router();

function normalizeSearchText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const isAdmin = req.headers["x-admin"] === "true";
  if (!isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
}

r.get("/api/market/search", async (req, res) => {
  try {
    const qRaw = String(req.query.q ?? "").trim();
    const q = normalizeSearchText(qRaw);
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    if (!q) return res.json({ items: [], total: 0, notFound: false });

    const items = await db
      .select()
      .from(marketItems)
      .where(
        and(
          eq(marketItems.status, "ACTIVE"),
          q ? sql`${marketItems.searchText} ILIKE ${"%" + q + "%"}` : sql`TRUE`
        )
      )
      .orderBy(desc(marketItems.createdAt))
      .limit(limit);

    console.log(`Search for "${q}" returned ${items.length} items`);

    return res.json({
      items,
      total: items.length,
      notFound: items.length === 0,
      requestHint: items.length === 0 ? { query: qRaw } : null
    });
  } catch (error) {
    console.error("Marketplace search error:", error);
    return res.status(500).json({ error: "Search failed", items: [], total: 0 });
  }
});

r.post("/api/market/requests", async (req, res) => {
  const query = String(req.body?.query ?? "").trim();
  const constraints = req.body?.constraints ?? {};
  const requestedByUserId = req.body?.requestedByUserId ?? "anonymous";

  if (!query) return res.status(400).json({ error: "Missing query" });

  const q = normalizeSearchText(query);
  const matches = await db
    .select({ id: marketItems.id })
    .from(marketItems)
    .where(
      and(
        eq(marketItems.status, "ACTIVE"),
        sql`${marketItems.searchText} ILIKE ${"%" + q + "%"}`
      )
    )
    .limit(1);

  const [created] = await db
    .insert(marketRequests)
    .values({
      query,
      constraints,
      requestedByUserId,
      status: "NEW",
      resultCountAtRequestTime: matches.length,
    })
    .returning();

  res.json({ requestId: created.id, status: created.status });

  setImmediate(async () => {
    try {
      await runProcurementScoutForRequest(created.id);
    } catch (e) {
      console.error("Procurement scout failed:", e);
    }
  });
});

r.get("/api/admin/procurement/requests", requireAdmin, async (req, res) => {
  const status = String(req.query.status ?? "REVIEW_READY");

  const rows = await db
    .select()
    .from(marketRequests)
    .where(eq(marketRequests.status, status as any))
    .orderBy(desc(marketRequests.createdAt))
    .limit(100);

  res.json({ requests: rows });
});

r.get("/api/admin/procurement/recommendations", requireAdmin, async (req, res) => {
  const requestId = String(req.query.requestId ?? "");
  if (!requestId) return res.status(400).json({ error: "Missing requestId" });

  const recs = await db
    .select()
    .from(procurementRecommendations)
    .where(eq(procurementRecommendations.requestId, requestId))
    .orderBy(desc(procurementRecommendations.fitScore));

  res.json({ recommendations: recs });
});

r.post("/api/admin/procurement/review", requireAdmin, async (req, res) => {
  const requestId = String(req.body?.requestId ?? "");
  const decision = String(req.body?.decision ?? "");
  const notes = String(req.body?.notes ?? "");
  const approvedRecId = req.body?.approvedRecId ?? null;
  const mode = (req.body?.publishMode ?? "DRAFT_ONLY") as "DRAFT_ONLY" | "PUBLISH_NOW";
  const reviewerUserId = req.body?.reviewerUserId ?? "admin";

  if (!requestId || !decision) return res.status(400).json({ error: "Missing fields" });

  await db.insert(procurementReviews).values({
    requestId,
    decision,
    notes,
    approvedRecId: approvedRecId ?? undefined,
    publishMode: mode,
    reviewerUserId,
  });

  if (decision === "REJECTED") {
    await db.update(marketRequests).set({ status: "REJECTED" }).where(eq(marketRequests.id, requestId));
    return res.json({ ok: true, status: "REJECTED" });
  }

  if (decision === "MORE_INFO_NEEDED") {
    await db.update(marketRequests).set({ status: "NEW" }).where(eq(marketRequests.id, requestId));
    return res.json({ ok: true, status: "NEW", message: "Request returned for more information" });
  }

  if (!approvedRecId) {
    return res.status(400).json({ error: "approvedRecId required for APPROVED" });
  }

  const [rec] = await db
    .select()
    .from(procurementRecommendations)
    .where(eq(procurementRecommendations.id, approvedRecId))
    .limit(1);

  if (!rec) return res.status(404).json({ error: "Recommendation not found" });

  const draftStatus = mode === "PUBLISH_NOW" ? "ACTIVE" : "DRAFT";

  const [item] = await db
    .insert(marketItems)
    .values({
      title: rec.productTitle,
      description: `Requested item. Source recommendation: ${rec.vendorName}.`,
      category: "requested",
      tags: ["requested", rec.vendorName || "unknown"],
      sourceType: "EXTERNAL_FULFILLMENT",
      vendorName: rec.vendorName,
      sourceUrl: rec.sourceUrl,
      priceFiatOptional: rec.priceEstimateFiat ?? undefined,
      kwhEstimate: rec.kwhEstimate ?? "0",
      status: draftStatus,
      searchText: normalizeSearchText(`${rec.productTitle} ${rec.vendorName} requested`),
    })
    .returning();

  await db.update(marketRequests).set({ status: mode === "PUBLISH_NOW" ? "PUBLISHED" : "APPROVED" }).where(eq(marketRequests.id, requestId));

  res.json({ ok: true, requestStatus: mode === "PUBLISH_NOW" ? "PUBLISHED" : "APPROVED", createdItem: item });
});

r.post("/api/market/items/publish", requireAdmin, async (req, res) => {
  const itemId = String(req.body?.itemId ?? "");
  if (!itemId) return res.status(400).json({ error: "Missing itemId" });

  const [updated] = await db
    .update(marketItems)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(eq(marketItems.id, itemId))
    .returning();

  if (!updated) return res.status(404).json({ error: "Item not found" });

  res.json({ ok: true, item: updated });
});

export default r;
