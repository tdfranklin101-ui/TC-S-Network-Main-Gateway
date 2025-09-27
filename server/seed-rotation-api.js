/**
 * Seed Rotation API endpoints
 * Provides REST API for managing the dynamic seed rotation system
 */

const SeedRotator = require('./seed-rotator');

// Initialize the global seed rotator instance
let globalSeedRotator = null;

/**
 * Get or create the global seed rotator instance
 */
function getSeedRotator() {
  if (!globalSeedRotator) {
    globalSeedRotator = new SeedRotator();
  }
  return globalSeedRotator;
}

/**
 * Register seed rotation API routes
 * @param {Express} app - Express application instance
 */
function registerSeedRotationRoutes(app) {
  
  // Get rotation status
  app.get('/api/seed-rotation/status', async (req, res) => {
    try {
      const rotator = getSeedRotator();
      const status = rotator.getStatus();
      
      res.json({
        success: true,
        status: status,
        message: 'Seed rotation status retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting seed rotation status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get seed rotation status',
        message: error.message
      });
    }
  });

  // Manually trigger a seed rotation
  app.post('/api/seed-rotation/trigger', async (req, res) => {
    try {
      const rotator = getSeedRotator();
      
      if (rotator.isRotating) {
        return res.status(409).json({
          success: false,
          error: 'Rotation already in progress',
          message: 'Please wait for the current rotation to complete'
        });
      }

      console.log('🔧 Manual seed rotation triggered via API');
      const result = await rotator.triggerRotation();
      
      if (result) {
        res.json({
          success: true,
          message: 'Seed rotation completed successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Rotation failed',
          message: 'Check server logs for details'
        });
      }
    } catch (error) {
      console.error('Error triggering seed rotation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger seed rotation',
        message: error.message
      });
    }
  });

  // Get rotation logs
  app.get('/api/seed-rotation/logs', async (req, res) => {
    try {
      const rotator = getSeedRotator();
      const status = rotator.getStatus();
      
      const limit = parseInt(req.query.limit) || 50;
      const logs = status.recentLogs.slice(-limit);
      
      res.json({
        success: true,
        logs: logs,
        total: status.recentLogs.length,
        limit: limit
      });
    } catch (error) {
      console.error('Error getting rotation logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rotation logs',
        message: error.message
      });
    }
  });

  // Restore from backup
  app.post('/api/seed-rotation/restore', async (req, res) => {
    try {
      const { backupTimestamp } = req.body;
      
      if (!backupTimestamp) {
        return res.status(400).json({
          success: false,
          error: 'Missing backup timestamp',
          message: 'Please provide a backup timestamp to restore from'
        });
      }

      const rotator = getSeedRotator();
      const result = rotator.restoreFromBackup(backupTimestamp);
      
      if (result) {
        res.json({
          success: true,
          message: `Successfully restored from backup: ${backupTimestamp}`,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Restore failed',
          message: `Backup not found or restore operation failed: ${backupTimestamp}`
        });
      }
    } catch (error) {
      console.error('Error restoring from backup:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore from backup',
        message: error.message
      });
    }
  });

  // Schedule automatic rotations
  app.post('/api/seed-rotation/schedule', async (req, res) => {
    try {
      const rotator = getSeedRotator();
      const job = rotator.scheduleRotations();
      
      res.json({
        success: true,
        message: 'Automatic seed rotations scheduled successfully',
        schedule: 'Daily at 3:00 AM',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error scheduling rotations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule rotations',
        message: error.message
      });
    }
  });

  // Get available seeds count and categories
  app.get('/api/seed-rotation/seeds', async (req, res) => {
    try {
      const seedDatabase = require('./seed-database');
      const allSeeds = seedDatabase.getAllSeeds();
      const categories = Object.keys(seedDatabase.SEED_DATABASE);
      
      res.json({
        success: true,
        data: {
          totalSeeds: allSeeds.length,
          categories: categories,
          categoryCounts: categories.reduce((acc, category) => {
            acc[category] = seedDatabase.SEED_DATABASE[category].length;
            return acc;
          }, {})
        }
      });
    } catch (error) {
      console.error('Error getting seed information:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get seed information',
        message: error.message
      });
    }
  });

  console.log('🌱 Seed Rotation API routes registered');
}

/**
 * Initialize seed rotation system with automatic scheduling
 * NOTE: Routing is now handled directly in main.js for HTTP-based architecture
 */
function initializeSeedRotation() {
  try {
    const rotator = getSeedRotator();
    
    // Only initialize the rotator and scheduling - routing is handled in main.js
    console.log('🌱 Seed Rotation System initialized (routing handled in main.js)');
    
    // Enable automatic scheduling with improved frequency and error handling
    const enableAutoScheduling = process.env.ENABLE_SEED_ROTATION_SCHEDULING !== 'false';
    
    if (enableAutoScheduling) {
      try {
        rotator.scheduleRotations();
        console.log('🌱 Automatic scheduling enabled (3-day intervals for stability)');
      } catch (scheduleError) {
        console.warn('⚠️ Failed to schedule automatic rotations, manual triggers only:', scheduleError.message);
      }
    } else {
      console.log('🌱 Automatic scheduling disabled by config - manual triggers only');
    }
    
    return rotator;
  } catch (error) {
    console.error('❌ Failed to initialize seed rotation system:', error);
    return null;
  }
}

module.exports = {
  registerSeedRotationRoutes,
  initializeSeedRotation,
  getSeedRotator
};