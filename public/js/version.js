// Version Display Script
// Loads and displays version number in top right corner

(function() {
    'use strict';
    
    function displayVersion(version, revision) {
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
        
        // Add to body
        if (document.body) {
            document.body.appendChild(versionElement);
        } else {
            // Wait for body to be available
            document.addEventListener('DOMContentLoaded', function() {
                document.body.appendChild(versionElement);
            });
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
            }
        } catch (error) {
            console.error('Error loading version:', error);
        }
        
        // Fallback - always show something
        displayVersion('1.2.0', '001');
    }
    
    // Load version when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadVersion);
    } else {
        // DOM already loaded, load immediately
        loadVersion();
    }
})();

