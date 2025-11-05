// Warranty Registration JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// Initialize Stripe (will be set after fetching publishable key)
let stripe = null;
let cardElement = null;
let cardErrors = null;

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    const errorDiv = document.getElementById('errorMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';
    }
}

function hideMessages() {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
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

// Warranty pricing
const warrantyPrices = {
    'none': 0,
    '3months': 9.99,
    '6months': 17.99,
    '12months': 29.99
};

// Load product info from sessionStorage or URL
function loadProductInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const barcode = urlParams.get('barcode') || sessionStorage.getItem('securityBarcode');
    
    if (!barcode) {
        showError('No product found. Please start from the home page.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Store barcode in sessionStorage
    sessionStorage.setItem('securityBarcode', barcode);
    
    // Display security code
    const securityCodeEl = document.getElementById('securityCode');
    if (securityCodeEl) {
        securityCodeEl.textContent = barcode;
    }
    
    // Fetch product details
    fetch(`${API_BASE}/api/product-info/${encodeURIComponent(barcode)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                showError('Product not found. Please check your security code.');
                return;
            }
            
            // Display product info
            const productInfoEl = document.getElementById('productInfo');
            if (productInfoEl) {
                const partTypeMap = {
                    'left': 'Left AirPod',
                    'right': 'Right AirPod',
                    'case': 'Charging Case'
                };
                const partType = partTypeMap[data.part_type] || data.part_type;
                const displayText = `${partType}${data.generation ? ' - ' + data.generation : ''}${data.part_model_number ? ' (' + data.part_model_number + ')' : ''}`;
                productInfoEl.textContent = displayText;
            }
        })
        .catch(err => {
            console.error('Error loading product:', err);
            showError('Failed to load product information. Please try again.');
        });
}

// Select warranty option
function selectWarranty(value) {
    // Update radio button
    const radio = document.getElementById(`warranty${value === 'none' ? 'None' : value === '3months' ? '3Months' : value === '6months' ? '6Months' : '12Months'}`);
    if (radio) {
        radio.checked = true;
    }
    
    // Update visual selection
    document.querySelectorAll('.warranty-option').forEach(option => {
        option.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Update total price display
    updateTotalPrice();
}

// Update total price display
function updateTotalPrice() {
    const registerFreeWarranty = document.getElementById('registerFreeWarranty');
    if (!registerFreeWarranty || !registerFreeWarranty.checked) {
        // Hide payment section if not registering free warranty
        const paymentSection = document.getElementById('paymentSection');
        const totalPriceSection = document.getElementById('totalPriceSection');
        if (paymentSection) paymentSection.style.display = 'none';
        if (totalPriceSection) totalPriceSection.style.display = 'none';
        return;
    }
    
    const selectedWarranty = document.querySelector('input[name="extendedWarranty"]:checked');
    const totalPriceSection = document.getElementById('totalPriceSection');
    const totalPriceEl = document.getElementById('totalPrice');
    const paymentSection = document.getElementById('paymentSection');
    
    if (selectedWarranty && selectedWarranty.value !== 'none') {
        const price = warrantyPrices[selectedWarranty.value];
        if (totalPriceSection) totalPriceSection.style.display = 'block';
        if (totalPriceEl) totalPriceEl.textContent = `£${price.toFixed(2)}`;
        if (paymentSection) paymentSection.style.display = 'block';
    } else {
        if (totalPriceSection) totalPriceSection.style.display = 'none';
        if (paymentSection) paymentSection.style.display = 'none';
    }
}

// Initialize Stripe Elements
async function initializeStripe() {
    try {
        // Fetch Stripe publishable key from server
        const response = await fetch(`${API_BASE}/api/stripe/config`);
        const config = await response.json();
        
        if (!config.publishableKey) {
            console.error('Stripe publishable key not available');
            return;
        }
        
        stripe = Stripe(config.publishableKey);
        
        // Create card element
        const elements = stripe.elements();
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                },
                invalid: {
                    color: '#9e2146',
                },
            },
        });
        
        cardElement.mount('#card-element');
        cardErrors = document.getElementById('card-errors');
        
        // Handle real-time validation errors
        cardElement.on('change', ({error}) => {
            if (error) {
                cardErrors.textContent = error.message;
                cardErrors.style.display = 'block';
            } else {
                cardErrors.style.display = 'none';
            }
        });
        
        console.log('Stripe initialized successfully');
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        showError('Payment system unavailable. Please contact support.');
    }
}

// Handle form submission
const warrantyForm = document.getElementById('warrantyForm');
if (warrantyForm) {
    warrantyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessages();
        
        const submitButton = document.getElementById('submitButton');
        const registerFreeWarranty = document.getElementById('registerFreeWarranty').checked;
        
        // If user doesn't want free warranty, skip straight to pairing
        if (!registerFreeWarranty) {
            submitButton.disabled = true;
            showSpinner();
            
            // Just redirect to confirmation page
            setTimeout(() => {
                window.location.href = 'confirmation.html';
            }, 500);
            return;
        }
        
        // User wants to register warranty - validate and process
        const customerName = document.getElementById('customerName').value.trim();
        const customerEmail = document.getElementById('customerEmail').value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();
        const extendedWarranty = document.querySelector('input[name="extendedWarranty"]:checked').value;
        const marketingConsent = document.getElementById('marketingConsent').checked;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        
        // Validation
        if (!customerName || !customerEmail) {
            showError('Please fill in all required fields.');
            return;
        }
        
        if (!acceptTerms) {
            showError('You must accept the Terms & Conditions to continue.');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            showError('Please enter a valid email address.');
            return;
        }
        
        submitButton.disabled = true;
        showSpinner();
        
        const securityBarcode = sessionStorage.getItem('securityBarcode');
        if (!securityBarcode) {
            showError('Session expired. Please start over.');
            window.location.href = 'index.html';
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/warranty/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    security_barcode: securityBarcode,
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone || null,
                    extended_warranty: extendedWarranty,
                    marketing_consent: marketingConsent,
                    warranty_price: warrantyPrices[extendedWarranty] || 0
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess('Warranty registered successfully! Redirecting...');
                
                // Store warranty registration status
                sessionStorage.setItem('warrantyRegistered', 'true');
                sessionStorage.setItem('warrantyId', data.warranty_id);
                
                // Redirect to confirmation page after 1.5 seconds
                setTimeout(() => {
                    window.location.href = 'confirmation.html';
                }, 1500);
            } else {
                showError(data.error || 'Failed to register warranty. Please try again.');
                submitButton.disabled = false;
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Network error. Please check your connection and try again.');
            submitButton.disabled = false;
        } finally {
            hideSpinner();
        }
    });
}

// Setup warranty option click handlers
document.querySelectorAll('.warranty-option').forEach(option => {
    option.addEventListener('click', function() {
        const radio = this.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
            selectWarranty(radio.value);
        }
    });
});

// Update price when warranty selection changes
document.querySelectorAll('input[name="extendedWarranty"]').forEach(radio => {
    radio.addEventListener('change', updateTotalPrice);
});

// Toggle sections based on free warranty registration checkbox
function toggleWarrantySections() {
    const registerFreeWarranty = document.getElementById('registerFreeWarranty');
    const customerInfoSection = document.getElementById('customerInfoSection');
    const extendedWarrantySection = document.getElementById('extendedWarrantySection');
    const marketingSection = document.getElementById('marketingSection');
    const termsSection = document.getElementById('termsSection');
    const paymentSection = document.getElementById('paymentSection');
    const acceptTerms = document.getElementById('acceptTerms');
    
    if (registerFreeWarranty && registerFreeWarranty.checked) {
        // Show all sections
        if (customerInfoSection) customerInfoSection.style.display = 'block';
        if (extendedWarrantySection) extendedWarrantySection.style.display = 'block';
        if (marketingSection) marketingSection.style.display = 'block';
        if (termsSection) termsSection.style.display = 'block';
        if (acceptTerms) acceptTerms.required = true;
    } else {
        // Hide sections (user doesn't want free warranty)
        if (customerInfoSection) customerInfoSection.style.display = 'none';
        if (extendedWarrantySection) extendedWarrantySection.style.display = 'none';
        if (marketingSection) marketingSection.style.display = 'none';
        if (termsSection) termsSection.style.display = 'none';
        if (paymentSection) paymentSection.style.display = 'none';
        if (acceptTerms) acceptTerms.required = false;
        
        // Reset extended warranty selection
        const warrantyNone = document.getElementById('warrantyNone');
        if (warrantyNone) warrantyNone.checked = true;
        updateTotalPrice();
    }
}

// Setup toggle listener
const registerFreeWarrantyCheckbox = document.getElementById('registerFreeWarranty');
if (registerFreeWarrantyCheckbox) {
    registerFreeWarrantyCheckbox.addEventListener('change', toggleWarrantySections);
}

// Load product info and initialize Stripe on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadProductInfo();
        initializeStripe();
        toggleWarrantySections(); // Initial toggle
    });
} else {
    loadProductInfo();
    initializeStripe();
    toggleWarrantySections(); // Initial toggle
}

