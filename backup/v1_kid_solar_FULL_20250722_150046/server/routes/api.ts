import { Router } from 'express';
import { db } from '../db';
import productService from '../product-energy-service';
import geolocationService from '../geolocation-service';
import { productScans } from '@shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

// Get product energy data
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({
        error: 'Missing productId parameter',
        message: 'Product ID is required'
      });
    }
    
    const productData = productService.getProductData(productId);
    
    if (!productData) {
      return res.status(404).json({
        error: 'Product not found',
        message: `No energy data found for product: ${productId}`
      });
    }
    
    // Return the product energy data
    res.json(productData);
  } catch (error) {
    console.error('Error getting product data:', error);
    res.status(500).json({
      error: 'Failed to retrieve product data',
      message: error.message
    });
  }
});

// Analyze a product using AI if available
router.post('/analyze-product', async (req, res) => {
  try {
    const { productName, productDescription } = req.body;
    
    if (!productName) {
      return res.status(400).json({
        error: 'Missing product name',
        message: 'Product name is required'
      });
    }
    
    // Use the product service to analyze the product
    const productData = await productService.analyzeProduct(productName, productDescription || '');
    
    // Return the product energy data with recommendations
    const recommendations = productService.recommendAlternative(productName);
    
    res.json({
      ...productData,
      recommendations
    });
  } catch (error) {
    console.error('Error analyzing product:', error);
    res.status(500).json({
      error: 'Failed to analyze product',
      message: error.message
    });
  }
});

// Get product recommendations
router.get('/recommendations/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!productId) {
      return res.status(400).json({
        error: 'Missing productId parameter',
        message: 'Product ID is required'
      });
    }
    
    const recommendations = productService.recommendAlternative(productId);
    
    res.json({
      productId,
      recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

// Get geolocation data
router.get('/geolocation', async (req, res) => {
  try {
    // Get the client IP address
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Use the geolocation service to get location data
    const locationData = await geolocationService.getLocation(clientIp);
    
    res.json(locationData);
  } catch (error) {
    console.error('Error getting geolocation data:', error);
    res.status(500).json({
      error: 'Failed to get geolocation data',
      message: error.message
    });
  }
});

// Record a product scan
router.post('/record-scan', async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to record scans'
      });
    }
    
    const { productId, productName, energyKwh, scanMethod } = req.body;
    
    if (!productId || !productName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'productId and productName are required'
      });
    }
    
    // Get client IP for geolocation
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Get location data
    const locationData = await geolocationService.getLocation(clientIp);
    
    // Record the scan in the database
    const [scan] = await db.insert(productScans).values({
      userId: req.user.id,
      productId,
      productName,
      energyKwh: energyKwh || 0,
      scanMethod: scanMethod || 'manual',
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      city: locationData.city,
      country: locationData.country,
      timestamp: new Date()
    }).returning();
    
    res.status(201).json(scan);
  } catch (error) {
    console.error('Error recording scan:', error);
    res.status(500).json({
      error: 'Failed to record scan',
      message: error.message
    });
  }
});

// Get user's scan history
router.get('/scan-history', async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view scan history'
      });
    }
    
    // Get the user's scan history
    const scans = await db.select()
      .from(productScans)
      .where(sql`${productScans.userId} = ${req.user.id}`)
      .orderBy(sql`${productScans.timestamp} DESC`);
    
    res.json(scans);
  } catch (error) {
    console.error('Error getting scan history:', error);
    res.status(500).json({
      error: 'Failed to retrieve scan history',
      message: error.message
    });
  }
});

export default router;