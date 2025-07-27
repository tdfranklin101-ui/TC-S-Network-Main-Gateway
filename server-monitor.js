#!/usr/bin/env node

// Production Server Monitor
// Ensures server consistency and automatic recovery

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

class ServerMonitor {
  constructor() {
    this.serverProcess = null;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.healthCheckInterval = 30000; // 30 seconds
    this.healthCheckTimer = null;
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [MONITOR-${level.toUpperCase()}] ${message}`;
    console.log(logEntry + (data ? ` | ${JSON.stringify(data)}` : ''));
    
    try {
      fs.appendFileSync('monitor.log', logEntry + '\n');
    } catch (e) {
      console.error('Monitor log write failed:', e.message);
    }
  }

  startServer() {
    this.log('info', 'Starting production server');
    
    this.serverProcess = spawn('node', ['production-server.js'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    this.serverProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    this.serverProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
      this.log('warn', 'Server stderr', { error: data.toString() });
    });

    this.serverProcess.on('close', (code) => {
      this.log('warn', 'Server process exited', { code, restartCount: this.restartCount });
      
      if (code !== 0 && this.restartCount < this.maxRestarts) {
        this.restartCount++;
        this.log('info', `Restarting server (attempt ${this.restartCount}/${this.maxRestarts})`);
        setTimeout(() => this.startServer(), 5000); // Wait 5 seconds before restart
      } else if (this.restartCount >= this.maxRestarts) {
        this.log('error', 'Max restart attempts reached, monitoring stopped');
        process.exit(1);
      }
    });

    this.serverProcess.on('error', (error) => {
      this.log('error', 'Server process error', { error: error.message });
    });

    // Start health monitoring after server startup
    setTimeout(() => this.startHealthMonitoring(), 10000);
  }

  startHealthMonitoring() {
    this.log('info', 'Starting health monitoring');
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  performHealthCheck() {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/health',
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          this.log('debug', 'Health check passed', { 
            status: health.status,
            sessions: health.memory?.totalSessions,
            uptime: health.server?.uptime
          });
          
          // Reset restart count on successful health check
          if (this.restartCount > 0) {
            this.log('info', 'Server stable, resetting restart counter');
            this.restartCount = 0;
          }
        } catch (error) {
          this.log('warn', 'Health check response parse error', { error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      this.log('error', 'Health check failed', { error: error.message });
      
      // If health check fails and server process is not running, restart
      if (!this.serverProcess || this.serverProcess.killed) {
        this.log('warn', 'Server process not running, restarting');
        this.startServer();
      }
    });

    req.on('timeout', () => {
      this.log('warn', 'Health check timeout');
      req.destroy();
    });

    req.end();
  }

  getMonitorStats() {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeMinutes = Math.floor(uptimeMs / (1000 * 60));
    
    return {
      monitorUptime: uptimeMinutes,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      healthCheckInterval: this.healthCheckInterval / 1000,
      serverProcessId: this.serverProcess?.pid,
      monitoring: !!this.healthCheckTimer
    };
  }

  stop() {
    this.log('info', 'Stopping server monitor');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.serverProcess && !this.serverProcess.killed) {
      this.serverProcess.kill('SIGTERM');
      
      // Force kill after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        if (!this.serverProcess.killed) {
          this.log('warn', 'Force killing server process');
          this.serverProcess.kill('SIGKILL');
        }
      }, 10000);
    }
  }
}

// Handle monitor shutdown
process.on('SIGTERM', () => {
  console.log('Monitor received SIGTERM, shutting down');
  if (monitor) monitor.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Monitor received SIGINT, shutting down');
  if (monitor) monitor.stop();
  process.exit(0);
});

// Start monitoring
const monitor = new ServerMonitor();
monitor.log('info', 'Server monitor initializing', monitor.getMonitorStats());
monitor.startServer();

// Monitor status endpoint
const monitorServer = http.createServer((req, res) => {
  if (req.url === '/monitor-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'active',
      ...monitor.getMonitorStats(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Monitor endpoint not found');
  }
});

monitorServer.listen(3001, () => {
  monitor.log('info', 'Monitor status endpoint active on port 3001');
});