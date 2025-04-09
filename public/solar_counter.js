/**
 * Solar Counter - A dynamic counter showing solar energy accumulation
 * 
 * This script creates an animated counter that visualizes the 
 * continuous generation of solar energy and its equivalent monetary value.
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
    initCounter();
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

function initCounter() {
    const counterElement = document.getElementById('solar-counter');
    
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
    
    // Initialize values
    const startTimestamp = Date.now();
    const kwhPerSecond = 0.00005; // Approximate solar generation rate for visualization
    const dollarPerKwh = 0.12;    // Average electricity cost
    
    // Start counter animation
    updateCounter(startTimestamp, kwhPerSecond, dollarPerKwh);
}

function updateCounter(startTimestamp, kwhPerSecond, dollarPerKwh) {
    const elapsedSeconds = (Date.now() - startTimestamp) / 1000;
    const generatedKwh = elapsedSeconds * kwhPerSecond;
    const generatedValue = generatedKwh * dollarPerKwh;
    
    // Update main counter
    const mainCounter = document.getElementById('main-counter');
    mainCounter.textContent = `${generatedKwh.toFixed(6)} kWh = $${generatedValue.toFixed(6)}`;
    
    // Update details section
    const details = document.getElementById('counter-details');
    details.innerHTML = `
        <div style="margin-bottom: 5px">Solar Generation Rate: ${(kwhPerSecond * 3600).toFixed(4)} kWh/hour</div>
        <div style="margin-bottom: 5px">Time Elapsed: ${formatTime(elapsedSeconds)}</div>
        <div style="margin-bottom: 5px">Equivalent CO₂ Saved: ${(generatedKwh * 0.85).toFixed(4)} kg</div>
        <div style="margin-bottom: 5px">Homes Powered: ${(generatedKwh / 1.5).toFixed(6)}</div>
        <div style="font-size: 10px; margin-top: 10px; opacity: 0.7">Click to toggle details</div>
    `;
    
    // Continue updating
    requestAnimationFrame(() => updateCounter(startTimestamp, kwhPerSecond, dollarPerKwh));
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}