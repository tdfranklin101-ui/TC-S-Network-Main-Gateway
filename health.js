/**
 * Health Check for The Current-See Deployment
 * 
 * This file helps Replit verify the application is running correctly
 */

module.exports = async function(req, res) {
  res.status(200).json({
    status: 'healthy',
    service: 'The Current-See',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
};