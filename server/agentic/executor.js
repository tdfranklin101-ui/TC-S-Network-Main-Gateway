/**
 * TC-S Network Foundation - Action Executor Service
 * Version: 1.0.0
 * 
 * Routes approved actions to existing core functionality.
 * Maintains audit trail and handles execution state.
 */

const { getActionById, RISK_LEVELS } = require('./api-surface');
const { PolicyEngine, POLICY_DECISIONS } = require('./policy');
const { MarketplaceHandlers } = require('./handlers/marketplace-handlers');

class ActionExecutor {
  constructor(pool) {
    this.pool = pool;
    this.policyEngine = new PolicyEngine(pool);
    this.handlers = {};
    this.marketplaceHandlers = new MarketplaceHandlers(pool);
    this.registerDefaultHandlers();
    this.registerMarketplaceHandlers();
  }

  registerDefaultHandlers() {
    this.handlers['CREATE_NETWORK'] = this.executeCreateNetwork.bind(this);
    this.handlers['QUERY_NETWORK'] = this.executeQueryNetwork.bind(this);
    this.handlers['QUERY_BALANCE'] = this.executeQueryBalance.bind(this);
    this.handlers['CALCULATE_ENERGY'] = this.executeCalculateEnergy.bind(this);
    this.handlers['CREATE_MEMBER'] = this.executeCreateMember.bind(this);
    this.handlers['QUERY_MEMBER'] = this.executeQueryMember.bind(this);
    this.handlers['QUERY_MARKETPLACE'] = this.executeQueryMarketplace.bind(this);
    this.handlers['GENERATE_REPORT'] = this.executeGenerateReport.bind(this);
    this.handlers['LOG_ETHICS_EVENT'] = this.executeLogEthicsEvent.bind(this);
  }

  registerMarketplaceHandlers() {
    const mh = this.marketplaceHandlers;
    this.handlers['ASSET.CREATE'] = mh.executeAssetCreate.bind(mh);
    this.handlers['ASSET.ENRICH'] = mh.executeAssetEnrich.bind(mh);
    this.handlers['ASSET.LIST'] = mh.executeAssetList.bind(mh);
    this.handlers['ASSET.UNLIST'] = mh.executeAssetUnlist.bind(mh);
    this.handlers['ASSET.UPDATE'] = mh.executeAssetUpdate.bind(mh);
    this.handlers['PRICE.QUOTE'] = mh.executePriceQuote.bind(mh);
    this.handlers['PRICE.PUBLISH'] = mh.executePricePublish.bind(mh);
    this.handlers['PRICE.UPDATE_RULES'] = mh.executePriceUpdateRules.bind(mh);
    this.handlers['ORDER.CREATE'] = mh.executeOrderCreate.bind(mh);
    this.handlers['ORDER.CAPTURE_PAYMENT'] = mh.executeOrderCapturePayment.bind(mh);
    this.handlers['ORDER.FULFILL'] = mh.executeOrderFulfill.bind(mh);
    this.handlers['LEDGER.POST'] = mh.executeLedgerPost.bind(mh);
    this.handlers['SETTLEMENT.RUN'] = mh.executeSettlementRun.bind(mh);
    this.handlers['MODERATION.REVIEW'] = mh.executeModerationReview.bind(mh);
    this.handlers['SEARCH.FULFILLMENT.RECOMMEND'] = mh.executeSearchFulfillmentRecommend.bind(mh);
    this.handlers['ALERT.CREATE'] = mh.executeAlertCreate.bind(mh);
  }

  registerHandler(actionType, handler) {
    this.handlers[actionType] = handler;
  }

  async submitAction(actionRequest) {
    const result = await this.pool.query(`
      INSERT INTO action_requests (action_type, agent_id, agent_name, requester_id, risk_level, payload, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      actionRequest.actionType,
      actionRequest.agentId,
      actionRequest.agentName || null,
      actionRequest.requesterId || null,
      getActionById(actionRequest.actionType)?.riskLevel || 'medium',
      JSON.stringify(actionRequest.payload),
      JSON.stringify(actionRequest.metadata || {})
    ]);

    const savedRequest = result.rows[0];

    await this.logAuditEvent(savedRequest.id, 'action_submitted', {
      actionType: actionRequest.actionType,
      agentId: actionRequest.agentId
    });

    const policyResult = await this.policyEngine.evaluateAction(actionRequest);

    await this.pool.query(`
      UPDATE action_requests 
      SET validation_result = $1, policy_checks = $2, updated_at = NOW()
      WHERE id = $3
    `, [
      JSON.stringify({ valid: policyResult.decision !== POLICY_DECISIONS.REJECT }),
      JSON.stringify(policyResult.checks),
      savedRequest.id
    ]);

    if (policyResult.decision === POLICY_DECISIONS.REJECT) {
      await this.pool.query(`
        UPDATE action_requests 
        SET status = 'rejected', error_message = $1, updated_at = NOW()
        WHERE id = $2
      `, [policyResult.reason, savedRequest.id]);

      await this.logAuditEvent(savedRequest.id, 'action_rejected', {
        reason: policyResult.reason,
        checks: policyResult.checks
      });

      return {
        requestId: savedRequest.id,
        status: 'rejected',
        reason: policyResult.reason,
        checks: policyResult.checks
      };
    }

    if (policyResult.decision === POLICY_DECISIONS.REQUIRE_APPROVAL) {
      await this.logAuditEvent(savedRequest.id, 'awaiting_approval', {
        reason: policyResult.reason
      });

      return {
        requestId: savedRequest.id,
        status: 'pending',
        reason: policyResult.reason,
        checks: policyResult.checks,
        requiresApproval: true
      };
    }

    return await this.executeAction(savedRequest.id);
  }

  async approveAction(requestId, approverId) {
    const result = await this.pool.query(
      'SELECT * FROM action_requests WHERE id = $1',
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Action request not found');
    }

    const request = result.rows[0];

    if (request.status !== 'pending') {
      throw new Error(`Cannot approve action with status: ${request.status}`);
    }

    const action = getActionById(request.action_type);
    const metadata = request.metadata || {};
    const approvals = metadata.approvals || [];
    
    if (approvals.some(a => a.approverId === approverId)) {
      throw new Error('Approver has already approved this action');
    }
    
    approvals.push({ approverId, timestamp: new Date().toISOString() });
    metadata.approvals = approvals;
    
    const requiredApprovals = action?.requiresMultiSig ? 2 : 1;
    
    if (approvals.length < requiredApprovals) {
      await this.pool.query(`
        UPDATE action_requests 
        SET metadata = $1, updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(metadata), requestId]);

      await this.logAuditEvent(requestId, 'approval_added', {
        approvedBy: approverId,
        approvalsCount: approvals.length,
        requiredApprovals
      });

      return { 
        requestId, 
        status: 'pending', 
        message: `Approval recorded. ${requiredApprovals - approvals.length} more approval(s) required.`,
        approvals: approvals.length,
        requiredApprovals
      };
    }

    await this.pool.query(`
      UPDATE action_requests 
      SET status = 'approved', approved_by = $1, approved_at = NOW(), metadata = $2, updated_at = NOW()
      WHERE id = $3
    `, [approverId, JSON.stringify(metadata), requestId]);

    await this.logAuditEvent(requestId, 'action_approved', {
      approvedBy: approverId,
      allApprovers: approvals.map(a => a.approverId)
    });

    return { 
      requestId, 
      status: 'approved', 
      message: 'Action approved. Ready for execution.',
      approvals: approvals.length,
      nextStep: 'Call POST /api/agentic/actions/:id/execute to run this action'
    };
  }

  async triggerExecution(requestId, executorId) {
    const result = await this.pool.query(
      'SELECT * FROM action_requests WHERE id = $1',
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Action request not found');
    }

    const request = result.rows[0];

    if (request.status !== 'approved') {
      throw new Error(`Cannot execute action with status: ${request.status}. Must be 'approved' first.`);
    }

    await this.logAuditEvent(requestId, 'execution_triggered', {
      triggeredBy: executorId
    });

    return await this.executeAction(requestId);
  }

  async rejectAction(requestId, rejectorId, reason) {
    await this.pool.query(`
      UPDATE action_requests 
      SET status = 'rejected', error_message = $1, approved_by = $2, updated_at = NOW()
      WHERE id = $3
    `, [reason, rejectorId, requestId]);

    await this.logAuditEvent(requestId, 'action_rejected_manual', {
      rejectedBy: rejectorId,
      reason
    });

    return { requestId, status: 'rejected', reason };
  }

  async executeAction(requestId) {
    const result = await this.pool.query(
      'SELECT * FROM action_requests WHERE id = $1',
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Action request not found');
    }

    const request = result.rows[0];
    const handler = this.handlers[request.action_type];

    if (!handler) {
      await this.pool.query(`
        UPDATE action_requests 
        SET status = 'failed', error_message = $1, updated_at = NOW()
        WHERE id = $2
      `, [`No handler registered for action type: ${request.action_type}`, requestId]);

      return {
        requestId,
        status: 'failed',
        error: `No handler for action type: ${request.action_type}`
      };
    }

    await this.pool.query(`
      UPDATE action_requests SET status = 'executing', updated_at = NOW() WHERE id = $1
    `, [requestId]);

    await this.logAuditEvent(requestId, 'execution_started', {});

    try {
      const executionResult = await handler(request.payload, request);

      await this.pool.query(`
        UPDATE action_requests 
        SET status = 'completed', execution_result = $1, executed_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(executionResult), requestId]);

      await this.logAuditEvent(requestId, 'execution_completed', {
        result: executionResult
      });

      return {
        requestId,
        status: 'completed',
        result: executionResult
      };
    } catch (error) {
      await this.pool.query(`
        UPDATE action_requests 
        SET status = 'failed', error_message = $1, updated_at = NOW()
        WHERE id = $2
      `, [error.message, requestId]);

      await this.logAuditEvent(requestId, 'execution_failed', {
        error: error.message
      });

      return {
        requestId,
        status: 'failed',
        error: error.message
      };
    }
  }

  async logAuditEvent(actionRequestId, eventType, eventData, agentId = null) {
    await this.pool.query(`
      INSERT INTO action_audit_log (action_request_id, event_type, event_data, agent_id)
      VALUES ($1, $2, $3, $4)
    `, [actionRequestId, eventType, JSON.stringify(eventData), agentId]);
  }

  async executeCreateNetwork(payload, request) {
    const result = await this.pool.query(`
      INSERT INTO network_specs (name, network_type, capabilities, region, energy_source, status, action_request_id, created_by_agent_id, initial_solar_allocation, metadata)
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9)
      RETURNING *
    `, [
      payload.name,
      payload.networkType,
      JSON.stringify(payload.capabilities),
      payload.region || 'global',
      payload.energySource || 'solar',
      request.id,
      request.agent_id,
      payload.initialSolarAllocation || 0,
      JSON.stringify(payload.metadata || {})
    ]);

    const network = result.rows[0];
    
    return {
      networkId: network.id,
      name: network.name,
      status: network.status,
      createdAt: network.created_at
    };
  }

  async executeQueryNetwork(payload, request) {
    const result = await this.pool.query(
      'SELECT * FROM network_specs WHERE id = $1 OR name = $1',
      [payload.networkId || payload.name]
    );

    if (result.rows.length === 0) {
      return { network: null, found: false };
    }

    return {
      network: result.rows[0],
      found: true
    };
  }

  async executeQueryBalance(payload, request) {
    const result = await this.pool.query(`
      SELECT m.id, m.username, m.total_solar, w.id as wallet_id
      FROM members m
      LEFT JOIN wallets w ON m.wallet_id = w.id
      WHERE w.id = $1 OR m.id::text = $1
    `, [payload.walletId]);

    if (result.rows.length === 0) {
      return { balance: 0, found: false };
    }

    const member = result.rows[0];
    return {
      balance: parseFloat(member.total_solar) || 0,
      walletId: member.wallet_id,
      memberId: member.id,
      found: true
    };
  }

  async executeCalculateEnergy(payload, request) {
    const SOLAR_RATE = 4913;
    
    if (payload.direction === 'kwh_to_solar' || payload.kWh !== undefined) {
      const solar = payload.kWh / SOLAR_RATE;
      return {
        kWh: payload.kWh,
        solar: parseFloat(solar.toFixed(6)),
        rate: SOLAR_RATE,
        direction: 'kwh_to_solar'
      };
    } else {
      const kWh = payload.solar * SOLAR_RATE;
      return {
        kWh: parseFloat(kWh.toFixed(2)),
        solar: payload.solar,
        rate: SOLAR_RATE,
        direction: 'solar_to_kwh'
      };
    }
  }

  async executeCreateMember(payload, request) {
    const result = await this.pool.query(`
      INSERT INTO members (username, email, total_solar, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, username, email, total_solar
    `, [
      payload.username,
      payload.email,
      payload.initialSolarGrant || 1
    ]);

    const member = result.rows[0];
    return {
      memberId: member.id,
      username: member.username,
      initialBalance: parseFloat(member.total_solar)
    };
  }

  async executeQueryMember(payload, request) {
    const result = await this.pool.query(`
      SELECT id, username, email, total_solar, created_at
      FROM members
      WHERE id = $1 OR email = $2
    `, [payload.memberId, payload.email]);

    if (result.rows.length === 0) {
      return { member: null, found: false };
    }

    return {
      member: result.rows[0],
      balance: parseFloat(result.rows[0].total_solar) || 0,
      found: true
    };
  }

  async executeQueryMarketplace(payload, request) {
    let query = 'SELECT * FROM artifacts WHERE active = true';
    const params = [];
    let paramIndex = 1;

    if (payload.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(payload.category);
    }

    if (payload.query) {
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${payload.query}%`);
      paramIndex++;
    }

    query += ` LIMIT $${paramIndex}`;
    params.push(payload.limit || 20);

    const result = await this.pool.query(query, params);

    return {
      items: result.rows,
      total: result.rows.length,
      query: payload.query || null
    };
  }

  async executeGenerateReport(payload, request) {
    const reportId = `report_${Date.now()}`;
    let data = {};

    if (payload.reportType === 'energy') {
      const result = await this.pool.query(`
        SELECT COUNT(*) as total_members, SUM(total_solar) as total_solar_distributed
        FROM members
      `);
      data = result.rows[0];
    } else if (payload.reportType === 'transactions') {
      const result = await this.pool.query(`
        SELECT type, COUNT(*) as count, SUM(amount_s) as total_amount
        FROM transactions
        GROUP BY type
      `);
      data = { transactions: result.rows };
    } else if (payload.reportType === 'members') {
      const result = await this.pool.query(`
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_last_30_days
        FROM members
      `);
      data = result.rows[0];
    }

    return {
      reportId,
      reportType: payload.reportType,
      data,
      generatedAt: new Date().toISOString()
    };
  }

  async executeLogEthicsEvent(payload, request) {
    const eventId = `ethics_${Date.now()}`;
    
    await this.logAuditEvent(request.id, 'ethics_event', {
      eventType: payload.eventType,
      agentId: payload.agentId,
      description: payload.description,
      ethicsScore: payload.ethicsScore
    }, payload.agentId);

    return {
      eventId,
      logged: true,
      timestamp: new Date().toISOString()
    };
  }

  async getActionStatus(requestId) {
    const result = await this.pool.query(
      'SELECT * FROM action_requests WHERE id = $1',
      [requestId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const request = result.rows[0];
    return {
      requestId: request.id,
      actionType: request.action_type,
      status: request.status,
      createdAt: request.created_at,
      executedAt: request.executed_at,
      result: request.execution_result,
      error: request.error_message
    };
  }

  async getPendingActions(agentId = null) {
    let query = 'SELECT * FROM action_requests WHERE status = $1';
    const params = ['pending'];

    if (agentId) {
      query += ' AND agent_id = $2';
      params.push(agentId);
    }

    query += ' ORDER BY created_at ASC';
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getAllActions(limit = 50, status = null) {
    let query = 'SELECT * FROM action_requests';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }
}

module.exports = { ActionExecutor };
