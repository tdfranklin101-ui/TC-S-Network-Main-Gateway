/**
 * TC-S Network Foundation - Daily Scheduler
 * Version: 1.0.0
 * 
 * Automated schedulers for:
 * - Daily settlement runs
 * - Daily reports
 * - Risk scans
 * - Inventory audits
 */

const crypto = require('crypto');
const { getIntentLogger, hashPayload } = require('./security');

const JOB_TYPES = {
  SETTLEMENT_DAILY: 'settlement.daily',
  REPORT_DAILY: 'report.daily',
  RISK_SCAN: 'risk.scan',
  INVENTORY_AUDIT: 'inventory.audit',
  POLICY_REVIEW: 'policy.review',
  SESSION_CLEANUP: 'session.cleanup'
};

const DEFAULT_SCHEDULES = {
  [JOB_TYPES.SETTLEMENT_DAILY]: '0 2 * * *',
  [JOB_TYPES.REPORT_DAILY]: '0 3 * * *',
  [JOB_TYPES.RISK_SCAN]: '0 * * * *',
  [JOB_TYPES.INVENTORY_AUDIT]: '0 4 * * 0',
  [JOB_TYPES.POLICY_REVIEW]: '0 5 * * 1',
  [JOB_TYPES.SESSION_CLEANUP]: '0 0 * * *'
};

class Scheduler {
  constructor(pool, executor) {
    this.pool = pool;
    this.executor = executor;
    this.runningJobs = new Map();
    this.intervals = new Map();
    this.isRunning = false;
  }

  async initialize() {
    await this.ensureJobsTable();
    await this.seedDefaultJobs();
    console.log('✅ Scheduler initialized');
  }

  async ensureJobsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_type VARCHAR(100) NOT NULL,
        schedule VARCHAR(100) NOT NULL,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        status VARCHAR(50) DEFAULT 'pending',
        network_id VARCHAR(100),
        config JSONB DEFAULT '{}',
        last_result JSONB,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_type ON scheduled_jobs(job_type)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at)`);
  }

  async seedDefaultJobs() {
    for (const [jobType, schedule] of Object.entries(DEFAULT_SCHEDULES)) {
      const exists = await this.pool.query(
        'SELECT id FROM scheduled_jobs WHERE job_type = $1',
        [jobType]
      );
      
      if (exists.rows.length === 0) {
        const nextRun = this.calculateNextRun(schedule);
        await this.pool.query(`
          INSERT INTO scheduled_jobs (job_type, schedule, next_run_at, network_id, config)
          VALUES ($1, $2, $3, 'default', $4)
        `, [jobType, schedule, nextRun, JSON.stringify({ autoCreated: true })]);
      }
    }
  }

  calculateNextRun(cronExpression) {
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    if (parts.length !== 5) {
      now.setDate(now.getDate() + 1);
      now.setHours(2, 0, 0, 0);
      return now;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (hour !== '*' && minute !== '*') {
      const targetHour = parseInt(hour, 10);
      const targetMinute = parseInt(minute, 10);
      
      now.setSeconds(0);
      now.setMilliseconds(0);

      if (dayOfWeek !== '*') {
        const targetDay = parseInt(dayOfWeek, 10);
        const currentDay = now.getDay();
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0 && (now.getHours() > targetHour || 
            (now.getHours() === targetHour && now.getMinutes() >= targetMinute))) {
          daysUntilTarget = 7;
        }
        now.setDate(now.getDate() + daysUntilTarget);
        now.setHours(targetHour, targetMinute, 0, 0);
        return now;
      }

      if (now.getHours() > targetHour || 
          (now.getHours() === targetHour && now.getMinutes() >= targetMinute)) {
        now.setDate(now.getDate() + 1);
      }
      now.setHours(targetHour, targetMinute, 0, 0);
      return now;
    }

    if (minute === '0' && hour === '*') {
      now.setMinutes(0);
      now.setSeconds(0);
      now.setMilliseconds(0);
      now.setHours(now.getHours() + 1);
      return now;
    }

    now.setDate(now.getDate() + 1);
    now.setHours(2, 0, 0, 0);
    return now;
  }

  start(intervalMs = 60000) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🕐 Scheduler started');
    
    this.checkInterval = setInterval(() => this.checkAndRunJobs(), intervalMs);
    this.checkAndRunJobs();
  }

  stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    console.log('🕐 Scheduler stopped');
  }

  async checkAndRunJobs() {
    if (!this.isRunning) return;

    try {
      const dueJobs = await this.pool.query(`
        SELECT * FROM scheduled_jobs 
        WHERE is_enabled = true 
          AND status != 'running'
          AND (next_run_at IS NULL OR next_run_at <= NOW())
        ORDER BY next_run_at ASC
        LIMIT 10
      `);

      for (const job of dueJobs.rows) {
        this.runJob(job).catch(err => {
          console.error(`Job ${job.job_type} failed:`, err.message);
        });
      }
    } catch (error) {
      console.error('Scheduler check failed:', error.message);
    }
  }

  async runJob(job) {
    if (this.runningJobs.has(job.id)) {
      return;
    }

    this.runningJobs.set(job.id, true);
    const startTime = Date.now();

    try {
      await this.pool.query(
        'UPDATE scheduled_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['running', job.id]
      );

      console.log(`⏳ Running job: ${job.job_type}`);
      const result = await this.executeJob(job);
      
      const nextRun = this.calculateNextRun(job.schedule);
      await this.pool.query(`
        UPDATE scheduled_jobs 
        SET status = 'completed', 
            last_run_at = NOW(), 
            next_run_at = $1,
            last_result = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [nextRun, JSON.stringify({
        success: true,
        duration_ms: Date.now() - startTime,
        result
      }), job.id]);

      console.log(`✅ Job completed: ${job.job_type} (${Date.now() - startTime}ms)`);
    } catch (error) {
      const nextRun = this.calculateNextRun(job.schedule);
      await this.pool.query(`
        UPDATE scheduled_jobs 
        SET status = 'failed', 
            last_run_at = NOW(),
            next_run_at = $1,
            last_result = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [nextRun, JSON.stringify({
        success: false,
        duration_ms: Date.now() - startTime,
        error: error.message
      }), job.id]);

      console.error(`❌ Job failed: ${job.job_type} - ${error.message}`);
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  async executeJob(job) {
    const startTime = Date.now();
    const reqId = `scheduler-${job.job_type}-${Date.now()}`;
    const logger = getIntentLogger();
    
    if (logger) {
      await logger.log({
        userId: 'system-scheduler',
        role: 'scheduler',
        actionType: job.job_type,
        route: '/internal/scheduler',
        method: 'CRON',
        reqId,
        payloadHash: hashPayload({ jobId: job.id, networkId: job.network_id }),
        success: true,
        metadata: { jobId: job.id, triggered: 'automatic' }
      });
    }
    
    let result;
    switch (job.job_type) {
      case JOB_TYPES.SETTLEMENT_DAILY:
        result = await this.runDailySettlement(job);
        break;
      
      case JOB_TYPES.REPORT_DAILY:
        result = await this.runDailyReport(job);
        break;
      
      case JOB_TYPES.RISK_SCAN:
        result = await this.runRiskScan(job);
        break;
      
      case JOB_TYPES.INVENTORY_AUDIT:
        result = await this.runInventoryAudit(job);
        break;
      
      case JOB_TYPES.SESSION_CLEANUP:
        result = await this.runSessionCleanup(job);
        break;
      
      default:
        console.log(`Unknown job type: ${job.job_type}`);
        result = { skipped: true, reason: 'unknown_job_type' };
    }
    
    return result;
  }

  async runDailySettlement(job) {
    const networkId = job.network_id || 'default';
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 1);
    periodStart.setHours(0, 0, 0, 0);
    
    const periodEnd = new Date(now);
    periodEnd.setHours(0, 0, 0, 0);

    if (!this.executor) {
      return { skipped: true, reason: 'no_executor' };
    }

    const result = await this.executor.submitAction({
      actionType: 'SETTLEMENT.RUN',
      agentId: 'tcs-scheduler-agent-v1',
      requesterId: 'tcs-scheduler-agent-v1',
      payload: {
        networkId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        dryRun: false,
        source: 'daily_scheduler'
      }
    });

    return {
      networkId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      actionResult: result
    };
  }

  async runDailyReport(job) {
    const networkId = job.network_id || 'default';
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const ordersResult = await this.pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'fulfilled' THEN 1 END) as fulfilled_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(total_solar), 0) as total_volume_solar
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2
    `, [yesterday, endOfYesterday]);

    const ledgerResult = await this.pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM ledger_events
      WHERE posted_at >= $1 AND posted_at <= $2
      GROUP BY event_type
    `, [yesterday, endOfYesterday]);

    const inventoryResult = await this.pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(available), 0) as total_available,
        COALESCE(SUM(reserved), 0) as total_reserved
      FROM inventory
    `);

    const report = {
      reportDate: yesterday.toISOString().split('T')[0],
      networkId,
      orders: ordersResult.rows[0],
      ledgerByType: ledgerResult.rows,
      inventory: inventoryResult.rows[0],
      generatedAt: now.toISOString()
    };

    console.log('📊 Daily Report:', JSON.stringify(report, null, 2));
    return report;
  }

  async runRiskScan(job) {
    const alerts = [];

    const highValueOrders = await this.pool.query(`
      SELECT id, buyer_id, total_solar, created_at
      FROM orders
      WHERE total_solar > 100
        AND created_at > NOW() - INTERVAL '1 hour'
        AND status = 'reserved'
    `);

    for (const order of highValueOrders.rows) {
      alerts.push({
        type: 'high_value_order',
        severity: 'medium',
        orderId: order.id,
        buyerId: order.buyer_id,
        amount: order.total_solar,
        message: `High-value order (${order.total_solar} Solar) in reserved status`
      });
    }

    const rapidRefunds = await this.pool.query(`
      SELECT buyer_id, COUNT(*) as refund_count
      FROM orders
      WHERE status = 'refunded'
        AND updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY buyer_id
      HAVING COUNT(*) >= 3
    `);

    for (const row of rapidRefunds.rows) {
      alerts.push({
        type: 'rapid_refunds',
        severity: 'high',
        buyerId: row.buyer_id,
        refundCount: row.refund_count,
        message: `User ${row.buyer_id} has ${row.refund_count} refunds in 24 hours`
      });
    }

    if (alerts.length > 0) {
      console.log(`⚠️ Risk scan found ${alerts.length} alerts`);
    }

    return { alertCount: alerts.length, alerts };
  }

  async runInventoryAudit(job) {
    const discrepancies = [];

    const inventoryCheck = await this.pool.query(`
      SELECT i.asset_id, i.available, i.reserved, i.sold,
             COUNT(oi.id) as order_items_count
      FROM inventory i
      LEFT JOIN order_items oi ON i.asset_id = oi.asset_id
      GROUP BY i.asset_id, i.available, i.reserved, i.sold
    `);

    for (const row of inventoryCheck.rows) {
      if (row.reserved < 0 || row.available < 0) {
        discrepancies.push({
          assetId: row.asset_id,
          issue: 'negative_quantity',
          available: row.available,
          reserved: row.reserved
        });
      }
    }

    if (discrepancies.length > 0) {
      console.log(`⚠️ Inventory audit found ${discrepancies.length} discrepancies`);
    }

    return { discrepancyCount: discrepancies.length, discrepancies };
  }

  async runSessionCleanup(job) {
    const result = await this.pool.query(`
      DELETE FROM session WHERE expire < NOW()
      RETURNING sid
    `);

    return { deletedSessions: result.rowCount };
  }

  async triggerJob(jobType, options = {}) {
    const job = await this.pool.query(
      'SELECT * FROM scheduled_jobs WHERE job_type = $1',
      [jobType]
    );

    if (job.rows.length === 0) {
      throw new Error(`Job type not found: ${jobType}`);
    }

    return this.runJob(job.rows[0]);
  }

  async getJobStatus() {
    const jobs = await this.pool.query(`
      SELECT job_type, status, last_run_at, next_run_at, is_enabled
      FROM scheduled_jobs
      ORDER BY job_type
    `);
    return jobs.rows;
  }
}

module.exports = { Scheduler, JOB_TYPES, DEFAULT_SCHEDULES };
