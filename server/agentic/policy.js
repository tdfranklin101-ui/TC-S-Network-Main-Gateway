/**
 * TC-S Network Foundation - Policy Module
 * Version: 1.0.0
 * 
 * Deterministic rules for validating and approving agent actions.
 * All policy checks are synchronous and rule-based (no AI/ML).
 */

const { RISK_LEVELS, ACTION_TYPES, validateActionInput, getActionById } = require('./api-surface');

const POLICY_DECISIONS = {
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUIRE_APPROVAL: 'require_approval',
  RATE_LIMITED: 'rate_limited'
};

class PolicyEngine {
  constructor(pool) {
    this.pool = pool;
    this.rateLimitCache = new Map();
  }

  async evaluateAction(actionRequest) {
    const checks = [];
    const action = getActionById(actionRequest.actionType);
    
    if (!action) {
      return {
        decision: POLICY_DECISIONS.REJECT,
        reason: 'Unknown action type',
        checks: [{ rule: 'action_exists', passed: false, reason: 'Action type not defined in API surface' }]
      };
    }

    checks.push(await this.checkAgentAuthorization(actionRequest, action));
    checks.push(await this.checkInputValidation(actionRequest, action));
    checks.push(await this.checkRateLimit(actionRequest));
    checks.push(await this.checkRiskLevel(actionRequest, action));
    checks.push(await this.checkBusinessRules(actionRequest, action));

    const failedChecks = checks.filter(c => !c.passed);
    
    if (failedChecks.length > 0) {
      const criticalFailure = failedChecks.find(c => c.critical);
      if (criticalFailure) {
        return {
          decision: POLICY_DECISIONS.REJECT,
          reason: criticalFailure.reason,
          checks
        };
      }
    }

    if (action.requiresApproval || action.riskLevel === RISK_LEVELS.HIGH || action.riskLevel === RISK_LEVELS.CRITICAL) {
      return {
        decision: POLICY_DECISIONS.REQUIRE_APPROVAL,
        reason: `Action ${actionRequest.actionType} requires human approval`,
        checks
      };
    }

    return {
      decision: POLICY_DECISIONS.APPROVE,
      reason: 'All policy checks passed',
      checks
    };
  }

  async checkAgentAuthorization(actionRequest, action) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM agent_registry WHERE id = $1 OR agent_name = $1',
        [actionRequest.agentId]
      );

      if (result.rows.length === 0) {
        return {
          rule: 'agent_authorization',
          passed: false,
          critical: true,
          reason: 'Agent not registered in the system'
        };
      }

      const agent = result.rows[0];

      if (!agent.is_active) {
        return {
          rule: 'agent_authorization',
          passed: false,
          critical: true,
          reason: 'Agent is deactivated'
        };
      }

      const allowedActions = agent.allowed_actions || [];
      if (allowedActions.length > 0 && !allowedActions.includes(actionRequest.actionType)) {
        return {
          rule: 'agent_authorization',
          passed: false,
          critical: true,
          reason: `Agent not authorized for action: ${actionRequest.actionType}`
        };
      }

      const riskHierarchy = ['low', 'medium', 'high', 'critical'];
      const agentMaxRisk = riskHierarchy.indexOf(agent.max_risk_level || 'low');
      const actionRisk = riskHierarchy.indexOf(action.riskLevel);

      if (actionRisk > agentMaxRisk) {
        return {
          rule: 'agent_authorization',
          passed: false,
          critical: true,
          reason: `Agent risk level (${agent.max_risk_level}) insufficient for action risk (${action.riskLevel})`
        };
      }

      return {
        rule: 'agent_authorization',
        passed: true,
        reason: 'Agent authorized'
      };
    } catch (error) {
      return {
        rule: 'agent_authorization',
        passed: false,
        critical: true,
        reason: `Authorization check failed: ${error.message}`
      };
    }
  }

  async checkInputValidation(actionRequest, action) {
    const validation = validateActionInput(actionRequest.actionType, actionRequest.payload);
    
    if (!validation.valid) {
      return {
        rule: 'input_validation',
        passed: false,
        critical: true,
        reason: `Invalid input: ${validation.errors.join(', ')}`
      };
    }

    return {
      rule: 'input_validation',
      passed: true,
      reason: 'Input validation passed'
    };
  }

  async checkRateLimit(actionRequest) {
    const cacheKey = `${actionRequest.agentId}:${actionRequest.actionType}`;
    const now = Date.now();
    const windowMs = 60000;
    const maxRequests = 10;

    if (!this.rateLimitCache.has(cacheKey)) {
      this.rateLimitCache.set(cacheKey, { count: 1, windowStart: now });
      return { rule: 'rate_limit', passed: true, reason: 'Within rate limits' };
    }

    const entry = this.rateLimitCache.get(cacheKey);
    
    if (now - entry.windowStart > windowMs) {
      this.rateLimitCache.set(cacheKey, { count: 1, windowStart: now });
      return { rule: 'rate_limit', passed: true, reason: 'Within rate limits' };
    }

    entry.count++;
    
    if (entry.count > maxRequests) {
      return {
        rule: 'rate_limit',
        passed: false,
        critical: false,
        reason: `Rate limit exceeded: ${entry.count}/${maxRequests} requests in window`
      };
    }

    return { rule: 'rate_limit', passed: true, reason: 'Within rate limits' };
  }

  async checkRiskLevel(actionRequest, action) {
    if (action.riskLevel === RISK_LEVELS.CRITICAL && !action.requiresMultiSig) {
      return {
        rule: 'risk_level',
        passed: true,
        warning: true,
        reason: 'Critical action flagged for additional review'
      };
    }

    if (action.requiresMultiSig) {
      const approvals = actionRequest.metadata?.approvals || [];
      if (approvals.length < 2) {
        return {
          rule: 'risk_level',
          passed: false,
          critical: true,
          reason: 'Multi-signature required: need at least 2 approvals'
        };
      }
    }

    return {
      rule: 'risk_level',
      passed: true,
      reason: `Risk level ${action.riskLevel} acceptable`
    };
  }

  async checkBusinessRules(actionRequest, action) {
    const rules = [];

    if (actionRequest.actionType === 'TRANSFER_SOLAR') {
      const { fromWalletId, toWalletId, amount } = actionRequest.payload;
      
      if (fromWalletId === toWalletId) {
        return {
          rule: 'business_rules',
          passed: false,
          critical: true,
          reason: 'Cannot transfer Solar to the same wallet'
        };
      }

      if (amount > 100) {
        rules.push({ check: 'large_transfer', warning: true, note: 'Transfer exceeds 100 Solar - flagged for review' });
      }
    }

    if (actionRequest.actionType === 'CREATE_NETWORK') {
      const { name, networkType, capabilities } = actionRequest.payload;
      
      if (capabilities.length > 10) {
        return {
          rule: 'business_rules',
          passed: false,
          critical: true,
          reason: 'Network cannot have more than 10 capabilities at creation'
        };
      }

      const existingNetwork = await this.pool.query(
        'SELECT id FROM network_specs WHERE name = $1 AND status != $2',
        [name, 'deleted']
      );
      
      if (existingNetwork.rows.length > 0) {
        return {
          rule: 'business_rules',
          passed: false,
          critical: true,
          reason: `Network with name "${name}" already exists`
        };
      }
    }

    if (actionRequest.actionType === 'MINT_SOLAR') {
      const { amount, kwhVerified } = actionRequest.payload;
      const requiredKwh = amount * 4913;
      
      if (kwhVerified < requiredKwh) {
        return {
          rule: 'business_rules',
          passed: false,
          critical: true,
          reason: `Insufficient energy verification: ${kwhVerified} kWh provided, ${requiredKwh} kWh required for ${amount} Solar`
        };
      }
    }

    return {
      rule: 'business_rules',
      passed: true,
      reason: 'Business rules passed',
      details: rules
    };
  }

  async loadCustomRules() {
    try {
      const result = await this.pool.query(
        'SELECT * FROM policy_rules WHERE is_active = true ORDER BY priority DESC'
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to load custom policy rules:', error);
      return [];
    }
  }

  async applyCustomRules(actionRequest, customRules) {
    const results = [];
    
    for (const rule of customRules) {
      if (rule.action_types.includes('*') || rule.action_types.includes(actionRequest.actionType)) {
        const passed = this.evaluateCondition(rule.conditions, actionRequest);
        results.push({
          rule: rule.rule_name,
          passed,
          reason: passed ? `Custom rule ${rule.rule_name} passed` : `Custom rule ${rule.rule_name} failed`
        });
      }
    }
    
    return results;
  }

  evaluateCondition(conditions, actionRequest) {
    if (!conditions || Object.keys(conditions).length === 0) return true;
    
    if (conditions.type === 'always_allow') return true;
    if (conditions.type === 'always_deny') return false;
    
    if (conditions.maxAmount && actionRequest.payload.amount > conditions.maxAmount) {
      return false;
    }
    
    if (conditions.allowedAgents && !conditions.allowedAgents.includes(actionRequest.agentId)) {
      return false;
    }
    
    return true;
  }
}

module.exports = {
  PolicyEngine,
  POLICY_DECISIONS
};
