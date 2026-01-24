/**
 * TC-S Network Foundation - Core Agent API Surface
 * Version: 1.0.0
 * 
 * This file defines the 18 operations agents are allowed to perform,
 * with JSON schemas for inputs/outputs and risk classifications.
 */

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const ACTION_TYPES = {
  // Network Operations (4)
  CREATE_NETWORK: {
    id: 'CREATE_NETWORK',
    description: 'Create a new satellite network in the TC-S ecosystem',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['name', 'networkType', 'capabilities'],
      properties: {
        name: { type: 'string', minLength: 3, maxLength: 100 },
        networkType: { 
          type: 'string', 
          enum: ['satellite', 'gateway', 'relay', 'compute', 'storage'] 
        },
        capabilities: { 
          type: 'array', 
          items: { type: 'string' },
          minItems: 1
        },
        region: { type: 'string', default: 'global' },
        energySource: { type: 'string', enum: ['solar', 'wind', 'hydro', 'mixed'] },
        initialSolarAllocation: { type: 'number', minimum: 0 },
        metadata: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  UPDATE_NETWORK: {
    id: 'UPDATE_NETWORK',
    description: 'Modify network configuration or capabilities',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['networkId'],
      properties: {
        networkId: { type: 'string' },
        name: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['active', 'maintenance', 'suspended'] },
        metadata: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        updated: { type: 'boolean' },
        changes: { type: 'object' }
      }
    }
  },

  DELETE_NETWORK: {
    id: 'DELETE_NETWORK',
    description: 'Permanently remove a network from the ecosystem',
    riskLevel: RISK_LEVELS.CRITICAL,
    requiresApproval: true,
    requiresMultiSig: true,
    inputSchema: {
      type: 'object',
      required: ['networkId', 'confirmationCode'],
      properties: {
        networkId: { type: 'string' },
        confirmationCode: { type: 'string' },
        reason: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        archiveId: { type: 'string' }
      }
    }
  },

  QUERY_NETWORK: {
    id: 'QUERY_NETWORK',
    description: 'Retrieve network information and status',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        includeMetrics: { type: 'boolean', default: false },
        includeMembers: { type: 'boolean', default: false }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        network: { type: 'object' },
        metrics: { type: 'object' },
        members: { type: 'array' }
      }
    }
  },

  // Member Operations (4)
  CREATE_MEMBER: {
    id: 'CREATE_MEMBER',
    description: 'Register a new member in the TC-S Network',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['username', 'email'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        email: { type: 'string', format: 'email' },
        fullName: { type: 'string' },
        initialSolarGrant: { type: 'number', default: 1, minimum: 0, maximum: 10 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        memberId: { type: 'number' },
        walletId: { type: 'string' },
        initialBalance: { type: 'number' }
      }
    }
  },

  UPDATE_MEMBER: {
    id: 'UPDATE_MEMBER',
    description: 'Modify member profile or settings',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['memberId'],
      properties: {
        memberId: { type: 'number' },
        email: { type: 'string', format: 'email' },
        fullName: { type: 'string' },
        preferences: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        updated: { type: 'boolean' },
        memberId: { type: 'number' }
      }
    }
  },

  SUSPEND_MEMBER: {
    id: 'SUSPEND_MEMBER',
    description: 'Temporarily suspend a member account',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['memberId', 'reason'],
      properties: {
        memberId: { type: 'number' },
        reason: { type: 'string', minLength: 10 },
        duration: { type: 'string', enum: ['24h', '7d', '30d', 'indefinite'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        suspended: { type: 'boolean' },
        expiresAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  QUERY_MEMBER: {
    id: 'QUERY_MEMBER',
    description: 'Retrieve member information',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        memberId: { type: 'number' },
        email: { type: 'string' },
        includeBalance: { type: 'boolean', default: true },
        includeTransactions: { type: 'boolean', default: false }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        member: { type: 'object' },
        balance: { type: 'number' },
        transactions: { type: 'array' }
      }
    }
  },

  // Solar Token Operations (4)
  TRANSFER_SOLAR: {
    id: 'TRANSFER_SOLAR',
    description: 'Transfer Solar tokens between wallets',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['fromWalletId', 'toWalletId', 'amount'],
      properties: {
        fromWalletId: { type: 'string' },
        toWalletId: { type: 'string' },
        amount: { type: 'number', minimum: 0.001 },
        memo: { type: 'string', maxLength: 256 },
        category: { type: 'string', enum: ['grant', 'payment', 'refund', 'distribution'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        success: { type: 'boolean' },
        newBalances: { type: 'object' }
      }
    }
  },

  MINT_SOLAR: {
    id: 'MINT_SOLAR',
    description: 'Create new Solar tokens (Foundation only)',
    riskLevel: RISK_LEVELS.CRITICAL,
    requiresApproval: true,
    requiresMultiSig: true,
    inputSchema: {
      type: 'object',
      required: ['amount', 'energySource', 'kwhVerified'],
      properties: {
        amount: { type: 'number', minimum: 0.001 },
        energySource: { type: 'string' },
        kwhVerified: { type: 'number', minimum: 4913 },
        auditReference: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        mintId: { type: 'string' },
        amountMinted: { type: 'number' },
        totalSupply: { type: 'number' }
      }
    }
  },

  QUERY_BALANCE: {
    id: 'QUERY_BALANCE',
    description: 'Check Solar balance for a wallet',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['walletId'],
      properties: {
        walletId: { type: 'string' },
        includeHistory: { type: 'boolean', default: false }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        balance: { type: 'number' },
        pendingTransfers: { type: 'number' },
        history: { type: 'array' }
      }
    }
  },

  CALCULATE_ENERGY: {
    id: 'CALCULATE_ENERGY',
    description: 'Convert kWh to Solar tokens or vice versa',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        kWh: { type: 'number' },
        solar: { type: 'number' },
        direction: { type: 'string', enum: ['kwh_to_solar', 'solar_to_kwh'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        kWh: { type: 'number' },
        solar: { type: 'number' },
        rate: { type: 'number' }
      }
    }
  },

  // Marketplace Operations (3)
  CREATE_ARTIFACT: {
    id: 'CREATE_ARTIFACT',
    description: 'Add a new item to the marketplace',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['title', 'category', 'priceKwh'],
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 200 },
        description: { type: 'string' },
        category: { type: 'string', enum: ['music', 'video', 'art', 'document', 'service'] },
        priceKwh: { type: 'number', minimum: 0 },
        priceSolar: { type: 'number' },
        creatorId: { type: 'number' },
        deliveryUrl: { type: 'string' },
        metadata: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string' },
        status: { type: 'string' }
      }
    }
  },

  PURCHASE_ARTIFACT: {
    id: 'PURCHASE_ARTIFACT',
    description: 'Buy an artifact from the marketplace',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['artifactId', 'buyerId'],
      properties: {
        artifactId: { type: 'string' },
        buyerId: { type: 'number' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        transactionId: { type: 'string' },
        deliveryUrl: { type: 'string' }
      }
    }
  },

  QUERY_MARKETPLACE: {
    id: 'QUERY_MARKETPLACE',
    description: 'Search and browse marketplace items',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
        limit: { type: 'number', default: 20, maximum: 100 }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        total: { type: 'number' },
        page: { type: 'number' }
      }
    }
  },

  // Audit & Compliance Operations (3)
  AUDIT_TRANSACTION: {
    id: 'AUDIT_TRANSACTION',
    description: 'Verify transaction integrity and compliance',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['transactionId'],
      properties: {
        transactionId: { type: 'string' },
        auditType: { type: 'string', enum: ['integrity', 'compliance', 'full'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        auditReport: { type: 'object' },
        flags: { type: 'array' }
      }
    }
  },

  GENERATE_REPORT: {
    id: 'GENERATE_REPORT',
    description: 'Create analytics or compliance reports',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['reportType'],
      properties: {
        reportType: { type: 'string', enum: ['energy', 'transactions', 'members', 'marketplace', 'compliance'] },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        format: { type: 'string', enum: ['json', 'csv', 'pdf'], default: 'json' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        data: { type: 'object' },
        generatedAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  LOG_ETHICS_EVENT: {
    id: 'LOG_ETHICS_EVENT',
    description: 'Record ethics-related events for the UIM protocol',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['eventType', 'agentId'],
      properties: {
        eventType: { type: 'string' },
        agentId: { type: 'string' },
        description: { type: 'string' },
        ethicsScore: { type: 'number', minimum: 0, maximum: 100 },
        metadata: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        logged: { type: 'boolean' }
      }
    }
  }
};

function getActionById(actionId) {
  return ACTION_TYPES[actionId] || null;
}

function getAllActions() {
  return Object.values(ACTION_TYPES);
}

function getActionsByRiskLevel(riskLevel) {
  return Object.values(ACTION_TYPES).filter(action => action.riskLevel === riskLevel);
}

function getHighRiskActions() {
  return Object.values(ACTION_TYPES).filter(
    action => action.riskLevel === RISK_LEVELS.HIGH || action.riskLevel === RISK_LEVELS.CRITICAL
  );
}

function validateActionInput(actionId, input) {
  const action = ACTION_TYPES[actionId];
  if (!action) {
    return { valid: false, errors: ['Unknown action type'] };
  }
  
  const errors = [];
  const schema = action.inputSchema;
  
  if (schema.required) {
    for (const field of schema.required) {
      if (input[field] === undefined || input[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  if (schema.properties) {
    for (const [field, spec] of Object.entries(schema.properties)) {
      if (input[field] !== undefined) {
        if (spec.type === 'string' && typeof input[field] !== 'string') {
          errors.push(`Field ${field} must be a string`);
        }
        if (spec.type === 'number' && typeof input[field] !== 'number') {
          errors.push(`Field ${field} must be a number`);
        }
        if (spec.minimum !== undefined && input[field] < spec.minimum) {
          errors.push(`Field ${field} must be >= ${spec.minimum}`);
        }
        if (spec.maximum !== undefined && input[field] > spec.maximum) {
          errors.push(`Field ${field} must be <= ${spec.maximum}`);
        }
        if (spec.enum && !spec.enum.includes(input[field])) {
          errors.push(`Field ${field} must be one of: ${spec.enum.join(', ')}`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

module.exports = {
  RISK_LEVELS,
  ACTION_TYPES,
  getActionById,
  getAllActions,
  getActionsByRiskLevel,
  getHighRiskActions,
  validateActionInput
};
