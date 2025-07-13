// Picture-in-Picture Audio Player JavaScript
class PIPAudioPlayer {
    constructor() {
        this.isDragging = false;
        this.currentX = 0;
        this.currentY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.xOffset = 0;
        this.yOffset = 0;
        this.isMinimized = false;
        this.audioElement = null;
        this.pipElement = null;
        
        this.init();
    }
    
    init() {
        this.createPIPElement();
        this.setupEventListeners();
    }
    
    createPIPElement() {
        // Create the PIP container
        this.pipElement = document.createElement('div');
        this.pipElement.className = 'pip-audio-player';
        this.pipElement.innerHTML = `
            <div class="pip-header">
                <span class="pip-title">TC-S Network Deep Dive</span>
                <div class="pip-controls">
                    <button class="pip-control-btn minimize-btn" title="Minimize">−</button>
                    <button class="pip-control-btn close-btn" title="Close">×</button>
                </div>
            </div>
            <div class="pip-content">
                <div class="solar-graphic">☀️</div>
                <div class="pip-title">Going deep - an early look at the TC-S Network</div>
                <div class="pip-audio-controls">
                    <audio controls preload="metadata" id="pip-audio">
                        <source src="./audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav" type="audio/wav">
                        <source src="audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav" type="audio/wav">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.pipElement);
        this.audioElement = this.pipElement.querySelector('audio');
    }
    
    setupEventListeners() {
        const header = this.pipElement.querySelector('.pip-header');
        const minimizeBtn = this.pipElement.querySelector('.minimize-btn');
        const closeBtn = this.pipElement.querySelector('.close-btn');
        
        // Dragging functionality
        header.addEventListener('mousedown', this.dragStart.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.dragEnd.bind(this));
        
        // Touch events for mobile
        header.addEventListener('touchstart', this.dragStart.bind(this));
        document.addEventListener('touchmove', this.drag.bind(this));
        document.addEventListener('touchend', this.dragEnd.bind(this));
        
        // Control buttons
        minimizeBtn.addEventListener('click', this.toggleMinimize.bind(this));
        closeBtn.addEventListener('click', this.close.bind(this));
        
        // Audio events
        this.audioElement.addEventListener('play', this.onAudioPlay.bind(this));
        this.audioElement.addEventListener('pause', this.onAudioPause.bind(this));
        this.audioElement.addEventListener('ended', this.onAudioEnded.bind(this));
        this.audioElement.addEventListener('error', this.onAudioError.bind(this));
        this.audioElement.addEventListener('canplaythrough', this.onAudioReady.bind(this));
        this.audioElement.addEventListener('loadstart', this.onAudioLoadStart.bind(this));
        this.audioElement.addEventListener('loadedmetadata', this.onMetadataLoaded.bind(this));
        
        // Prevent context menu on player
        this.pipElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    dragStart(e) {
        if (e.type === 'touchstart') {
            this.initialX = e.touches[0].clientX - this.xOffset;
            this.initialY = e.touches[0].clientY - this.yOffset;
        } else {
            this.initialX = e.clientX - this.xOffset;
            this.initialY = e.clientY - this.yOffset;
        }
        
        if (e.target === this.pipElement.querySelector('.pip-header') || 
            e.target.closest('.pip-header')) {
            this.isDragging = true;
            this.pipElement.classList.add('dragging');
        }
    }
    
    drag(e) {
        if (this.isDragging) {
            e.preventDefault();
            
            if (e.type === 'touchmove') {
                this.currentX = e.touches[0].clientX - this.initialX;
                this.currentY = e.touches[0].clientY - this.initialY;
            } else {
                this.currentX = e.clientX - this.initialX;
                this.currentY = e.clientY - this.initialY;
            }
            
            this.xOffset = this.currentX;
            this.yOffset = this.currentY;
            
            this.setTranslate(this.currentX, this.currentY);
        }
    }
    
    dragEnd() {
        this.isDragging = false;
        this.pipElement.classList.remove('dragging');
        
        // Snap to edges if close
        const rect = this.pipElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let newX = this.currentX;
        let newY = this.currentY;
        
        // Snap to right edge
        if (rect.right > windowWidth - 50) {
            newX = windowWidth - rect.width - 20;
        }
        // Snap to left edge
        if (rect.left < 50) {
            newX = 20;
        }
        // Snap to top
        if (rect.top < 50) {
            newY = 20;
        }
        // Snap to bottom
        if (rect.bottom > windowHeight - 50) {
            newY = windowHeight - rect.height - 20;
        }
        
        this.xOffset = newX;
        this.yOffset = newY;
        this.setTranslate(newX, newY);
    }
    
    setTranslate(xPos, yPos) {
        this.pipElement.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }
    
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        const content = this.pipElement.querySelector('.pip-content');
        const minimizeBtn = this.pipElement.querySelector('.minimize-btn');
        
        if (this.isMinimized) {
            this.pipElement.classList.add('minimized');
            content.classList.add('minimized');
            minimizeBtn.innerHTML = '□';
            minimizeBtn.title = 'Restore';
        } else {
            this.pipElement.classList.remove('minimized');
            content.classList.remove('minimized');
            minimizeBtn.innerHTML = '−';
            minimizeBtn.title = 'Minimize';
        }
    }
    
    show() {
        this.pipElement.classList.add('active');
        // Try to load the audio when showing
        if (this.audioElement) {
            console.log('Loading audio element...');
            
            // Add play button functionality immediately
            const playBtn = this.createPlayButton();
            const audioControls = this.pipElement.querySelector('.pip-audio-controls');
            audioControls.insertBefore(playBtn, audioControls.firstChild);
            
            // Load audio
            this.audioElement.load();
        }
    }
    
    createPlayButton() {
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶️ Play Audio';
        playBtn.style.cssText = `
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 10px;
            width: 100%;
        `;
        
        playBtn.addEventListener('click', () => {
            if (this.audioElement.paused) {
                // Simple play with user interaction
                this.audioElement.play().then(() => {
                    console.log('Audio playing');
                }).catch(error => {
                    console.error('Playback failed:', error);
                    // Show user instructions
                    const titleElement = this.pipElement.querySelector('.pip-title');
                    titleElement.textContent = 'Click the audio controls below to play';
                    titleElement.style.color = '#f39c12';
                });
            } else {
                this.audioElement.pause();
            }
        });
        
        // Update button text based on audio state
        this.audioElement.addEventListener('play', () => {
            playBtn.innerHTML = '⏸️ Pause Audio';
        });
        
        this.audioElement.addEventListener('pause', () => {
            playBtn.innerHTML = '▶️ Play Audio';
        });
        
        return playBtn;
    }
    
    hide() {
        this.pipElement.classList.remove('active');
    }
    
    close() {
        this.hide();
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }
    
    onAudioPlay() {
        const solarGraphic = this.pipElement.querySelector('.solar-graphic');
        solarGraphic.style.animationPlayState = 'running';
    }
    
    onAudioPause() {
        const solarGraphic = this.pipElement.querySelector('.solar-graphic');
        solarGraphic.style.animationPlayState = 'paused';
    }
    
    onAudioEnded() {
        const solarGraphic = this.pipElement.querySelector('.solar-graphic');
        solarGraphic.style.animationPlayState = 'paused';
    }
    
    onAudioError(e) {
        console.error('Audio error:', e);
        console.error('Audio error details:', {
            error: e.target.error,
            networkState: e.target.networkState,
            readyState: e.target.readyState,
            src: e.target.src,
            currentSrc: e.target.currentSrc
        });
        
        const titleElement = this.pipElement.querySelector('.pip-title');
        titleElement.textContent = 'Audio loading error - please try again';
        titleElement.style.color = '#e74c3c';
        
        // Try to reload audio with different path
        if (e.target.src.includes('./audio/')) {
            console.log('Trying alternative audio path...');
            setTimeout(() => {
                e.target.src = 'audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav';
                e.target.load();
            }, 1000);
        }
    }
    
    onAudioReady() {
        console.log('Audio ready to play');
        const titleElement = this.pipElement.querySelector('.pip-title');
        titleElement.textContent = 'TC-S Network Deep Dive';
        titleElement.style.color = '#ecf0f1';
    }
    
    onAudioLoadStart() {
        console.log('Audio started loading');
        const titleElement = this.pipElement.querySelector('.pip-title');
        titleElement.textContent = 'Loading audio...';
        titleElement.style.color = '#3498db';
    }
    
    onMetadataLoaded() {
        console.log('Audio metadata loaded, duration:', this.audioElement.duration);
        const titleElement = this.pipElement.querySelector('.pip-title');
        titleElement.textContent = 'Going deep - an early look at the TC-S Network';
        titleElement.style.color = '#ecf0f1';
    }
    
    tryAlternativeAudio() {
        console.log('Trying alternative audio loading...');
        
        // Create a new audio element
        const newAudio = document.createElement('audio');
        newAudio.controls = true;
        newAudio.preload = 'auto';
        
        // Try different approaches
        const audioSrc = '/audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav';
        
        // Test if file exists
        fetch(audioSrc, { method: 'HEAD' })
            .then(response => {
                console.log('Audio file status:', response.status);
                console.log('Audio file headers:', response.headers);
                if (response.ok) {
                    newAudio.src = audioSrc;
                    newAudio.load();
                    
                    // Replace the old audio element
                    const audioControls = this.pipElement.querySelector('.pip-audio-controls');
                    audioControls.replaceChild(newAudio, this.audioElement);
                    this.audioElement = newAudio;
                    
                    // Re-attach event listeners
                    this.setupAudioEvents();
                } else {
                    console.error('Audio file not accessible:', response.status);
                }
            })
            .catch(error => {
                console.error('Failed to check audio file:', error);
            });
    }
    
    setupAudioEvents() {
        this.audioElement.addEventListener('play', this.onAudioPlay.bind(this));
        this.audioElement.addEventListener('pause', this.onAudioPause.bind(this));
        this.audioElement.addEventListener('ended', this.onAudioEnded.bind(this));
        this.audioElement.addEventListener('error', this.onAudioError.bind(this));
        this.audioElement.addEventListener('canplaythrough', this.onAudioReady.bind(this));
        this.audioElement.addEventListener('loadstart', this.onAudioLoadStart.bind(this));
        this.audioElement.addEventListener('loadedmetadata', this.onMetadataLoaded.bind(this));
    }
}

// Initialize PIP player when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.pipAudioPlayer = new PIPAudioPlayer();
});

// Function to launch PIP player (called from homepage)
function launchPIPAudio() {
    if (window.pipAudioPlayer) {
        window.pipAudioPlayer.show();
    }
}