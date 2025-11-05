// Script to add inline version display to all HTML files
const fs = require('fs');
const path = require('path');

const versionScript = `
    <script>
        // Inline version display - always runs immediately
        (function() {
            function showVersion() {
                var el = document.createElement('div');
                el.id = 'version-display';
                el.style.cssText = 'position:fixed;top:10px;right:10px;font-size:0.7rem;color:rgba(0,0,0,0.7);font-family:"Courier New",monospace;z-index:99999;padding:4px 8px;background:rgba(255,255,255,0.9);border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:none;';
                el.textContent = 'v1.2.0.001';
                el.title = 'Version 1.2.0 (Revision 001)';
                if (document.body) {
                    document.body.appendChild(el);
                } else {
                    setTimeout(function() {
                        if (document.body) document.body.appendChild(el);
                    }, 100);
                }
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', showVersion);
            } else {
                showVersion();
            }
            setTimeout(showVersion, 1000);
        })();
    </script>`;

const htmlFiles = [
    'public/case.html',
    'public/confirmation.html',
    'public/index.html',
    'public/left-airpod.html',
    'public/privacy-policy.html',
    'public/product-details.html',
    'public/right-airpod.html',
    'public/terms-and-conditions.html',
    'public/troubleshooting.html',
    'public/warranty-registration.html',
    'public/admin/dashboard.html',
    'public/admin/login.html',
    'public/admin/parts.html',
    'public/admin/warranty-pricing.html'
];

htmlFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if version script already exists
        if (content.includes('version-display') || content.includes('v1.2.0.001')) {
            console.log(`Skipping ${file} - already has version script`);
            return;
        }
        
        // Add after <link rel="stylesheet"> or before </head>
        if (content.includes('</head>')) {
            content = content.replace('</head>', versionScript + '\n</head>');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        } else {
            console.log(`Warning: ${file} doesn't have </head> tag`);
        }
    } else {
        console.log(`File not found: ${file}`);
    }
});

console.log('Done!');

