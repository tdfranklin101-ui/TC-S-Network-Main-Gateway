/**
 * The Current-See Cache Busting Script
 * 
 * This script helps ensure browsers always load the latest data without manual redeployment
 * by checking for updates to the cache-timestamp.txt file
 */
(function() {
  // Store the last checked timestamp
  let lastTimestamp = '';
  
  // Function to load the current timestamp from the server
  async function checkForUpdates() {
    try {
      // Add a random query parameter to prevent browser caching of the timestamp file
      const response = await fetch('/cache-timestamp.txt?nocache=' + Math.random(), {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.log('Cache check: Timestamp file not available');
        return;
      }
      
      const currentTimestamp = await response.text();
      
      // If this is the first check, just store the timestamp
      if (!lastTimestamp) {
        lastTimestamp = currentTimestamp;
        console.log('Cache system initialized');
        return;
      }
      
      // If the timestamp has changed, refresh the page data
      if (currentTimestamp.trim() !== lastTimestamp.trim()) {
        console.log('Data update detected - refreshing...');
        lastTimestamp = currentTimestamp;
        
        // Refresh the members data
        if (typeof refreshMembersData === 'function') {
          refreshMembersData();
        }
        
        // Refresh the solar generator data
        if (typeof refreshSolarGeneratorData === 'function') {
          refreshSolarGeneratorData();
        }
        
        // Add any other data refresh functions here
        
        console.log('Data refresh complete');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }
  
  // Check for updates periodically (every 5 minutes)
  setInterval(checkForUpdates, 5 * 60 * 1000);
  
  // Also check for updates when the page gains focus (user returns to tab)
  window.addEventListener('focus', checkForUpdates);
  
  // Initial check when the script loads
  checkForUpdates();
  
  console.log('Cache busting system activated');
})();