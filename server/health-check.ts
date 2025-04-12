/**
 * Health Check Module
 * 
 * This module provides dedicated health check functionality that will work
 * even if the rest of the application fails to initialize properly.
 */
import express, { Express, Request, Response } from 'express';

/**
 * Sets up health check routes with highest priority
 * This must be called BEFORE any other middleware or route setup
 */
export function setupHealthChecks(app: Express) {
  // Root path health check - responds to deployments health checks
  app.get('/', (req: Request, res: Response, next: any) => {
    const userAgent = req.headers['user-agent'] || '';
    const isHealthCheck = userAgent.includes('Health') || req.query.health === 'check';
    
    if (isHealthCheck) {
      // Force content-type for all health checks
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
      }));
    }
    
    // Not a health check, proceed to next handler
    next();
  });
  
  // Dedicated health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    }));
  });
  
  // Match Replit health check paths
  app.get('/_health', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    }));
  });
  
  // Emergency fallback - catch all GET requests if they look like health checks
  app.use((req: Request, res: Response, next: any) => {
    // Only match GET requests with health-related paths or query params
    if (req.method === 'GET' && 
        (req.path.includes('health') || req.query.health || 
         req.headers['user-agent']?.includes('Health'))) {
      
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        path: req.path
      }));
    }
    
    next();
  });
  
  console.log('Health check endpoints initialized');
}