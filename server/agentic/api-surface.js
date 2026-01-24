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
  },

  // ============================================================================
  // MARKETPLACE OPERATIONS - Autonomy Spine v2
  // ============================================================================

  'ASSET.CREATE': {
    id: 'ASSET.CREATE',
    description: 'Create a new asset record from user input (photos, description, condition)',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['title', 'description'],
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 200 },
        description: { type: 'string', minLength: 10 },
        category: { type: 'string' },
        condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'parts'] },
        quantity: { type: 'number', minimum: 1, default: 1 },
        imageUrls: { type: 'array', items: { type: 'string' } },
        pickupLocation: { type: 'string' },
        pickupRules: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } },
        createdByUserId: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  'ASSET.ENRICH': {
    id: 'ASSET.ENRICH',
    description: 'AI enrichment: add metadata, category, brand/model guess, kWh estimate, carbon estimate',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string' },
        forceRefresh: { type: 'boolean', default: false }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        enrichedFields: { type: 'array', items: { type: 'string' } },
        normalizedTitle: { type: 'string' },
        category: { type: 'string' },
        attributes: { type: 'object' },
        kwhEstimate: { type: 'number' },
        carbonEstimate: { type: 'number' },
        riskScore: { type: 'number', minimum: 0, maximum: 100 },
        comparableItems: { type: 'array' }
      }
    }
  },

  'ASSET.LIST': {
    id: 'ASSET.LIST',
    description: 'Make an asset active in the marketplace (requires price)',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    autoExecuteIf: ['low_risk', 'high_confidence', 'price_within_bounds'],
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        status: { type: 'string' },
        listedAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  'ASSET.UNLIST': {
    id: 'ASSET.UNLIST',
    description: 'Remove an asset from active marketplace listings',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string' },
        reason: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        status: { type: 'string' },
        unlistedAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  'ASSET.UPDATE': {
    id: 'ASSET.UPDATE',
    description: 'Update asset details (photos, description, quantity)',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        imageUrls: { type: 'array', items: { type: 'string' } },
        quantity: { type: 'number', minimum: 0 },
        pickupRules: { type: 'object' },
        tags: { type: 'array', items: { type: 'string' } }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        updatedFields: { type: 'array', items: { type: 'string' } },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  // Pricing Operations
  'PRICE.QUOTE': {
    id: 'PRICE.QUOTE',
    description: 'Get suggested price with confidence and explanation (can auto-execute)',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string' },
        networkId: { type: 'string' },
        includeComparables: { type: 'boolean', default: true }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        priceSolar: { type: 'number' },
        priceFiat: { type: 'number' },
        currency: { type: 'string' },
        taxIncluded: { type: 'boolean' },
        feeBreakdown: {
          type: 'object',
          properties: {
            vendorNet: { type: 'number' },
            commissionerFee: { type: 'number' },
            tcsFee: { type: 'number' },
            taxBucket: { type: 'number' },
            microFee: { type: 'number' }
          }
        },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
        explanation: { type: 'string' },
        comparables: { type: 'array' },
        requiresApproval: { type: 'boolean' }
      }
    }
  },

  'PRICE.PUBLISH': {
    id: 'PRICE.PUBLISH',
    description: 'Write a price to the listing (requires approval unless auto-conditions met)',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: true,
    autoExecuteIf: ['low_risk', 'confidence_above_80', 'price_within_bounds'],
    inputSchema: {
      type: 'object',
      required: ['assetId', 'priceSolar'],
      properties: {
        assetId: { type: 'string' },
        priceSolar: { type: 'number', minimum: 0 },
        priceFiat: { type: 'number', minimum: 0 },
        overrideReason: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        priceSolar: { type: 'number' },
        publishedAt: { type: 'string', format: 'date-time' },
        feeBreakdown: { type: 'object' }
      }
    }
  },

  'PRICE.UPDATE_RULES': {
    id: 'PRICE.UPDATE_RULES',
    description: 'Update network pricing configuration (margins, taxes, fees)',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['networkId'],
      properties: {
        networkId: { type: 'string' },
        commissionerMargin: { type: 'number', minimum: 0, maximum: 0.5 },
        tcsMargin: { type: 'number', minimum: 0, maximum: 0.1 },
        taxRate: { type: 'number', minimum: 0, maximum: 0.3 },
        microFeePerTransaction: { type: 'number', minimum: 0 },
        categoryFloors: { type: 'object' },
        categoryCeilings: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        updated: { type: 'boolean' },
        effectiveAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  // Order & Settlement Operations
  'ORDER.CREATE': {
    id: 'ORDER.CREATE',
    description: 'Reserve inventory and create an order invoice',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['buyerId', 'items'],
      properties: {
        buyerId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['assetId', 'quantity'],
            properties: {
              assetId: { type: 'string' },
              quantity: { type: 'number', minimum: 1 }
            }
          }
        },
        paymentMethod: { type: 'string', enum: ['solar', 'stripe', 'both'] },
        shippingAddress: { type: 'object' },
        pickupPreference: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        status: { type: 'string' },
        totalSolar: { type: 'number' },
        totalFiat: { type: 'number' },
        reservationExpiry: { type: 'string', format: 'date-time' },
        items: { type: 'array' }
      }
    }
  },

  'ORDER.CAPTURE_PAYMENT': {
    id: 'ORDER.CAPTURE_PAYMENT',
    description: 'Capture payment via Stripe or debit Solar tokens',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string' },
        paymentIntentId: { type: 'string' },
        solarAmount: { type: 'number' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        captured: { type: 'boolean' },
        transactionId: { type: 'string' },
        capturedAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  'ORDER.FULFILL': {
    id: 'ORDER.FULFILL',
    description: 'Mark order as fulfilled (pickup QR verification or staff confirm)',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['orderId'],
      properties: {
        orderId: { type: 'string' },
        verificationMethod: { type: 'string', enum: ['qr', 'staff', 'delivery_confirm'] },
        verificationCode: { type: 'string' },
        staffId: { type: 'string' },
        notes: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        fulfilled: { type: 'boolean' },
        fulfilledAt: { type: 'string', format: 'date-time' },
        ledgerEventId: { type: 'string' }
      }
    }
  },

  'LEDGER.POST': {
    id: 'LEDGER.POST',
    description: 'Post an immutable transaction event to the ledger',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['eventType', 'amount', 'currency'],
      properties: {
        eventType: { type: 'string', enum: ['sale', 'refund', 'fee', 'settlement', 'adjustment'] },
        orderId: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string', enum: ['solar', 'usd'] },
        fromAccountId: { type: 'string' },
        toAccountId: { type: 'string' },
        description: { type: 'string' },
        metadata: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        ledgerEventId: { type: 'string' },
        posted: { type: 'boolean' },
        postedAt: { type: 'string', format: 'date-time' },
        runningBalance: { type: 'number' }
      }
    }
  },

  'SETTLEMENT.RUN': {
    id: 'SETTLEMENT.RUN',
    description: 'Split funds between vendor, commissioner, TC-S, and tax bucket',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['networkId'],
      properties: {
        networkId: { type: 'string' },
        periodStart: { type: 'string', format: 'date' },
        periodEnd: { type: 'string', format: 'date' },
        dryRun: { type: 'boolean', default: false }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        settlementId: { type: 'string' },
        ordersSettled: { type: 'number' },
        totalVolume: { type: 'number' },
        splits: {
          type: 'object',
          properties: {
            vendors: { type: 'number' },
            commissioner: { type: 'number' },
            tcs: { type: 'number' },
            taxBucket: { type: 'number' }
          }
        },
        ledgerEvents: { type: 'array' },
        settledAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  // Moderation & Search Operations
  'MODERATION.REVIEW': {
    id: 'MODERATION.REVIEW',
    description: 'Review asset content for policy compliance (text/image + risk score)',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    autoExecuteIf: ['low_risk'],
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string' },
        contentType: { type: 'string', enum: ['text', 'image', 'both'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        decision: { type: 'string', enum: ['approved', 'flagged', 'rejected'] },
        riskScore: { type: 'number', minimum: 0, maximum: 100 },
        policyViolations: { type: 'array', items: { type: 'string' } },
        requiresHumanReview: { type: 'boolean' }
      }
    }
  },

  'SEARCH.FULFILLMENT.RECOMMEND': {
    id: 'SEARCH.FULFILLMENT.RECOMMEND',
    description: 'When local search fails, recommend external fulfillment sources',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string' },
        constraints: {
          type: 'object',
          properties: {
            budget: { type: 'number' },
            condition: { type: 'string' },
            location: { type: 'string' },
            urgency: { type: 'string' }
          }
        },
        allowedPortals: { type: 'array', items: { type: 'string' }, default: ['amazon', 'walmart', 'ebay'] }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              vendorName: { type: 'string' },
              productTitle: { type: 'string' },
              sourceUrl: { type: 'string' },
              priceEstimate: { type: 'number' },
              fitScore: { type: 'number' },
              riskFlags: { type: 'array' }
            }
          }
        },
        requiresHumanApproval: { type: 'boolean' }
      }
    }
  },

  // Operations & Alerts
  'MEMBER.ONBOARD': {
    id: 'MEMBER.ONBOARD',
    description: 'Complete member onboarding with verification',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['memberId'],
      properties: {
        memberId: { type: 'string' },
        verificationLevel: { type: 'string', enum: ['basic', 'verified', 'premium'] },
        networkId: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        memberId: { type: 'string' },
        onboarded: { type: 'boolean' },
        verificationLevel: { type: 'string' },
        walletActivated: { type: 'boolean' }
      }
    }
  },

  'MEMBER.SUSPEND': {
    id: 'MEMBER.SUSPEND',
    description: 'Suspend a member account (requires approval)',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['memberId', 'reason'],
      properties: {
        memberId: { type: 'string' },
        reason: { type: 'string' },
        duration: { type: 'string' },
        evidence: { type: 'array', items: { type: 'string' } }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        memberId: { type: 'string' },
        suspended: { type: 'boolean' },
        suspendedUntil: { type: 'string', format: 'date-time' }
      }
    }
  },

  'ALERT.CREATE': {
    id: 'ALERT.CREATE',
    description: 'Create an operational alert (fraud, inventory mismatch, etc.)',
    riskLevel: RISK_LEVELS.LOW,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['alertType', 'severity', 'message'],
      properties: {
        alertType: { type: 'string', enum: ['fraud', 'inventory', 'fee_anomaly', 'policy_violation', 'system'] },
        severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        message: { type: 'string' },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        metadata: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        alertId: { type: 'string' },
        created: { type: 'boolean' },
        escalated: { type: 'boolean' }
      }
    }
  },

  'DISPUTE.OPEN': {
    id: 'DISPUTE.OPEN',
    description: 'Open a dispute for an order or transaction',
    riskLevel: RISK_LEVELS.MEDIUM,
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      required: ['orderId', 'disputeType', 'description'],
      properties: {
        orderId: { type: 'string' },
        disputeType: { type: 'string', enum: ['not_received', 'not_as_described', 'damaged', 'fraud', 'other'] },
        description: { type: 'string' },
        evidence: { type: 'array', items: { type: 'string' } }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        disputeId: { type: 'string' },
        status: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  },

  'DISPUTE.RESOLVE': {
    id: 'DISPUTE.RESOLVE',
    description: 'Resolve a dispute with a decision',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['disputeId', 'resolution'],
      properties: {
        disputeId: { type: 'string' },
        resolution: { type: 'string', enum: ['refund_full', 'refund_partial', 'no_refund', 'replacement'] },
        refundAmount: { type: 'number' },
        notes: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        disputeId: { type: 'string' },
        resolved: { type: 'boolean' },
        resolution: { type: 'string' },
        ledgerEventId: { type: 'string' }
      }
    }
  },

  'CONFIG.UPDATE': {
    id: 'CONFIG.UPDATE',
    description: 'Update network configuration settings',
    riskLevel: RISK_LEVELS.HIGH,
    requiresApproval: true,
    inputSchema: {
      type: 'object',
      required: ['networkId', 'configKey'],
      properties: {
        networkId: { type: 'string' },
        configKey: { type: 'string' },
        configValue: { type: 'object' },
        reason: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        configKey: { type: 'string' },
        updated: { type: 'boolean' },
        previousValue: { type: 'object' }
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
