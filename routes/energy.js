import express from "express";
import { listEnergy, matchEnergyOrders, getEnergyMarket } from "../lib/ledger.js";

const router = express.Router();

router.post("/list", (req, res) => {
  const { walletId, type, kwh, pricePerKwh } = req.body;
  const id = listEnergy(walletId, type, kwh, pricePerKwh);
  res.json({ ok: true, listingId: id });
});

router.post("/match", (req, res) => {
  matchEnergyOrders();
  res.json({ ok: true });
});

router.get("/", (req, res) => {
  res.json(getEnergyMarket());
});

export default router;
