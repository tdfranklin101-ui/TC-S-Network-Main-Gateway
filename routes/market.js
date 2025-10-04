import express from "express";
import { MarketCategories } from "../lib/categories.js";
import { artifacts } from "../lib/artifacts.js";

const router = express.Router();

router.get("/categories", (req, res) => {
  res.json(MarketCategories);
});

router.get("/artifacts/:category", (req, res) => {
  const cat = req.params.category;
  const filtered = artifacts.filter(a => a.category === cat);
  res.json(filtered);
});

export default router;
