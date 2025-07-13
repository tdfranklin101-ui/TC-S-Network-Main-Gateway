/**
 * Production Audio Fix Script
 * 
 * This script ensures the audio file works correctly in production
 * by using the proper absolute path and testing the audio endpoint.
 */

// Test audio file accessibility in production
function testAudioProduction() {
    console.log('Testing audio file in production...');
    
    // Test the audio URL directly
    const audioUrl = '/audio/The Current-See_ Solar Energy for Universal Basic Income_1752340053171.wav';
    
    fetch(audioUrl, { method: 'HEAD' })
        .then(response => {
            console.log('Audio file response:', response.status);
            console.log('Content-Length:', response.headers.get('content-length'));
            console.log('Content-Type:', response.headers.get('content-type'));
            console.log('Accept-Ranges:', response.headers.get('accept-ranges'));
            
            if (response.ok) {
                console.log('✅ Audio file accessible in production');
                
                // Test actual audio element
                const audio = document.createElement('audio');
                audio.src = audioUrl;
                audio.preload = 'metadata';
                
                audio.addEventListener('loadedmetadata', () => {
                    console.log('✅ Audio metadata loaded, duration:', audio.duration);
                });
                
                audio.addEventListener('error', (e) => {
                    console.error('❌ Audio loading error:', e);
                });
                
                audio.addEventListener('canplaythrough', () => {
                    console.log('✅ Audio ready to play');
                });
                
                document.body.appendChild(audio);
                
            } else {
                console.error('❌ Audio file not accessible:', response.status);
            }
        })
        .catch(error => {
            console.error('❌ Network error testing audio:', error);
        });
}

// Run the test when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testAudioProduction);
} else {
    testAudioProduction();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testAudioProduction };
}