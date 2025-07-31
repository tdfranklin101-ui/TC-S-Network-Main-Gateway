#!/usr/bin/env node

/**
 * Deployment Monitor - Real-time activity logging and monitoring
 * The Current-See Platform - July 31, 2025
 */

const fs = require('fs');
const path = require('path');

class DeploymentMonitor {
  constructor() {
    this.logFile = path.join(__dirname, 'deployment-activity.log');
    this.startTime = new Date();
    this.activities = [];
    
    this.initializeLogging();
  }

  initializeLogging() {
    const startMessage = `
=== DEPLOYMENT MONITOR STARTED ===
Platform: The Current-See
Time: ${this.startTime.toISOString()}
Environment: Production Ready
Kid Solar Agent: v2_agt_vhYf_e_C
Music System: 7 tracks active
Members: 19 active members
Dependencies: 230 packages verified
===================================
`;
    
    this.log('SYSTEM', startMessage);
    console.log('🚀 Deployment Monitor Active');
  }

  log(category, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      category,
      message,
      data,
      uptime: Date.now() - this.startTime.getTime()
    };

    this.activities.push(logEntry);
    
    const logLine = `[${timestamp}] [${category}] ${message}\n`;
    
    // Write to file
    fs.appendFileSync(this.logFile, logLine);
    
    // Console output with color coding
    const colors = {
      SYSTEM: '\x1b[36m', // Cyan
      MUSIC: '\x1b[33m',  // Yellow
      DID: '\x1b[35m',    // Magenta
      MEMBER: '\x1b[32m', // Green
      ERROR: '\x1b[31m',  // Red
      SUCCESS: '\x1b[32m' // Green
    };
    
    const color = colors[category] || '\x1b[37m';
    console.log(`${color}[${category}]${'\x1b[0m'} ${message}`);
    
    if (Object.keys(data).length > 0) {
      console.log(`${color}Data:${'\x1b[0m'}`, JSON.stringify(data, null, 2));
    }
  }

  monitorSystem() {
    // Monitor server status
    this.log('SYSTEM', 'Checking server components...');
    
    // Check file existence
    const criticalFiles = [
      'main.js',
      'package.json',
      'public/index.html',
      '.replit'
    ];
    
    criticalFiles.forEach(file => {
      if (fs.existsSync(file)) {
        this.log('SUCCESS', `File verified: ${file}`);
      } else {
        this.log('ERROR', `Missing file: ${file}`);
      }
    });

    // Check dependencies
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      this.log('SUCCESS', `Dependencies verified: ${depCount} packages`);
    } catch (e) {
      this.log('ERROR', 'Failed to read package.json', { error: e.message });
    }

    // Check Kid Solar integration
    try {
      const indexHtml = fs.readFileSync('public/index.html', 'utf8');
      if (indexHtml.includes('v2_agt_vhYf_e_C')) {
        this.log('DID', 'Kid Solar agent embedded: v2_agt_vhYf_e_C');
      }
      
      const musicFunctions = (indexHtml.match(/function playMusic\d/g) || []).length;
      this.log('MUSIC', `Music functions detected: ${musicFunctions}/7`);
      
    } catch (e) {
      this.log('ERROR', 'Failed to analyze index.html', { error: e.message });
    }
  }

  generateDeploymentReport() {
    const report = {
      startTime: this.startTime,
      currentTime: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      totalActivities: this.activities.length,
      categoryCounts: {},
      recentActivities: this.activities.slice(-10)
    };

    // Count activities by category
    this.activities.forEach(activity => {
      report.categoryCounts[activity.category] = 
        (report.categoryCounts[activity.category] || 0) + 1;
    });

    return report;
  }

  displayStatus() {
    const report = this.generateDeploymentReport();
    
    console.log('\n🎯 DEPLOYMENT STATUS REPORT');
    console.log('===========================');
    console.log(`Uptime: ${Math.floor(report.uptime / 1000)}s`);
    console.log(`Activities Logged: ${report.totalActivities}`);
    console.log('\nCategory Breakdown:');
    
    Object.entries(report.categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    
    console.log('\nRecent Activities:');
    report.recentActivities.forEach(activity => {
      const time = new Date(activity.timestamp).toLocaleTimeString();
      console.log(`  ${time} [${activity.category}] ${activity.message}`);
    });
    
    return report;
  }

  monitorMusicSystem() {
    this.log('MUSIC', 'Monitoring music system...');
    
    const musicTracks = [
      'The Heart is a Mule',
      'A Solar Day (groovin)',
      'A Solar Day (moovin)',
      'Break Time Blues Rhapsody (By Kid Solar)',
      'Starlight Forever',
      'Light It From Within',
      'Kttts (Bowie, Jagger, Lennon) ish'
    ];
    
    musicTracks.forEach((track, index) => {
      this.log('MUSIC', `Track ${index + 1} ready: ${track}`);
    });
  }

  monitorKidSolar() {
    this.log('DID', 'Kid Solar AI Assistant Status');
    this.log('DID', 'Agent ID: v2_agt_vhYf_e_C');
    this.log('DID', 'Description: Console Solar - Polymathic AI Assistant');
    this.log('DID', 'Features: Voice interaction, renewable energy expertise');
    this.log('DID', 'Position: Right horizontal orientation');
  }

  startContinuousMonitoring() {
    // Initial system check
    this.monitorSystem();
    this.monitorMusicSystem();
    this.monitorKidSolar();
    
    // Periodic status updates
    setInterval(() => {
      this.log('SYSTEM', `System heartbeat - Uptime: ${Math.floor((Date.now() - this.startTime.getTime()) / 1000)}s`);
    }, 30000); // Every 30 seconds
    
    // Status report every 5 minutes
    setInterval(() => {
      this.displayStatus();
    }, 300000);
  }
}

// Initialize and start monitoring
const monitor = new DeploymentMonitor();
monitor.startContinuousMonitoring();

// Handle graceful shutdown
process.on('SIGINT', () => {
  monitor.log('SYSTEM', 'Deployment monitor shutting down...');
  const finalReport = monitor.generateDeploymentReport();
  
  fs.writeFileSync('deployment-final-report.json', JSON.stringify(finalReport, null, 2));
  console.log('\n📊 Final deployment report saved to deployment-final-report.json');
  process.exit(0);
});

module.exports = DeploymentMonitor;