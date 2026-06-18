// Downloads Management JavaScript
// Uses window.API_BASE set by admin.js

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Get file type from extension
function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'png': 'PNG Image',
        'jpg': 'JPEG Image',
        'jpeg': 'JPEG Image',
        'gif': 'GIF Image',
        'svg': 'SVG Vector',
        'pdf': 'PDF Document',
        'zip': 'ZIP Archive'
    };
    return types[ext] || 'File';
}

// Load available graphics from API
async function loadDownloads() {
    const spinner = document.getElementById('spinner');
    const downloadsList = document.getElementById('downloadsList');
    
    try {
        spinner.classList.add('active');
        
        const response = await authenticatedFetch(`${window.API_BASE || ""}/api/admin/downloads`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load downloads');
        }
        
        const data = await response.json();
        spinner.classList.remove('active');
        
        if (!data.files || data.files.length === 0) {
            downloadsList.innerHTML = `
                <div class="empty-state">
                    <h3>No Graphics Found</h3>
                    <p>No graphics files are available for download.</p>
                </div>
            `;
            return;
        }
        
        downloadsList.innerHTML = `<div class="graphics-grid">` + data.files.map(file => {
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(file.extension.toLowerCase());
            const previewUrl = isImage ? `/images/${file.filename}` : null;
            
            return `
                <div class="graphic-item">
                    <div class="graphic-preview">
                        ${previewUrl ? `
                            <img src="${previewUrl}" alt="${file.filename}" onerror="this.parentElement.innerHTML='<p style=\\'color:#999;\\'>Preview not available</p>'">
                        ` : `
                            <p style="color: #999; text-align: center;">Preview not available for ${getFileType(file.filename)}</p>
                        `}
                    </div>
                    <div class="graphic-info">
                        <div class="graphic-title">${file.filename}</div>
                        <div class="graphic-details">
                            <div class="graphic-detail-item"><strong>Type:</strong> ${getFileType(file.filename)}</div>
                            <div class="graphic-detail-item"><strong>Size:</strong> ${formatFileSize(file.size)}</div>
                            <div class="graphic-detail-item"><strong>Modified:</strong> ${file.modified ? new Date(file.modified).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown'}</div>
                        </div>
                        <a href="/images/${file.filename}" download="${file.filename}" class="download-button">
                            ⬇ Download
                        </a>
                    </div>
                </div>
            `;
        }).join('') + `</div>`;
        
    } catch (error) {
        console.error('Error loading downloads:', error);
        spinner.classList.remove('active');
        downloadsList.innerHTML = `
            <div class="error-message">
                Failed to load graphics: ${error.message}
            </div>
        `;
    }
}

// ============================================================
// Data Export (CSV)
// ============================================================

// Turn a friendly title from a collection name (e.g. "support_tickets" -> "Support Tickets")
function prettifyCollectionName(name) {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Download a blob response from an authenticated endpoint
async function downloadFromEndpoint(url, fallbackFilename, button) {
    const statusEl = document.getElementById('exportStatus');
    const originalLabel = button ? button.textContent : null;
    try {
        if (button) {
            button.disabled = true;
            button.textContent = '⏳ Preparing…';
        }
        if (statusEl) statusEl.textContent = 'Preparing your download…';

        const response = await authenticatedFetch(`${window.API_BASE || ""}${url}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            let message = `Export failed (${response.status})`;
            try {
                const errData = await response.json();
                if (errData && errData.error) message = errData.error;
            } catch (e) { /* response was not JSON */ }
            throw new Error(message);
        }

        // Prefer the filename the server provides via Content-Disposition
        let filename = fallbackFilename;
        const disposition = response.headers.get('Content-Disposition');
        if (disposition) {
            const match = disposition.match(/filename="?([^"]+)"?/);
            if (match) filename = match[1];
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);

        if (statusEl) statusEl.textContent = `Downloaded: ${filename}`;
    } catch (error) {
        console.error('Error downloading export:', error);
        if (statusEl) statusEl.textContent = `Error: ${error.message}`;
    } finally {
        if (button) {
            button.disabled = false;
            if (originalLabel !== null) button.textContent = originalLabel;
        }
    }
}

// Load the list of exportable collections
async function loadExportCollections() {
    const spinner = document.getElementById('exportSpinner');
    const exportList = document.getElementById('exportList');
    if (!exportList) return;

    try {
        const response = await authenticatedFetch(`${window.API_BASE || ""}/api/admin/export/collections`, {
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load data sets');
        }

        const data = await response.json();
        if (spinner) spinner.classList.remove('active');

        const collections = data.collections || [];
        if (collections.length === 0) {
            exportList.innerHTML = `
                <div class="empty-state">
                    <h3>No Data Found</h3>
                    <p>There are no data sets available to export.</p>
                </div>
            `;
            return;
        }

        exportList.innerHTML = `
            <table class="export-table">
                <thead>
                    <tr>
                        <th>Data Set</th>
                        <th>Records</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${collections.map(c => `
                        <tr>
                            <td>${prettifyCollectionName(c.name)}</td>
                            <td class="count">${(c.count || 0).toLocaleString()}</td>
                            <td>
                                <button class="download-button export-one" data-collection="${c.name}">
                                    ⬇ CSV
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        exportList.querySelectorAll('.export-one').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.getAttribute('data-collection');
                downloadFromEndpoint(
                    `/api/admin/export/csv?collection=${encodeURIComponent(name)}`,
                    `${name}.csv`,
                    btn
                );
            });
        });
    } catch (error) {
        console.error('Error loading export collections:', error);
        if (spinner) spinner.classList.remove('active');
        exportList.innerHTML = `
            <div class="error-message">
                Failed to load data sets: ${error.message}
            </div>
        `;
    }
}

function initDataExport() {
    const allButton = document.getElementById('exportAllButton');
    if (allButton) {
        allButton.addEventListener('click', () => {
            downloadFromEndpoint('/api/admin/export/all', 'ljm-data-export.zip', allButton);
        });
    }
    loadExportCollections();
}

// Initialize page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadDownloads();
        initDataExport();
    });
} else {
    loadDownloads();
    initDataExport();
}

