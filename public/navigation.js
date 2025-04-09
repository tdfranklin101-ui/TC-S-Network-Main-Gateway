// Navigation Script for Static Pages
document.addEventListener('DOMContentLoaded', function() {
    // Load the solar counter script
    if (!document.getElementById('solar-counter-script')) {
        const solarCounterScript = document.createElement('script');
        solarCounterScript.id = 'solar-counter-script';
        solarCounterScript.src = '/solar_counter.js';
        solarCounterScript.async = true;
        document.body.appendChild(solarCounterScript);
    }
});