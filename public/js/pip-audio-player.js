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
                    <audio controls>
                        <source src="/audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav" type="audio/wav">
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