// Warranties Management JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format currency
function formatCurrency(amount) {
    if (!amount || amount === 0) return 'Free';
    return `£${amount.toFixed(2)}`;
}

// Format extended warranty type
function formatWarrantyType(type) {
    if (!type || type === 'none') return 'None';
    const map = {
        '3months': '3 Months',
        '6months': '6 Months',
        '12months': '12 Months'
    };
    return map[type] || type;
}

// Load warranties from API
async function loadWarranties() {
    const spinner = document.getElementById('spinner');
    const warrantiesList = document.getElementById('warrantiesList');
    
    try {
        spinner.classList.add('active');
        
        const response = await fetch(`${API_BASE}/api/admin/warranties`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load warranties');
        }
        
        const data = await response.json();
        spinner.classList.remove('active');
        
        if (!data.warranties || data.warranties.length === 0) {
            warrantiesList.innerHTML = `
                <div class="empty-state">
                    <h3>No Warranties Found</h3>
                    <p>No warranty registrations have been created yet.</p>
                </div>
            `;
            return;
        }
        
        warrantiesList.innerHTML = data.warranties.map(warranty => `
            <div class="warranty-item" data-warranty-id="${warranty.id}">
                <div class="warranty-item-header">
                    <div>
                        <div class="warranty-item-title">
                            ${warranty.customer_name} - ${warranty.warranty_id}
                        </div>
                        <div style="margin-top: 5px; font-size: 0.85rem; color: #666;">
                            Security Code: <strong>${warranty.security_barcode}</strong>
                        </div>
                    </div>
                    <div class="warranty-item-actions">
                        <span class="status-badge status-${warranty.status || 'active'}">${warranty.status || 'Active'}</span>
                        <span class="status-badge status-${warranty.payment_status || 'free'}">${warranty.payment_status === 'paid' ? 'Paid' : 'Free'}</span>
                        <button class="delete-button" data-delete-id="${warranty.id}" data-warranty-id="${warranty.warranty_id}">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="warranty-item-details">
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Email:</span>
                        ${warranty.customer_email}
                    </div>
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Phone:</span>
                        ${warranty.customer_phone || 'N/A'}
                    </div>
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Extended Warranty:</span>
                        ${formatWarrantyType(warranty.extended_warranty)}
                    </div>
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Price:</span>
                        ${formatCurrency(warranty.warranty_price)}
                    </div>
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Registered:</span>
                        ${formatDate(warranty.registration_date)}
                    </div>
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Standard Warranty Ends:</span>
                        ${formatDate(warranty.standard_warranty_end)}
                    </div>
                    ${warranty.extended_warranty_end ? `
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Extended Warranty Ends:</span>
                        ${formatDate(warranty.extended_warranty_end)}
                    </div>
                    ` : ''}
                    <div class="warranty-detail">
                        <span class="warranty-detail-label">Marketing Consent:</span>
                        ${warranty.marketing_consent ? 'Yes' : 'No'}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Attach delete event listeners
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', handleDelete);
        });
        
    } catch (error) {
        console.error('Error loading warranties:', error);
        spinner.classList.remove('active');
        warrantiesList.innerHTML = `
            <div class="error-message">
                Failed to load warranties: ${error.message}
            </div>
        `;
    }
}

// Handle delete warranty
async function handleDelete(event) {
    const button = event.currentTarget;
    const warrantyId = button.getAttribute('data-delete-id');
    const warrantyDisplayId = button.getAttribute('data-warranty-id');
    
    if (!confirm(`Are you sure you want to delete warranty ${warrantyDisplayId}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    button.disabled = true;
    button.textContent = 'Deleting...';
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/warranty/${warrantyId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }
            throw new Error(data.error || 'Failed to delete warranty');
        }
        
        // Remove the warranty item from the DOM
        const warrantyItem = button.closest('.warranty-item');
        warrantyItem.style.opacity = '0.5';
        warrantyItem.style.transition = 'opacity 0.3s';
        
        setTimeout(() => {
            warrantyItem.remove();
            
            // Check if list is empty
            const warrantiesList = document.getElementById('warrantiesList');
            if (warrantiesList.querySelectorAll('.warranty-item').length === 0) {
                warrantiesList.innerHTML = `
                    <div class="empty-state">
                        <h3>No Warranties Found</h3>
                        <p>No warranty registrations have been created yet.</p>
                    </div>
                `;
            }
        }, 300);
        
    } catch (error) {
        console.error('Error deleting warranty:', error);
        alert('Failed to delete warranty: ' + error.message);
        button.disabled = false;
        button.textContent = 'Delete';
    }
}

// Initialize page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWarranties);
} else {
    loadWarranties();
}





