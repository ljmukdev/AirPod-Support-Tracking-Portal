// Version Display Script
// Loads and displays version number in top right corner

(function() {
    'use strict';
    
    function displayVersion(version, revision) {
        try {
            // Remove any existing version display
            const existing = document.querySelector('.version-display');
            if (existing) {
                existing.remove();
            }
            
            // Create version display element
            const versionElement = document.createElement('div');
            versionElement.className = 'version-display';
            versionElement.textContent = `v${version}.${revision}`;
            versionElement.title = `Version ${version} (Revision ${revision})`;
            versionElement.style.cssText = 'position: fixed; top: 10px; right: 10px; font-size: 0.7rem; color: rgba(0, 0, 0, 0.6); font-family: "Courier New", monospace; z-index: 9999; padding: 4px 8px; background-color: rgba(255, 255, 255, 0.85); border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); opacity: 1; display: block; pointer-events: none;';
            
            // Add to body
            if (document.body) {
                document.body.appendChild(versionElement);
                console.log('Version displayed:', `v${version}.${revision}`);
            } else {
                // Wait for body to be available
                const waitForBody = setInterval(function() {
                    if (document.body) {
                        clearInterval(waitForBody);
                        document.body.appendChild(versionElement);
                        console.log('Version displayed (delayed):', `v${version}.${revision}`);
                    }
                }, 100);
                
                // Fallback timeout
                setTimeout(function() {
                    clearInterval(waitForBody);
                    if (document.body && !document.querySelector('.version-display')) {
                        document.body.appendChild(versionElement);
                        console.log('Version displayed (timeout):', `v${version}.${revision}`);
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('Error displaying version:', err);
        }
    }
    
    async function loadVersion() {
        try {
            const response = await fetch('/api/version');
            if (response.ok) {
                const data = await response.json();
                if (data.version && data.revision) {
                    displayVersion(data.version, data.revision);
                    return;
                }
            } else {
                console.warn('Version API returned non-OK status:', response.status);
            }
        } catch (error) {
            console.warn('Error loading version from API:', error.message);
        }
        
        // Fallback - always show something
        console.log('Using fallback version');
        displayVersion('1.2.0', '001');
    }
    
    // Try to load immediately
    function init() {
        console.log('Version script loaded, initializing...');
        loadVersion();
    }
    
    // Load version when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded, load immediately
        init();
    }
    
    // Also try after a short delay as backup
    setTimeout(init, 500);
})();

