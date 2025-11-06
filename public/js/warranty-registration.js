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
                'none': 0
            };
            
            // Only include enabled warranty options
            if (pricing['3months'] !== undefined) {
                warrantyPrices['3months'] = pricing['3months'];
            }
            if (pricing['6months'] !== undefined) {
                warrantyPrices['6months'] = pricing['6months'];
            }
            if (pricing['12months'] !== undefined) {
                warrantyPrices['12months'] = pricing['12months'];
            }
            
            console.log('Warranty pricing loaded:', warrantyPrices);
            // Update prices in the UI and hide disabled options
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
    // Update 3 months price and visibility
    const option3Months = document.querySelector('#warranty3Months')?.closest('.warranty-option');
    if (option3Months) {
        if (warrantyPrices['3months'] !== undefined) {
            const price3El = option3Months.querySelector('.warranty-price');
            if (price3El) {
                price3El.textContent = `£${warrantyPrices['3months'].toFixed(2)}`;
            }
            option3Months.style.display = 'block';
        } else {
            option3Months.style.display = 'none';
        }
    }
    
    // Update 6 months price and visibility
    const option6Months = document.querySelector('#warranty6Months')?.closest('.warranty-option');
    if (option6Months) {
        if (warrantyPrices['6months'] !== undefined) {
            const price6El = option6Months.querySelector('.warranty-price');
            if (price6El) {
                price6El.textContent = `£${warrantyPrices['6months'].toFixed(2)}`;
            }
            option6Months.style.display = 'block';
        } else {
            option6Months.style.display = 'none';
        }
    }
    
    // Update 12 months price and visibility
    const option12Months = document.querySelector('#warranty12Months')?.closest('.warranty-option');
    if (option12Months) {
        if (warrantyPrices['12months'] !== undefined) {
            const price12El = option12Months.querySelector('.warranty-price');
            if (price12El) {
                price12El.textContent = `£${warrantyPrices['12months'].toFixed(2)}`;
            }
            option12Months.style.display = 'block';
        } else {
            option12Months.style.display = 'none';
        }
    }
    
    // If a disabled warranty option is currently selected, reset to 'none'
    const selectedWarranty = document.querySelector('input[name="extendedWarranty"]:checked');
    if (selectedWarranty && selectedWarranty.value !== 'none') {
        if (warrantyPrices[selectedWarranty.value] === undefined) {
            // Selected warranty is disabled, reset to 'none'
            const warrantyNone = document.getElementById('warrantyNone');
            if (warrantyNone) {
                warrantyNone.checked = true;
            }
        }
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
            console.log('Product data received:', data); // Debug log
            
            if (data.error) {
                showError('Product not found. Please check your security code.');
                return;
            }
            
            // Display product info in the new tile format
            const productTitleEl = document.getElementById('productTitle');
            const productItemEl = document.getElementById('productItem');
            const productNameEl = document.getElementById('productName');
            const productModelEl = document.getElementById('productModel');
            const serialNumberEl = document.getElementById('serialNumber');
            const securityCodeEl = document.getElementById('securityCode');
            const productImageEl = document.getElementById('productImage');
            const productImagePlaceholder = document.getElementById('productImagePlaceholder');
            
            // Build product details
            const partTypeMap = {
                'left': 'Left AirPod',
                'right': 'Right AirPod',
                'case': 'Charging Case'
            };
            const partType = partTypeMap[data.part_type] || data.part_type || 'Unknown';
            const productTitle = `${partType}${data.generation ? ' - ' + data.generation : ''}`;
            
            // Display product title
            if (productTitleEl) {
                productTitleEl.textContent = productTitle;
            }
            
            // Display item (part type)
            if (productItemEl) {
                productItemEl.textContent = partType;
            }
            
            // Display product name (generation)
            if (productNameEl) {
                productNameEl.textContent = data.generation || 'N/A';
            }
            
            // Display product code (model number)
            if (productModelEl) {
                productModelEl.textContent = data.part_model_number || 'N/A';
            }
            
            // Display serial number
            if (serialNumberEl) {
                serialNumberEl.textContent = data.serial_number || 'N/A';
            }
            
            // Display security code
            if (securityCodeEl) {
                securityCodeEl.textContent = barcode;
            }
            
            // Display product image if available
            if (data.photos && data.photos.length > 0) {
                const firstPhoto = data.photos[0];
                // Ensure photo path is correct
                const photoPath = firstPhoto.startsWith('/') ? firstPhoto : `/${firstPhoto}`;
                if (productImageEl) {
                    productImageEl.src = photoPath;
                    productImageEl.style.display = 'block';
                    productImageEl.onerror = function() {
                        // If image fails to load, show placeholder
                        this.style.display = 'none';
                        if (productImagePlaceholder) {
                            productImagePlaceholder.style.display = 'flex';
                        }
                    };
                    if (productImagePlaceholder) {
                        productImagePlaceholder.style.display = 'none';
                    }
                }
            } else {
                // No photos, ensure placeholder is visible
                if (productImageEl) {
                    productImageEl.style.display = 'none';
                }
                if (productImagePlaceholder) {
                    productImagePlaceholder.style.display = 'flex';
                }
            }
            
            // Setup photo carousel
            setupPhotoCarousel(data.photos || []);
        })
        .catch(err => {
            console.error('Error loading product:', err);
            showError('Failed to load product information. Please try again.');
        });
}

// Photo carousel and modal functionality
let currentPhotoIndex = 0;
let photos = [];

function setupPhotoCarousel(photoArray) {
    photos = photoArray || [];
    const carouselSection = document.getElementById('photoCarouselSection');
    const carouselContainer = document.getElementById('carouselContainer');
    const carouselIndicators = document.getElementById('carouselIndicators');
    
    if (!carouselSection || !carouselContainer || !carouselIndicators) {
        return;
    }
    
    // Hide carousel if no photos
    if (photos.length === 0) {
        carouselSection.style.display = 'none';
        return;
    }
    
    // Show carousel
    carouselSection.style.display = 'block';
    
    // Clear existing content
    carouselContainer.innerHTML = '';
    carouselIndicators.innerHTML = '';
    
    // Add photos to carousel
    photos.forEach((photo, index) => {
        const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
        
        // Create photo element
        const photoDiv = document.createElement('div');
        photoDiv.className = 'carousel-photo';
        photoDiv.dataset.index = index;
        
        const img = document.createElement('img');
        img.src = photoPath;
        img.alt = `Product photo ${index + 1}`;
        img.onerror = function() {
            photoDiv.style.display = 'none';
        };
        
        photoDiv.appendChild(img);
        photoDiv.addEventListener('click', () => openModal(index));
        carouselContainer.appendChild(photoDiv);
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator' + (index === 0 ? ' active' : '');
        indicator.dataset.index = index;
        indicator.addEventListener('click', () => scrollToPhoto(index));
        carouselIndicators.appendChild(indicator);
    });
    
    // Setup carousel navigation
    const prevButton = document.getElementById('carouselPrev');
    const nextButton = document.getElementById('carouselNext');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => scrollCarousel(-1));
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => scrollCarousel(1));
    }
    
    // Update button states
    updateCarouselButtons();
}

function scrollCarousel(direction) {
    const container = document.getElementById('carouselContainer');
    if (!container) return;
    
    const photoWidth = 150 + 12; // width + gap
    const scrollAmount = photoWidth * direction;
    
    container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
    
    // Update active indicator after scroll
    setTimeout(() => {
        updateActiveIndicator();
    }, 300);
}

function scrollToPhoto(index) {
    const container = document.getElementById('carouselContainer');
    if (!container) return;
    
    const photoWidth = 150 + 12; // width + gap
    container.scrollTo({
        left: photoWidth * index,
        behavior: 'smooth'
    });
    
    updateActiveIndicator(index);
}

function updateActiveIndicator(activeIndex) {
    const indicators = document.querySelectorAll('.carousel-indicator');
    const container = document.getElementById('carouselContainer');
    
    if (activeIndex === undefined && container) {
        const scrollLeft = container.scrollLeft;
        const photoWidth = 150 + 12;
        activeIndex = Math.round(scrollLeft / photoWidth);
    }
    
    indicators.forEach((indicator, index) => {
        if (index === activeIndex) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    });
}

function updateCarouselButtons() {
    const prevButton = document.getElementById('carouselPrev');
    const nextButton = document.getElementById('carouselNext');
    const container = document.getElementById('carouselContainer');
    
    if (!container) return;
    
    // Check scroll position
    const isAtStart = container.scrollLeft <= 0;
    const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;
    
    if (prevButton) {
        prevButton.disabled = isAtStart;
    }
    if (nextButton) {
        nextButton.disabled = isAtEnd;
    }
}

// Modal functionality
function openModal(index) {
    currentPhotoIndex = index;
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    
    if (!modal || !modalImage) return;
    
    const photo = photos[index];
    if (!photo) return;
    
    const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
    modalImage.src = photoPath;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    updateModalButtons();
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function navigateModal(direction) {
    currentPhotoIndex += direction;
    
    if (currentPhotoIndex < 0) {
        currentPhotoIndex = photos.length - 1;
    } else if (currentPhotoIndex >= photos.length) {
        currentPhotoIndex = 0;
    }
    
    const modalImage = document.getElementById('modalImage');
    if (modalImage) {
        const photo = photos[currentPhotoIndex];
        const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
        modalImage.src = photoPath;
    }
    
    updateModalButtons();
}

function updateModalButtons() {
    const prevButton = document.getElementById('modalPrev');
    const nextButton = document.getElementById('modalNext');
    
    // Buttons are always enabled (circular navigation)
    // Could add visual feedback if needed
}

// Setup modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    const modalClose = document.getElementById('modalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    const modalOverlay = document.querySelector('.modal-overlay');
    
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    if (modalPrev) {
        modalPrev.addEventListener('click', () => navigateModal(-1));
    }
    
    if (modalNext) {
        modalNext.addEventListener('click', () => navigateModal(1));
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
            closeModal();
        }
        if (e.key === 'ArrowLeft' && modal && modal.style.display !== 'none') {
            navigateModal(-1);
        }
        if (e.key === 'ArrowRight' && modal && modal.style.display !== 'none') {
            navigateModal(1);
        }
    });
    
    // Update carousel buttons on scroll
    const carouselContainer = document.getElementById('carouselContainer');
    if (carouselContainer) {
        carouselContainer.addEventListener('scroll', updateCarouselButtons);
    }
});

// Handle warranty choice selection (free, extended, or skip)
// Make it globally accessible for onclick handlers
window.selectWarrantyOption = function(choice) {
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
        
        // Billing address section is now inside payment section
        // It will show automatically when payment section is displayed (extended warranty selected)
        // For now, just ensure form is visible
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
        
        // Billing address is now inside payment section
        // For free warranty only, billing address is optional, so it can remain hidden
        // It will show automatically when extended warranty is selected
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
        
        // Billing address is now inside payment section
        // It will show automatically when payment section is displayed (when extended warranty is selected)
    }
};

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
            // Update button text
            const submitButtonText = document.getElementById('submitButtonText');
            if (submitButtonText) submitButtonText.textContent = 'Continue to Pairing Instructions';
            return;
        }
        
        const selectedWarranty = document.querySelector('input[name="extendedWarranty"]:checked');
        const totalPriceSection = document.getElementById('totalPriceSection');
        const totalPriceEl = document.getElementById('totalPrice');
        const paymentSection = document.getElementById('paymentSection');
        
        // Update button text based on warranty selection
        const submitButtonText = document.getElementById('submitButtonText');
        if (submitButtonText) {
            if (selectedWarranty && selectedWarranty.value !== 'none') {
                submitButtonText.textContent = 'Complete Payment and Progress to Pairing Instructions';
            } else {
                submitButtonText.textContent = 'Continue to Pairing Instructions';
            }
        }
        
        if (selectedWarranty && selectedWarranty.value !== 'none') {
        const price = warrantyPrices[selectedWarranty.value];
        if (totalPriceSection) totalPriceSection.style.display = 'block';
        if (totalPriceEl) totalPriceEl.textContent = `£${price.toFixed(2)}`;
        
        // Show billing address section when extended warranty is selected (required for payment)
        // Billing address is now inside payment section, so it will show automatically when payment section is shown
        const billingAddressSection = document.getElementById('billingAddressSection');
        if (billingAddressSection && paymentSection) {
            // Billing address is inside payment section, so ensure payment section is visible
            billingAddressSection.style.display = 'block';
            billingAddressSection.style.visibility = 'visible';
        }
        
        if (paymentSection) {
            paymentSection.style.display = 'block';
            paymentSection.style.visibility = 'visible';
            // Show Process Payment button
            const processPaymentButton = document.getElementById('processPaymentButton');
            if (processPaymentButton) processPaymentButton.style.display = 'inline-block';
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
        // Hide Process Payment button
        const processPaymentButton = document.getElementById('processPaymentButton');
        if (processPaymentButton) processPaymentButton.style.display = 'none';
        
        // Billing address can be hidden for free warranty only, but show it if form is visible
        // (It's still useful for warranty records)
    }
}

// Initialize Stripe Elements
async function initializeStripe() {
    try {
        // Fetch Stripe publishable key from server
        const response = await fetch(`${API_BASE}/api/stripe/config`);
        
        if (!response.ok) {
            console.warn('⚠️  Stripe configuration endpoint returned error:', response.status);
            return;
        }
        
        const config = await response.json();
        
        if (!config.publishableKey) {
            // Payment features disabled - this is OK, app will work without payments
            // Silently return - no console warnings needed in production
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
        
        // Stripe initialized successfully - card element will mount when payment section is shown
    } catch (error) {
        console.error('Error initializing Stripe:', error);
        showError('Payment system unavailable. Please contact support.');
    }
}

// Process payment when "Process Payment" button is clicked
async function processPayment() {
    hideMessages();
    
    const processPaymentButton = document.getElementById('processPaymentButton');
    const registerFreeWarranty = document.getElementById('registerFreeWarranty');
    
    if (!registerFreeWarranty || !registerFreeWarranty.checked) {
        showError('Please register for warranty first.');
        return;
    }
    
    // Validate form first
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const extendedWarranty = document.querySelector('input[name="extendedWarranty"]:checked');
    const acceptTerms = document.getElementById('acceptTerms').checked;
    
    // Address fields (required for payment)
    const addressLine1 = document.getElementById('addressLine1').value.trim();
    const addressLine2 = document.getElementById('addressLine2').value.trim();
    const city = document.getElementById('city').value.trim();
    const postcode = document.getElementById('postcode').value.trim().toUpperCase();
    const country = document.getElementById('country').value;
    
    if (!customerName || !customerEmail) {
        showError('Please fill in all required fields before processing payment.');
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
    
    if (!extendedWarranty || extendedWarranty.value === 'none') {
        showError('Please select an extended warranty option.');
        return;
    }
    
    // Validate billing address (required for payment)
    if (!addressLine1 || !city || !postcode || !country) {
        showError('Please fill in all required billing address fields before processing payment.');
        return;
    }
    
    if (!stripe || !cardElement) {
        showError('Payment system is not configured. Please contact support.');
        return;
    }
    
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    if (!securityBarcode) {
        showError('Session expired. Please start over.');
        window.location.href = 'index.html';
        return;
    }
    
    const selectedWarrantyPrice = warrantyPrices[extendedWarranty.value] || 0;
    if (selectedWarrantyPrice <= 0) {
        showError('Invalid warranty selection.');
        return;
    }
    
    processPaymentButton.disabled = true;
    showSpinner();
    
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
            processPaymentButton.disabled = false;
            hideSpinner();
            if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
            return;
        }
        
        // Confirm the card payment with billing address
        const { paymentIntent, error } = await stripe.confirmCardPayment(intentData.clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone || undefined,
                    address: {
                        line1: addressLine1,
                        line2: addressLine2 || undefined,
                        city: city,
                        postal_code: postcode,
                        country: country
                    }
                },
            }
        });
        
        if (error) {
            showError(error.message);
            if (cardErrors) {
                cardErrors.textContent = error.message;
                cardErrors.style.display = 'block';
            }
            processPaymentButton.disabled = false;
            hideSpinner();
            if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
            return;
        }
        
        if (paymentIntent.status === 'succeeded') {
            // Store payment intent ID in sessionStorage
            sessionStorage.setItem('paymentIntentId', paymentIntent.id);
            sessionStorage.setItem('paymentProcessed', 'true');
            
            console.log('Stripe payment succeeded:', paymentIntent.id);
            showSuccess('Payment processed successfully! Redirecting to pairing instructions...');
            
            // Register warranty and redirect to pairing page
            try {
                const marketingConsent = document.getElementById('marketingConsent').checked;
                
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
                        billing_address: {
                            line1: addressLine1,
                            line2: addressLine2 || null,
                            city: city,
                            postcode: postcode,
                            country: country
                        },
                        extended_warranty: extendedWarranty.value,
                        marketing_consent: marketingConsent,
                        warranty_price: selectedWarrantyPrice,
                        payment_intent_id: paymentIntent.id
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Store warranty registration status
                    sessionStorage.setItem('warrantyRegistered', 'true');
                    sessionStorage.setItem('warrantyId', data.warranty_id);
                    
                    // Redirect to pairing page after 1.5 seconds
                    setTimeout(() => {
                        window.location.href = 'confirmation.html';
                    }, 1500);
                } else {
                    showError(data.error || 'Payment succeeded but warranty registration failed. Please contact support.');
                    processPaymentButton.disabled = false;
                    hideSpinner();
                }
            } catch (regError) {
                console.error('Warranty registration error:', regError);
                showError('Payment succeeded but warranty registration failed. Please contact support.');
                processPaymentButton.disabled = false;
                hideSpinner();
            }
        } else {
            showError('Payment failed or was not successful. Please try again.');
            processPaymentButton.disabled = false;
            hideSpinner();
        }
    } catch (paymentError) {
        console.error('Payment processing error:', paymentError);
        showError('An error occurred during payment. Please try again or contact support.');
        processPaymentButton.disabled = false;
        hideSpinner();
    } finally {
        if (paymentProcessingEl) paymentProcessingEl.style.display = 'none';
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
        
        // User wants to register warranty - validate
        const customerName = document.getElementById('customerName').value.trim();
        const customerEmail = document.getElementById('customerEmail').value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();
        const extendedWarranty = document.querySelector('input[name="extendedWarranty"]:checked').value;
        const marketingConsent = document.getElementById('marketingConsent').checked;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        
        // Address fields (optional for free warranty, but should be present if payment was processed)
        const addressLine1 = document.getElementById('addressLine1').value.trim();
        const addressLine2 = document.getElementById('addressLine2').value.trim();
        const city = document.getElementById('city').value.trim();
        const postcode = document.getElementById('postcode').value.trim().toUpperCase();
        const country = document.getElementById('country').value;
        
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
        
        // If extended warranty is selected, check if payment was processed
        if (extendedWarranty !== 'none') {
            const paymentProcessed = sessionStorage.getItem('paymentProcessed');
            if (paymentProcessed !== 'true') {
                showError('Please click "Process Payment" to complete your extended warranty purchase before continuing.');
                return;
            }
        }
        
        submitButton.disabled = true;
        showSpinner();
        
        const securityBarcode = sessionStorage.getItem('securityBarcode');
        if (!securityBarcode) {
            showError('Session expired. Please start over.');
            window.location.href = 'index.html';
            return;
        }
        
        const selectedWarrantyPrice = warrantyPrices[extendedWarranty] || 0;
        const paymentIntentId = extendedWarranty !== 'none' ? sessionStorage.getItem('paymentIntentId') : null;
        
        // Build billing address object (may be null for free warranty)
        const billingAddress = (addressLine1 && city && postcode && country) ? {
            line1: addressLine1,
            line2: addressLine2 || null,
            city: city,
            postcode: postcode,
            country: country
        } : null;
        
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
                    billing_address: billingAddress,
                    extended_warranty: extendedWarranty,
                    marketing_consent: marketingConsent,
                    warranty_price: selectedWarrantyPrice,
                    payment_intent_id: paymentIntentId
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess('Warranty registered successfully! Redirecting...');
                
                // Store warranty registration status
                sessionStorage.setItem('warrantyRegistered', 'true');
                sessionStorage.setItem('warrantyId', data.warranty_id);
                
                // Clear payment flags
                sessionStorage.removeItem('paymentProcessed');
                sessionStorage.removeItem('paymentIntentId');
                
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

// Setup Process Payment button handler
document.addEventListener('DOMContentLoaded', function() {
    const processPaymentButton = document.getElementById('processPaymentButton');
    if (processPaymentButton) {
        processPaymentButton.addEventListener('click', processPayment);
    }
});

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
    const billingAddressSection = document.getElementById('billingAddressSection');
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
        // Billing address is now inside payment section, so it will show when payment section is shown
        // For free warranty only, we still want billing address visible, so we'll show it separately
        // But since it's now inside payment section, we need to ensure payment section shows it
        // Actually, for free warranty, billing address is optional, so we can leave it hidden
        // It will show automatically when extended warranty is selected (payment section shown)
        if (billingAddressSection) {
            // Only show if payment section is visible (extended warranty selected)
            // For free warranty only, billing address is optional so can be hidden
            const paymentSection = document.getElementById('paymentSection');
            if (paymentSection && paymentSection.style.display !== 'none') {
                billingAddressSection.style.display = 'block';
                billingAddressSection.style.visibility = 'visible';
                console.log('Billing address section shown (payment section visible)');
            }
        } else {
            console.warn('Billing address section element not found!');
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
        if (billingAddressSection) billingAddressSection.style.display = 'none';
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

// Load product info on page load
function initializePage() {
    loadProductInfo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

