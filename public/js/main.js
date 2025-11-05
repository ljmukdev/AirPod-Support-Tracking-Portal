// Main JavaScript for LJM AirPod Support

// API base URL
const API_BASE = '';

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 5000);
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.add('show');
        setTimeout(() => {
            successDiv.classList.remove('show');
        }, 5000);
    }
}

function showSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.add('active');
    }
}

function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.remove('active');
    }
}

// Barcode verification form
const barcodeForm = document.getElementById('barcodeForm');
if (barcodeForm) {
    barcodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const barcodeInput = document.getElementById('securityBarcode');
        const submitButton = document.getElementById('submitButton');
        const securityBarcode = barcodeInput.value.trim();
        
        if (!securityBarcode) {
            showError('Please enter a security code');
            return;
        }
        
        // Disable button and show spinner
        submitButton.disabled = true;
        showSpinner();
        
        try {
            const response = await fetch(`${API_BASE}/api/verify-barcode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ security_barcode: securityBarcode })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Store barcode in sessionStorage
                sessionStorage.setItem('securityBarcode', securityBarcode);
                sessionStorage.setItem('partType', data.part_type);
                
                // Redirect to product details page first
                window.location.href = `product-details.html?barcode=${encodeURIComponent(securityBarcode)}`;
            } else {
                showError(data.error || 'Invalid security code. Please check and try again.');
                barcodeInput.focus();
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            submitButton.disabled = false;
            hideSpinner();
        }
    });
}

// Confirmation page functionality
// Check if user has valid barcode before showing confirmation page
if (window.location.pathname.includes('confirmation.html')) {
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    if (!securityBarcode) {
        // Redirect to home if no barcode found
        window.location.href = 'index.html';
    }
}

const confirmationForm = document.getElementById('confirmationForm');
const confirmationCheckbox = document.getElementById('confirmCheckbox');
const viewInstructionsButton = document.getElementById('viewInstructionsButton');

if (confirmationCheckbox && viewInstructionsButton) {
    // Disable button initially
    viewInstructionsButton.disabled = true;
    
    // Enable/disable button based on checkbox
    confirmationCheckbox.addEventListener('change', (e) => {
        viewInstructionsButton.disabled = !e.target.checked;
    });
    
    // Load part type from sessionStorage or API
    const partTypeElement = document.getElementById('partType');
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    
    if (partTypeElement && securityBarcode) {
        // Try to get from sessionStorage first
        const partType = sessionStorage.getItem('partType');
        if (partType) {
            const partTypeMap = {
                'left': 'Left AirPod',
                'right': 'Right AirPod',
                'case': 'Charging Case'
            };
            partTypeElement.textContent = partTypeMap[partType] || 'replacement part';
        } else {
            // Fetch from API
            fetch(`${API_BASE}/api/product-info/${securityBarcode}`)
                .then(res => res.json())
                .then(data => {
                    const partTypeMap = {
                        'left': 'Left AirPod',
                        'right': 'Right AirPod',
                        'case': 'Charging Case'
                    };
                    partTypeElement.textContent = partTypeMap[data.part_type] || 'replacement part';
                    sessionStorage.setItem('partType', data.part_type);
                })
                .catch(err => {
                    console.error('Error fetching part type:', err);
                    partTypeElement.textContent = 'replacement part';
                });
        }
    }
    
    // Handle form submission
    if (confirmationForm) {
        confirmationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!confirmationCheckbox.checked) {
                showError('Please confirm that you understand the pairing process');
                return;
            }
            
            const securityBarcode = sessionStorage.getItem('securityBarcode');
            if (!securityBarcode) {
                showError('Session expired. Please start over.');
                window.location.href = 'index.html';
                return;
            }
            
            viewInstructionsButton.disabled = true;
            showSpinner();
            
            try {
                // Log confirmation
                const response = await fetch(`${API_BASE}/api/confirm-understanding`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ security_barcode: securityBarcode })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Redirect to appropriate instruction page
                    const partType = sessionStorage.getItem('partType');
                    let redirectUrl = 'left-airpod.html';
                    
                    if (partType === 'right') {
                        redirectUrl = 'right-airpod.html';
                    } else if (partType === 'case') {
                        redirectUrl = 'case.html';
                    }
                    
                    window.location.href = redirectUrl;
                } else {
                    showError(data.error || 'Failed to log confirmation. Please try again.');
                    viewInstructionsButton.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Network error. Please check your connection and try again.');
                viewInstructionsButton.disabled = false;
            } finally {
                hideSpinner();
            }
        });
    }
}

// Instruction pages - check if user has confirmed before viewing
if (window.location.pathname.includes('airpod.html') || window.location.pathname.includes('case.html')) {
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    // Note: We don't redirect here because the confirmation is logged in the database
    // But we can add a visual indicator if needed
}

// Troubleshooting accordion
const troubleshootingQuestions = document.querySelectorAll('.troubleshooting-question');
troubleshootingQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const isActive = question.classList.contains('active');
        
        // Close all other items
        troubleshootingQuestions.forEach(q => {
            q.classList.remove('active');
            q.nextElementSibling.classList.remove('active');
        });
        
        // Toggle current item
        if (!isActive) {
            question.classList.add('active');
            answer.classList.add('active');
        }
    });
});

