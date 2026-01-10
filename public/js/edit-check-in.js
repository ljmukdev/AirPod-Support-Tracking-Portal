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
        const evidencePhotos = item.issue_photos || [];
        const evidenceNotes = item.issue_notes || '';
        
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

                <div class="issue-evidence" id="issue_evidence_${index}">
                    <label for="issue_notes_${index}" style="font-weight: 600;">Fault notes</label>
                    <textarea id="issue_notes_${index}" data-field="issue_notes" data-index="${index}" rows="3" placeholder="Add notes about the fault or damage...">${escapeHtml(evidenceNotes)}</textarea>
                    <label for="issue_photos_${index}" style="font-weight: 600; margin-top: 8px; display: block;">Add photos (optional)</label>
                    <input type="file" id="issue_photos_${index}" name="issue_photos_${index}" accept="image/*" multiple>
                    ${evidencePhotos.length > 0 ? `
                    <div class="issue-photo-list">
                        ${evidencePhotos.map((photo, photoIndex) => `
                            <a href="${photo}" target="_blank" rel="noreferrer">Photo ${photoIndex + 1}</a>
                        `).join('')}
                    </div>
                    ` : ''}
                    <small style="color: #666;">This section appears when visual or audible condition is Poor or Not Working.</small>
                </div>
            </div>
        `;
    }).join('');

    setupIssueEvidenceListeners(items);
    if (typeof setupUppercaseFields === 'function') {
        setupUppercaseFields();
    }
}

function setupIssueEvidenceListeners(items) {
    items.forEach((item, index) => {
        const section = document.querySelector(`.item-form[data-item-index="${index}"]`);
        if (!section) {
            return;
        }
        const evidence = document.getElementById(`issue_evidence_${index}`);
        if (!evidence) {
            return;
        }

        const updateVisibility = () => {
            const conditionSelect = section.querySelector(`select[data-field="condition"][data-index="${index}"]`);
            const audibleSelect = section.querySelector(`select[data-field="audible_condition"][data-index="${index}"]`);
            const conditionValue = conditionSelect ? conditionSelect.value : null;
            const audibleValue = audibleSelect ? audibleSelect.value : null;

            const shouldShow = conditionValue === 'poor' || audibleValue === 'poor' || audibleValue === 'not_working';
            if (shouldShow) {
                evidence.classList.add('active');
            } else {
                evidence.classList.remove('active');
            }
        };

        const conditionSelect = section.querySelector(`select[data-field="condition"][data-index="${index}"]`);
        const audibleSelect = section.querySelector(`select[data-field="audible_condition"][data-index="${index}"]`);
        if (conditionSelect) {
            conditionSelect.addEventListener('change', updateVisibility);
        }
        if (audibleSelect) {
            audibleSelect.addEventListener('change', updateVisibility);
        }
        updateVisibility();
    });
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
                
                console.log(`[EDIT-CHECK-IN] Item ${index} (${item.item_type}) - ${fieldName}: "${updatedItem[fieldName]}"`);
            });
            
            return updatedItem;
        });
        
        console.log('[EDIT-CHECK-IN] Saving updated items:', JSON.stringify(updatedItems, null, 2));
        
        const formData = new FormData();
        formData.append('items', JSON.stringify(updatedItems));

        updatedItems.forEach((_, index) => {
            const photosInput = document.getElementById(`issue_photos_${index}`);
            if (photosInput && photosInput.files && photosInput.files.length > 0) {
                Array.from(photosInput.files).forEach((file) => {
                    formData.append(`issue_photos_${index}`, file);
                });
            }
        });

        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}`, {
            method: 'PUT',
            body: formData
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
