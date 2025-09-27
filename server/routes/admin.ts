import { Router } from 'express';
import { storage } from '../storage';
import { users, productScans } from '@shared/schema';
import { db } from '../db';

const router = Router();

/**
 * Token authentication middleware for admin routes
 */
function tokenAuth(req, res, next) {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Missing Authorization header'
    });
  }
  
  // Check if the token matches the environment variable
  const expectedToken = process.env.ADMIN_API_TOKEN;
  
  if (!expectedToken) {
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'Admin API token not configured'
    });
  }
  
  // Simple token comparison - format should be "Bearer TOKEN"
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;
  
  if (token !== expectedToken) {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid API token'
    });
  }
  
  // Token is valid, proceed to the route handler
  next();
}

// Admin Routes

// View logs and analytics data
router.get('/logs', tokenAuth, async (req, res) => {
  try {
    // In a real application, you would implement pagination here
    const allUsers = await db.select().from(users);
    const allScans = await db.select().from(productScans);
    
    res.json({
      users: allUsers.map(user => ({
        ...user,
        password: '[REDACTED]' // Don't send passwords in the response
      })),
      scans: allScans,
      stats: {
        userCount: allUsers.length,
        scanCount: allScans.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting admin logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// System diagnostics
router.get('/diagnostics', tokenAuth, async (req, res) => {
  try {
    // Database connection check
    let dbStatus = 'failed';
    try {
      await db.execute('SELECT 1');
      dbStatus = 'connected';
    } catch (dbError) {
      console.error('Database connection error:', dbError);
    }
    
    res.json({
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV,
        nodeVersion: process.version
      },
      database: {
        status: dbStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting system diagnostics:', error);
    res.status(500).json({ error: 'Failed to retrieve diagnostics' });
  }
});

// Product database management
router.get('/products', tokenAuth, async (req, res) => {
  try {
    // Import the product service dynamically to avoid circular dependencies
    const productService = await import('../product-energy-service');
    const products = productService.default.getAllProducts();
    
    res.json({
      products,
      count: products.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting product database:', error);
    res.status(500).json({ error: 'Failed to retrieve product database' });
  }
});

export default router;