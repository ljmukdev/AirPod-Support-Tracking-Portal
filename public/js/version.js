// Version Display Script
// Loads and displays version number in top right corner

(function() {
    'use strict';
    
    async function loadVersion() {
        try {
            const response = await fetch('/api/version');
            if (response.ok) {
                const data = await response.json();
                displayVersion(data.version, data.revision);
            } else {
                // Fallback if API fails
                displayVersion('1.0.0', '000');
            }
        } catch (error) {
            console.error('Error loading version:', error);
            // Fallback if API fails
            displayVersion('1.0.0', '000');
        }
    }
    
    function displayVersion(version, revision) {
        // Create version display element
        const versionElement = document.createElement('div');
        versionElement.className = 'version-display';
        versionElement.textContent = `v${version}.${revision}`;
        versionElement.title = `Version ${version} (Revision ${revision})`;
        
        // Add to body
        document.body.appendChild(versionElement);
    }
    
    // Load version when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadVersion);
    } else {
        loadVersion();
    }
})();

