// Downloads Management JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

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
        
        const response = await fetch(`${API_BASE}/api/admin/downloads`, {
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

// Initialize page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDownloads);
} else {
    loadDownloads();
}

