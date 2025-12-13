import express from "express";
import { db } from "../db";
import { eq, desc, sql, and } from "drizzle-orm";
import { 
  gumballProducts, 
  gumballTransactions, 
  gumballs, 
  gumballJobs, 
  gumballAssets,
  wallets 
} from "@shared/schema";
import { nightMarketJuggler, composePrompt } from "../gumballs/nightMarketJuggler";

const router = express.Router();

// Constants
const RAYS_PER_SOLAR = 10000;

// Helper: Get or create visitor wallet by visitorId
async function getOrCreateVisitorWallet(visitorId: string) {
  let wallet = await db.select().from(wallets).where(eq(wallets.userId, visitorId)).then(r => r[0]);
  
  if (!wallet) {
    const result = await db.insert(wallets).values({
      userId: visitorId,
      promptCredits: 0,
      balanceRays: 0,
      balanceSolarS: "0"
    }).returning();
    wallet = result[0];
  }
  
  return wallet;
}

// GET /api/gumball/me - Current user session with promptCredits
router.get("/me", async (req, res) => {
  try {
    const visitorId = req.query.visitorId as string || (req.session as any)?.visitorId;
    
    if (!visitorId) {
      return res.json({ 
        visitorId: null, 
        promptCredits: 0, 
        message: "No session - provide visitorId query param" 
      });
    }
    
    const wallet = await getOrCreateVisitorWallet(visitorId);
    
    res.json({
      visitorId,
      promptCredits: wallet.promptCredits || 0,
      balanceRays: wallet.balanceRays || 0
    });
  } catch (error) {
    console.error("Error fetching gumball user:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// GET /api/gumball/products - List active products with Rays/Solar pricing
router.get("/products", async (req, res) => {
  try {
    const products = await db.select()
      .from(gumballProducts)
      .where(eq(gumballProducts.active, true))
      .orderBy(gumballProducts.priceRays);
    
    const productsWithSolar = products.map(p => ({
      ...p,
      priceSolar: (p.priceRays / RAYS_PER_SOLAR).toFixed(4),
      priceUsd: (p.priceRays / RAYS_PER_SOLAR * 0.10).toFixed(2) // Approximate USD value
    }));
    
    res.json(productsWithSolar);
  } catch (error) {
    console.error("Error fetching gumball products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST /api/gumball/buy - Redirect to external checkout
router.post("/buy", async (req, res) => {
  try {
    const { productId, currency, visitorId } = req.body;
    
    if (!productId || !currency || !visitorId) {
      return res.status(400).json({ error: "Missing productId, currency, or visitorId" });
    }
    
    const product = await db.select()
      .from(gumballProducts)
      .where(eq(gumballProducts.id, productId))
      .then(r => r[0]);
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // Get checkout URL from environment based on product tier
    const tierMap: { [key: number]: string } = {
      5: "5",
      20: "20",
      100: "100"
    };
    const tier = tierMap[product.pulls] || "5";
    const envKey = `CHECKOUT_${currency.toUpperCase()}_${tier}`;
    const checkoutUrl = process.env[envKey] || `https://checkout.example.com/${currency.toLowerCase()}/${tier}`;
    
    // Create transaction record
    const transaction = await db.insert(gumballTransactions).values({
      visitorId,
      productId,
      currency: currency.toUpperCase(),
      status: "pending",
      checkoutUrl,
      priceRays: product.priceRays,
      pullsPurchased: product.pulls
    }).returning();
    
    res.json({
      transactionId: transaction[0].id,
      checkoutUrl,
      product: {
        name: product.name,
        pulls: product.pulls,
        priceRays: product.priceRays
      }
    });
  } catch (error) {
    console.error("Error processing gumball purchase:", error);
    res.status(500).json({ error: "Failed to process purchase" });
  }
});

// POST /api/gumball/confirm - Confirm a purchase (webhook or manual)
router.post("/confirm", async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({ error: "Missing transactionId" });
    }
    
    const transaction = await db.select()
      .from(gumballTransactions)
      .where(eq(gumballTransactions.id, transactionId))
      .then(r => r[0]);
    
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    
    if (transaction.status === "confirmed") {
      return res.json({ message: "Already confirmed", transaction });
    }
    
    // Ensure wallet exists before crediting
    await getOrCreateVisitorWallet(transaction.visitorId);
    
    // Update transaction status
    await db.update(gumballTransactions)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(gumballTransactions.id, transactionId));
    
    // Add credits to wallet and verify update succeeded
    const updatedWallet = await db.update(wallets)
      .set({ promptCredits: sql`COALESCE(${wallets.promptCredits}, 0) + ${transaction.pullsPurchased}` })
      .where(eq(wallets.userId, transaction.visitorId))
      .returning();
    
    if (updatedWallet.length === 0) {
      console.error(`[GumballConfirm] Failed to credit wallet for visitor ${transaction.visitorId}`);
      return res.status(500).json({ error: "Failed to credit wallet" });
    }
    
    console.log(`[GumballConfirm] Credited ${transaction.pullsPurchased} credits to ${transaction.visitorId}, new balance: ${updatedWallet[0].promptCredits}`);
    
    res.json({ 
      success: true, 
      creditsAdded: transaction.pullsPurchased,
      newBalance: updatedWallet[0].promptCredits
    });
  } catch (error) {
    console.error("Error confirming gumball purchase:", error);
    res.status(500).json({ error: "Failed to confirm purchase" });
  }
});

// POST /api/gumball/vend - Atomically decrement credit and create gumball
router.post("/vend", async (req, res) => {
  try {
    const { visitorId } = req.body;
    
    if (!visitorId) {
      return res.status(400).json({ error: "Missing visitorId" });
    }
    
    const wallet = await getOrCreateVisitorWallet(visitorId);
    
    if (!wallet.promptCredits || wallet.promptCredits < 1) {
      return res.status(400).json({ error: "Insufficient prompt credits", promptCredits: wallet.promptCredits || 0 });
    }
    
    // Atomically decrement credits
    const updatedWallet = await db.update(wallets)
      .set({ promptCredits: sql`${wallets.promptCredits} - 1` })
      .where(and(
        eq(wallets.userId, visitorId),
        sql`${wallets.promptCredits} >= 1`
      ))
      .returning();
    
    if (updatedWallet.length === 0) {
      return res.status(400).json({ error: "Failed to decrement credits - race condition" });
    }
    
    // Create gumball using Night Market Juggler generator
    const generator = nightMarketJuggler;
    
    const gumball = await db.insert(gumballs).values({
      visitorId,
      title: generator.title,
      type: generator.type,
      promptMain: generator.promptMain,
      remixJson: generator.remixes,
      mcpRunbook: generator.mcpRunbook
    }).returning();
    
    res.json({
      gumball: gumball[0],
      remainingCredits: updatedWallet[0].promptCredits
    });
  } catch (error) {
    console.error("Error vending gumball:", error);
    res.status(500).json({ error: "Failed to vend gumball" });
  }
});

// POST /api/gumball/run - Create job with composed prompt
router.post("/run", async (req, res) => {
  try {
    const { gumballId, remixId, visitorId } = req.body;
    
    if (!gumballId || !visitorId) {
      return res.status(400).json({ error: "Missing gumballId or visitorId" });
    }
    
    const gumball = await db.select()
      .from(gumballs)
      .where(eq(gumballs.id, gumballId))
      .then(r => r[0]);
    
    if (!gumball) {
      return res.status(404).json({ error: "Gumball not found" });
    }
    
    // Compose the prompt with selected remix
    const composedPrompt = composePrompt(nightMarketJuggler, remixId || "");
    
    // Create job
    const job = await db.insert(gumballJobs).values({
      visitorId,
      gumballId,
      status: "QUEUED",
      provider: "SORA_MANUAL",
      composedPrompt,
      selectedRemixId: remixId || null
    }).returning();
    
    res.json({
      job: job[0],
      composedPrompt
    });
  } catch (error) {
    console.error("Error creating gumball job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

// GET /api/gumball/job/:jobId - Get job status and assets
router.get("/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await db.select()
      .from(gumballJobs)
      .where(eq(gumballJobs.id, jobId))
      .then(r => r[0]);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const assets = await db.select()
      .from(gumballAssets)
      .where(eq(gumballAssets.jobId, jobId));
    
    res.json({
      job,
      assets
    });
  } catch (error) {
    console.error("Error fetching gumball job:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

// GET /api/gumball/jobs - Get all jobs for a visitor
router.get("/jobs", async (req, res) => {
  try {
    const visitorId = req.query.visitorId as string;
    
    if (!visitorId) {
      return res.status(400).json({ error: "Missing visitorId" });
    }
    
    const jobs = await db.select()
      .from(gumballJobs)
      .where(eq(gumballJobs.visitorId, visitorId))
      .orderBy(desc(gumballJobs.createdAt));
    
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching gumball jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /api/gumball/gumballs - Get all gumballs for a visitor
router.get("/gumballs", async (req, res) => {
  try {
    const visitorId = req.query.visitorId as string;
    
    if (!visitorId) {
      return res.status(400).json({ error: "Missing visitorId" });
    }
    
    const userGumballs = await db.select()
      .from(gumballs)
      .where(eq(gumballs.visitorId, visitorId))
      .orderBy(desc(gumballs.createdAt));
    
    res.json(userGumballs);
  } catch (error) {
    console.error("Error fetching gumballs:", error);
    res.status(500).json({ error: "Failed to fetch gumballs" });
  }
});

// POST /api/gumball/deliver - Manual asset delivery
router.post("/deliver", async (req, res) => {
  try {
    const { jobId, videoUrl, thumbnailUrl } = req.body;
    
    if (!jobId) {
      return res.status(400).json({ error: "Missing jobId" });
    }
    
    const job = await db.select()
      .from(gumballJobs)
      .where(eq(gumballJobs.id, jobId))
      .then(r => r[0]);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const createdAssets = [];
    
    // Create video asset if provided
    if (videoUrl) {
      const videoAsset = await db.insert(gumballAssets).values({
        jobId,
        kind: "video",
        url: videoUrl
      }).returning();
      createdAssets.push(videoAsset[0]);
    }
    
    // Create thumbnail asset if provided
    if (thumbnailUrl) {
      const thumbAsset = await db.insert(gumballAssets).values({
        jobId,
        kind: "thumbnail",
        url: thumbnailUrl
      }).returning();
      createdAssets.push(thumbAsset[0]);
    }
    
    // Update job status to DELIVERED
    await db.update(gumballJobs)
      .set({ status: "DELIVERED", updatedAt: new Date() })
      .where(eq(gumballJobs.id, jobId));
    
    res.json({
      success: true,
      assets: createdAssets,
      jobStatus: "DELIVERED"
    });
  } catch (error) {
    console.error("Error delivering gumball assets:", error);
    res.status(500).json({ error: "Failed to deliver assets" });
  }
});

// POST /api/gumball/seed - Seed product tiers (admin endpoint)
router.post("/seed", async (req, res) => {
  try {
    const productTiers = [
      { name: "Pocket Roll", pulls: 5, priceRays: 50 },
      { name: "Creator Roll", pulls: 20, priceRays: 180 },
      { name: "Studio Roll", pulls: 100, priceRays: 800 }
    ];
    
    const createdProducts = [];
    
    for (const tier of productTiers) {
      // Check if product already exists
      const existing = await db.select()
        .from(gumballProducts)
        .where(eq(gumballProducts.name, tier.name))
        .then(r => r[0]);
      
      if (!existing) {
        const product = await db.insert(gumballProducts).values({
          name: tier.name,
          pulls: tier.pulls,
          priceRays: tier.priceRays,
          active: true
        }).returning();
        createdProducts.push(product[0]);
      } else {
        createdProducts.push(existing);
      }
    }
    
    res.json({
      success: true,
      products: createdProducts
    });
  } catch (error) {
    console.error("Error seeding gumball products:", error);
    res.status(500).json({ error: "Failed to seed products" });
  }
});

export default router;
