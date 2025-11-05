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

// Warranty pricing (will be loaded from API)
let warrantyPrices = {
    'none': 0,
    '3months': 4.99,  // Default fallback
    '6months': 7.99,  // Default fallback
    '12months': 12.99 // Default fallback
};

// Load warranty pricing from API
async function loadWarrantyPricing() {
    try {
        const response = await fetch(`${API_BASE}/api/warranty/pricing`);
        if (response.ok) {
            const pricing = await response.json();
            warrantyPrices = {
                'none': 0,
                '3months': pricing['3months'] || 4.99,
                '6months': pricing['6months'] || 7.99,
                '12months': pricing['12months'] || 12.99
            };
            console.log('Warranty pricing loaded:', warrantyPrices);
            // Update prices in the UI
            updateWarrantyPricesInUI();
        } else {
            console.warn('Failed to load warranty pricing, using defaults');
        }
    } catch (error) {
        console.error('Error loading warranty pricing:', error);
        // Use defaults if API fails
    }
}

// Update warranty prices displayed in the UI
function updateWarrantyPricesInUI() {
    // Update 3 months price
    const price3El = document.querySelector('#warranty3Months')?.closest('.warranty-option')?.querySelector('.warranty-price');
    if (price3El) {
        price3El.textContent = `£${warrantyPrices['3months'].toFixed(2)}`;
    }
    
    // Update 6 months price
    const price6El = document.querySelector('#warranty6Months')?.closest('.warranty-option')?.querySelector('.warranty-price');
    if (price6El) {
        price6El.textContent = `£${warrantyPrices['6months'].toFixed(2)}`;
    }
    
    // Update 12 months price
    const price12El = document.querySelector('#warranty12Months')?.closest('.warranty-option')?.querySelector('.warranty-price');
    if (price12El) {
        price12El.textContent = `£${warrantyPrices['12months'].toFixed(2)}`;
    }
    
    // Update total price if already selected
    updateTotalPrice();
}

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

// Handle warranty choice selection (free, extended, or skip)
function selectWarrantyOption(choice) {
    const choiceOptions = document.getElementById('warrantyChoiceOptions');
    const warrantyForm = document.getElementById('warrantyForm');
    const registerFreeWarranty = document.getElementById('registerFreeWarranty');
    
    if (choice === 'skip') {
        // Skip directly to pairing instructions
        window.location.href = 'confirmation.html';
        return;
    }
    
    // Hide choice options and show form
    if (choiceOptions) choiceOptions.style.display = 'none';
    if (warrantyForm) {
        warrantyForm.classList.add('active');
        // Scroll to form
        warrantyForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    if (choice === 'free') {
        // Show free warranty registration form
        if (registerFreeWarranty) {
            registerFreeWarranty.checked = true;
            toggleWarrantySections();
        }
        // Ensure extended warranty is set to 'none'
        const warrantyNone = document.getElementById('warrantyNone');
        if (warrantyNone) warrantyNone.checked = true;
        updateTotalPrice();
        // Ensure marketing checkbox is checked by default
        const marketingConsent = document.getElementById('marketingConsent');
        if (marketingConsent) marketingConsent.checked = true;
    } else if (choice === 'extended') {
        // Show extended warranty purchase form
        if (registerFreeWarranty) {
            registerFreeWarranty.checked = true;
            toggleWarrantySections();
        }
        // Focus on extended warranty section (don't auto-select any option)
        const extendedSection = document.getElementById('extendedWarrantySection');
        if (extendedSection) {
            extendedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Ensure marketing checkbox is checked by default
        const marketingConsent = document.getElementById('marketingConsent');
        if (marketingConsent) marketingConsent.checked = true;
    }
}

// Go back to warranty choice options
function goBackToChoices() {
    const choiceOptions = document.getElementById('warrantyChoiceOptions');
    const warrantyForm = document.getElementById('warrantyForm');
    
    if (choiceOptions) choiceOptions.style.display = 'grid';
    if (warrantyForm) {
        warrantyForm.classList.remove('active');
        // Reset form
        document.getElementById('warrantyForm').reset();
        // Re-check marketing consent checkbox after reset (default is checked)
        const marketingConsent = document.getElementById('marketingConsent');
        if (marketingConsent) marketingConsent.checked = true;
        const registerFreeWarranty = document.getElementById('registerFreeWarranty');
        if (registerFreeWarranty) registerFreeWarranty.checked = false;
        toggleWarrantySections();
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Select warranty option (for extended warranty radio buttons)
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
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }
    
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
        if (paymentSection) {
            paymentSection.style.display = 'block';
            paymentSection.style.visibility = 'visible';
            // Ensure Stripe Elements is mounted if not already mounted
            if (stripe && cardElement) {
                // Check if already mounted
                const cardElementDiv = document.getElementById('card-element');
                if (cardElementDiv && !cardElementDiv.querySelector('.StripeElement')) {
                    try {
                        cardElement.mount('#card-element');
                        console.log('Stripe card element mounted');
                    } catch (err) {
                        console.error('Error mounting Stripe card element:', err);
                        // Try to recreate if mount fails
                        if (stripe) {
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
                            cardElement.on('change', ({error}) => {
                                if (error && cardErrors) {
                                    cardErrors.textContent = error.message;
                                    cardErrors.style.display = 'block';
                                } else if (cardErrors) {
                                    cardErrors.style.display = 'none';
                                }
                            });
                        }
                    }
                }
            }
        }
    } else {
        if (totalPriceSection) totalPriceSection.style.display = 'none';
        if (paymentSection) {
            paymentSection.style.display = 'none';
            paymentSection.style.visibility = 'hidden';
        }
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
        
        // Don't mount immediately - wait until payment section is shown
        // This prevents mounting issues when element is hidden
        cardErrors = document.getElementById('card-errors');
        
        // Set up error handler (will be used when mounted)
        cardElement.on('change', ({error}) => {
            if (error) {
                if (cardErrors) {
                    cardErrors.textContent = error.message;
                    cardErrors.style.display = 'block';
                }
            } else {
                if (cardErrors) {
                    cardErrors.style.display = 'none';
                }
            }
        });
        
        console.log('Stripe initialized successfully - card element will mount when payment section is shown');
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
        
        let paymentIntentId = null;
        const selectedWarrantyPrice = warrantyPrices[extendedWarranty] || 0;
        
        // Process payment if extended warranty is selected
        if (extendedWarranty !== 'none' && selectedWarrantyPrice > 0) {
            // Process payment if extended warranty is selected
            if (!stripe || !cardElement) {
                showError('Payment system not initialized. Please refresh or contact support.');
                submitButton.disabled = false;
                hideSpinner();
                return;
            }
            
            const paymentProcessingEl = document.getElementById('paymentProcessing');
            if (paymentProcessingEl) paymentProcessingEl.style.display = 'block';
            
            try {
                // Create payment intent on the server
                const createIntentResponse = await fetch(`${API_BASE}/api/stripe/create-payment-intent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        amount: Math.round(selectedWarrantyPrice * 100), // Amount in cents
                        currency: 'gbp',
                        description: `Extended warranty for AirPod part ${securityBarcode}`
                    })
                });
                const intentData = await createIntentResponse.json();
                
                if (!createIntentResponse.ok || !intentData.clientSecret) {
                    showError(intentData.error || 'Failed to initiate payment. Please try again.');
                    submitButton.disabled = false;
                    hideSpinner();
                    if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
                    return;
                }
                
                // Confirm the card payment
                const { paymentIntent, error } = await stripe.confirmCardPayment(intentData.clientSecret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: customerName,
                            email: customerEmail,
                            phone: customerPhone || undefined
                        },
                    }
                });
                
                if (error) {
                    showError(error.message);
                    if (cardErrors) {
                        cardErrors.textContent = error.message;
                        cardErrors.style.display = 'block';
                    }
                    submitButton.disabled = false;
                    hideSpinner();
                    if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
                    return;
                }
                
                if (paymentIntent.status === 'succeeded') {
                    paymentIntentId = paymentIntent.id;
                    console.log('Stripe payment succeeded:', paymentIntentId);
                } else {
                    showError('Payment failed or was not successful. Please try again.');
                    submitButton.disabled = false;
                    hideSpinner();
                    if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
                    return;
                }
            } catch (paymentError) {
                console.error('Payment processing error:', paymentError);
                showError('An error occurred during payment. Please try again or contact support.');
                submitButton.disabled = false;
                hideSpinner();
                const paymentProcessingEl = document.getElementById('paymentProcessing');
                if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
                return;
            } finally {
                const paymentProcessingEl = document.getElementById('paymentProcessing');
                if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
            }
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
                    warranty_price: selectedWarrantyPrice,
                    payment_intent_id: paymentIntentId // Pass payment intent ID to backend
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
    
    // Ensure sections exist before toggling
    if (!registerFreeWarranty) {
        console.warn('registerFreeWarranty checkbox not found');
        return;
    }
    
    if (registerFreeWarranty.checked) {
        // Show all sections (checkbox is checked)
        if (customerInfoSection) {
            customerInfoSection.style.display = 'block';
            customerInfoSection.style.visibility = 'visible';
        }
        if (extendedWarrantySection) {
            extendedWarrantySection.style.display = 'block';
            extendedWarrantySection.style.visibility = 'visible';
        }
        if (marketingSection) {
            marketingSection.style.display = 'block';
            marketingSection.style.visibility = 'visible';
        }
        if (termsSection) {
            termsSection.style.display = 'block';
            termsSection.style.visibility = 'visible';
        }
        if (acceptTerms) acceptTerms.required = true;
        // Update payment section visibility based on selected warranty
        updateTotalPrice();
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
function initializePage() {
    loadProductInfo();
    loadWarrantyPricing(); // Load pricing from API
    initializeStripe();
    
    // Ensure form is hidden initially (choice options shown)
    const warrantyForm = document.getElementById('warrantyForm');
    const choiceOptions = document.getElementById('warrantyChoiceOptions');
    
    if (warrantyForm) {
        warrantyForm.classList.remove('active'); // Hide form initially
    }
    if (choiceOptions) {
        choiceOptions.style.display = 'grid'; // Show choice options
    }
    
    // Ensure marketing checkbox is checked by default
    const marketingConsent = document.getElementById('marketingConsent');
    if (marketingConsent) {
        marketingConsent.checked = true;
    }
    
    // Wait a moment for DOM to be fully ready, then toggle sections
    setTimeout(() => {
        toggleWarrantySections();
    }, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

