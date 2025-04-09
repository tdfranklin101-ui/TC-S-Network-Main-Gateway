import { Request, Response } from 'express';
import fs from 'fs';
import { parse, stringify } from 'csv/sync';
import path from 'path';

const REGISTRANT_FILE = path.join(process.cwd(), 'registrants.csv');

export function setupWaitlistRoutes(app: any) {
  app.post('/signup', handleSignup);
  app.get('/registrants/count', getRegistrantCount);
}

function handleSignup(req: Request, res: Response) {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Missing name or email' });
  }
  
  try {
    const fileExists = fs.existsSync(REGISTRANT_FILE);
    const now = new Date().toISOString();
    
    // Create file with headers if it doesn't exist
    if (!fileExists) {
      fs.writeFileSync(REGISTRANT_FILE, 'name,email,date\n');
    }
    
    // Escape CSV fields to handle commas in values
    const escapedName = name.includes(',') ? `"${name}"` : name;
    const escapedEmail = email.includes(',') ? `"${email}"` : email;
    
    // Append to CSV file with date
    fs.appendFileSync(REGISTRANT_FILE, `${escapedName},${escapedEmail},${now}\n`);
    
    return res.status(200).json({ 
      success: true, 
      message: `Thank you for signing up, ${name}!` 
    });
  } catch (error) {
    console.error('Error saving registration:', error);
    return res.status(500).json({ error: 'Failed to register' });
  }
}

function getRegistrantCount(req: Request, res: Response) {
  try {
    if (!fs.existsSync(REGISTRANT_FILE)) {
      return res.json({ count: 0 });
    }
    
    const content = fs.readFileSync(REGISTRANT_FILE, 'utf8');
    // Count lines (subtract 1 for header)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const count = Math.max(0, lines.length - 1); // Ensure non-negative
    
    return res.json({ count });
  } catch (error) {
    console.error('Error counting registrants:', error);
    return res.status(500).json({ error: 'Failed to count registrants' });
  }
}