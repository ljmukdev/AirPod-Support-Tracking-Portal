// Check-In Management - Frontend Logic
console.log('[CHECK-IN] Script loaded - v1.0.0');

let currentPurchase = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CHECK-IN] Initializing check-in page...');
    
    // Search button
    document.getElementById('searchButton').addEventListener('click', searchByTracking);
    
    // Enter key in search input
    document.getElementById('trackingNumberInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchByTracking();
        }
    });
    
    // Auto-convert tracking number to uppercase as user types
    document.getElementById('trackingNumberInput').addEventListener('input', function(e) {
        this.value = this.value.toUpperCase();
    });
    
    // Cancel button
    document.getElementById('cancelButton').addEventListener('click', resetForm);
    
    // Submit check-in
    document.getElementById('submitCheckIn').addEventListener('click', submitCheckIn);
    
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.toggle('sidebar-open');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    });
    
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.remove('sidebar-open');
        this.classList.remove('active');
    });
    
    // Load checked-in items
    loadCheckedInItems();
});

async function searchByTracking() {
    const trackingNumber = document.getElementById('trackingNumberInput').value.trim().toUpperCase();
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');
    
    // Hide previous messages
    errorBanner.style.display = 'none';
    successBanner.style.display = 'none';
    
    if (!trackingNumber) {
        errorBanner.textContent = 'Please enter a tracking number';
        errorBanner.style.display = 'block';
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases/by-tracking/${encodeURIComponent(trackingNumber)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('No purchase found with this tracking number');
            }
            throw new Error('Failed to search for purchase');
        }
        
        const data = await response.json();
        currentPurchase = data.purchase;
        
        console.log('[CHECK-IN] Purchase found:', currentPurchase);
        
        // Display purchase details and check-in form
        displayPurchaseDetails(currentPurchase);
        displayCheckInForm(currentPurchase);
        
        // Show the form
        document.getElementById('checkInForm').style.display = 'block';
        
        // Scroll to form
        document.getElementById('checkInForm').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('[CHECK-IN] Error:', error);
        errorBanner.textContent = error.message || 'An error occurred while searching';
        errorBanner.style.display = 'block';
    }
}

function displayPurchaseDetails(purchase) {
    const detailsDiv = document.getElementById('purchaseDetails');
    
    const purchaseDate = new Date(purchase.purchase_date).toLocaleDateString('en-GB', { 
        day: 'numeric', month: 'short', year: 'numeric' 
    });
    
    const platformBadge = `<span class="badge" style="background: #0064D2; color: white;">${escapeHtml(purchase.platform.toUpperCase())}</span>`;
    
    detailsDiv.innerHTML = `
        <h3>Purchase Information</h3>
        <div class="detail-row">
            <div class="detail-label">Platform:</div>
            <div class="detail-value">${platformBadge}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Order Number:</div>
            <div class="detail-value">${escapeHtml(purchase.order_number)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Seller:</div>
            <div class="detail-value">${escapeHtml(purchase.seller_name)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Generation:</div>
            <div class="detail-value">${escapeHtml(purchase.generation)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Purchase Date:</div>
            <div class="detail-value">${purchaseDate}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Price Paid:</div>
            <div class="detail-value">£${parseFloat(purchase.purchase_price).toFixed(2)}</div>
        </div>
    `;
}

function displayCheckInForm(purchase) {
    const itemsSection = document.getElementById('itemsCheckSection');

    const itemLabels = {
        'case': 'Case',
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'box': 'Box',
        'ear_tips': 'Ear Tips',
        'cable': 'Cable',
        'protective_case': 'Protective Case'
    };

    const items = purchase.items_purchased || [];
    const quantity = purchase.quantity || 1;

    if (items.length === 0) {
        itemsSection.innerHTML = '<p style="color: #999;">No items listed for this purchase</p>';
        return;
    }

    // Generate forms for each quantity set
    let formHtml = '';

    for (let setIndex = 1; setIndex <= quantity; setIndex++) {
        if (quantity > 1) {
            formHtml += `
                <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: var(--accent-teal);">Set ${setIndex} of ${quantity}</h3>
                </div>
            `;
        }

        formHtml += items.map(item => {
            const itemName = itemLabels[item] || item;
            const needsSerial = ['case', 'left', 'right'].includes(item);
            const needsAudible = ['left', 'right'].includes(item);
            const fieldSuffix = quantity > 1 ? `_${setIndex}` : '';

            return `
                <div class="item-check-section" data-item="${item}" data-set="${setIndex}">
                    <h4>
                        <span>✓</span>
                        <span>${escapeHtml(itemName)}</span>
                    </h4>
                
                <!-- Genuine Check -->
                <div class="form-group">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Is this item genuine?</label>
                    <div style="display: flex; gap: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="genuine_${item}${fieldSuffix}" value="yes" style="margin-right: 8px;" required>
                            <span>Yes - Genuine</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="genuine_${item}${fieldSuffix}" value="no" style="margin-right: 8px;" required>
                            <span>No - Fake/Replica</span>
                        </label>
                    </div>
                </div>

                <!-- Condition Rating -->
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Visual Condition:</label>
                    <div class="condition-rating">
                        <label>
                            <input type="radio" name="condition_${item}${fieldSuffix}" value="new" required>
                            <span>New</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}${fieldSuffix}" value="like_new" required>
                            <span>Like New</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}${fieldSuffix}" value="excellent" required>
                            <span>Excellent</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}${fieldSuffix}" value="good" required>
                            <span>Good</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}${fieldSuffix}" value="fair" required>
                            <span>Fair</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}${fieldSuffix}" value="poor" required>
                            <span>Poor</span>
                        </label>
                    </div>
                </div>

                ${needsSerial ? `
                <!-- Serial Number -->
                <div class="form-group" style="margin-top: 15px;">
                    <label for="serial_${item}${fieldSuffix}" style="font-weight: 600;">Serial Number:</label>
                    <input type="text" id="serial_${item}${fieldSuffix}" name="serial_${item}${fieldSuffix}"
                           placeholder="Enter serial number"
                           style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                ` : ''}

                ${needsAudible ? `
                <!-- Audible Condition -->
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Audible Condition:</label>
                    <div class="condition-rating">
                        <label>
                            <input type="radio" name="audible_${item}${fieldSuffix}" value="excellent" required>
                            <span>Excellent</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}${fieldSuffix}" value="good" required>
                            <span>Good</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}${fieldSuffix}" value="fair" required>
                            <span>Fair</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}${fieldSuffix}" value="poor" required>
                            <span>Poor</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}${fieldSuffix}" value="not_working" required>
                            <span>Not Working</span>
                        </label>
                    </div>
                </div>
                ` : ''}

                ${needsSerial ? `
                <!-- Connectivity Check -->
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Does it connect correctly?</label>
                    <div style="display: flex; gap: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="connectivity_${item}${fieldSuffix}" value="yes" style="margin-right: 8px;" required>
                            <span>Yes - Connects Fine</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="connectivity_${item}${fieldSuffix}" value="no" style="margin-right: 8px;" required>
                            <span>No - Connection Issues</span>
                        </label>
                    </div>
                </div>
                ` : ''}

                <!-- Fault evidence (shown for Poor / Not Working) -->
                <div class="issue-evidence" id="issue_evidence_${item}${fieldSuffix}">
                    <label for="issue_notes_${item}${fieldSuffix}" style="font-weight: 600;">Fault notes</label>
                    <textarea id="issue_notes_${item}${fieldSuffix}" name="issue_notes_${item}${fieldSuffix}" rows="3" placeholder="Add notes about the fault or damage..."></textarea>
                    <label for="issue_photos_${item}${fieldSuffix}" style="font-weight: 600; margin-top: 8px; display: block;">Add photos (optional)</label>
                    <input type="file" id="issue_photos_${item}${fieldSuffix}" name="issue_photos_${item}${fieldSuffix}" accept="image/*" multiple>
                    <small style="color: #666;">This section appears when visual or audible condition is Poor or Not Working.</small>
                </div>
            </div>
        `;
        }).join('');
    }

    itemsSection.innerHTML = formHtml;

    setupIssueEvidenceListeners(items, quantity);
    if (typeof setupUppercaseFields === 'function') {
        setupUppercaseFields();
    }
}

function setupIssueEvidenceListeners(items, quantity) {
    for (let setIndex = 1; setIndex <= quantity; setIndex++) {
        const fieldSuffix = quantity > 1 ? `_${setIndex}` : '';

        items.forEach((item) => {
            const section = document.querySelector(`.item-check-section[data-item="${item}"][data-set="${setIndex}"]`);
            if (!section) {
                return;
            }
            const evidence = document.getElementById(`issue_evidence_${item}${fieldSuffix}`);
            if (!evidence) {
                return;
            }

            const updateVisibility = () => {
                const conditionRadio = document.querySelector(`input[name="condition_${item}${fieldSuffix}"]:checked`);
                const audibleRadio = document.querySelector(`input[name="audible_${item}${fieldSuffix}"]:checked`);
                const conditionValue = conditionRadio ? conditionRadio.value : null;
                const audibleValue = audibleRadio ? audibleRadio.value : null;

                const shouldShow = conditionValue === 'poor' || audibleValue === 'poor' || audibleValue === 'not_working';
                if (shouldShow) {
                    evidence.classList.add('active');
                } else {
                    evidence.classList.remove('active');
                    const notes = evidence.querySelector('textarea');
                    const photos = evidence.querySelector('input[type="file"]');
                    if (notes) {
                        notes.value = '';
                    }
                    if (photos) {
                        photos.value = '';
                    }
                }
            };

            const conditionInputs = section.querySelectorAll(`input[name="condition_${item}${fieldSuffix}"]`);
            const audibleInputs = section.querySelectorAll(`input[name="audible_${item}${fieldSuffix}"]`);
            conditionInputs.forEach((input) => input.addEventListener('change', updateVisibility));
            audibleInputs.forEach((input) => input.addEventListener('change', updateVisibility));
            updateVisibility();
        });
    }
}

async function submitCheckIn() {
    const submitButton = document.getElementById('submitCheckIn');
    const errorBanner = document.getElementById('errorBanner');
    const successBanner = document.getElementById('successBanner');
    
    // Hide previous messages
    errorBanner.style.display = 'none';
    successBanner.style.display = 'none';
    
    if (!currentPurchase) {
        errorBanner.textContent = 'No purchase loaded';
        errorBanner.style.display = 'block';
        return;
    }
    
    // Collect check-in data
    const items = currentPurchase.items_purchased || [];
    const quantity = currentPurchase.quantity || 1;
    const checkInData = {
        purchase_id: currentPurchase._id,
        tracking_number: currentPurchase.tracking_number,
        items: []
    };

    // Validate and collect data for each item in each set
    let hasErrors = false;

    for (let setIndex = 1; setIndex <= quantity; setIndex++) {
        const fieldSuffix = quantity > 1 ? `_${setIndex}` : '';

        for (const item of items) {
            const genuineRadio = document.querySelector(`input[name="genuine_${item}${fieldSuffix}"]:checked`);
            const conditionRadio = document.querySelector(`input[name="condition_${item}${fieldSuffix}"]:checked`);

            if (!genuineRadio || !conditionRadio) {
                errorBanner.textContent = 'Please complete all fields for each item';
                errorBanner.style.display = 'block';
                hasErrors = true;
                break;
            }

            const itemData = {
                item_type: item,
                is_genuine: genuineRadio.value === 'yes',
                condition: conditionRadio.value
            };

            // Add set information if quantity > 1
            if (quantity > 1) {
                itemData.set_number = setIndex;
            }

            // Add serial number and connectivity if applicable (case, left, right)
            if (['case', 'left', 'right'].includes(item)) {
                const serialInput = document.getElementById(`serial_${item}${fieldSuffix}`);
                if (serialInput && serialInput.value.trim()) {
                    itemData.serial_number = serialInput.value.trim();
                }

                // Connectivity (all three items that connect)
                const connectivityRadio = document.querySelector(`input[name="connectivity_${item}${fieldSuffix}"]:checked`);
                if (connectivityRadio) {
                    itemData.connects_correctly = connectivityRadio.value === 'yes';
                }
            }

            // Add audible condition only for left and right AirPods (not case)
            if (['left', 'right'].includes(item)) {
                const audibleRadio = document.querySelector(`input[name="audible_${item}${fieldSuffix}"]:checked`);
                if (audibleRadio) {
                    itemData.audible_condition = audibleRadio.value;
                }
            }

            // Add fault notes when evidence section is active
            const evidenceSection = document.getElementById(`issue_evidence_${item}${fieldSuffix}`);
            if (evidenceSection && evidenceSection.classList.contains('active')) {
                const notesInput = document.getElementById(`issue_notes_${item}${fieldSuffix}`);
                if (notesInput && notesInput.value.trim()) {
                    itemData.issue_notes = notesInput.value.trim();
                }
            }

            checkInData.items.push(itemData);
        }

        if (hasErrors) {
            break;
        }
    }
    
    if (hasErrors) {
        return;
    }
    
    // Submit the check-in
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    
    try {
        const formData = new FormData();
        formData.append('purchase_id', checkInData.purchase_id);
        formData.append('tracking_number', checkInData.tracking_number || '');
        formData.append('items', JSON.stringify(checkInData.items));

        for (let setIndex = 1; setIndex <= quantity; setIndex++) {
            const fieldSuffix = quantity > 1 ? `_${setIndex}` : '';
            for (const item of items) {
                const photosInput = document.getElementById(`issue_photos_${item}${fieldSuffix}`);
                if (photosInput && photosInput.files && photosInput.files.length > 0) {
                    Array.from(photosInput.files).forEach((file) => {
                        formData.append(`issue_photos_${item}${fieldSuffix}`, file);
                    });
                }
            }
        }

        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Check if there are any issues that require seller contact
            if (data.issues_found && data.issues_found.length > 0) {
                // Redirect to check-in details page with generated email
                window.location.href = `check-in-detail.html?id=${data.id}&purchase_id=${currentPurchase._id}`;
            } else {
                successBanner.textContent = 'Check-in completed successfully! No issues detected.';
                successBanner.style.display = 'block';
                
                // Reset after 2 seconds
                setTimeout(() => {
                    resetForm();
                    successBanner.style.display = 'none';
                }, 2000);
            }
        } else {
            throw new Error(data.error || 'Failed to complete check-in');
        }
    } catch (error) {
        console.error('[CHECK-IN] Error:', error);
        errorBanner.textContent = error.message || 'An error occurred. Please try again.';
        errorBanner.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Complete Check-In';
    }
}

function resetForm() {
    currentPurchase = null;
    document.getElementById('trackingNumberInput').value = '';
    document.getElementById('checkInForm').style.display = 'none';
    document.getElementById('purchaseDetails').innerHTML = '';
    document.getElementById('itemsCheckSection').innerHTML = '';
}

async function loadCheckedInItems() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-ins`);
        
        if (!response.ok) {
            throw new Error('Failed to load checked-in items');
        }
        
        const data = await response.json();
        displayCheckedInItems(data.check_ins || []);
    } catch (error) {
        console.error('[CHECK-IN] Error loading checked-in items:', error);
        document.getElementById('checkedInList').innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Failed to load checked-in items</div>';
    }
}

function displayCheckedInItems(checkIns) {
    const container = document.getElementById('checkedInList');
    
    if (checkIns.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No items checked in yet</div>';
        return;
    }
    
    container.innerHTML = checkIns.map(checkIn => {
        const checkedInDate = new Date(checkIn.checked_in_at).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const hasIssues = checkIn.has_issues || (checkIn.issues_detected && checkIn.issues_detected.length > 0);
        const issueCount = checkIn.issues_detected ? checkIn.issues_detected.length : 0;
        
        let issuesHtml = '';
        if (hasIssues && checkIn.issues_detected) {
            issuesHtml = '<div style="margin-top: 10px;">';
            checkIn.issues_detected.forEach(item => {
                issuesHtml += `<strong style="color: #666;">${escapeHtml(item.item_name)}:</strong> `;
                item.issues.forEach(issue => {
                    const badgeClass = issue.severity === 'critical' ? 'issue-critical' : 
                                      issue.severity === 'high' ? 'issue-high' : 'issue-medium';
                    issuesHtml += `<span class="issue-badge ${badgeClass}">${escapeHtml(issue.description)}</span>`;
                });
                issuesHtml += '<br>';
            });
            issuesHtml += '</div>';
        } else {
            issuesHtml = '<div style="margin-top: 10px;"><span class="issue-badge no-issues">✓ No Issues Detected</span></div>';
        }
        
        const checkInId = checkIn._id || checkIn.id;
        
        return `
            <div class="check-in-item">
                <div class="check-in-header">
                    <div>
                        <strong style="font-size: 1.1rem;">Tracking: ${escapeHtml(checkIn.tracking_number || 'N/A')}</strong>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button onclick="viewCheckInDetails('${checkInId}')" class="button button-secondary" style="padding: 6px 12px; font-size: 0.85rem;">View Details</button>
                        <button onclick="deleteCheckIn('${checkInId}')" title="Delete check-in" style="background: none; border: none; cursor: pointer; padding: 4px; color: #999; transition: color 0.2s;" onmouseover="this.style.color='#dc3545'" onmouseout="this.style.color='#999'">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <path d="M4 4L12 12M12 4L4 12"/>
                            </svg>
                        </button>
                        <div class="check-in-date">${checkedInDate}</div>
                    </div>
                </div>
                <div class="check-in-details">
                    <div class="check-in-detail">
                        <strong>Items Checked:</strong> ${checkIn.items ? checkIn.items.length : 0}
                    </div>
                    <div class="check-in-detail">
                        <strong>Checked By:</strong> ${escapeHtml(checkIn.checked_in_by || 'N/A')}
                    </div>
                    <div class="check-in-detail">
                        <strong>Status:</strong> ${hasIssues ? '<span style="color: #dc3545;">Issues Found (' + issueCount + ')</span>' : '<span style="color: #28a745;">All Good</span>'}
                    </div>
                </div>
                ${issuesHtml}
            </div>
        `;
    }).join('');
}

function viewCheckInDetails(checkInId) {
    console.log('[CHECK-IN] Viewing check-in details:', checkInId);
    window.location.href = `check-in-detail.html?id=${checkInId}`;
}

async function deleteCheckIn(checkInId) {
    if (!confirm('Are you sure you want to delete this check-in? This cannot be undone.')) {
        return;
    }

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Show success message and reload the list
            const successBanner = document.getElementById('successBanner');
            successBanner.textContent = 'Check-in deleted successfully';
            successBanner.style.display = 'block';
            setTimeout(() => {
                successBanner.style.display = 'none';
            }, 3000);
            loadCheckedInItems();
        } else {
            throw new Error(data.error || 'Failed to delete check-in');
        }
    } catch (error) {
        console.error('[CHECK-IN] Error deleting check-in:', error);
        const errorBanner = document.getElementById('errorBanner');
        errorBanner.textContent = error.message || 'Failed to delete check-in';
        errorBanner.style.display = 'block';
        setTimeout(() => {
            errorBanner.style.display = 'none';
        }, 5000);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
