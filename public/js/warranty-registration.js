// Warranty Registration Flow - Enhanced UX
// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// State Management
const appState = {
    currentStep: 1,
    totalSteps: 7,
    securityCode: '',
    failedAttempts: 0,
    productData: null,
    contactDetails: {
        name: '',
        email: '',
        phone: ''
    },
    selectedWarranty: '6month',
    selectedAccessories: [],
    setupStepsCompleted: [],
    exitIntentShown: false,
    sessionStartTime: Date.now(),
    skippedStep1: false, // Track if step 1 was skipped (coming from home page)
    airpodExamples: null // Store loaded example images database
};

// Load saved state from localStorage
function loadSavedState() {
    const saved = localStorage.getItem('warrantyRegistrationState');
    if (saved) {
        const state = JSON.parse(saved);
        const savedTime = state.sessionStartTime || 0;
        const hoursSince = (Date.now() - savedTime) / (1000 * 60 * 60);
        
        // Resume if within 24 hours
        if (hoursSince < 24 && state.currentStep > 1) {
            console.log('Loading saved state - currentStep:', state.currentStep);
            Object.assign(appState, state);
            // Hide step 1 if it was skipped
            if (appState.skippedStep1) {
                const step1 = document.getElementById('step1');
                if (step1) {
                    step1.style.display = 'none';
                }
            }
            return true;
        } else {
            // Clear old saved state
            localStorage.removeItem('warrantyRegistrationState');
        }
    }
    return false;
}

// Save state to localStorage
function saveState() {
    appState.sessionStartTime = Date.now();
    localStorage.setItem('warrantyRegistrationState', JSON.stringify(appState));
}

// Track analytics
function trackEvent(eventName, data = {}) {
    console.log('Analytics:', eventName, data);
    // Add your analytics tracking here (Google Analytics, etc.)
    if (window.gtag) {
        window.gtag('event', eventName, data);
    }
}

// Initialize page
function initializePage() {
    console.log('=== initializePage called ===');
    console.log('Current URL:', window.location.href);
    
    // Immediately check URL for barcode to hide step 1 if needed
    const urlParams = new URLSearchParams(window.location.search);
    const barcodeFromUrl = urlParams.get('barcode');
    console.log('Barcode from URL:', barcodeFromUrl);
    
    // Hide step 1 immediately if barcode is in URL (coming from home page)
    if (barcodeFromUrl) {
        const step1 = document.getElementById('step1');
        if (step1) {
            step1.style.display = 'none';
        }
    }
    
    // Check if we should resume from saved state
    const resumed = loadSavedState();
    
    // If coming from home page with barcode, don't use saved state - start fresh
    if (barcodeFromUrl) {
        console.log('Barcode in URL - clearing saved state and starting fresh');
        localStorage.removeItem('warrantyRegistrationState');
        appState.currentStep = 1;
        appState.skippedStep1 = false;
    }
    
    if (resumed && appState.currentStep > 1 && !barcodeFromUrl) {
        console.log('Resuming from saved state at step:', appState.currentStep);
        showWelcomeBack();
        // Load product info if we have security code and show on step 1 if appropriate
        if (appState.securityCode) {
            // If resuming at step 1, show product info on step 1
            if (appState.currentStep === 1) {
                loadProductInfo(appState.securityCode, true).then((data) => {
                    displayProductInfoOnStep1(data);
                    const productDisplay = document.getElementById('productRecordDisplay');
                    if (productDisplay) {
                        productDisplay.style.display = 'block';
                    }
                    const continueBtn = document.getElementById('continueBtn1');
                    if (continueBtn) {
                        continueBtn.disabled = false;
                        continueBtn.textContent = 'Continue to Contact Information';
                    }
                });
            } else {
                loadProductInfo(appState.securityCode, true);
            }
        }
        showStep(appState.currentStep);
    } else {
        // Check URL for barcode
        const barcode = barcodeFromUrl || sessionStorage.getItem('securityBarcode');
        
        if (barcode) {
            appState.securityCode = barcode;
            // If coming from index.html with validated code, show product on step 1
            if (barcodeFromUrl) {
                // Coming from index.html - code already validated, show product on step 1
                appState.skippedStep1 = false;
                appState.currentStep = 1;
                
                const step1 = document.getElementById('step1');
                if (step1) {
                    step1.style.display = 'block';
                }
                
                // Hide security code entry section when coming from home page
                const securityCodeEntry = document.getElementById('securityCodeEntrySection');
                if (securityCodeEntry) {
                    securityCodeEntry.style.display = 'none';
                }
                
                // Ensure we're on step 1 first
                showStep(1);
                
                // Load product info and display on step 1
                loadProductInfo(barcode, true).then((data) => {
                    // Ensure we're still on step 1
                    showStep(1);
                    
                    displayProductInfoOnStep1(data);
                    // Show product record display
                    const productDisplay = document.getElementById('productRecordDisplay');
                    if (productDisplay) {
                        productDisplay.style.display = 'block';
                    }
                    // Enable continue button
                    const continueBtn = document.getElementById('continueBtn1');
                    if (continueBtn) {
                        continueBtn.disabled = false;
                        continueBtn.textContent = 'Continue to Contact Information';
                    }
                }).catch((error) => {
                    console.error('Failed to load product info:', error);
                    showStep(1);
                });
            } else {
                // Pre-fill security code input (from sessionStorage)
                const step1 = document.getElementById('step1');
                if (step1) {
                    step1.style.display = 'block';
                }
                const securityInput = document.getElementById('securityCodeInput');
                if (securityInput) {
                    let formatted = barcode.replace(/[^\w]/g, '').toUpperCase();
                    formatted = formatted.match(/.{1,4}/g)?.join('-') || formatted;
                    securityInput.value = formatted;
                    securityInput.classList.add('valid');
                    document.getElementById('validationIcon').classList.add('show');
                    document.getElementById('validationIcon').style.color = '#28a745';
                    document.getElementById('continueBtn1').disabled = false;
                }
                showStep(1);
            }
        } else {
            // Start at step 1 - security code entry (direct navigation)
            const step1 = document.getElementById('step1');
            if (step1) {
                step1.style.display = 'block';
            }
            showStep(1);
        }
    }
    
    setupEventListeners();
    setupNavigationLocking();
    setupExitIntent();
    updateProgressIndicator();
}

// Show welcome back message
function showWelcomeBack() {
    const cardBody = document.querySelector('.card-body');
    if (cardBody) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'warranty-warning';
        welcomeMsg.style.marginBottom = '24px';
        welcomeMsg.innerHTML = '<strong>Welcome back!</strong> Let\'s finish setting up your AirPods';
        cardBody.insertBefore(welcomeMsg, cardBody.firstChild);
        setTimeout(() => welcomeMsg.remove(), 5000);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Security code input
    const securityInput = document.getElementById('securityCodeInput');
    if (securityInput) {
        securityInput.addEventListener('input', handleSecurityCodeInput);
        securityInput.addEventListener('keypress', (e) => {
            const continueBtn = document.getElementById('continueBtn1');
            if (e.key === 'Enter' && !continueBtn.disabled) {
                // Check if product record is displayed on step 1
                const productDisplay = document.getElementById('productRecordDisplay');
                const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
                
                // If product is displayed on step 1, go to contact details
                if (isProductDisplayed && appState.productData) {
                    showStep(3);
                } else {
                    validateSecurityCode();
                }
            }
        });
        // Auto-focus
        setTimeout(() => securityInput.focus(), 100);
    }
    
    // Continue buttons
    document.getElementById('continueBtn1')?.addEventListener('click', function() {
        // Check if product record is displayed on step 1
        const productDisplay = document.getElementById('productRecordDisplay');
        const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
        
        // If product is displayed on step 1, go to contact details
        if (isProductDisplayed && appState.productData) {
            showStep(3);
        } else {
            // Otherwise validate security code
            validateSecurityCode();
        }
    });
    document.getElementById('continueBtn2')?.addEventListener('click', () => {
        // Product review complete, go to contact details
        showStep(3);
    });
    document.getElementById('continueBtn3')?.addEventListener('click', handleContactDetailsSubmit);
    document.getElementById('continueBtn4')?.addEventListener('click', () => {
        // Warranty confirmed, go to extended warranty upsell
        trackEvent('warranty_confirmed');
        showStep(5);
    });
    document.getElementById('continueBtn5')?.addEventListener('click', () => {
        trackEvent('warranty_selected', { plan: appState.selectedWarranty });
        showStep(6);
    });
    document.getElementById('continueBtn6')?.addEventListener('click', () => {
        trackEvent('accessories_selected', { items: appState.selectedAccessories });
        showStep(7);
    });
    document.getElementById('continueBtn7')?.addEventListener('click', finishSetup);
    
    // Warranty selection
    document.querySelectorAll('.warranty-card').forEach(card => {
        card.addEventListener('click', function() {
            if (this.classList.contains('grayed-out')) return;
            document.querySelectorAll('.warranty-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            appState.selectedWarranty = this.dataset.plan;
            saveState();
        });
    });
    
    // Skip warranty
    document.getElementById('skipWarranty')?.addEventListener('click', (e) => {
        e.preventDefault();
        appState.selectedWarranty = 'none';
        trackEvent('warranty_skipped');
        showStep(6);
    });
    
    // Accessory selection
    document.querySelectorAll('.accessory-item').forEach(item => {
        item.addEventListener('click', function() {
            this.classList.toggle('selected');
            const itemId = this.dataset.item;
            if (this.classList.contains('selected')) {
                if (!appState.selectedAccessories.includes(itemId)) {
                    appState.selectedAccessories.push(itemId);
                }
            } else {
                appState.selectedAccessories = appState.selectedAccessories.filter(id => id !== itemId);
            }
            saveState();
        });
    });
    
    // Skip accessories
    document.getElementById('skipAccessories')?.addEventListener('click', (e) => {
        e.preventDefault();
        trackEvent('accessories_skipped');
        showStep(7);
    });
    
    // Setup step checkboxes
    document.querySelectorAll('.step-checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                const stepNum = parseInt(this.dataset.step);
                if (!appState.setupStepsCompleted.includes(stepNum)) {
                    appState.setupStepsCompleted.push(stepNum);
                    saveState();
                    
                        // Show next step
                        const nextStep = document.querySelector(`.setup-step[data-step-num="${stepNum + 1}"]`);
                        if (nextStep) {
                            setTimeout(() => {
                                nextStep.classList.add('active');
                            }, 300);
                        } else {
                            // All steps completed
                            document.getElementById('continueBtn7').style.display = 'block';
                            
                            // Show last chance popup if no warranty selected
                            if (appState.selectedWarranty === 'none') {
        setTimeout(() => {
                                    showLastChancePopup();
                                }, 1000);
                            }
                        }
                }
            }
        });
    });
    
    // Setup image modal event listeners
    setupImageModalListeners();
}

// Handle security code input
function handleSecurityCodeInput(e) {
    let value = e.target.value.replace(/[^\w]/g, '').toUpperCase();
    let formattedValue = value.match(/.{1,4}/g)?.join('-') || value;
    e.target.value = formattedValue;
    
    // Validate format
    const isValid = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formattedValue);
    const validationIcon = document.getElementById('validationIcon');
    const continueBtn = document.getElementById('continueBtn1');
    
    if (isValid) {
        e.target.classList.add('valid');
        validationIcon.classList.add('show');
        validationIcon.style.color = '#28a745';
        continueBtn.disabled = false;
    } else {
        e.target.classList.remove('valid');
        validationIcon.classList.remove('show');
        continueBtn.disabled = true;
    }
}

// Validate security code
async function validateSecurityCode() {
    const securityInput = document.getElementById('securityCodeInput');
    const securityCode = securityInput.value.trim();
    const continueBtn = document.getElementById('continueBtn1');
    const errorMessage = document.getElementById('errorMessage');
    const supportContact = document.getElementById('supportContact');
    
    if (!securityCode) {
        showError('Please enter a security code');
        return;
    }
    
    continueBtn.disabled = true;
    continueBtn.textContent = 'Validating...';
    
    try {
        const response = await fetch(`${API_BASE}/api/verify-barcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ security_barcode: securityCode })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            appState.securityCode = securityCode;
            appState.failedAttempts = 0;
            sessionStorage.setItem('securityBarcode', securityCode);
            saveState();
            
            trackEvent('security_code_validated');
            
            // Hide security code entry section after validation
            const securityCodeEntry = document.getElementById('securityCodeEntrySection');
            if (securityCodeEntry) {
                securityCodeEntry.style.display = 'none';
            }
            
            // Load product info and display on step 1
            loadProductInfo(securityCode, false).then((data) => {
                // Ensure we're on step 1
                showStep(1);
                
                displayProductInfoOnStep1(data);
                // Show product record display
                const productDisplay = document.getElementById('productRecordDisplay');
                if (productDisplay) {
                    productDisplay.style.display = 'block';
                    // Scroll to product info smoothly
                    setTimeout(() => {
                        productDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
                // Enable continue button
                continueBtn.disabled = false;
                continueBtn.textContent = 'Continue to Contact Information';
            }).catch((error) => {
                console.error('Failed to load product info:', error);
                showError('Product found but details could not be loaded. Please try again.');
                // Show security code entry again on error
                if (securityCodeEntry) {
                    securityCodeEntry.style.display = 'block';
                }
            });
        } else {
            appState.failedAttempts++;
            saveState();
            
            if (appState.failedAttempts >= 3) {
                errorMessage.style.display = 'none';
                supportContact.classList.add('show');
                securityInput.disabled = true;
                continueBtn.style.display = 'none';
            } else {
                showError(data.error || 'Invalid security code. Please check and try again.');
                securityInput.focus();
            }
            
            trackEvent('security_code_failed', { attempts: appState.failedAttempts });
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        continueBtn.disabled = false;
        continueBtn.textContent = 'Continue';
    }
}

// Handle contact details submission
function handleContactDetailsSubmit() {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();
    
    // Validate
    if (!name || !email || !phone) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Save contact details
    appState.contactDetails = { name, email, phone };
    saveState();
    
    // Register warranty with contact details
    registerWarranty().then(() => {
            // Show success animation and warranty confirmation
            showStep(4);
            showSuccessAnimation();
            setTimeout(() => {
                const confirmationEl = document.getElementById('warrantyConfirmation');
                if (confirmationEl) {
                    confirmationEl.style.display = 'block';
                }
            }, 2000);
    }).catch((error) => {
        console.error('Failed to register warranty:', error);
        alert('Failed to register warranty. Please try again.');
    });
}

// Register warranty with contact details
async function registerWarranty() {
    try {
        const response = await fetch(`${API_BASE}/api/warranty/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                security_barcode: appState.securityCode,
                customer_name: appState.contactDetails.name,
                customer_email: appState.contactDetails.email,
                customer_phone: appState.contactDetails.phone,
                extended_warranty: 'none', // Standard 30-day warranty
                warranty_price: 0,
                marketing_consent: false
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('Warranty registered successfully');
            trackEvent('warranty_registered', {
                name: appState.contactDetails.name,
                email: appState.contactDetails.email
            });
            return Promise.resolve(data);
        } else {
            return Promise.reject(new Error(data.error || 'Failed to register warranty'));
        }
    } catch (error) {
        console.error('Error registering warranty:', error);
        return Promise.reject(error);
    }
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }
}

// Show success animation
function showSuccessAnimation() {
    const successAnimation = document.getElementById('successAnimation');
    if (successAnimation) {
        successAnimation.classList.add('show');
    }
}

// Load product info
async function loadProductInfo(barcode, skipValidation = false) {
    console.log('loadProductInfo called with barcode:', barcode, 'skipValidation:', skipValidation);
    try {
        const response = await fetch(`${API_BASE}/api/product-info/${encodeURIComponent(barcode)}`);
        const data = await response.json();
        
        console.log('Product data received:', data);
            
            if (data.error) {
            console.error('Product data has error:', data.error);
            if (!skipValidation) {
                showError('Product not found. Please check your security code.');
            }
            return Promise.reject(new Error('Product not found'));
        }
        
        appState.productData = data;
        saveState();
        
        // Only display product info for warranty confirmation step (step 4)
        // When loading for step 1, displayProductInfoOnStep1 will be called separately
        if (appState.currentStep === 4 || (!skipValidation && appState.currentStep > 3)) {
            console.log('Calling displayProductInfo for warranty confirmation');
            displayProductInfo(data);
            
            // Calculate warranty expiry
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            const expiryEl = document.getElementById('warrantyExpiry');
            if (expiryEl) {
                expiryEl.textContent = expiryDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            
            // Show warranty confirmation after animation
            if (!skipValidation) {
                // Show success animation first
                showSuccessAnimation();
                setTimeout(() => {
                    const confirmationEl = document.getElementById('warrantyConfirmation');
                    if (confirmationEl) {
                        confirmationEl.style.display = 'block';
                    }
                }, 2000);
            } else {
                // Skip animation for resumed sessions
                console.log('Skipping animation, showing warranty confirmation immediately');
                const confirmationEl = document.getElementById('warrantyConfirmation');
                const animationEl = document.getElementById('successAnimation');
                if (confirmationEl) {
                    confirmationEl.style.display = 'block';
                    console.log('Warranty confirmation element found and displayed');
                } else {
                    console.error('Warranty confirmation element NOT found!');
                }
                if (animationEl) {
                    animationEl.classList.remove('show');
                    animationEl.style.display = 'none';
                }
            }
        } else {
            console.log('Skipping displayProductInfo - not on warranty confirmation step');
        }
        
        console.log('loadProductInfo completed successfully');
        return Promise.resolve(data);
        
    } catch (error) {
        console.error('Error loading product:', error);
        if (!skipValidation) {
            showError('Failed to load product information. Please try again.');
        }
        return Promise.reject(error);
    }
}

// Load AirPod examples database
async function loadAirpodExamples() {
    if (appState.airpodExamples) {
        console.log('Using cached AirPod examples');
        return appState.airpodExamples;
    }
    
    try {
        const jsonPath = `${API_BASE}/data/airpod-examples.json`;
        console.log('Loading AirPod examples from:', jsonPath);
        const response = await fetch(jsonPath);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('AirPod examples JSON loaded successfully:', data);
        appState.airpodExamples = data.examples;
        return appState.airpodExamples;
    } catch (error) {
        console.error('Failed to load AirPod examples:', error);
        return null;
    }
}

// Get example images for compatible parts
async function getCompatiblePartExamples(partModelNumber, partType) {
    console.log('getCompatiblePartExamples called for:', partModelNumber);
    const examples = await loadAirpodExamples();
    
    if (!examples) {
        console.error('Examples database not loaded');
        return null;
    }
    
    if (!partModelNumber) {
        console.warn('No part model number provided');
        return null;
    }
    
    console.log('Looking for part:', partModelNumber, 'Available parts:', Object.keys(examples));
    
    // Check if we have examples for this part model number
    if (examples[partModelNumber]) {
        console.log('Found examples for', partModelNumber, ':', examples[partModelNumber]);
        return examples[partModelNumber];
    }
    
    console.warn('No examples found for part model number:', partModelNumber);
    // Fallback: try to find by part type and generation if available
    return null;
}

// Get compatible part numbers based on purchased part
function getCompatiblePartNumbers(partModelNumber, partType) {
    // AirPods Pro 2nd Gen part numbers
    const partNumbers = {
        'A2698': { type: 'left', compatible: ['A2699', 'A2700'] },  // Left AirPod
        'A2699': { type: 'right', compatible: ['A2698', 'A2700'] }, // Right AirPod
        'A2700': { type: 'case', compatible: ['A2698', 'A2699'] }   // Charging Case
    };
    
    // AirPods Pro 1st Gen part numbers
    const partNumbersGen1 = {
        'A2084': { type: 'left', compatible: ['A2083', 'A2190'] },  // Left AirPod
        'A2083': { type: 'right', compatible: ['A2084', 'A2190'] }, // Right AirPod
        'A2190': { type: 'case', compatible: ['A2084', 'A2083'] }   // Charging Case
    };
    
    // AirPods 3rd Gen part numbers
    const partNumbersGen3 = {
        'A2564': { type: 'left', compatible: ['A2565', 'A2566'] },  // Left AirPod
        'A2565': { type: 'right', compatible: ['A2564', 'A2566'] }, // Right AirPod
        'A2566': { type: 'case', compatible: ['A2564', 'A2565'] }   // Charging Case
    };
    
    // AirPods 2nd Gen part numbers
    const partNumbersGen2 = {
        'A2032': { type: 'left', compatible: ['A2031', 'A1602'] },  // Left AirPod
        'A2031': { type: 'right', compatible: ['A2032', 'A1602'] }, // Right AirPod
        'A1602': { type: 'case', compatible: ['A2032', 'A2031'] }   // Charging Case
    };
    
    // Check all part number sets
    const allPartNumbers = { ...partNumbers, ...partNumbersGen1, ...partNumbersGen3, ...partNumbersGen2 };
    
    if (partModelNumber && allPartNumbers[partModelNumber]) {
        return allPartNumbers[partModelNumber].compatible;
    }
    
    // Fallback: if we know the part type, return generic message
    if (partType === 'left') {
        return ['Right AirPod', 'Charging Case'];
    } else if (partType === 'right') {
        return ['Left AirPod', 'Charging Case'];
    } else if (partType === 'case') {
        return ['Left AirPod', 'Right AirPod'];
    }
    
    return ['the other two parts'];
}

// Display product info on step 1 (with photos)
function displayProductInfoOnStep1(data) {
    const partTypeMap = {
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'case': 'Charging Case'
    };
    const partType = partTypeMap[data.part_type] || data.part_type || 'Unknown';
    const partModelNumber = data.part_model_number || '';
    
    // Get compatible part numbers
    const compatibleParts = getCompatiblePartNumbers(partModelNumber, data.part_type);
    const compatiblePartsText = compatibleParts.join(' & ');
    
    const detailsHtml = `
        <div class="product-detail-item">
            <span class="detail-label">Item:</span>
            <span class="detail-value">${partType}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Product Name:</span>
            <span class="detail-value">${data.generation || 'N/A'}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Product Code:</span>
            <span class="detail-value">${partModelNumber || 'N/A'}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Serial Number:</span>
            <span class="detail-value">${data.serial_number || 'N/A'}</span>
        </div>
    `;
    
    const step1Container = document.getElementById('productDetailsStep1');
    if (step1Container) {
        step1Container.innerHTML = detailsHtml;
    }
    
    // Update compatible part numbers in guidance
    const purchasedPartEl = document.getElementById('purchasedPartNumber');
    const compatiblePartsEl = document.getElementById('compatiblePartNumbers');
    if (purchasedPartEl) {
        purchasedPartEl.textContent = partModelNumber || 'your part';
    }
    if (compatiblePartsEl) {
        compatiblePartsEl.textContent = compatiblePartsText;
    }
    
    // Load and display compatible part examples
    console.log('=== DISPLAYING COMPATIBLE PART EXAMPLES ===');
    console.log('Part Model Number:', partModelNumber);
    console.log('Part Type:', data.part_type);
    console.log('Product Data:', data);
    displayCompatiblePartExamples(partModelNumber, data.part_type).catch(err => {
        console.error('Error displaying examples:', err);
    });
    
    // Hide security code entry section when product is displayed
    const securityCodeEntry = document.getElementById('securityCodeEntrySection');
    if (securityCodeEntry) {
        securityCodeEntry.style.display = 'none';
    }
    
    // Setup photo carousel for step 1
    setupPhotoCarouselForStep1(data.photos || []);
    
    // Initialize step-by-step verification
    initializeVerificationSteps();
}

// Display compatible part examples
async function displayCompatiblePartExamples(partModelNumber, partType) {
    console.log('displayCompatiblePartExamples called with:', partModelNumber, partType);
    const examplesContainer = document.getElementById('compatiblePartsExamples');
    const examplesGrid = document.getElementById('compatiblePartsExamplesGrid');
    
    if (!examplesContainer || !examplesGrid) {
        console.error('Examples container or grid not found!');
        return;
    }
    
    // Get example data
    const exampleData = await getCompatiblePartExamples(partModelNumber, partType);
    console.log('Example data loaded:', exampleData);
    
    if (!exampleData || !exampleData.compatibleParts || exampleData.compatibleParts.length === 0) {
        console.log('No example data found, hiding container');
        examplesContainer.style.display = 'none';
        return;
    }
    
    // Clear existing content
    examplesGrid.innerHTML = '';
    
    // Display each compatible part example
    console.log('Displaying', exampleData.compatibleParts.length, 'compatible parts');
    exampleData.compatibleParts.forEach((part, index) => {
        console.log(`Part ${index + 1}:`, part.name, part.exampleImage);
        const partCard = document.createElement('div');
        partCard.style.cssText = 'background: white; border: 2px solid #e8ecf1; border-radius: 12px; padding: 16px; text-align: center; transition: all 0.3s ease;';
        partCard.style.cursor = 'pointer';
        
        // Ensure image path is correct (add leading slash if needed)
        let imagePath = part.exampleImage;
        if (!imagePath.startsWith('/') && !imagePath.startsWith('http')) {
            imagePath = '/' + imagePath;
        }
        
        // Try .jpg first, fallback to .svg if .jpg doesn't exist
        const jpgPath = imagePath;
        const svgPath = imagePath.replace(/\.jpg$/, '.svg').replace(/\.png$/, '.svg');
        
        partCard.innerHTML = `
            <img src="${jpgPath}" 
                 alt="${part.name}" 
                 style="width: 100%; max-width: 200px; height: auto; min-height: 150px; border-radius: 8px; margin-bottom: 12px; object-fit: contain; background: #f8f9fa;"
                 onerror="console.warn('JPG not found, trying SVG:', '${svgPath}'); this.onerror=null; this.src='${svgPath}';"
                 onload="console.log('Image loaded successfully:', '${jpgPath}')">
            <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 0.95rem;">${part.name}</div>
            <div style="font-size: 0.85rem; color: #6c757d; margin-bottom: 8px;">${part.partModelNumber}</div>
            <div style="font-size: 0.8rem; color: #6c757d; line-height: 1.4;">${part.description || ''}</div>
        `;
        
        // Add hover effect
        partCard.addEventListener('mouseenter', function() {
            this.style.borderColor = '#284064';
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(40, 64, 100, 0.15)';
        });
        
        partCard.addEventListener('mouseleave', function() {
            this.style.borderColor = '#e8ecf1';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
        
        // Make image clickable to open in modal
        const img = partCard.querySelector('img');
        if (img) {
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                openModal(0, [part.exampleImage]);
            });
        }
        
        examplesGrid.appendChild(partCard);
    });
    
    // Show the examples container
    examplesContainer.style.display = 'block';
    console.log('Examples container displayed');
}

// Fallback SVG paths for authenticity images
const FALLBACK_CASE_SVG = '/images/airpod-case-markings.svg';
const FALLBACK_AIRPOD_SVG = '/images/airpod-stem-markings.svg';

// Update authenticity check images based on purchased part
async function updateAuthenticityImages(partModelNumber, partType) {
    console.log('[Authenticity] updateAuthenticityImages called for:', partModelNumber, partType);
    
    const caseImgEl = document.getElementById('authenticityCaseImage');
    const airpodImgEl = document.getElementById('authenticityAirPodImage');
    
    if (!caseImgEl || !airpodImgEl) {
        console.error('[Authenticity] Image elements not found');
        return;
    }
    
    // Set up error handlers with fallback
    caseImgEl.onerror = (event) => {
        const currentSrc = caseImgEl.src;
        console.error('[Authenticity] Case image failed to load:', currentSrc);
        console.error('[Authenticity] Error event:', event);
        if (currentSrc !== location.origin + FALLBACK_CASE_SVG && !currentSrc.includes('airpod-case-markings.svg')) {
            console.warn('[Authenticity] Case image failed to load, falling back to SVG. Original src was:', currentSrc);
            caseImgEl.src = FALLBACK_CASE_SVG;
        }
    };
    
    caseImgEl.onload = () => {
        console.log('[Authenticity] Case image loaded successfully:', caseImgEl.src);
    };
    
    airpodImgEl.onerror = (event) => {
        const currentSrc = airpodImgEl.src;
        console.error('[Authenticity] AirPod image failed to load:', currentSrc);
        console.error('[Authenticity] Error event:', event);
        if (currentSrc !== location.origin + FALLBACK_AIRPOD_SVG && !currentSrc.includes('airpod-stem-markings.svg')) {
            console.warn('[Authenticity] AirPod image failed to load, falling back to SVG. Original src was:', currentSrc);
            airpodImgEl.src = FALLBACK_AIRPOD_SVG;
        }
    };
    
    airpodImgEl.onload = () => {
        console.log('[Authenticity] AirPod image loaded successfully:', airpodImgEl.src);
    };
    
    try {
        // Fetch authenticity images from database
        const response = await fetch(`${API_BASE}/api/authenticity-images/${partModelNumber}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Authenticity] API response:', data);
        
        // Support both response formats (new structured and old flat)
        const images = data.data?.images || {
            caseImage: data.authenticity_case_image || null,
            airpodImage: data.authenticity_airpod_image || null
        };
        
        console.log('[Authenticity] Extracted images from API:', images);
        
        // Determine image paths
        let caseSrc = FALLBACK_CASE_SVG;
        let airpodSrc = FALLBACK_AIRPOD_SVG;
        
        // Update case image
        if (images.caseImage) {
            caseSrc = images.caseImage.startsWith('/') 
                ? images.caseImage 
                : '/' + images.caseImage;
            console.log('[Authenticity] Using uploaded case image:', caseSrc);
        } else {
            console.log('[Authenticity] No case image found in database, using fallback SVG');
        }
        
        // Update AirPod image
        if (images.airpodImage) {
            airpodSrc = images.airpodImage.startsWith('/') 
                ? images.airpodImage 
                : '/' + images.airpodImage;
            console.log('[Authenticity] Using uploaded AirPod image:', airpodSrc);
        } else {
            console.log('[Authenticity] No AirPod image found in database, using fallback SVG');
        }
        
        // Set image sources (error handlers will catch 404s)
        caseImgEl.src = caseSrc;
        airpodImgEl.src = airpodSrc;
        
        // Update alt text
        caseImgEl.alt = images.caseImage 
            ? 'Example charging case showing markings' 
            : 'Generic case markings diagram';
        airpodImgEl.alt = images.airpodImage 
            ? 'Example AirPod showing markings' 
            : 'Generic AirPod markings diagram';
        
        console.log('[Authenticity] Set images:', { caseSrc, airpodSrc });
    } catch (err) {
        console.error('[Authenticity] Fetch error:', err);
        // Hard fallback to SVGs
        caseImgEl.src = FALLBACK_CASE_SVG;
        airpodImgEl.src = FALLBACK_AIRPOD_SVG;
    }
}

// Verification step state
let verificationState = {
    currentStep: 1,
    totalSteps: 4,
    completedSteps: new Set(),
    listenersAttached: false
};

// Initialize step-by-step verification flow
function initializeVerificationSteps() {
    // Reset state
    verificationState.currentStep = 1;
    verificationState.completedSteps.clear();
    verificationState.listenersAttached = false;
    
    // Reset all checkboxes
    const allCheckboxes = ['verifyCompatibility', 'verifyAuthenticity', 'verifyCondition', 'verifyReady'];
    allCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = false;
    });
    
    // Disable continue button initially
    const continueBtn = document.getElementById('continueBtn1');
    if (continueBtn) continueBtn.disabled = true;
    
    // Update step counter
    const currentStepEl = document.getElementById('currentVerificationStep');
    const totalStepsEl = document.getElementById('totalVerificationSteps');
    if (currentStepEl) currentStepEl.textContent = verificationState.currentStep;
    if (totalStepsEl) totalStepsEl.textContent = verificationState.totalSteps;
    
    // Show first step
    showVerificationStep(1);
    
    // Setup checkbox handlers
    const checkboxes = {
        1: document.getElementById('verifyCompatibility'),
        2: document.getElementById('verifyAuthenticity'),
        3: document.getElementById('verifyCondition'),
        4: document.getElementById('verifyReady')
    };
    
    // Handle checkbox changes
    if (!verificationState.listenersAttached) {
        Object.keys(checkboxes).forEach(stepNum => {
            const checkbox = checkboxes[stepNum];
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    const stepNumber = parseInt(stepNum);
                    if (this.checked) {
                        verificationState.completedSteps.add(stepNumber);
                        
                        // Auto-advance to next step after a short delay
                        setTimeout(() => {
                            if (verificationState.currentStep < verificationState.totalSteps) {
                                verificationState.currentStep++;
                                showVerificationStep(verificationState.currentStep);
                                if (currentStepEl) currentStepEl.textContent = verificationState.currentStep;
                            }
                            
                            // Enable continue button when all steps complete
                            if (verificationState.completedSteps.size === verificationState.totalSteps) {
                                const continueBtn = document.getElementById('continueBtn1');
                                if (continueBtn) {
                                    continueBtn.disabled = false;
                                }
                            }
                        }, 500);
                    } else {
                        verificationState.completedSteps.delete(stepNumber);
                        const continueBtn = document.getElementById('continueBtn1');
                        if (continueBtn) {
                            continueBtn.disabled = true;
                        }
                    }
                });
            }
        });
        verificationState.listenersAttached = true;
    }
}

// Show specific verification step
function showVerificationStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.verification-step').forEach(step => {
        step.style.display = 'none';
    });
    
    // Show current step with animation
    const currentStepEl = document.querySelector(`.verification-step[data-step="${stepNumber}"]`);
    if (currentStepEl) {
        currentStepEl.style.display = 'block';
        currentStepEl.style.animation = 'fadeIn 0.3s ease';
        
        // If showing step 1 and we have product data, ensure examples are displayed
        if (stepNumber === 1 && appState.productData) {
            const partModelNumber = appState.productData.part_model_number;
            const partType = appState.productData.part_type;
            if (partModelNumber) {
                console.log('Step 1 shown, re-displaying examples for:', partModelNumber);
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    displayCompatiblePartExamples(partModelNumber, partType);
                }, 100);
            }
        }
        
        // If showing step 2 (Authenticity Check), update images dynamically
        if (stepNumber === 2 && appState.productData) {
            const partModelNumber = appState.productData.part_model_number;
            const partType = appState.productData.part_type;
            if (partModelNumber) {
                console.log('[Authenticity] Step 2 shown, updating authenticity images for:', partModelNumber, partType);
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    updateAuthenticityImages(partModelNumber, partType);
                }, 100);
            } else {
                console.warn('[Authenticity] Step 2 shown but no part model number available');
            }
        }
    }
}

// Setup photo carousel for step 1
function setupPhotoCarouselForStep1(photoArray) {
    const carouselSection = document.getElementById('photoCarouselStep1');
    const carouselContainer = document.getElementById('carouselContainerStep1');
    const carouselIndicators = document.getElementById('carouselIndicatorsStep1');
    
    if (!carouselSection || !carouselContainer || !carouselIndicators) {
        return;
    }
    
    // Hide carousel if no photos
    if (photoArray.length === 0) {
        carouselSection.style.display = 'none';
        return;
    }
    
    // Show carousel
    carouselSection.style.display = 'block';
    
    // Clear existing content
    carouselContainer.innerHTML = '';
    carouselIndicators.innerHTML = '';
    
    // Add photos to carousel
    photoArray.forEach((photo, index) => {
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
        photoDiv.addEventListener('click', () => openModal(index, photoArray));
        carouselContainer.appendChild(photoDiv);
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator' + (index === 0 ? ' active' : '');
        indicator.dataset.index = index;
        indicator.addEventListener('click', () => scrollToPhotoStep1(index));
        carouselIndicators.appendChild(indicator);
    });
    
    // Setup carousel navigation
    const prevButton = document.getElementById('carouselPrevStep1');
    const nextButton = document.getElementById('carouselNextStep1');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => scrollCarouselStep1(-1));
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => scrollCarouselStep1(1));
    }
    
    // Update indicators and buttons on scroll
    if (carouselContainer) {
        carouselContainer.addEventListener('scroll', () => {
            updateActiveIndicatorStep1();
            updateCarouselButtonsStep1();
        });
    }
    
    // Update button states
    updateCarouselButtonsStep1();
}

// Carousel functions for step 1
function scrollCarouselStep1(direction) {
    const container = document.getElementById('carouselContainerStep1');
    if (!container) return;
    
    const photoWidth = 150 + 12;
    const scrollAmount = photoWidth * direction;
    
    container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
    
    setTimeout(() => {
        updateActiveIndicatorStep1();
    }, 300);
}

function scrollToPhotoStep1(index) {
    const container = document.getElementById('carouselContainerStep1');
    if (!container) return;
    
    const photoWidth = 150 + 12;
    container.scrollTo({
        left: photoWidth * index,
        behavior: 'smooth'
    });
    
    updateActiveIndicatorStep1(index);
}

function updateActiveIndicatorStep1(activeIndex) {
    const indicators = document.querySelectorAll('#carouselIndicatorsStep1 .carousel-indicator');
    const container = document.getElementById('carouselContainerStep1');
    
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

function updateCarouselButtonsStep1() {
    const prevButton = document.getElementById('carouselPrevStep1');
    const nextButton = document.getElementById('carouselNextStep1');
    const container = document.getElementById('carouselContainerStep1');
    
    if (!container) return;
    
    const isAtStart = container.scrollLeft <= 0;
    const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;
    
    if (prevButton) {
        prevButton.disabled = isAtStart;
    }
    if (nextButton) {
        nextButton.disabled = isAtEnd;
    }
}

// Display product info for review step (with photos)
function displayProductInfoForReview(data) {
    const partTypeMap = {
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'case': 'Charging Case'
    };
    const partType = partTypeMap[data.part_type] || data.part_type || 'Unknown';
    
    const detailsHtml = `
        <div class="product-detail-item">
            <span class="detail-label">Item:</span>
            <span class="detail-value">${partType}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Product Name:</span>
            <span class="detail-value">${data.generation || 'N/A'}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Product Code:</span>
            <span class="detail-value">${data.part_model_number || 'N/A'}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Serial Number:</span>
            <span class="detail-value">${data.serial_number || 'N/A'}</span>
        </div>
    `;
    
    const reviewContainer = document.getElementById('productDetailsReview');
    if (reviewContainer) {
        reviewContainer.innerHTML = detailsHtml;
    }
    
    // Setup photo carousel for review
    setupPhotoCarouselForReview(data.photos || []);
}

// Setup photo carousel for review step
function setupPhotoCarouselForReview(photoArray) {
    const carouselSection = document.getElementById('photoCarouselReview');
    const carouselContainer = document.getElementById('carouselContainerReview');
    const carouselIndicators = document.getElementById('carouselIndicatorsReview');
    
    if (!carouselSection || !carouselContainer || !carouselIndicators) {
        return;
    }
    
    // Hide carousel if no photos
    if (photoArray.length === 0) {
        carouselSection.style.display = 'none';
        return;
    }
    
    // Show carousel
    carouselSection.style.display = 'block';
    
    // Clear existing content
    carouselContainer.innerHTML = '';
    carouselIndicators.innerHTML = '';
    
    // Add photos to carousel
    photoArray.forEach((photo, index) => {
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
        photoDiv.addEventListener('click', () => openModal(index, photoArray));
        carouselContainer.appendChild(photoDiv);
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator' + (index === 0 ? ' active' : '');
        indicator.dataset.index = index;
        indicator.addEventListener('click', () => scrollToPhotoReview(index));
        carouselIndicators.appendChild(indicator);
    });
    
    // Setup carousel navigation
    const prevButton = document.getElementById('carouselPrevReview');
    const nextButton = document.getElementById('carouselNextReview');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => scrollCarouselReview(-1));
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => scrollCarouselReview(1));
    }
    
    // Update indicators and buttons on scroll
    if (carouselContainer) {
        carouselContainer.addEventListener('scroll', () => {
            updateActiveIndicatorReview();
            updateCarouselButtonsReview();
        });
    }
    
    // Update button states
    updateCarouselButtonsReview();
}

// Carousel functions for review
let currentReviewPhotoIndex = 0;
let reviewPhotos = [];

function scrollCarouselReview(direction) {
    const container = document.getElementById('carouselContainerReview');
    if (!container) return;
    
    const photoWidth = 150 + 12;
    const scrollAmount = photoWidth * direction;
    
    container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
    
    setTimeout(() => {
        updateActiveIndicatorReview();
    }, 300);
}

function scrollToPhotoReview(index) {
    const container = document.getElementById('carouselContainerReview');
    if (!container) return;
    
    const photoWidth = 150 + 12;
    container.scrollTo({
        left: photoWidth * index,
        behavior: 'smooth'
    });
    
    updateActiveIndicatorReview(index);
}

function updateActiveIndicatorReview(activeIndex) {
    const indicators = document.querySelectorAll('#carouselIndicatorsReview .carousel-indicator');
    const container = document.getElementById('carouselContainerReview');
    
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

function updateCarouselButtonsReview() {
    const prevButton = document.getElementById('carouselPrevReview');
    const nextButton = document.getElementById('carouselNextReview');
    const container = document.getElementById('carouselContainerReview');
    
    if (!container) return;
    
    const isAtStart = container.scrollLeft <= 0;
    const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;
    
    if (prevButton) {
        prevButton.disabled = isAtStart;
    }
    if (nextButton) {
        nextButton.disabled = isAtEnd;
    }
}

function openModal(index, photos) {
    currentReviewPhotoIndex = index;
    reviewPhotos = photos;
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalClose = document.getElementById('modalClose');
    
    if (!modal || !modalImage) return;
    
    const photo = photos[index];
    if (!photo) return;
    
    const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
    modalImage.src = photoPath;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Ensure close button is visible
    if (modalClose) {
        modalClose.style.display = 'flex';
        modalClose.style.visibility = 'visible';
        modalClose.style.opacity = '1';
    }
    
    // Update navigation button states
    updateModalNavigation();
}

// Setup image modal event listeners
function setupImageModalListeners() {
    const modal = document.getElementById('imageModal');
    const modalClose = document.getElementById('modalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    const modalOverlay = modal?.querySelector('.modal-overlay');
    
    // Close modal
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    // Close on overlay click (but not on content)
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            // Only close if clicking directly on overlay, not on content
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
    
    // Prevent modal content clicks from closing modal
    const modalContent = modal?.querySelector('.modal-content');
    if (modalContent) {
        modalContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Previous image
    if (modalPrev) {
        modalPrev.addEventListener('click', function(e) {
            e.stopPropagation();
            navigateModal(-1);
        });
    }
    
    // Next image
    if (modalNext) {
        modalNext.addEventListener('click', function(e) {
            e.stopPropagation();
            navigateModal(1);
        });
    }
    
    // Keyboard navigation (Escape to close, arrow keys to navigate)
    document.addEventListener('keydown', function(e) {
        if (modal && modal.style.display === 'block') {
            if (e.key === 'Escape') {
                closeModal();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateModal(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigateModal(1);
            }
        }
    });
}

// Close modal
function closeModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Navigate modal (prev/next)
function navigateModal(direction) {
    if (!reviewPhotos || reviewPhotos.length === 0) return;
    
    currentReviewPhotoIndex += direction;
    
    // Wrap around
    if (currentReviewPhotoIndex < 0) {
        currentReviewPhotoIndex = reviewPhotos.length - 1;
    } else if (currentReviewPhotoIndex >= reviewPhotos.length) {
        currentReviewPhotoIndex = 0;
    }
    
    // Update image
    const modalImage = document.getElementById('modalImage');
    if (modalImage && reviewPhotos[currentReviewPhotoIndex]) {
        const photo = reviewPhotos[currentReviewPhotoIndex];
        const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
        modalImage.src = photoPath;
    }
    
    // Update navigation button states
    updateModalNavigation();
}

// Update modal navigation button states
function updateModalNavigation() {
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    
    if (!reviewPhotos || reviewPhotos.length <= 1) {
        // Hide navigation if only one or no photos
        if (modalPrev) modalPrev.style.display = 'none';
        if (modalNext) modalNext.style.display = 'none';
    } else {
        // Show navigation buttons
        if (modalPrev) modalPrev.style.display = 'flex';
        if (modalNext) modalNext.style.display = 'flex';
    }
}

// Display product info (for warranty confirmation step)
function displayProductInfo(data) {
    const partTypeMap = {
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'case': 'Charging Case'
    };
    const partType = partTypeMap[data.part_type] || data.part_type || 'Unknown';
    
    const detailsHtml = `
        <div class="product-detail-item">
            <span class="detail-label">Item:</span>
            <span class="detail-value">${partType}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Product Name:</span>
            <span class="detail-value">${data.generation || 'N/A'}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Product Code:</span>
            <span class="detail-value">${data.part_model_number || 'N/A'}</span>
        </div>
        <div class="product-detail-item">
            <span class="detail-label">Serial Number:</span>
            <span class="detail-value">${data.serial_number || 'N/A'}</span>
        </div>
    `;
    
    const displayContainer = document.getElementById('productDetailsDisplay');
    if (displayContainer) {
        displayContainer.innerHTML = detailsHtml;
    }
}

// Show step
function showStep(stepNumber) {
    console.log('showStep called with stepNumber:', stepNumber, 'currentStep:', appState.currentStep);
    console.trace('showStep call stack'); // This will show where it's being called from
    
    // Prevent auto-advance from step 1 to step 3 if product is being displayed
    if (stepNumber === 3 && appState.currentStep === 1) {
        const productDisplay = document.getElementById('productRecordDisplay');
        const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
        if (isProductDisplayed || appState.productData) {
            console.log('BLOCKED: Preventing auto-advance from step 1 to step 3 - product is displayed');
            console.log('Product display visible:', isProductDisplayed, 'Product data exists:', !!appState.productData);
            return; // Stay on step 1
        }
    }
    
    // Also prevent if we're on step 1 and have product data but haven't shown it yet
    if (stepNumber === 3 && appState.currentStep === 1 && appState.productData) {
        console.log('BLOCKED: Preventing step 3 - product data loaded but should stay on step 1');
        return;
    }
    
    // Hide all steps
    document.querySelectorAll('.step-container').forEach(step => {
        step.classList.remove('active');
        step.style.display = 'none'; // Ensure hidden
    });
    
    // Show current step
    const currentStep = document.getElementById(`step${stepNumber}`);
    if (currentStep) {
        currentStep.classList.add('active');
        currentStep.style.display = 'block'; // Force display
        appState.currentStep = stepNumber;
        saveState();
        updateProgressIndicator();
        
        console.log('Step', stepNumber, 'is now active and visible');
        
        // Track step view
        trackEvent('step_viewed', { step: stepNumber });
        
        // Enable/disable navigation locking
        // Lock navigation from step 2 onwards (or step 1 if not skipped)
        const lockStartStep = appState.skippedStep1 ? 2 : 1;
        if (stepNumber >= lockStartStep && stepNumber < appState.totalSteps) {
            enableNavigationLock();
            enableFocusOverlay();
        } else {
            disableNavigationLock();
            disableFocusOverlay();
        }
        
        // Start countdown timer on warranty step
        if (stepNumber === 5) {
            setTimeout(() => startCountdownTimer(), 100);
        }
        
        // Auto-dismiss keyboard on mobile
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        console.error('Step container not found for step', stepNumber);
    }
}

// Update progress indicator
function updateProgressIndicator() {
    const progressIndicator = document.getElementById('progressIndicator');
    const progressSteps = document.getElementById('progressSteps');
    const progressText = document.getElementById('progressText');
    
    // Show progress indicator if on step 1 with product displayed, or step 2+
    const productDisplay = document.getElementById('productRecordDisplay');
    const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
    const shouldShowProgress = appState.currentStep > 1 || (appState.currentStep === 1 && isProductDisplayed) || appState.skippedStep1;
    
    if (shouldShowProgress) {
        progressIndicator.style.display = 'block';
        
        // Create progress steps (adjust if step 1 was skipped)
        progressSteps.innerHTML = '';
        const startStep = appState.skippedStep1 ? 2 : 1;
        const displaySteps = appState.skippedStep1 ? appState.totalSteps - 1 : appState.totalSteps;
        
        for (let i = startStep; i <= appState.totalSteps; i++) {
            const step = document.createElement('div');
            step.className = 'progress-step';
            if (i < appState.currentStep) {
                step.classList.add('completed');
            } else if (i === appState.currentStep) {
                step.classList.add('active');
            }
            progressSteps.appendChild(step);
        }
        
        // Adjust step number display if step 1 was skipped
        // When step 1 is skipped: Step 2 becomes "Step 1 of 5", Step 3 becomes "Step 2 of 5", etc.
        const displayStep = appState.skippedStep1 ? appState.currentStep - 1 : appState.currentStep;
        const displayTotal = appState.skippedStep1 ? appState.totalSteps - 1 : appState.totalSteps;
        progressText.textContent = `Step ${displayStep} of ${displayTotal}`;
    } else {
        progressIndicator.style.display = 'none';
    }
}

// Setup navigation locking
function setupNavigationLocking() {
    // Disable header nav links during activation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const lockStartStep = appState.skippedStep1 ? 2 : 1;
            if (appState.currentStep >= lockStartStep && appState.currentStep < appState.totalSteps) {
                e.preventDefault();
                showExitWarning();
            }
        });
    });
    
    // Prevent back button
    window.history.pushState(null, '', window.location.href);
    window.onpopstate = function() {
        const lockStartStep = appState.skippedStep1 ? 2 : 1;
        if (appState.currentStep >= lockStartStep && appState.currentStep < appState.totalSteps) {
            showExitWarning();
            window.history.pushState(null, '', window.location.href);
        }
    };
}

// Enable navigation lock
function enableNavigationLock() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.add('disabled-nav');
    });
}

// Disable navigation lock
function disableNavigationLock() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('disabled-nav');
    });
}

// Enable focus overlay
function enableFocusOverlay() {
    document.getElementById('focusOverlay').classList.add('active');
}

// Disable focus overlay
function disableFocusOverlay() {
    document.getElementById('focusOverlay').classList.remove('active');
}

// Show exit warning
function showExitWarning() {
    if (!appState.exitIntentShown) {
        document.getElementById('exitModal').classList.add('show');
        appState.exitIntentShown = true;
        trackEvent('exit_intent_shown');
    }
}

// Setup exit intent detection
function setupExitIntent() {
    let exitIntentTriggered = false;
    
    // Mouse movement toward top of page
    document.addEventListener('mousemove', function(e) {
        const lockStartStep = appState.skippedStep1 ? 2 : 1;
        if (e.clientY < 50 && appState.currentStep >= lockStartStep && appState.currentStep < appState.totalSteps) {
            if (!exitIntentTriggered && !appState.exitIntentShown) {
                exitIntentTriggered = true;
                showExitWarning();
            }
        }
    });
    
    // Exit modal buttons
    document.getElementById('stayButton')?.addEventListener('click', function() {
        document.getElementById('exitModal').classList.remove('show');
        trackEvent('exit_intent_stayed');
    });
    
    document.getElementById('leaveButton')?.addEventListener('click', function() {
        // Capture email for follow-up
        const email = prompt('Please enter your email for follow-up:');
        if (email) {
            trackEvent('exit_intent_left', { email: email });
            // Save email for follow-up
            localStorage.setItem('exitIntentEmail', email);
        }
        document.getElementById('exitModal').classList.remove('show');
        window.location.href = 'index.html';
    });
}

// Start countdown timer
let countdownTimer = null;
function startCountdownTimer() {
    // Clear existing timer if any
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
    
    let timeLeft = 15 * 60; // 15 minutes in seconds
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (!timerDisplay) return;
    
    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            timerDisplay.textContent = '00:00';
            countdownTimer = null;
        }
        timeLeft--;
    };
    
    updateTimer(); // Initial update
    countdownTimer = setInterval(updateTimer, 1000);
}

// Show last chance popup
function showLastChancePopup() {
    const popup = document.createElement('div');
    popup.className = 'exit-modal-content';
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.zIndex = '10001';
    popup.innerHTML = `
        <h3>Last Chance!</h3>
        <p>Protect your AirPods for just $7.99 (3 months)</p>
        <div class="exit-modal-buttons">
            <button class="btn btn-primary" id="acceptLastChance">Add Protection</button>
            <button class="btn btn-secondary" id="declineLastChance">No Thanks</button>
        </div>
    `;
    document.body.appendChild(popup);
    
    document.getElementById('acceptLastChance').addEventListener('click', () => {
        appState.selectedWarranty = '3month';
        trackEvent('last_chance_accepted');
        popup.remove();
        showStep(5);
    });
    
    document.getElementById('declineLastChance').addEventListener('click', () => {
        trackEvent('last_chance_declined');
        popup.remove();
    });
}

// Finish setup
function finishSetup() {
    trackEvent('setup_completed', {
        warranty: appState.selectedWarranty,
        accessories: appState.selectedAccessories,
        timeSpent: Math.round((Date.now() - appState.sessionStartTime) / 1000)
    });
    
    // Clear saved state
    localStorage.removeItem('warrantyRegistrationState');
    
    // Redirect to confirmation or next page
    alert('Setup completed! Thank you for registering your warranty.');
    // window.location.href = 'confirmation.html';
}

// Prevent clicking outside active section
document.addEventListener('click', function(e) {
    const lockStartStep = appState.skippedStep1 ? 2 : 1;
    if (appState.currentStep >= lockStartStep && appState.currentStep < appState.totalSteps) {
        const activeSection = document.querySelector('.step-container.active');
        if (activeSection && !activeSection.contains(e.target) && !e.target.closest('.header') && !e.target.closest('.progress-indicator')) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
});

// Mobile swipe gestures (forward only)
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    // Swipe left (forward)
    if (diff > swipeThreshold && appState.currentStep < appState.totalSteps) {
        // Only allow swipe if current step is complete
        if (canAdvanceStep()) {
            showStep(appState.currentStep + 1);
        }
    }
}

function canAdvanceStep() {
    // Add logic to check if current step can be advanced
    return true;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
