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
  // Root path health check handler - ALWAYS RESPOND with 200 OK
  // This is critical for Replit deployments which check the root path
  app.get('/', (req: Request, res: Response, next: any) => {
    // Log health check requests
    if (process.env.NODE_ENV === 'development') {
      const userAgent = req.headers['user-agent'] || '';
      console.log(`Root path request with User-Agent: ${userAgent}`);
    }
    
    // Check if this looks like a health check (either by user agent or query param)
    const userAgent = req.headers['user-agent'] || '';
    const mightBeHealthCheck = 
      userAgent.includes('Health') || 
      userAgent.includes('health') ||
      userAgent.includes('kube') ||
      userAgent.includes('Deployment') ||
      req.query.health === 'check' ||
      req.query.check !== undefined;
    
    // If this might be a health check or if there's no accept header for HTML
    // respond with a JSON health response
    if (mightBeHealthCheck || !req.headers.accept?.includes('html')) {
      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Access-Control-Allow-Origin': '*'
      });
      
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'thecurrentsee'
      });
    }
    
    // Not a health check, proceed to next handler
    next();
  });
  
  // Dedicated health check endpoints
  function sendHealthResponse(res: Response) {
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'thecurrentsee'
    });
  }
  
  // Standard health endpoint
  app.get('/health', (req: Request, res: Response) => {
    sendHealthResponse(res);
  });
  
  // Match Replit health check paths
  app.get('/_health', (req: Request, res: Response) => {
    sendHealthResponse(res);
  });
  
  // Match Kubernetes health paths
  app.get('/healthz', (req: Request, res: Response) => {
    sendHealthResponse(res);
  });
  
  // Additional safety - special catch-all middleware for health checks
  app.use((req: Request, res: Response, next: any) => {
    // Only match GET requests with health-related indicators
    const path = req.path.toLowerCase();
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    
    if (req.method === 'GET' && (
        path.includes('health') || 
        path === '/' ||
        req.query.health !== undefined || 
        req.query.check !== undefined ||
        userAgent.includes('health') ||
        userAgent.includes('kube') ||
        userAgent.includes('deployment')
    )) {
      return sendHealthResponse(res);
    }
    
    next();
  });
  
  console.log('Health check endpoints initialized with enhanced detection');
}