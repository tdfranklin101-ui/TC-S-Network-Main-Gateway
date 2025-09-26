/**
 * AR/VR Support for The Current-See Website
 * 
 * This script adds functionality to detect and enable AR/VR features
 * when supported by the user's device.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Check for WebXR support
  const isXrSupported = 'xr' in navigator;
  const isArSupported = isXrSupported && 'isSessionSupported' in navigator.xr ? 
                        navigator.xr.isSessionSupported('immersive-ar') : false;
  const isVrSupported = isXrSupported && 'isSessionSupported' in navigator.xr ? 
                        navigator.xr.isSessionSupported('immersive-vr') : false;
  
  // Check for Apple AR Quick Look support (iOS)
  const isAppleArSupported = /(iPhone|iPad|iPod)/i.test(navigator.userAgent);
  
  // Add marker classes to the body for CSS targeting
  if (isXrSupported) document.body.classList.add('xr-supported');
  if (isArSupported) document.body.classList.add('ar-supported');
  if (isVrSupported) document.body.classList.add('vr-supported');
  if (isAppleArSupported) document.body.classList.add('apple-ar-supported');
  
  // Find elements that should show AR/VR buttons
  const arEnabledElements = document.querySelectorAll('[data-ar-enabled]');
  const vrEnabledElements = document.querySelectorAll('[data-vr-enabled]');
  
  // Add AR buttons to supported elements
  arEnabledElements.forEach(element => {
    if (isArSupported || isAppleArSupported) {
      addArButton(element);
    }
  });
  
  // Add VR buttons to supported elements
  vrEnabledElements.forEach(element => {
    if (isVrSupported) {
      addVrButton(element);
    }
  });
  
  /**
   * Adds an AR viewer button to an element
   */
  function addArButton(element) {
    const modelUrl = element.getAttribute('data-model-url') || '/models/solar-token.usdz';
    const modelName = element.getAttribute('data-model-name') || 'Solar Token';
    
    const arButton = document.createElement('button');
    arButton.className = 'ar-button';
    arButton.innerHTML = '<span>View in AR</span>';
    
    if (isAppleArSupported) {
      // For iOS, use AR Quick Look
      const iosArUrl = modelUrl.endsWith('.usdz') ? modelUrl : '/models/solar-token.usdz';
      arButton.addEventListener('click', function() {
        window.location.href = `${iosArUrl}#allowsContentScaling=0&canonicalWebPageURL=${encodeURIComponent(window.location.href)}`;
      });
    } else if (isArSupported) {
      // For WebXR capable devices
      arButton.addEventListener('click', function() {
        // WebXR AR implementation would go here
        console.log('Starting WebXR AR session with model:', modelUrl);
        // This requires more complex WebXR setup that would go here
      });
    }
    
    element.appendChild(arButton);
  }
  
  /**
   * Adds a VR viewer button to an element
   */
  function addVrButton(element) {
    const modelUrl = element.getAttribute('data-model-url') || '/models/solar-token.glb';
    const modelName = element.getAttribute('data-model-name') || 'Solar Token';
    
    const vrButton = document.createElement('button');
    vrButton.className = 'vr-button';
    vrButton.innerHTML = '<span>View in VR</span>';
    
    vrButton.addEventListener('click', function() {
      // WebXR VR implementation would go here
      console.log('Starting WebXR VR session with model:', modelUrl);
      // This requires more complex WebXR setup that would go here
    });
    
    element.appendChild(vrButton);
  }
});