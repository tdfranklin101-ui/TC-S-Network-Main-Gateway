/**
 * TC-S Network Foundation - Commissioning Agent
 * Version: 1.0.0
 * 
 * Purpose: Gather network requirements and submit CREATE_NETWORK actions.
 * Follows principle of least privilege - can ONLY:
 *   1. Gather requirements via structured prompts
 *   2. Generate NetworkSpec from requirements
 *   3. Submit CREATE_NETWORK action through the policy pipeline
 */

const { ActionExecutor } = require('../executor');
const { getActionById, validateActionInput } = require('../api-surface');

const AGENT_ID = 'commissioning-agent-v1';
const AGENT_NAME = 'Commissioning Agent';
const ALLOWED_ACTIONS = ['CREATE_NETWORK', 'QUERY_NETWORK'];

const NETWORK_TYPES = {
  SATELLITE: {
    id: 'satellite',
    name: 'Satellite Network',
    description: 'Remote sensing and data collection node',
    defaultCapabilities: ['data_collection', 'remote_sensing', 'telemetry']
  },
  GATEWAY: {
    id: 'gateway',
    name: 'Gateway Network',
    description: 'Entry point for external systems',
    defaultCapabilities: ['routing', 'authentication', 'rate_limiting']
  },
  RELAY: {
    id: 'relay',
    name: 'Relay Network',
    description: 'Message and data relay node',
    defaultCapabilities: ['message_relay', 'data_caching', 'load_balancing']
  },
  COMPUTE: {
    id: 'compute',
    name: 'Compute Network',
    description: 'Processing and computation node',
    defaultCapabilities: ['computation', 'ai_inference', 'data_processing']
  },
  STORAGE: {
    id: 'storage',
    name: 'Storage Network',
    description: 'Data persistence and archival node',
    defaultCapabilities: ['data_storage', 'backup', 'replication']
  }
};

const CAPABILITY_OPTIONS = [
  'data_collection', 'remote_sensing', 'telemetry', 'routing', 'authentication',
  'rate_limiting', 'message_relay', 'data_caching', 'load_balancing', 'computation',
  'ai_inference', 'data_processing', 'data_storage', 'backup', 'replication',
  'energy_tracking', 'solar_calculation', 'marketplace_integration', 'wallet_management',
  'audit_logging', 'ethics_monitoring'
];

const REGIONS = ['global', 'north_america', 'europe', 'asia_pacific', 'africa', 'south_america'];
const ENERGY_SOURCES = ['solar', 'wind', 'hydro', 'mixed'];

class CommissioningAgent {
  constructor(pool) {
    this.pool = pool;
    this.executor = new ActionExecutor(pool);
    this.agentId = AGENT_ID;
    this.agentName = AGENT_NAME;
    this.conversationState = new Map();
  }

  async initialize() {
    const existingAgent = await this.pool.query(
      'SELECT * FROM agent_registry WHERE agent_name = $1',
      [AGENT_NAME]
    );

    if (existingAgent.rows.length === 0) {
      await this.pool.query(`
        INSERT INTO agent_registry (id, agent_name, agent_type, description, allowed_actions, max_risk_level, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
      `, [
        AGENT_ID,
        AGENT_NAME,
        'commissioning',
        'Gathers network requirements and creates network specifications. Only authorized to create and query networks.',
        JSON.stringify(ALLOWED_ACTIONS),
        'medium'
      ]);
      console.log(`✅ Registered ${AGENT_NAME} in agent registry`);
    }

    return this;
  }

  getRequirementsPrompt() {
    return {
      introduction: `I am the TC-S Network Commissioning Agent. I help you create new networks in the TC-S ecosystem. 
I will guide you through the requirements gathering process.`,
      fields: [
        {
          name: 'networkName',
          prompt: 'What would you like to name your network?',
          validation: { type: 'string', minLength: 1, maxLength: 100 },
          required: true
        },
        {
          name: 'networkType',
          prompt: 'What type of network do you need?',
          options: Object.values(NETWORK_TYPES).map(t => ({
            id: t.id,
            name: t.name,
            description: t.description
          })),
          validation: { type: 'enum', values: Object.keys(NETWORK_TYPES).map(k => k.toLowerCase()) },
          required: true
        },
        {
          name: 'capabilities',
          prompt: 'What capabilities should your network have?',
          options: CAPABILITY_OPTIONS,
          validation: { type: 'array', minItems: 1, maxItems: 10 },
          required: true,
          multiSelect: true
        },
        {
          name: 'region',
          prompt: 'Which region should host this network?',
          options: REGIONS,
          validation: { type: 'enum', values: REGIONS },
          required: false,
          default: 'global'
        },
        {
          name: 'energySource',
          prompt: 'What is the primary energy source?',
          options: ENERGY_SOURCES,
          validation: { type: 'enum', values: ENERGY_SOURCES },
          required: false,
          default: 'solar'
        },
        {
          name: 'initialSolarAllocation',
          prompt: 'Initial Solar token allocation (0-1000)?',
          validation: { type: 'number', minimum: 0, maximum: 1000 },
          required: false,
          default: 0
        }
      ]
    };
  }

  startConversation(sessionId) {
    const state = {
      sessionId,
      step: 0,
      requirements: {},
      startedAt: new Date(),
      completed: false
    };
    this.conversationState.set(sessionId, state);
    
    const prompt = this.getRequirementsPrompt();
    return {
      agentId: this.agentId,
      agentName: this.agentName,
      message: prompt.introduction,
      nextQuestion: prompt.fields[0],
      progress: { current: 1, total: prompt.fields.length }
    };
  }

  processInput(sessionId, fieldName, value) {
    const state = this.conversationState.get(sessionId);
    if (!state) {
      return { error: 'Session not found. Please start a new conversation.' };
    }

    const prompt = this.getRequirementsPrompt();
    const currentField = prompt.fields.find(f => f.name === fieldName);
    
    if (!currentField) {
      return { error: 'Unknown field' };
    }

    const validation = this.validateField(currentField, value);
    if (!validation.valid) {
      return {
        error: validation.error,
        retry: true,
        currentQuestion: currentField
      };
    }

    state.requirements[fieldName] = value;
    state.step++;

    if (state.step >= prompt.fields.length) {
      state.completed = true;
      const networkSpec = this.generateNetworkSpec(state.requirements);
      
      return {
        complete: true,
        message: 'All requirements gathered. Ready to create network.',
        networkSpec,
        confirmation: `Create network "${networkSpec.name}" of type "${networkSpec.networkType}" with ${networkSpec.capabilities.length} capabilities?`
      };
    }

    const nextField = prompt.fields[state.step];
    return {
      message: 'Got it!',
      nextQuestion: nextField,
      progress: { current: state.step + 1, total: prompt.fields.length }
    };
  }

  validateField(field, value) {
    const v = field.validation;
    
    if (field.required && (value === undefined || value === null || value === '')) {
      return { valid: false, error: `${field.name} is required` };
    }

    if (v.type === 'string') {
      if (typeof value !== 'string') return { valid: false, error: 'Must be a string' };
      if (v.minLength && value.length < v.minLength) return { valid: false, error: `Minimum ${v.minLength} characters` };
      if (v.maxLength && value.length > v.maxLength) return { valid: false, error: `Maximum ${v.maxLength} characters` };
    }

    if (v.type === 'enum') {
      if (!v.values.includes(value)) return { valid: false, error: `Must be one of: ${v.values.join(', ')}` };
    }

    if (v.type === 'array') {
      if (!Array.isArray(value)) return { valid: false, error: 'Must be an array' };
      if (v.minItems && value.length < v.minItems) return { valid: false, error: `At least ${v.minItems} items required` };
      if (v.maxItems && value.length > v.maxItems) return { valid: false, error: `Maximum ${v.maxItems} items allowed` };
    }

    if (v.type === 'number') {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) return { valid: false, error: 'Must be a number' };
      if (v.minimum !== undefined && num < v.minimum) return { valid: false, error: `Minimum value is ${v.minimum}` };
      if (v.maximum !== undefined && num > v.maximum) return { valid: false, error: `Maximum value is ${v.maximum}` };
    }

    return { valid: true };
  }

  generateNetworkSpec(requirements) {
    const networkType = NETWORK_TYPES[requirements.networkType?.toUpperCase()] || NETWORK_TYPES.SATELLITE;
    
    let capabilities = requirements.capabilities || [];
    if (capabilities.length === 0) {
      capabilities = networkType.defaultCapabilities;
    }

    return {
      name: requirements.networkName,
      networkType: requirements.networkType || 'satellite',
      capabilities: capabilities,
      region: requirements.region || 'global',
      energySource: requirements.energySource || 'solar',
      initialSolarAllocation: requirements.initialSolarAllocation || 0,
      metadata: {
        createdBy: this.agentId,
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  async submitNetworkCreation(sessionId, confirmed = false) {
    const state = this.conversationState.get(sessionId);
    
    if (!state || !state.completed) {
      return { error: 'Requirements gathering not complete' };
    }

    if (!confirmed) {
      return { 
        error: 'Confirmation required',
        requiresConfirmation: true 
      };
    }

    const networkSpec = this.generateNetworkSpec(state.requirements);

    const validation = validateActionInput('CREATE_NETWORK', networkSpec);
    if (!validation.valid) {
      return {
        error: 'Invalid network specification',
        validationErrors: validation.errors
      };
    }

    const actionRequest = {
      actionType: 'CREATE_NETWORK',
      agentId: this.agentId,
      agentName: this.agentName,
      payload: networkSpec,
      metadata: {
        sessionId,
        gatheredRequirements: state.requirements,
        submittedAt: new Date().toISOString()
      }
    };

    try {
      const result = await this.executor.submitAction(actionRequest);
      
      this.conversationState.delete(sessionId);

      return {
        success: true,
        actionRequestId: result.requestId,
        status: result.status,
        message: result.status === 'pending' 
          ? 'Network creation submitted for approval' 
          : result.status === 'completed'
            ? 'Network created successfully'
            : `Action ${result.status}`,
        networkSpec,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createNetworkDirect(networkSpec) {
    const validation = validateActionInput('CREATE_NETWORK', networkSpec);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Invalid network specification',
        validationErrors: validation.errors
      };
    }

    const actionRequest = {
      actionType: 'CREATE_NETWORK',
      agentId: this.agentId,
      agentName: this.agentName,
      payload: networkSpec,
      metadata: {
        directCreation: true,
        submittedAt: new Date().toISOString()
      }
    };

    try {
      const result = await this.executor.submitAction(actionRequest);
      return {
        success: true,
        actionRequestId: result.requestId,
        status: result.status,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async queryNetwork(networkIdOrName) {
    const actionRequest = {
      actionType: 'QUERY_NETWORK',
      agentId: this.agentId,
      agentName: this.agentName,
      payload: { networkId: networkIdOrName },
      metadata: {}
    };

    return await this.executor.submitAction(actionRequest);
  }

  getCapabilities() {
    return {
      agentId: this.agentId,
      agentName: this.agentName,
      allowedActions: ALLOWED_ACTIONS,
      networkTypes: Object.values(NETWORK_TYPES),
      capabilityOptions: CAPABILITY_OPTIONS,
      regions: REGIONS,
      energySources: ENERGY_SOURCES
    };
  }
}

module.exports = { 
  CommissioningAgent,
  NETWORK_TYPES,
  CAPABILITY_OPTIONS,
  REGIONS,
  ENERGY_SOURCES
};
