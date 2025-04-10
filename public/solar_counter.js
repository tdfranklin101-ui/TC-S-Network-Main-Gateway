/**
 * Solar Counter - A dynamic counter showing solar energy accumulation
 * 
 * This script creates an animated counter that visualizes the 
 * continuous generation of solar energy and its equivalent monetary value
 * based on data accumulated since April 7, 2025.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Create counter element if it doesn't exist
    if (!document.getElementById('solar-counter')) {
        const counterDiv = document.createElement('div');
        counterDiv.id = 'solar-counter';
        document.body.appendChild(counterDiv);
        
        // Style the counter
        styleCounter(counterDiv);
    }
    
    // Initialize the counter
    fetchSolarClockData();
});

function styleCounter(element) {
    element.style.position = 'fixed';
    element.style.bottom = '20px';
    element.style.right = '20px';
    element.style.backgroundColor = 'rgba(0, 87, 184, 0.9)';
    element.style.color = 'white';
    element.style.padding = '15px';
    element.style.borderRadius = '8px';
    element.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
    element.style.fontFamily = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    element.style.fontSize = '14px';
    element.style.zIndex = '1000';
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.transition = 'all 0.3s ease';
    element.style.cursor = 'pointer';
    
    // Add hover effect
    element.addEventListener('mouseenter', function() {
        this.style.backgroundColor = 'rgba(0, 64, 144, 0.95)';
        this.style.transform = 'scale(1.05)';
    });
    
    element.addEventListener('mouseleave', function() {
        this.style.backgroundColor = 'rgba(0, 87, 184, 0.9)';
        this.style.transform = 'scale(1)';
    });
    
    // Add click to hide/show details
    let expanded = false;
    element.addEventListener('click', function() {
        const detailsElement = document.getElementById('counter-details');
        if (detailsElement) {
            expanded = !expanded;
            detailsElement.style.maxHeight = expanded ? '300px' : '0';
            detailsElement.style.opacity = expanded ? '1' : '0';
        }
    });
}

// Fetch the solar clock data from the server API
function fetchSolarClockData() {
    // Display loading state
    const counterElement = document.getElementById('solar-counter');
    if (counterElement) {
        counterElement.innerHTML = '<div>Loading solar data...</div>';
    }
    
    fetch('/api/solar-clock')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch solar clock data');
            }
            return response.json();
        })
        .then(data => {
            // Initialize the counter with fetched data
            initCounter(data);
        })
        .catch(error => {
            console.error('Error fetching solar clock data:', error);
            
            // Show error in counter
            if (counterElement) {
                counterElement.innerHTML = '<div style="color: #FFD700">⚠️ Solar data unavailable</div>';
            }
        });
}

function initCounter(data) {
    const counterElement = document.getElementById('solar-counter');
    if (!counterElement) return;
    
    // Clear existing content
    counterElement.innerHTML = '';
    
    // Create counter title
    const title = document.createElement('div');
    title.textContent = '☀️ Live Solar Generation';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    
    // Create main counter
    const counter = document.createElement('div');
    counter.id = 'main-counter';
    counter.style.fontSize = '16px';
    counter.style.fontWeight = 'bold';
    counter.style.color = '#FFD700';
    
    // Create expanding details section
    const details = document.createElement('div');
    details.id = 'counter-details';
    details.style.overflow = 'hidden';
    details.style.maxHeight = '0';
    details.style.opacity = '0';
    details.style.transition = 'all 0.5s ease';
    details.style.marginTop = '10px';
    details.style.fontSize = '12px';
    
    // Add elements to counter
    counterElement.appendChild(title);
    counterElement.appendChild(counter);
    counterElement.appendChild(details);
    
    // Start counter animation with the fetched data
    updateCounter(data);
}

function updateCounter(initialData) {
    // Calculate current values based on initial data and time elapsed since fetch
    const fetchTimestamp = new Date(initialData.timestamp).getTime();
    const currentTimestamp = Date.now();
    const secondsSinceFetch = (currentTimestamp - fetchTimestamp) / 1000;
    
    // Add kWh generated since the data was fetched
    const additionalKwh = secondsSinceFetch * initialData.kwhPerSecond;
    const additionalDollars = additionalKwh * initialData.dollarPerKwh;
    
    // Current total values
    const currentKwh = initialData.totalKwh + additionalKwh;
    const currentDollars = initialData.totalDollars + additionalDollars;
    
    // Total elapsed seconds since base date (April 7, 2025)
    const totalElapsedSeconds = initialData.elapsedSeconds + secondsSinceFetch;
    
    // Convert to MkWh (Million kWh) for display
    const currentMkWh = currentKwh / 1000000;
    
    // Make sure the numbers change visibly by ensuring 6 decimal places
    const formattedMkWh = currentMkWh.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
    });
    
    const formattedDollars = currentDollars.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    // Update main counter
    const mainCounter = document.getElementById('main-counter');
    if (mainCounter) {
        mainCounter.textContent = `${formattedMkWh} MkWh = $${formattedDollars}`;
    }
    
    // Update details section
    const details = document.getElementById('counter-details');
    if (details) {
        // Calculate various statistics
        const kwhPerHour = initialData.kwhPerSecond * 3600;
        const mkwhPerHour = kwhPerHour / 1000000;
        const co2Saved = currentKwh * 0.85; // kg of CO2 saved per kWh
        const co2SavedTons = co2Saved / 1000; // Convert to metric tons
        const homesPowered = currentKwh / 1.5; // Homes powered based on average consumption
        
        details.innerHTML = `
            <div style="margin-bottom: 5px">Base Date: April 7, 2025</div>
            <div style="margin-bottom: 5px">Total Days: ${(totalElapsedSeconds / 86400).toFixed(2)}</div>
            <div style="margin-bottom: 5px">Generation Rate: ${mkwhPerHour.toFixed(8)} MkWh/hour</div>
            <div style="margin-bottom: 5px">Equivalent CO₂ Saved: ${co2SavedTons.toLocaleString(undefined, {maximumFractionDigits: 2})} metric tons</div>
            <div style="margin-bottom: 5px">Homes Powered: ${homesPowered.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
            <div style="font-size: 10px; margin-top: 10px; opacity: 0.7">Click to toggle details</div>
        `;
    }
    
    // Continue updating - make sure this happens faster to show visible changes
    setTimeout(() => updateCounter(initialData), 100);
}

function formatTime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}