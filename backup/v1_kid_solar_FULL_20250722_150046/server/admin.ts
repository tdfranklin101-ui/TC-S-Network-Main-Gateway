import { Request, Response } from 'express';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { parse, stringify } from 'csv/sync';
import path from 'path';
import crypto from 'crypto';

// Simple session management
const sessions: {[key: string]: {expires: Date}} = {};

// Hash for password verification (will be initialized on first run)
let passwordHash = '';
const defaultPassword = 'currentsee-admin'; // Default password before it's changed

// Initialize admin system
export function initializeAdmin() {
  // Load password hash from file if it exists, otherwise create with default password
  const passwordFilePath = path.join(process.cwd(), 'admin_password.hash');
  
  if (existsSync(passwordFilePath)) {
    passwordHash = readFileSync(passwordFilePath, 'utf8');
  } else {
    // Create with default password
    passwordHash = hashPassword(defaultPassword);
    writeFileSync(passwordFilePath, passwordHash);
  }
}

// Hash a password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Verify a password against the stored hash
function verifyPassword(password: string): boolean {
  return hashPassword(password) === passwordHash;
}

// Generate a random session ID
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: any) {
  const sessionId = req.cookies?.adminSession;
  
  if (sessionId && sessions[sessionId] && sessions[sessionId].expires > new Date()) {
    // Session exists and is valid
    next();
  } else {
    // No valid session
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Admin Authentication
export function handleAuth(req: Request, res: Response) {
  const { password } = req.body;
  
  if (verifyPassword(password)) {
    // Create a session that expires in 2 hours
    const sessionId = generateSessionId();
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 2);
    
    sessions[sessionId] = {
      expires: expiryDate
    };
    
    // Set cookie
    res.cookie('adminSession', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiryDate
    });
    
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
}

// Check Auth Status
export function checkAuth(req: Request, res: Response) {
  const sessionId = req.cookies?.adminSession;
  
  if (sessionId && sessions[sessionId] && sessions[sessionId].expires > new Date()) {
    // Session exists and is valid
    res.status(200).json({ authenticated: true });
  } else {
    // No valid session
    res.status(401).json({ authenticated: false });
  }
}

// Logout
export function handleLogout(req: Request, res: Response) {
  const sessionId = req.cookies?.adminSession;
  
  if (sessionId && sessions[sessionId]) {
    // Remove session
    delete sessions[sessionId];
  }
  
  // Clear cookie
  res.clearCookie('adminSession');
  res.status(200).json({ success: true });
}

// Change Password
export function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  
  if (!verifyPassword(currentPassword)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  
  // Update password
  passwordHash = hashPassword(newPassword);
  
  // Save to file
  const passwordFilePath = path.join(process.cwd(), 'admin_password.hash');
  writeFileSync(passwordFilePath, passwordHash);
  
  res.status(200).json({ success: true });
}

// Get Waitlist Data
export function getWaitlistData(req: Request, res: Response) {
  const registrantsFilePath = path.join(process.cwd(), 'registrants.csv');
  
  if (!existsSync(registrantsFilePath)) {
    return res.json([]);
  }
  
  try {
    const csvData = readFileSync(registrantsFilePath, 'utf8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });
    
    res.json(records);
  } catch (error) {
    console.error('Error reading waitlist data:', error);
    res.status(500).json({ error: 'Failed to read waitlist data' });
  }
}

// Export Waitlist as CSV
export function exportWaitlist(req: Request, res: Response) {
  const registrantsFilePath = path.join(process.cwd(), 'registrants.csv');
  
  if (!existsSync(registrantsFilePath)) {
    // Create empty CSV with headers if it doesn't exist
    const emptyData = 'name,email,date\n';
    res.setHeader('Content-Disposition', 'attachment; filename=waitlist-data.csv');
    res.setHeader('Content-Type', 'text/csv');
    return res.send(emptyData);
  }
  
  try {
    const csvData = readFileSync(registrantsFilePath, 'utf8');
    
    res.setHeader('Content-Disposition', 'attachment; filename=waitlist-data.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (error) {
    console.error('Error exporting waitlist:', error);
    res.status(500).json({ error: 'Failed to export waitlist data' });
  }
}

// Register admin routes
export function setupAdminRoutes(app: any) {
  initializeAdmin();
  
  // Authentication routes
  app.post('/admin/auth', handleAuth);
  app.get('/admin/check-auth', checkAuth);
  app.post('/admin/logout', handleLogout);
  app.post('/admin/change-password', isAuthenticated, changePassword);
  
  // Data routes
  app.get('/admin/waitlist-data', isAuthenticated, getWaitlistData);
  app.get('/admin/export-waitlist', isAuthenticated, exportWaitlist);
}