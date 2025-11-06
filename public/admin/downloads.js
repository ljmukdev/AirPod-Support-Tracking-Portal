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
        
        downloadsList.innerHTML = data.files.map(file => {
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(file.extension.toLowerCase());
            const previewUrl = isImage ? `/images/${file.filename}` : null;
            
            return `
                <div class="download-item">
                    ${previewUrl ? `
                        <div class="download-item-preview">
                            <img src="${previewUrl}" alt="${file.filename}" onerror="this.style.display='none'">
                        </div>
                    ` : ''}
                    <div class="download-item-info">
                        <div class="download-item-title">${file.filename}</div>
                        <div class="download-item-details">
                            <strong>Type:</strong> ${getFileType(file.filename)} | 
                            <strong>Size:</strong> ${formatFileSize(file.size)} |
                            <strong>Modified:</strong> ${file.modified ? new Date(file.modified).toLocaleDateString('en-GB') : 'Unknown'}
                        </div>
                    </div>
                    <a href="/images/${file.filename}" download="${file.filename}" class="download-button">
                        ⬇ Download
                    </a>
                </div>
            `;
        }).join('');
        
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

