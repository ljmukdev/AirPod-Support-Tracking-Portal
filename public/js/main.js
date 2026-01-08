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
        if (barcodeInput) {
            barcodeInput.addEventListener('input', () => {
                barcodeInput.value = barcodeInput.value.toUpperCase();
            });
        }
        // Convert to uppercase automatically
        const securityBarcode = barcodeInput.value.trim().toUpperCase();
        
        // Update the input field to show uppercase
        barcodeInput.value = securityBarcode;
        
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
                
                // Redirect directly to warranty registration/choice page
                window.location.href = `warranty-registration.html?barcode=${encodeURIComponent(securityBarcode)}`;
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

// Support/Suggestions Bubble (public pages)
function initSupportBubble() {
    if (document.getElementById('supportBubble')) {
        return;
    }

    const bubbleButton = document.createElement('button');
    bubbleButton.id = 'supportBubble';
    bubbleButton.className = 'support-bubble';
    bubbleButton.type = 'button';
    bubbleButton.setAttribute('aria-label', 'Support or suggestions');
    bubbleButton.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Support</span>
    `;

    const modal = document.createElement('div');
    modal.id = 'supportModal';
    modal.className = 'support-modal';
    modal.innerHTML = `
        <div class="support-modal-content" role="dialog" aria-modal="true" aria-labelledby="supportModalTitle">
            <button type="button" class="support-modal-close" aria-label="Close support form">×</button>
            <h3 id="supportModalTitle">Support / Suggestions</h3>
            <p>Send a fault report or improvement idea to our support team.</p>
            <form id="supportForm" class="support-form">
                <label for="supportType">Type</label>
                <select id="supportType" name="supportType" required>
                    <option value="fault">Fault / Issue</option>
                    <option value="suggestion">Suggestion</option>
                </select>
                <label for="supportMessage">Message</label>
                <textarea id="supportMessage" name="supportMessage" rows="4" placeholder="Describe the issue or suggestion..." required></textarea>
                <label for="supportEmail">Your Email (optional)</label>
                <input type="email" id="supportEmail" name="supportEmail" placeholder="name@example.com">
                <button type="submit" class="button button-primary">Send to Support</button>
                <div class="support-form-status" id="supportFormStatus" role="status" aria-live="polite"></div>
            </form>
        </div>
    `;

    document.body.appendChild(bubbleButton);
    document.body.appendChild(modal);

    const closeButton = modal.querySelector('.support-modal-close');
    const form = modal.querySelector('#supportForm');
    const status = modal.querySelector('#supportFormStatus');

    const openModal = () => {
        modal.classList.add('open');
    };
    const closeModal = () => {
        modal.classList.remove('open');
    };

    bubbleButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = '';

        const payload = {
            type: form.supportType.value,
            message: form.supportMessage.value.trim(),
            userEmail: form.supportEmail.value.trim() || null,
            page: window.location.pathname
        };

        if (!payload.message) {
            status.textContent = 'Please enter a message.';
            status.classList.add('error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/support`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to send message');
            }
            status.textContent = 'Message sent. Thanks for the feedback!';
            status.classList.remove('error');
            status.classList.add('success');
            form.reset();
        } catch (error) {
            status.textContent = error.message || 'Failed to send message.';
            status.classList.remove('success');
            status.classList.add('error');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportBubble);
} else {
    initSupportBubble();
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
