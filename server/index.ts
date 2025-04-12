import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { runMigrations } from "./migration";
import fs from "fs";

// Set environment variables
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'currentsee-session-secret';

// Handle missing DATABASE_URL in production
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: DATABASE_URL is not set in production environment. Using in-memory mode.');
  process.env.USE_IN_MEMORY_MODE = 'true';
} else if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Using default development database URL.');
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';
}

const app = express();

// Add health check endpoints BEFORE all other middleware
// This ensures they're accessible even if other parts of the app fail
app.get('/', (req, res, next) => {
  // Check if this is a health check request from the deployment system
  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.includes('Health') || req.query.health === 'check') {
    // Set the content type to application/json for proper health checks
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }
  
  // For normal web requests, check if index.html exists in the public folder
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  if (fs.existsSync(indexPath) && req.path === '/') {
    return res.sendFile(indexPath);
  }
  
  // Otherwise continue to the next handler
  next();
});

// Dedicated health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from public folder with higher priority
app.use(express.static(path.join(process.cwd(), 'public')));

// Explicit route for solar_counter.js to ensure it's available in production
app.get('/solar_counter.js', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'solar_counter.js'));
});

// Specific routes for our HTML pages
app.get('/founder_note.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'founder_note.html'));
});

app.get('/whitepapers.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'whitepapers.html'));
});

app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'signup.html'));
});

// White paper HTML files
app.get('/white_paper_1.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'white_paper_1.html'));
});

app.get('/white_paper_2.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'white_paper_2.html'));
});

app.get('/white_paper_3.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'white_paper_3.html'));
});

app.get('/white_paper_4.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'white_paper_4.html'));
});

app.get('/white_paper_5.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'white_paper_5.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'dashboard.html'));
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Import the template-to-static module synchronously if possible
import './template-to-static';
console.log('Static page generation complete');

(async () => {
  // Run schema push to ensure all tables exist
  try {
    console.log('Ensuring database schema is up to date...');
    const createTables = (await import('./push-schema')).createTables;
    await createTables();
    console.log('Database schema updated successfully');
  } catch (schemaError) {
    console.error('Error updating database schema:', schemaError);
  }

  // Run data migrations from CSV to database
  try {
    await runMigrations();
  } catch (error) {
    console.error('Error running migrations:', error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port: process.env.PORT || 5000,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Server running on port ${process.env.PORT || 5000}`);
    log(`Environment: ${process.env.NODE_ENV}`);
  });
})();
