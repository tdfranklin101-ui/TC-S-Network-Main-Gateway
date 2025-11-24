const { Pool } = require('@neondatabase/serverless');
const { randomUUID } = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class AgentStorage {
  // Create agent
  async createAgent(data) {
    const id = randomUUID();
    const {
      walletAddress,
      agentType,
      displayName,
      autonomyLevel = 'low',
      dailyLimitSolar = 1,
      maxPerActionRays = 10000,
      capabilities = []
    } = data;

    const ethicsProfile = {
      udhrAligned: true,
      solarStandardVersion: '1.0.0',
      notes: `Default ${agentType} agent`
    };

    const metadata = { capabilities };

    await pool.query(
      `INSERT INTO agents 
        (id, wallet_address, agent_type, display_name, autonomy_level, daily_limit_solar, max_per_action_rays, ethics_profile, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, walletAddress, agentType, displayName, autonomyLevel, dailyLimitSolar, maxPerActionRays, JSON.stringify(ethicsProfile), JSON.stringify(metadata)]
    );

    // Initialize wallet balance
    await pool.query(
      `INSERT INTO wallet_solar_balances (wallet_address, balance_solar)
      VALUES ($1, $2)
      ON CONFLICT (wallet_address) DO NOTHING`,
      [walletAddress, agentType === 'personal' ? 1 : 1000]
    );

    return await this.getAgent(id);
  }

  // Get agent by ID
  async getAgent(id) {
    const result = await pool.query(
      'SELECT * FROM agents WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      agentType: row.agent_type,
      walletAddress: row.wallet_address,
      displayName: row.display_name,
      autonomyLevel: row.autonomy_level,
      dailyLimitSolar: parseFloat(row.daily_limit_solar),
      maxPerActionRays: row.max_per_action_rays,
      ethicsProfile: row.ethics_profile,
      metadata: row.metadata,
      createdAt: row.created_at
    };
  }

  // Update agent settings
  async updateAgent(id, updates) {
    const { autonomyLevel, dailyLimitSolar, maxPerActionRays } = updates;
    
    const setParts = [];
    const values = [];
    let paramCount = 1;

    if (autonomyLevel !== undefined) {
      setParts.push(`autonomy_level = $${paramCount++}`);
      values.push(autonomyLevel);
    }
    if (dailyLimitSolar !== undefined) {
      setParts.push(`daily_limit_solar = $${paramCount++}`);
      values.push(dailyLimitSolar);
    }
    if (maxPerActionRays !== undefined) {
      setParts.push(`max_per_action_rays = $${paramCount++}`);
      values.push(maxPerActionRays);
    }

    if (setParts.length === 0) return await this.getAgent(id);

    setParts.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE agents SET ${setParts.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    return await this.getAgent(id);
  }

  // Get wallet balance
  async getWalletBalance(walletAddress) {
    const result = await pool.query(
      'SELECT balance_solar FROM wallet_solar_balances WHERE wallet_address = $1',
      [walletAddress]
    );
    
    if (result.rows.length === 0) {
      return { balanceSolar: 0 };
    }
    
    return { balanceSolar: parseFloat(result.rows[0].balance_solar) };
  }

  // Deduct Solar from wallet
  async deductSolar(walletAddress, solarCost) {
    const result = await pool.query(
      `UPDATE wallet_solar_balances 
       SET balance_solar = balance_solar - $1, updated_at = NOW()
       WHERE wallet_address = $2
       RETURNING balance_solar`,
      [solarCost, walletAddress]
    );

    if (result.rows.length === 0) {
      throw new Error('Wallet not found');
    }

    return { balanceSolar: parseFloat(result.rows[0].balance_solar) };
  }

  // Log agent action
  async logAction(data) {
    const { agentId, targetAgentId, actionType, solarCost, raysCost, payload } = data;
    
    const result = await pool.query(
      `INSERT INTO agent_actions 
        (agent_id, target_agent_id, action_type, solar_cost, rays_cost, payload, status, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
      RETURNING id, created_at`,
      [agentId, targetAgentId || null, actionType, solarCost, raysCost, JSON.stringify(payload)]
    );

    return {
      id: result.rows[0].id,
      agentId,
      actionType,
      solarCost,
      raysCost,
      createdAt: result.rows[0].created_at
    };
  }
}

module.exports = new AgentStorage();
