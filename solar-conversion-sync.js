/**
 * The Current-See Solar-Conversion-Clock Synchronization System
 * 
 * This module watches for changes to solar distribution files and ensures
 * the website automatically updates with the latest data without requiring manual 
 * redeployments or server restarts.
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Files to watch for changes
const watchPaths = [
  // Main data files
  'public/api/members.json',
  'public/embedded-members',
  'distribution_log.txt',
  // Add any other files that might be changed during solar distribution
];

// Cache update functions
let watcherInitialized = false;
let fsWatcher = null;

/**
 * Updates the cache timestamp file to trigger client-side refreshes
 */
function updateCacheTimestamp() {
  try {
    const timestamp = new Date().toISOString();
    fs.writeFileSync(path.join(__dirname, 'public', 'cache-timestamp.txt'), timestamp);
    console.log(`Cache timestamp updated to ${timestamp}`);
    return true;
  } catch (error) {
    console.error('Error updating cache timestamp:', error);
    return false;
  }
}

/**
 * Initialize file watchers to detect changes in critical solar distribution files
 */
function initFileWatchers() {
  if (watcherInitialized) {
    console.log('File watchers already initialized');
    return;
  }

  console.log('Initializing Solar-Conversion-Clock file watchers...');
  
  // Create the watcher instance
  fsWatcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });
  
  // Add event listeners
  fsWatcher
    .on('change', (filePath) => {
      console.log(`[Solar-Conversion-Sync] Detected change in ${filePath}`);
      
      // Update the cache timestamp to trigger client refreshes
      updateCacheTimestamp();
      
      // Log the change for monitoring
      logSyncEvent(`File change detected in ${filePath}`);
    })
    .on('error', (error) => {
      console.error(`[Solar-Conversion-Sync] Error watching files: ${error}`);
      logSyncEvent(`Watcher error: ${error.message}`);
    });
    
  // When all files are ready to be watched
  fsWatcher.on('ready', () => {
    console.log('[Solar-Conversion-Sync] Initial scan complete, watching for changes...');
    watcherInitialized = true;
    
    // Do an initial cache timestamp update
    updateCacheTimestamp();
    
    // Log system start
    logSyncEvent('Solar-Conversion-Clock synchronization system activated');
  });
  
  // Set up a periodic check every 15 minutes as a failsafe
  setInterval(() => {
    verifyWatcherStatus();
  }, 15 * 60 * 1000);
  
  console.log('Solar-Conversion-Clock file watchers initialized');
}

/**
 * Verify the watcher is still functioning properly
 */
function verifyWatcherStatus() {
  if (!watcherInitialized || !fsWatcher) {
    console.log('[Solar-Conversion-Sync] Watcher not initialized, starting now...');
    initFileWatchers();
    return;
  }
  
  // Check if any of the watched files exist but aren't being watched
  for (const watchPath of watchPaths) {
    try {
      if (fs.existsSync(watchPath) && !fsWatcher.getWatched()[path.dirname(watchPath)]?.includes(path.basename(watchPath))) {
        console.log(`[Solar-Conversion-Sync] Re-adding watch for ${watchPath}`);
        fsWatcher.add(watchPath);
      }
    } catch (error) {
      console.error(`[Solar-Conversion-Sync] Error checking watched file ${watchPath}:`, error);
    }
  }
  
  logSyncEvent('Watcher status verified');
}

/**
 * Log synchronization events
 */
function logSyncEvent(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync('sync_log.txt', logMessage);
  } catch (error) {
    console.error('Error writing to sync log:', error);
  }
}

/**
 * Manual trigger for synchronization (for testing or forced updates)
 */
function manualSyncTrigger() {
  console.log('[Solar-Conversion-Sync] Manually triggering synchronization');
  updateCacheTimestamp();
  logSyncEvent('Manual synchronization triggered');
  return true;
}

// Export the functions
module.exports = {
  initFileWatchers,
  manualSyncTrigger,
  updateCacheTimestamp
};