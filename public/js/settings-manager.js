// Settings Manager JavaScript

// Use existing API_BASE from window (set by admin.js)
// Don't redeclare to avoid conflicts - just use window.API_BASE directly
// Create a local reference for convenience, but check if it exists first
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}

// Default status options
const DEFAULT_STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
    { value: 'returned', label: 'Returned' },
    { value: 'pending', label: 'Pending' }
];

// Define helper functions first (they'll be hoisted)
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    console.error(message);
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }
}

function getCurrentStatusOptions() {
    const list = document.getElementById('statusOptionsList');
    if (!list) return [];
    
    const options = [];
    const items = list.querySelectorAll('.status-option-item');
    
    items.forEach(item => {
        const valueInput = item.querySelector('.status-value-input');
        const labelInput = item.querySelector('.status-label-input');
        
        if (valueInput && labelInput && valueInput.value.trim() && labelInput.value.trim()) {
            options.push({
                value: valueInput.value.trim(),
                label: labelInput.value.trim()
            });
        }
    });
    
    return options;
}

function renderStatusOptions(options) {
    const list = document.getElementById('statusOptionsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'status-option-item';
        li.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                <div>
                    <span class="status-value-label">Value (internal):</span>
                    <input 
                        type="text" 
                        class="status-value-input" 
                        value="${escapeHtml(option.value)}" 
                        data-index="${index}"
                        data-field="value"
                        placeholder="e.g., active"
                        required
                    >
                </div>
                <div>
                    <span class="status-value-label">Label (displayed):</span>
                    <input 
                        type="text" 
                        class="status-label-input" 
                        value="${escapeHtml(option.label)}" 
                        data-index="${index}"
                        data-field="label"
                        placeholder="e.g., Active"
                        required
                    >
                </div>
            </div>
            <button type="button" class="remove-status-btn" data-index="${index}">Remove</button>
        `;
        
        // Add remove button listener
        const removeBtn = li.querySelector('.remove-status-btn');
        removeBtn.addEventListener('click', function() {
            removeStatusOption(index);
        });
        
        list.appendChild(li);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Define addStatusOption function immediately so it's available for inline handlers
window.addStatusOption = function() {
    console.log('addStatusOption called');
    const list = document.getElementById('statusOptionsList');
    if (!list) {
        console.error('statusOptionsList not found');
        if (typeof showError === 'function') {
            showError('Status options list not found. Please refresh the page.');
        } else {
            alert('Status options list not found. Please refresh the page.');
        }
        return;
    }
    
    // Use a more user-friendly approach - add inline form
    const newValue = prompt('Enter status value (lowercase, no spaces, e.g., "in_transit"):');
    if (!newValue || newValue.trim() === '') {
        console.log('User cancelled or empty value');
        return;
    }
    
    // Validate value format
    const cleanValue = newValue.trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_]+$/.test(cleanValue)) {
        if (typeof showError === 'function') {
            showError('Status value must contain only lowercase letters, numbers, and underscores.');
        } else {
            alert('Status value must contain only lowercase letters, numbers, and underscores.');
        }
        return;
    }
    
    const newLabel = prompt('Enter display label (e.g., "In Transit"):');
    if (!newLabel || newLabel.trim() === '') {
        console.log('User cancelled or empty label');
        return;
    }
    
    // Get current options
    const currentOptions = getCurrentStatusOptions();
    
    // Check if value already exists
    if (currentOptions.some(opt => opt.value === cleanValue)) {
        if (typeof showError === 'function') {
            showError('A status with this value already exists.');
        } else {
            alert('A status with this value already exists.');
        }
        return;
    }
    
    // Add new option
    currentOptions.push({
        value: cleanValue,
        label: newLabel.trim()
    });
    
    console.log('Adding new status option:', cleanValue, newLabel.trim());
    renderStatusOptions(currentOptions);
    
    if (typeof showSuccess === 'function') {
        showSuccess('Status option added. Don\'t forget to save!');
    }
};

// Load settings on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Settings manager: DOMContentLoaded');
    loadSettings();
    loadEmailSettings();

    // Add status button
    const addStatusBtn = document.getElementById('addStatusBtn');
    console.log('Add status button found:', !!addStatusBtn);
    if (addStatusBtn) {
        addStatusBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Add status button clicked');
            addStatusOption();
        });
    } else {
        console.error('Add status button not found!');
    }

    // Save settings button
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
    
    // Test email button
    const testEmailBtn = document.getElementById('testEmailBtn');
    if (testEmailBtn) {
        testEmailBtn.addEventListener('click', testEmailConfiguration);
    }
});

// Load settings from API
async function loadSettings() {
    try {
        const response = await fetch(`${window.API_BASE || ''}/api/admin/settings`);
        const data = await response.json();

        if (response.ok && data.settings) {
            const statusOptions = data.settings.product_status_options || DEFAULT_STATUS_OPTIONS;
            renderStatusOptions(statusOptions);
        } else {
            // Use defaults if no settings found
            renderStatusOptions(DEFAULT_STATUS_OPTIONS);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showError('Failed to load settings. Using defaults.');
        renderStatusOptions(DEFAULT_STATUS_OPTIONS);
    }
}

// Remove status option
function removeStatusOption(index) {
    if (!confirm('Are you sure you want to remove this status option? Products using this status may be affected.')) {
        return;
    }
    
    const currentOptions = getCurrentStatusOptions();
    currentOptions.splice(index, 1);
    renderStatusOptions(currentOptions);
}

// Load email settings
async function loadEmailSettings() {
    try {
        const response = await fetch(`${window.API_BASE || ''}/api/admin/settings`);
        const data = await response.json();

        if (response.ok && data.settings && data.settings.email_settings) {
            const emailSettings = data.settings.email_settings;
            document.getElementById('smtpHost').value = emailSettings.smtp_host || '';
            document.getElementById('smtpPort').value = emailSettings.smtp_port || 587;
            document.getElementById('smtpSecure').value = emailSettings.smtp_secure ? 'true' : 'false';
            document.getElementById('smtpUser').value = emailSettings.smtp_user || '';
            document.getElementById('smtpPass').value = emailSettings.smtp_pass || '';
            document.getElementById('smtpFrom').value = emailSettings.smtp_from || '';
        }
    } catch (error) {
        console.error('Error loading email settings:', error);
    }
}

// Test email configuration
async function testEmailConfiguration() {
    const testBtn = document.getElementById('testEmailBtn');
    const resultDiv = document.getElementById('emailTestResult');
    
    // Get email settings from form
    const smtpHost = document.getElementById('smtpHost').value.trim();
    const smtpPort = document.getElementById('smtpPort').value.trim();
    const smtpSecure = document.getElementById('smtpSecure').value === 'true';
    const smtpUser = document.getElementById('smtpUser').value.trim();
    const smtpPass = document.getElementById('smtpPass').value.trim();
    const smtpFrom = document.getElementById('smtpFrom').value.trim();
    
    // Validate required fields
    if (!smtpHost || !smtpUser || !smtpPass) {
        resultDiv.style.display = 'block';
        resultDiv.style.backgroundColor = '#f8d7da';
        resultDiv.style.color = '#721c24';
        resultDiv.style.border = '1px solid #f5c6cb';
        resultDiv.textContent = 'Please fill in SMTP Host, Username, and Password before testing.';
        return;
    }
    
    // Get test email address
    const testEmail = prompt('Enter an email address to send the test email to:');
    if (!testEmail || !testEmail.trim()) {
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail.trim())) {
        resultDiv.style.display = 'block';
        resultDiv.style.backgroundColor = '#f8d7da';
        resultDiv.style.color = '#721c24';
        resultDiv.style.border = '1px solid #f5c6cb';
        resultDiv.textContent = 'Please enter a valid email address.';
        return;
    }
    
    // Disable button and show loading
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    resultDiv.style.display = 'block';
    resultDiv.style.backgroundColor = '#d1ecf1';
    resultDiv.style.color = '#0c5460';
    resultDiv.style.border = '1px solid #bee5eb';
    resultDiv.textContent = 'Sending test email...';
    
    try {
        const response = await fetch(`${window.API_BASE || ''}/api/admin/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                smtp_host: smtpHost,
                smtp_port: smtpPort,
                smtp_secure: smtpSecure,
                smtp_user: smtpUser,
                smtp_pass: smtpPass,
                smtp_from: smtpFrom,
                test_email: testEmail.trim()
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.style.backgroundColor = '#d4edda';
            resultDiv.style.color = '#155724';
            resultDiv.style.border = '1px solid #c3e6cb';
            resultDiv.textContent = `✅ Test email sent successfully to ${testEmail.trim()}! Check your inbox.`;
        } else {
            resultDiv.style.backgroundColor = '#f8d7da';
            resultDiv.style.color = '#721c24';
            resultDiv.style.border = '1px solid #f5c6cb';
            resultDiv.textContent = `❌ Failed to send test email: ${data.error || 'Unknown error'}`;
        }
    } catch (error) {
        console.error('Error testing email:', error);
        resultDiv.style.backgroundColor = '#f8d7da';
        resultDiv.style.color = '#721c24';
        resultDiv.style.border = '1px solid #f5c6cb';
        resultDiv.textContent = `❌ Network error: ${error.message}`;
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Email Configuration';
    }
}

// Save settings
async function saveSettings() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    const statusOptions = getCurrentStatusOptions();
    
    // Get email settings
    const emailSettings = {
        smtp_host: document.getElementById('smtpHost').value.trim(),
        smtp_port: parseInt(document.getElementById('smtpPort').value) || 587,
        smtp_secure: document.getElementById('smtpSecure').value === 'true',
        smtp_user: document.getElementById('smtpUser').value.trim(),
        smtp_pass: document.getElementById('smtpPass').value.trim(),
        smtp_from: document.getElementById('smtpFrom').value.trim()
    };
    
    // Validate status options
    if (statusOptions.length === 0) {
        showError('At least one status option is required.');
        return;
    }
    
    // Check for duplicate values
    const values = statusOptions.map(opt => opt.value);
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
        showError('Duplicate status values are not allowed.');
        return;
    }
    
    // Validate email settings if provided
    if (emailSettings.smtp_host || emailSettings.smtp_user || emailSettings.smtp_pass) {
        if (!emailSettings.smtp_host || !emailSettings.smtp_user || !emailSettings.smtp_pass) {
            showError('If configuring email, SMTP Host, Username, and Password are all required.');
            return;
        }
    }
    
    // Disable save button
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch(`${window.API_BASE || ''}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                product_status_options: statusOptions,
                email_settings: emailSettings
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Settings saved successfully!');
            
            // Clear status options cache in admin.js if it exists
            if (typeof window.clearStatusOptionsCache === 'function') {
                window.clearStatusOptionsCache();
                console.log('Status options cache cleared');
            }
            
            // If we're on the dashboard, reload the products table
            if (typeof loadProducts === 'function') {
                console.log('Reloading products table with new status options...');
                loadProducts();
            } else {
                // If not on dashboard, show message to refresh
                console.log('Not on dashboard - user should refresh dashboard to see changes');
            }
        } else {
            showError(data.error || 'Failed to save settings.');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Network error. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
    }
}
