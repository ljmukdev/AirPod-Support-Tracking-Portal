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
    
    if (items.length === 0) {
        itemsSection.innerHTML = '<p style="color: #999;">No items listed for this purchase</p>';
        return;
    }
    
    itemsSection.innerHTML = items.map(item => {
        const itemName = itemLabels[item] || item;
        const needsSerial = ['case', 'left', 'right'].includes(item);
        
        return `
            <div class="item-check-section" data-item="${item}">
                <h4>
                    <span>✓</span>
                    <span>${escapeHtml(itemName)}</span>
                </h4>
                
                <!-- Genuine Check -->
                <div class="form-group">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Is this item genuine?</label>
                    <div style="display: flex; gap: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="genuine_${item}" value="yes" style="margin-right: 8px;" required>
                            <span>Yes - Genuine</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="genuine_${item}" value="no" style="margin-right: 8px;" required>
                            <span>No - Fake/Replica</span>
                        </label>
                    </div>
                </div>
                
                <!-- Condition Rating -->
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Visual Condition:</label>
                    <div class="condition-rating">
                        <label>
                            <input type="radio" name="condition_${item}" value="new" required>
                            <span>New</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}" value="like_new" required>
                            <span>Like New</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}" value="excellent" required>
                            <span>Excellent</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}" value="good" required>
                            <span>Good</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}" value="fair" required>
                            <span>Fair</span>
                        </label>
                        <label>
                            <input type="radio" name="condition_${item}" value="poor" required>
                            <span>Poor</span>
                        </label>
                    </div>
                </div>
                
                ${needsSerial ? `
                <!-- Serial Number -->
                <div class="form-group" style="margin-top: 15px;">
                    <label for="serial_${item}" style="font-weight: 600;">Serial Number:</label>
                    <input type="text" id="serial_${item}" name="serial_${item}" 
                           placeholder="Enter serial number" 
                           style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <!-- Audible Condition -->
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Audible Condition:</label>
                    <div class="condition-rating">
                        <label>
                            <input type="radio" name="audible_${item}" value="excellent" required>
                            <span>Excellent</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}" value="good" required>
                            <span>Good</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}" value="fair" required>
                            <span>Fair</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}" value="poor" required>
                            <span>Poor</span>
                        </label>
                        <label>
                            <input type="radio" name="audible_${item}" value="not_working" required>
                            <span>Not Working</span>
                        </label>
                    </div>
                </div>
                
                <!-- Connectivity Check -->
                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 8px;">Does it connect correctly?</label>
                    <div style="display: flex; gap: 20px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="connectivity_${item}" value="yes" style="margin-right: 8px;" required>
                            <span>Yes - Connects Fine</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="connectivity_${item}" value="no" style="margin-right: 8px;" required>
                            <span>No - Connection Issues</span>
                        </label>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
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
    const checkInData = {
        purchase_id: currentPurchase._id,
        tracking_number: currentPurchase.tracking_number,
        items: []
    };
    
    // Validate and collect data for each item
    let hasErrors = false;
    
    for (const item of items) {
        const genuineRadio = document.querySelector(`input[name="genuine_${item}"]:checked`);
        const conditionRadio = document.querySelector(`input[name="condition_${item}"]:checked`);
        
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
        
        // Add serial number, audible condition, and connectivity if applicable
        if (['case', 'left', 'right'].includes(item)) {
            const serialInput = document.getElementById(`serial_${item}`);
            if (serialInput && serialInput.value.trim()) {
                itemData.serial_number = serialInput.value.trim();
            }
            
            // Audible condition
            const audibleRadio = document.querySelector(`input[name="audible_${item}"]:checked`);
            if (audibleRadio) {
                itemData.audible_condition = audibleRadio.value;
            }
            
            // Connectivity
            const connectivityRadio = document.querySelector(`input[name="connectivity_${item}"]:checked`);
            if (connectivityRadio) {
                itemData.connects_correctly = connectivityRadio.value === 'yes';
            }
        }
        
        checkInData.items.push(itemData);
    }
    
    if (hasErrors) {
        return;
    }
    
    // Submit the check-in
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(checkInData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            successBanner.textContent = 'Check-in completed successfully!';
            successBanner.style.display = 'block';
            
            // Reset after 2 seconds
            setTimeout(() => {
                resetForm();
                successBanner.style.display = 'none';
            }, 2000);
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
