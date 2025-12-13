// Gumball Worker - Polls for QUEUED jobs and processes them
// MCP Pipeline: QUEUED → RUNNING → AWAITING_ASSET

import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { gumballJobs, gumballAssets } from "@shared/schema";

const POLL_INTERVAL_MS = 2000;

async function processQueuedJobs() {
  try {
    // Find QUEUED jobs
    const queuedJobs = await db.select()
      .from(gumballJobs)
      .where(eq(gumballJobs.status, "QUEUED"))
      .limit(5);
    
    for (const job of queuedJobs) {
      console.log(`[GumballWorker] Processing job ${job.id}`);
      
      // Update to RUNNING
      await db.update(gumballJobs)
        .set({ status: "RUNNING", updatedAt: new Date() })
        .where(eq(gumballJobs.id, job.id));
      
      // Create prompt_txt asset as data URL
      const promptTxt = job.composedPrompt || "No prompt available";
      const promptDataUrl = `data:text/plain;base64,${Buffer.from(promptTxt).toString('base64')}`;
      
      await db.insert(gumballAssets).values({
        jobId: job.id,
        kind: "prompt_txt",
        url: promptDataUrl
      });
      
      // Update to AWAITING_ASSET (waiting for manual Sora delivery)
      await db.update(gumballJobs)
        .set({ status: "AWAITING_ASSET", updatedAt: new Date() })
        .where(eq(gumballJobs.id, job.id));
      
      console.log(`[GumballWorker] Job ${job.id} now AWAITING_ASSET`);
    }
  } catch (error) {
    console.error("[GumballWorker] Error processing jobs:", error);
  }
}

// Start worker loop
export function startGumballWorker() {
  console.log("[GumballWorker] Starting worker loop...");
  
  setInterval(processQueuedJobs, POLL_INTERVAL_MS);
  
  // Run immediately once
  processQueuedJobs();
}

// Auto-start if run directly
if (require.main === module) {
  startGumballWorker();
}
