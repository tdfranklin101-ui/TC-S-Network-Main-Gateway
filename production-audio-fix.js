/**
 * Production Audio Fix for The Current-See
 * 
 * This script addresses the WAV audio playback issue in production
 * by ensuring proper audio element initialization and fallback handling.
 */

// Enhanced audio player initialization for production
function initializeProductionAudio() {
    console.log('Initializing production audio player...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupProductionAudio);
    } else {
        setupProductionAudio();
    }
}

function setupProductionAudio() {
    // Find all audio elements and configure them for production
    const audioElements = document.querySelectorAll('audio');
    
    audioElements.forEach(audio => {
        // Set proper source for production
        const sources = audio.querySelectorAll('source');
        sources.forEach(source => {
            if (source.src.includes('Current-See_')) {
                source.src = '/audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav';
            }
        });
        
        // Add production-specific event listeners
        audio.addEventListener('error', (e) => {
            console.error('Audio error in production:', e);
            handleAudioError(audio, e);
        });
        
        audio.addEventListener('loadstart', () => {
            console.log('Audio loading started in production');
        });
        
        audio.addEventListener('loadedmetadata', () => {
            console.log('Audio metadata loaded in production, duration:', audio.duration);
        });
        
        audio.addEventListener('canplaythrough', () => {
            console.log('Audio ready to play in production');
        });
        
        // Force reload to apply new source
        audio.load();
    });
}

function handleAudioError(audio, error) {
    console.error('Audio error details:', {
        error: error.target.error,
        networkState: error.target.networkState,
        readyState: error.target.readyState,
        src: error.target.src
    });
    
    // Try to recover by resetting the source
    setTimeout(() => {
        audio.src = '/audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav';
        audio.load();
        console.log('Attempted audio recovery');
    }, 1000);
}

// Initialize when script loads
initializeProductionAudio();

// Make available globally for debugging
window.setupProductionAudio = setupProductionAudio;