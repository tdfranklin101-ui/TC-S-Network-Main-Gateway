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
    
    // Create navigation menu if not on the homepage (which has its own navigation)
    if (!document.querySelector('.home-page') && !document.getElementById('nav-menu')) {
        const header = document.querySelector('header');
        if (header) {
            const nav = document.createElement('nav');
            nav.id = 'nav-menu';
            nav.className = 'nav-menu';
            nav.innerHTML = `
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/founder_note.html">Founder's Note</a></li>
                    <li><a href="/whitepapers.html">White Papers</a></li>
                    <li><a href="/signup.html" class="highlight-link">Join Waitlist</a></li>
                </ul>
            `;
            
            // Apply some basic styling
            const style = document.createElement('style');
            style.textContent = `
                .nav-menu {
                    margin-top: 10px;
                }
                .nav-menu ul {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    padding: 0;
                    margin: 0;
                    list-style: none;
                }
                .nav-menu a {
                    color: #0057B8; /* Changed from white to blue for better contrast */
                    text-decoration: none;
                    font-weight: 500;
                    transition: opacity 0.3s;
                }
                .nav-menu a:hover {
                    opacity: 0.8;
                }
                .nav-menu .highlight-link {
                    background-color: #f0de4d;
                    color: #333;
                    padding: 5px 10px;
                    border-radius: 4px;
                }
                
                @media (max-width: 600px) {
                    .nav-menu ul {
                        flex-direction: column;
                        gap: 10px;
                        align-items: center;
                    }
                }
            `;
            
            document.head.appendChild(style);
            header.appendChild(nav);
        }
    }
});