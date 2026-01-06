// Get check-in ID from URL
const urlParams = new URLSearchParams(window.location.search);
const checkInId = urlParams.get('id');

let checkInData = null;
let purchaseData = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CHECK-IN-DETAIL] Loading check-in:', checkInId);
    
    if (!checkInId) {
        showError('No check-in ID provided');
        return;
    }
    
    loadCheckInDetails();
    
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.toggle('sidebar-open');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    });
    
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.remove('sidebar-open');
        this.classList.remove('active');
    });
});

async function loadCheckInDetails() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load check-in details');
        }
        
        const data = await response.json();
        
        if (data.success) {
            checkInData = data.check_in;
            purchaseData = data.purchase;
            displayCheckInDetails();
        } else {
            showError(data.error || 'Failed to load check-in');
        }
    } catch (error) {
        console.error('[CHECK-IN-DETAIL] Error:', error);
        showError('Error loading check-in details: ' + error.message);
    }
}

function displayCheckInDetails() {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('detailsContainer').style.display = 'block';
    
    // Purchase info
    document.getElementById('trackingNumber').textContent = checkInData.tracking_number || 'N/A';
    document.getElementById('platform').textContent = purchaseData.platform || 'N/A';
    document.getElementById('seller').textContent = purchaseData.seller_name || 'N/A';
    document.getElementById('generation').textContent = purchaseData.generation || 'N/A';
    document.getElementById('price').textContent = purchaseData.purchase_price ? `£${purchaseData.purchase_price.toFixed(2)}` : 'N/A';
    
    const checkedInDate = new Date(checkInData.checked_in_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('checkedInDate').textContent = checkedInDate;
    document.getElementById('checkedBy').textContent = checkInData.checked_in_by || 'N/A';
    
    // Overall status
    const hasIssues = checkInData.has_issues || (checkInData.issues_detected && checkInData.issues_detected.length > 0);
    const statusHtml = hasIssues 
        ? `<span class="issue-badge issue-critical">⚠ Issues Found</span>`
        : `<span class="issue-badge no-issues-badge">✓ No Issues</span>`;
    document.getElementById('overallStatus').innerHTML = statusHtml;
    
    // Display items
    displayItems();
    
    // Display split section
    displaySplitSection();
}

function displayItems() {
    const container = document.getElementById('itemsContainer');
    const items = checkInData.items || [];
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No items found</p>';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const itemName = getItemDisplayName(item.item_type);
        const hasIssues = checkInData.issues_detected && checkInData.issues_detected.some(i => i.item_type === item.item_type);
        const itemIssues = hasIssues ? checkInData.issues_detected.find(i => i.item_type === item.item_type).issues : [];
        
        let issuesBadges = '';
        if (itemIssues.length > 0) {
            issuesBadges = itemIssues.map(issue => {
                const badgeClass = issue.severity === 'critical' ? 'issue-critical' : 
                                  issue.severity === 'high' ? 'issue-high' : 'issue-medium';
                return `<span class="issue-badge ${badgeClass}">${escapeHtml(issue.description)}</span>`;
            }).join('');
        } else {
            issuesBadges = '<span class="issue-badge no-issues-badge">✓ No Issues</span>';
        }
        
        return `
            <div class="item-card">
                <div class="item-header">
                    <span class="item-name">${itemName}</span>
                    <div>${issuesBadges}</div>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Genuine</span>
                        <span class="info-value">${item.is_genuine ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Visual Condition</span>
                        <span class="info-value">${formatCondition(item.condition)}</span>
                    </div>
                    ${item.serial_number ? `
                    <div class="info-item">
                        <span class="info-label">Serial Number</span>
                        <span class="info-value">${escapeHtml(item.serial_number)}</span>
                    </div>
                    ` : ''}
                    ${item.audible_condition ? `
                    <div class="info-item">
                        <span class="info-label">Audible Condition</span>
                        <span class="info-value">${formatCondition(item.audible_condition)}</span>
                    </div>
                    ` : ''}
                    ${item.connects_correctly !== null && item.connects_correctly !== undefined ? `
                    <div class="info-item">
                        <span class="info-label">Connects Correctly</span>
                        <span class="info-value">${item.connects_correctly ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function displaySplitSection() {
    const container = document.getElementById('splitSection');
    const hasIssues = checkInData.has_issues || (checkInData.issues_detected && checkInData.issues_detected.length > 0);
    const alreadySplit = checkInData.split_into_products === true;
    
    if (alreadySplit) {
        container.innerHTML = `
            <div class="detail-card">
                <div class="already-split">
                    <h3 style="margin-top: 0;">✓ Already Split into Products</h3>
                    <p>This check-in has already been split into individual products on ${new Date(checkInData.split_date).toLocaleString('en-GB')}.</p>
                </div>
            </div>
        `;
        return;
    }
    
    let warningHtml = '';
    if (hasIssues) {
        warningHtml = `
            <div class="split-warning">
                <strong>⚠ Issues Detected</strong>
                <p style="margin: 5px 0 0 0;">This check-in has issues that may need to be resolved before splitting into products. Review the issues above and ensure they are acceptable or resolved.</p>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="detail-card split-section">
            <h3>Split into Products</h3>
            <p>This will create individual product entries for each item checked in. Each item will become a separate product in your inventory.</p>
            
            ${warningHtml}
            
            <div class="split-actions">
                <label class="checkbox-label">
                    <input type="checkbox" id="confirmSplit">
                    <span>I confirm that I have reviewed all items and am ready to split this check-in into products</span>
                </label>
            </div>
            
            <div class="split-actions">
                <button class="split-button" id="splitButton" disabled onclick="splitIntoProducts()">
                    Split into Products
                </button>
            </div>
        </div>
    `;
    
    // Enable/disable split button based on checkbox
    document.getElementById('confirmSplit').addEventListener('change', function() {
        document.getElementById('splitButton').disabled = !this.checked;
    });
}

async function splitIntoProducts() {
    if (!confirm('Are you sure you want to split this check-in into individual products? This cannot be undone.')) {
        return;
    }
    
    const button = document.getElementById('splitButton');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Splitting...';
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/split`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to split into products');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Success! Created ${data.products_created} products.\n\nYou will now be redirected to the products page.`);
            window.location.href = 'products.html';
        } else {
            throw new Error(data.error || 'Failed to split into products');
        }
    } catch (error) {
        console.error('[CHECK-IN-DETAIL] Error splitting:', error);
        alert('Error: ' + error.message);
        button.disabled = false;
        button.textContent = originalText;
    }
}

function editCheckIn() {
    window.location.href = `edit-check-in.html?id=${checkInId}`;
}

function getItemDisplayName(itemType) {
    const names = {
        'case': 'Case',
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'box': 'Box',
        'ear_tips': 'Ear Tips',
        'cable': 'Cable',
        'protective_case': 'Protective Case'
    };
    return names[itemType] || itemType;
}

function formatCondition(condition) {
    if (!condition) return 'N/A';
    
    const formatted = condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Color code based on condition
    const colors = {
        'Like New': '#28a745',
        'Excellent': '#28a745',
        'Good': '#28a745',
        'Fair': '#ffc107',
        'Poor': '#dc3545',
        'Not Working': '#dc3545'
    };
    
    const color = colors[formatted] || '#333';
    return `<span style="color: ${color}; font-weight: 600;">${formatted}</span>`;
}

function showError(message) {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
