// Get check-in ID from URL
const urlParams = new URLSearchParams(window.location.search);
const checkInId = urlParams.get('id');

let checkInData = null;
let purchaseData = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[EDIT-CHECK-IN] Loading check-in:', checkInId);
    
    if (!checkInId) {
        showError('No check-in ID provided');
        return;
    }
    
    loadCheckInData();
    
    // Form submission
    document.getElementById('editCheckInForm').addEventListener('submit', saveChanges);
    
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

async function loadCheckInData() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load check-in');
        }
        
        const data = await response.json();
        
        if (data.success) {
            checkInData = data.check_in;
            purchaseData = data.purchase;
            displayCheckInForm();
        } else {
            showError(data.error || 'Failed to load check-in');
        }
    } catch (error) {
        console.error('[EDIT-CHECK-IN] Error:', error);
        showError('Error loading check-in: ' + error.message);
    }
}

function displayCheckInForm() {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('editCheckInForm').style.display = 'block';
    
    // Display read-only info
    document.getElementById('trackingNumber').value = checkInData.tracking_number || 'N/A';
    
    const checkedInDate = new Date(checkInData.checked_in_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('checkedInDate').value = checkedInDate;
    
    // Display items
    displayItems();
}

function displayItems() {
    const container = document.getElementById('itemsContainer');
    const items = checkInData.items || [];
    
    container.innerHTML = items.map((item, index) => {
        const itemName = getItemDisplayName(item.item_type);
        const needsAudible = ['left', 'right'].includes(item.item_type);
        const needsConnectivity = ['case', 'left', 'right'].includes(item.item_type);
        const needsSerial = ['case', 'left', 'right'].includes(item.item_type);
        
        return `
            <div class="item-form" data-item-index="${index}">
                <div class="item-form-header">
                    <span class="item-title">${itemName}</span>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>
                            <div class="checkbox-group">
                                <input type="checkbox" data-field="is_genuine" data-index="${index}" ${item.is_genuine ? 'checked' : ''}>
                                <span>Is Genuine</span>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Visual Condition</label>
                        <select data-field="condition" data-index="${index}" required>
                            <option value="like_new" ${item.condition === 'like_new' ? 'selected' : ''}>Like New</option>
                            <option value="excellent" ${item.condition === 'excellent' ? 'selected' : ''}>Excellent</option>
                            <option value="good" ${item.condition === 'good' ? 'selected' : ''}>Good</option>
                            <option value="fair" ${item.condition === 'fair' ? 'selected' : ''}>Fair</option>
                            <option value="poor" ${item.condition === 'poor' ? 'selected' : ''}>Poor</option>
                        </select>
                    </div>
                    
                    ${needsSerial ? `
                    <div class="form-group">
                        <label>Serial Number</label>
                        <input type="text" data-field="serial_number" data-index="${index}" value="${item.serial_number || ''}" style="text-transform: uppercase;">
                    </div>
                    ` : ''}
                </div>
                
                ${needsAudible ? `
                <div class="form-row">
                    <div class="form-group">
                        <label>Audible Condition</label>
                        <select data-field="audible_condition" data-index="${index}" required>
                            <option value="excellent" ${item.audible_condition === 'excellent' ? 'selected' : ''}>Excellent</option>
                            <option value="good" ${item.audible_condition === 'good' ? 'selected' : ''}>Good</option>
                            <option value="fair" ${item.audible_condition === 'fair' ? 'selected' : ''}>Fair</option>
                            <option value="poor" ${item.audible_condition === 'poor' ? 'selected' : ''}>Poor</option>
                            <option value="not_working" ${item.audible_condition === 'not_working' ? 'selected' : ''}>Not Working</option>
                        </select>
                    </div>
                </div>
                ` : ''}
                
                ${needsConnectivity ? `
                <div class="form-row">
                    <div class="form-group">
                        <label>
                            <div class="checkbox-group">
                                <input type="checkbox" data-field="connects_correctly" data-index="${index}" ${item.connects_correctly ? 'checked' : ''}>
                                <span>Connects Correctly</span>
                            </div>
                        </label>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function saveChanges(e) {
    e.preventDefault();
    
    if (!confirm('Save changes to this check-in?')) {
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    
    try {
        // Collect updated item data
        const updatedItems = checkInData.items.map((item, index) => {
            const updatedItem = { ...item };
            
            // Get all fields for this item
            const fields = document.querySelectorAll(`[data-index="${index}"]`);
            fields.forEach(field => {
                const fieldName = field.dataset.field;
                
                if (field.type === 'checkbox') {
                    updatedItem[fieldName] = field.checked;
                } else {
                    updatedItem[fieldName] = field.value || null;
                }
            });
            
            return updatedItem;
        });
        
        console.log('[EDIT-CHECK-IN] Saving updated items:', updatedItems);
        
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: updatedItems
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save changes');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('Check-in updated successfully!');
            window.location.href = `check-in-detail.html?id=${checkInId}`;
        } else {
            throw new Error(data.error || 'Failed to save changes');
        }
    } catch (error) {
        console.error('[EDIT-CHECK-IN] Error saving:', error);
        alert('Error: ' + error.message);
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

function goBack() {
    window.location.href = `check-in-detail.html?id=${checkInId}`;
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

function showError(message) {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}
