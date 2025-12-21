// Warranty Terms & Conditions Management
// Ensure API_BASE is available - reference from window or use empty string
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}

// Check authentication
checkAuth();

// Helper function to get API_BASE without redeclaring
function getApiBase() {
    return window.API_BASE || '';
}

// Load current terms and version history
async function loadTermsData() {
    try {
        // Load current active version
        const currentResponse = await authenticatedFetch(`${getApiBase()}/api/admin/warranty-terms/current`);
        if (currentResponse.ok) {
            const current = await currentResponse.json();
            if (current.terms) {
                document.getElementById('termsContent').value = current.terms.content || '';
                document.getElementById('currentVersion').textContent = current.terms.version || '-';
            }
        }

        // Load version history
        const versionsResponse = await authenticatedFetch(`${getApiBase()}/api/admin/warranty-terms/versions`);
        if (versionsResponse.ok) {
            const versions = await versionsResponse.json();
            displayVersionHistory(versions.versions || []);
            document.getElementById('totalVersions').textContent = versions.versions?.length || 0;
        }

        // Load active warranties count
        const warrantiesResponse = await authenticatedFetch(`${getApiBase()}/api/admin/warranties`);
        if (warrantiesResponse.ok) {
            const data = await warrantiesResponse.json();
            document.getElementById('activeWarranties').textContent = data.warranties?.length || 0;
        }
    } catch (error) {
        console.error('Error loading terms data:', error);
        showError('Failed to load terms data');
    }
}

// Display version history
function displayVersionHistory(versions) {
    const versionList = document.getElementById('versionList');
    
    if (!versions || versions.length === 0) {
        versionList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No versions yet. Create the first version above.</p>';
        return;
    }

    // Sort by version number (descending)
    versions.sort((a, b) => {
        const aNum = parseInt(a.version) || 0;
        const bNum = parseInt(b.version) || 0;
        return bNum - aNum;
    });

    const currentVersion = versions[0]?.version;

    versionList.innerHTML = versions.map(version => {
        const isCurrent = version.version === currentVersion;
        const date = new Date(version.created_at).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="version-item ${isCurrent ? 'current' : ''}">
                <div class="version-info">
                    <div class="version-number">
                        Version ${version.version}
                        ${isCurrent ? '<span class="current-version-badge">CURRENT</span>' : ''}
                    </div>
                    <div class="version-date">
                        Created: ${date} ${version.created_by ? `by ${version.created_by}` : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
                        ${version.active_warranties || 0} active warranty${version.active_warranties !== 1 ? 'ies' : ''} using this version
                    </div>
                </div>
                <div class="version-actions">
                    <button class="button button-secondary" onclick="viewVersion('${version.version}')">View</button>
                    <button class="button button-secondary" onclick="copyVersion('${version.version}')">Copy</button>
                </div>
            </div>
        `;
    }).join('');
}

// View a specific version
async function viewVersion(versionNumber) {
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/warranty-terms/version/${versionNumber}`);
        if (response.ok) {
            const data = await response.json();
            if (data.terms) {
                // Show in a modal or new window
                const preview = window.open('', '_blank', 'width=800,height=600');
                preview.document.write(`
                    <html>
                        <head>
                            <title>Warranty Terms Version ${versionNumber}</title>
                            <style>
                                body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
                                h1 { color: #284064; }
                                pre { white-space: pre-wrap; background: #f8f9fa; padding: 20px; border-radius: 8px; }
                            </style>
                        </head>
                        <body>
                            <h1>Warranty Terms & Conditions - Version ${versionNumber}</h1>
                            <p><strong>Created:</strong> ${new Date(data.terms.created_at).toLocaleString('en-GB')}</p>
                            <pre>${data.terms.content}</pre>
                        </body>
                    </html>
                `);
            }
        }
    } catch (error) {
        console.error('Error viewing version:', error);
        showError('Failed to load version');
    }
}

// Copy version content to editor
async function copyVersion(versionNumber) {
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/warranty-terms/version/${versionNumber}`);
        if (response.ok) {
            const data = await response.json();
            if (data.terms) {
                document.getElementById('termsContent').value = data.terms.content;
                showSuccess('Version content copied to editor');
            }
        }
    } catch (error) {
        console.error('Error copying version:', error);
        showError('Failed to copy version');
    }
}

// Preview terms
document.getElementById('previewTerms')?.addEventListener('click', () => {
    const content = document.getElementById('termsContent').value;
    if (!content.trim()) {
        showError('Please enter some content first');
        return;
    }
    
    const previewSection = document.getElementById('previewSection');
    const previewContent = document.getElementById('previewContent');
    previewContent.textContent = content;
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// Save new version
document.getElementById('saveNewVersion')?.addEventListener('click', async () => {
    const content = document.getElementById('termsContent').value.trim();
    
    if (!content) {
        showError('Please enter terms content');
        return;
    }

    if (!confirm('Create a new version of the Terms & Conditions? This will increment the version number and become the active version for new warranty registrations.')) {
        return;
    }

    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/warranty-terms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content
            })
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(`New version ${data.version} created successfully!`);
            document.getElementById('termsContent').value = '';
            document.getElementById('previewSection').style.display = 'none';
            loadTermsData();
        } else {
            showError(data.error || 'Failed to create new version');
        }
    } catch (error) {
        console.error('Error saving terms:', error);
        showError('Failed to save terms');
    }
});

// Logout
document.getElementById('logoutButton')?.addEventListener('click', async () => {
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/logout`, { method: 'POST' });
        if (response.ok) {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'login.html';
    }
});

// Helper functions
function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    alert('Success: ' + message);
}

// Load data on page load
loadTermsData();

