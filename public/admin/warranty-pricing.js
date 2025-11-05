// Warranty Pricing Management JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        successDiv.classList.remove('show');
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    const errorDiv = document.getElementById('errorMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.add('show');
        errorDiv.classList.remove('show');
    }
}

function hideMessages() {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    if (errorDiv) errorDiv.classList.remove('show');
    if (successDiv) successDiv.classList.remove('show');
}

// Load current pricing
async function loadPricing() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/warranty-pricing`);
        const data = await response.json();
        
        if (response.ok) {
            // Populate form fields
            document.getElementById('price3months').value = data['3months'] || 4.99;
            document.getElementById('price6months').value = data['6months'] || 7.99;
            document.getElementById('price12months').value = data['12months'] || 12.99;
            
            // Update last updated info
            const lastUpdatedEl = document.getElementById('lastUpdatedDate');
            const updatedByEl = document.getElementById('updatedBy');
            
            if (data.last_updated) {
                const date = new Date(data.last_updated);
                lastUpdatedEl.textContent = date.toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } else {
                lastUpdatedEl.textContent = 'Never (using defaults)';
            }
            
            updatedByEl.textContent = data.updated_by || 'System';
        } else {
            showError('Failed to load current pricing. Please refresh the page.');
        }
    } catch (error) {
        console.error('Error loading pricing:', error);
        showError('Network error. Please check your connection and try again.');
    }
}

// Handle form submission
const pricingForm = document.getElementById('pricingForm');
if (pricingForm) {
    pricingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessages();
        
        const saveButton = document.getElementById('saveButton');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        
        const formData = {
            '3months': parseFloat(document.getElementById('price3months').value),
            '6months': parseFloat(document.getElementById('price6months').value),
            '12months': parseFloat(document.getElementById('price12months').value)
        };
        
        // Validation
        if (isNaN(formData['3months']) || isNaN(formData['6months']) || isNaN(formData['12months']) ||
            formData['3months'] < 0 || formData['6months'] < 0 || formData['12months'] < 0) {
            showError('All prices must be valid positive numbers.');
            saveButton.disabled = false;
            saveButton.textContent = 'Save Pricing';
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/warranty-pricing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess('Warranty pricing updated successfully! Changes are now live.');
                // Reload pricing to get updated metadata
                setTimeout(() => {
                    loadPricing();
                }, 500);
            } else {
                showError(data.error || 'Failed to update pricing. Please try again.');
            }
        } catch (error) {
            console.error('Error updating pricing:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Pricing';
        }
    });
}

// Load pricing on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPricing);
} else {
    loadPricing();
}

