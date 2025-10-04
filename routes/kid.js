import express from "express";
import { kidSolarRespond } from "../lib/kidSolar.js";

const router = express.Router();

router.post("/query", async (req, res) => {
  const { walletId, text } = req.body;
  const reply = await kidSolarRespond(walletId, text);
  res.json({ reply });
});

export default router;
