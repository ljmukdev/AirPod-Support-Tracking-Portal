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
    addonSalesData: [], // Store addon sales data for basket calculations
    setupStepsCompleted: [],
    exitIntentShown: false,
    sessionStartTime: Date.now(),
    skippedStep1: false, // Track if step 1 was skipped (coming from home page)
    airpodExamples: null, // Store loaded example images database
    termsVersion: null, // Current T&Cs version
    termsAccepted: false // T&Cs acceptance status
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
    
    // Immediately check URL for barcode
    const urlParams = new URLSearchParams(window.location.search);
    const barcodeFromUrl = urlParams.get('barcode');
    const paymentSuccess = urlParams.get('payment') === 'success';
    // GoCardless returns redirect_flow_id in the URL after redirect
    const redirectFlowId = urlParams.get('redirect_flow_id') || sessionStorage.getItem('gocardless_redirect_flow_id');
    
    console.log('Barcode from URL:', barcodeFromUrl);
    console.log('Payment success:', paymentSuccess);
    console.log('Redirect flow ID:', redirectFlowId);
    
    // Handle GoCardless payment success redirect
    if (paymentSuccess && redirectFlowId) {
        console.log('[Payment] Detected payment success redirect, handling...');
        handleGoCardlessPaymentSuccess(redirectFlowId);
        return; // Don't continue with normal initialization
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
                    // Update progress indicator now that product is displayed
                    updateProgressIndicator();
                    const continueBtn = document.getElementById('continueBtn1');
                    if (continueBtn) {
                        // Hide button - workflow will auto-progress when verification is complete
                        continueBtn.style.display = 'none';
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
                
                // Show progress indicator immediately when coming from home page
                updateProgressIndicator();
                
                // Ensure we're on step 1 first
                showStep(1);
                
                // Load product info and display on step 1
                loadProductInfo(barcode, true).then((data) => {
                    console.log('Product info loaded successfully:', data);
                    // Ensure we're still on step 1
                    showStep(1);
                    
                    displayProductInfoOnStep1(data);
                    // Show product record display
                    const productDisplay = document.getElementById('productRecordDisplay');
                    if (productDisplay) {
                        productDisplay.style.display = 'block';
                        console.log('Product display shown');
                    } else {
                        console.error('Product display element not found!');
                    }
                    // Update progress indicator now that product is displayed
                    updateProgressIndicator();
                    // Enable continue button
                    const continueBtn = document.getElementById('continueBtn1');
                    if (continueBtn) {
                        // Hide button - workflow will auto-progress when verification is complete
                        continueBtn.style.display = 'none';
                    }
                }).catch((error) => {
                    console.error('Failed to load product info:', error);
                    // Show error to user
                    showError(error.message || 'Failed to load product information. Please try again.');
                    // Show step 1 with security code entry as fallback
                    showStep(1);
                    const securityCodeEntry = document.getElementById('securityCodeEntrySection');
                    if (securityCodeEntry) {
                        securityCodeEntry.style.display = 'block';
                    }
                    const continueBtn = document.getElementById('continueBtn1');
                    if (continueBtn) {
                        continueBtn.style.display = 'block';
                        continueBtn.disabled = false;
                    }
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
                    showStep(2); // Go to step 2 (Contact Info)
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
        const continueBtn = document.getElementById('continueBtn1');
        
        // Check if all verification steps are completed - if so, auto-progression should have already happened
        // But handle manual click just in case
        if (verificationState && verificationState.completedSteps && verificationState.completedSteps.size === verificationState.totalSteps && appState.productData) {
            console.log('[Continue] All verification steps complete, going to contact details');
            showStep(2, true); // Force navigation to step 2 (Contact Info)
            return;
        }
        
        // Check if product record is displayed on step 1
        const productDisplay = document.getElementById('productRecordDisplay');
        const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
        
        // If product is displayed but verification not complete, don't allow manual progression
        // User must complete verification questions which will auto-progress
        if (isProductDisplayed && appState.productData) {
            console.log('[Continue] Product displayed but verification not complete - user must complete verification questions');
            return; // Don't allow manual progression - verification questions will guide them
        } else {
            // Otherwise validate security code (initial entry)
            validateSecurityCode();
        }
    });
    document.getElementById('continueBtn2')?.addEventListener('click', handleContactDetailsSubmit);
    document.getElementById('continueBtn3')?.addEventListener('click', () => {
        // Setup instructions complete, go to warranty confirmation
        showStep(4);
    });
    document.getElementById('continueBtn4')?.addEventListener('click', () => {
        // Warranty confirmed, go to extended warranty upsell
        trackEvent('warranty_confirmed');
        showStep(5);
    });
    document.getElementById('skipWarrantyStep4')?.addEventListener('click', (e) => {
        e.preventDefault();
        trackEvent('warranty_skipped', { step: 4 });
        // Skip to accessories step (step 6)
        showStep(6);
    });
    document.getElementById('continueBtn5')?.addEventListener('click', () => {
        trackEvent('warranty_selected', { plan: appState.selectedWarranty });
        showStep(6);
    });
    document.getElementById('continueBtn6')?.addEventListener('click', () => {
        trackEvent('accessories_selected', { items: appState.selectedAccessories });
        showStep(7); // Go to Stripe payment
    });
    document.getElementById('continueBtn7')?.addEventListener('click', finishSetup);
    
    // Back button from payment page
    document.getElementById('backFromPaymentBtn')?.addEventListener('click', () => {
        // Go back to step 6 (accessories) if there are accessories, otherwise step 5 (warranty)
        if (appState.selectedAccessories && appState.selectedAccessories.length > 0) {
            showStep(6);
        } else {
            showStep(5);
        }
    });
    
    // Reconditioning form submission - attach listener when form exists (will be set up when form is shown)
    
    // Warranty selection
    document.querySelectorAll('.warranty-card').forEach(card => {
        card.addEventListener('click', function() {
            if (this.classList.contains('grayed-out')) return;
            document.querySelectorAll('.warranty-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            appState.selectedWarranty = this.dataset.plan;
            updateBasketDisplay(); // Update basket when warranty is selected
            saveState();
        });
    });
    
    // Skip warranty
    document.getElementById('skipWarranty')?.addEventListener('click', (e) => {
        e.preventDefault();
        appState.selectedWarranty = 'none';
        updateBasketDisplay(); // Update basket when warranty is skipped
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

// Load product information from API
async function loadProductInfo(securityCode, skipValidation = false) {
    try {
        console.log('Loading product info for barcode:', securityCode);
        const response = await fetch(`${API_BASE}/api/verify-barcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ security_barcode: securityCode })
        });
        
        console.log('API response status:', response.status);
        const data = await response.json();
        console.log('API response data:', data);
        console.log('API response part_name:', data.part_name);
        console.log('API response part_model_number:', data.part_model_number);
        
        if (response.ok && data.success) {
            // Store product data (include all fields from API including part_name)
            appState.productData = {
                part_type: data.part_type,
                serial_number: data.serial_number,
                generation: data.generation,
                part_model_number: data.part_model_number,
                part_name: data.part_name || null, // Include part_name from API
                photos: data.photos || [],
                ebay_order_number: data.ebay_order_number || null,
                date_added: data.date_added,
                notes: data.notes || null,
                associated_parts: data.associated_parts || []
            };
            console.log('[Load Product Info] Stored product data with part_name:', appState.productData.part_name);
            
            if (!skipValidation) {
                appState.securityCode = securityCode;
                appState.failedAttempts = 0;
                sessionStorage.setItem('securityBarcode', securityCode);
                saveState();
            }
            
            return Promise.resolve(appState.productData);
        } else {
            return Promise.reject(new Error(data.error || 'Failed to load product information'));
        }
    } catch (error) {
        console.error('Error loading product info:', error);
        return Promise.reject(error);
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
            
            // Show progress indicator immediately after security code is entered
            updateProgressIndicator();
            
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
                // Update progress indicator now that product is displayed
                updateProgressIndicator();
                // Hide continue button during verification - workflow will auto-progress when verification is complete
                // Button will remain hidden until verification completes, then auto-progresses to Contact Information
                continueBtn.style.display = 'none';
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
    
    // Check T&Cs acceptance
    const termsAccepted = document.getElementById('termsAccepted')?.checked;
    if (!termsAccepted) {
        alert('You must accept the Terms & Conditions to continue');
        return;
    }
    
    // Save contact details
    appState.contactDetails = { name, email, phone };
    appState.termsAccepted = true;
    saveState();
    
    // Register warranty with contact details
    // After registration, go to step 3 (Setup Instructions)
    registerWarranty().then(() => {
            // Go to Setup Instructions (step 3)
            showStep(3);
    }).catch((error) => {
        console.error('Failed to register warranty:', error);
        alert('Failed to register warranty. Please try again.');
    });
}

// Format Terms & Conditions content with proper headings, font sizes, and professional styling
function formatTermsContent(content) {
    if (!content) return '';
    
    // Split into lines and format
    const lines = content.split('\n');
    const formattedLines = [];
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
            formattedLines.push('');
            return;
        }
        
        // Check if line is a main heading (all caps, ends with colon, or specific patterns)
        if (trimmed.match(/^[A-Z\s]{5,}:?$/) && trimmed.length < 50) {
            formattedLines.push(`<h4 style="font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 20px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">${trimmed.replace(':', '')}</h4>`);
            return;
        }
        
        // Check if line starts with a number followed by a period (section heading)
        if (trimmed.match(/^\d+\.\s+[A-Z]/)) {
            const match = trimmed.match(/^(\d+\.\s+)(.+)$/);
            if (match) {
                formattedLines.push(`<h5 style="font-size: 0.95rem; font-weight: 600; color: #284064; margin: 16px 0 6px 0;">${match[1]}${match[2]}</h5>`);
                return;
            }
        }
        
        // Check if line starts with a letter followed by a period (sub-section)
        if (trimmed.match(/^[a-z]\)\s+[A-Z]/i)) {
            const match = trimmed.match(/^([a-z]\)\s+)(.+)$/i);
            if (match) {
                formattedLines.push(`<p style="font-size: 0.9rem; font-weight: 500; color: #1a1a1a; margin: 10px 0 4px 20px;">${match[1]}${match[2]}</p>`);
                return;
            }
        }
        
        // Check if line starts with a dash or bullet
        if (trimmed.match(/^[-•]\s+/)) {
            formattedLines.push(`<p style="font-size: 0.85rem; color: #6c757d; margin: 6px 0 4px 20px; line-height: 1.6;">${trimmed}</p>`);
            return;
        }
        
        // Regular paragraph text
        const capitalized = trimmed.replace(/^([a-z])/, (match, letter) => letter.toUpperCase());
        formattedLines.push(`<p style="font-size: 0.9rem; color: #1a1a1a; margin: 8px 0; line-height: 1.7;">${capitalized}</p>`);
    });
    
    return formattedLines.join('');
}

// Load Terms & Conditions
async function loadTermsAndConditions() {
    try {
        const response = await fetch(`${API_BASE}/api/warranty-terms/current`);
        if (response.ok) {
            const data = await response.json();
            const termsContentEl = document.getElementById('termsContent');
            const termsVersionEl = document.getElementById('termsVersion');
            const termsAcceptedEl = document.getElementById('termsAccepted');
            
            if (termsContentEl) {
                const content = data.content || 'No terms and conditions available.';
                // Format the terms content with proper headings, font sizes, and styling
                const formattedContent = formatTermsContent(content);
                termsContentEl.innerHTML = formattedContent;
            }
            
            if (termsVersionEl) {
                termsVersionEl.textContent = data.version || '1';
            }
            
            // Store version in appState
            appState.termsVersion = data.version || 1;
            
            // Reset acceptance checkbox
            if (termsAcceptedEl) {
                termsAcceptedEl.checked = false;
            }
            
            console.log('[T&Cs] Loaded version', data.version);
        } else {
            console.error('[T&Cs] Failed to load terms');
            const termsContentEl = document.getElementById('termsContent');
            if (termsContentEl) {
                termsContentEl.textContent = 'Unable to load terms and conditions. Please try again later.';
            }
        }
    } catch (error) {
        console.error('[T&Cs] Error loading terms:', error);
        const termsContentEl = document.getElementById('termsContent');
        if (termsContentEl) {
            termsContentEl.textContent = 'Unable to load terms and conditions. Please try again later.';
        }
    }
}

// Load warranty pricing and display lowest price in step 4
async function loadAndDisplayLowestWarrantyPrice() {
    try {
        const response = await fetch(`${API_BASE}/api/warranty/pricing`);
        if (response.ok) {
            const pricing = await response.json();
            
            // Find the lowest price and corresponding plan from enabled options
            let lowestPrice = null;
            let lowestPlan = null;
            
            for (const [plan, price] of Object.entries(pricing)) {
                if (typeof price === 'number' && price > 0) {
                    if (lowestPrice === null || price < lowestPrice) {
                        lowestPrice = price;
                        lowestPlan = plan;
                    }
                }
            }
            
            // Fallback to default if no pricing found
            if (lowestPrice === null) {
                lowestPrice = 19.99;
                lowestPlan = '6months';
            }
            
            // Determine months text
            let months = '6 months';
            if (lowestPlan === '3months') months = '3 months';
            else if (lowestPlan === '6months') months = '6 months';
            else if (lowestPlan === '12months') months = '12 months';
            
            // Update the price display elements
            const priceElement = document.getElementById('lowestWarrantyPrice');
            const monthsElement = document.getElementById('lowestWarrantyMonths');
            
            if (priceElement) {
                priceElement.textContent = `£${lowestPrice.toFixed(2)}`;
            }
            if (monthsElement) {
                monthsElement.textContent = months;
            }
            
            console.log('[Warranty Pricing] Loaded lowest price:', lowestPrice, 'for', months);
        } else {
            console.warn('[Warranty Pricing] Failed to load pricing, using default');
            updatePriceDisplay(19.99, '6 months');
        }
    } catch (error) {
        console.error('[Warranty Pricing] Error loading pricing:', error);
        updatePriceDisplay(19.99, '6 months');
    }
}

// Helper function to update price display
function updatePriceDisplay(price, months) {
    const priceElement = document.getElementById('lowestWarrantyPrice');
    const monthsElement = document.getElementById('lowestWarrantyMonths');
    
    if (priceElement) {
        priceElement.textContent = `£${price.toFixed(2)}`;
    }
    if (monthsElement) {
        monthsElement.textContent = months;
    }
}

// Load and display warranty options dynamically in step 5
async function loadAndDisplayWarrantyOptions() {
    try {
        const response = await fetch(`${API_BASE}/api/warranty/pricing`);
        if (!response.ok) {
            console.warn('[Warranty Options] Failed to load pricing, using defaults');
            return;
        }
        
        const pricing = await response.json();
        console.log('[Warranty Options] Loaded pricing:', pricing);
        
        // Map of plan keys to HTML elements and display names
        const planMapping = {
            '3months': {
                cardId: 'warranty3Month',
                planId: '3month',
                title: '3-Month Protection',
                badge: null,
                badgeStyle: null
            },
            '6months': {
                cardId: 'warranty6Month',
                planId: '6month',
                title: '6-Month Protection',
                badge: 'Most Popular',
                badgeStyle: null
            },
            '12months': {
                cardId: 'warranty12Month',
                planId: '12month',
                title: '12-Month Protection',
                badge: 'Best Value',
                badgeStyle: 'background: #ffc107; color: #856404;'
            }
        };
        
        // Hide all warranty cards first
        Object.values(planMapping).forEach(plan => {
            const card = document.getElementById(plan.cardId);
            if (card) {
                card.style.display = 'none';
            }
        });
        
        // Show and update enabled warranty options
        let firstEnabledCard = null;
        let lowestPrice = Infinity;
        let lowestPricePlan = null;
        
        for (const [planKey, price] of Object.entries(pricing)) {
            if (typeof price === 'number' && price > 0 && planMapping[planKey]) {
                const plan = planMapping[planKey];
                const card = document.getElementById(plan.cardId);
                
                if (card) {
                    // Show the card
                    card.style.display = 'block';
                    card.setAttribute('data-plan', plan.planId);
                    card.classList.remove('grayed-out');
                    
                    // Update price
                    const priceElement = card.querySelector('.warranty-price');
                    if (priceElement) {
                        priceElement.textContent = `£${price.toFixed(2)}`;
                        priceElement.style.color = ''; // Remove any red color
                    }
                    
                    // Calculate and update monthly price
                    const detailsElement = card.querySelector('.warranty-details');
                    if (detailsElement) {
                        const months = parseInt(planKey.replace('months', ''));
                        const monthlyPrice = (price / months).toFixed(2);
                        
                        // For 12-month, show savings if applicable
                        if (planKey === '12months' && pricing['6months']) {
                            const savings = ((pricing['6months'] * 2 - price) / (pricing['6months'] * 2) * 100).toFixed(0);
                            detailsElement.textContent = `Save ${savings}% • £${monthlyPrice}/month`;
                        } else {
                            detailsElement.textContent = `£${monthlyPrice}/month`;
                        }
                    }
                    
                    // Update title
                    const titleElement = card.querySelector('h3');
                    if (titleElement) {
                        titleElement.textContent = plan.title;
                    }
                    
                    // Update badge if exists
                    let badgeElement = card.querySelector('.warranty-badge');
                    if (plan.badge) {
                        if (!badgeElement) {
                            badgeElement = document.createElement('div');
                            badgeElement.className = 'warranty-badge';
                            card.insertBefore(badgeElement, card.firstChild);
                        }
                        badgeElement.textContent = plan.badge;
                        if (plan.badgeStyle) {
                            badgeElement.setAttribute('style', plan.badgeStyle);
                        } else {
                            badgeElement.removeAttribute('style');
                        }
                    } else if (badgeElement) {
                        badgeElement.remove();
                    }
                    
                    // Track first enabled card and lowest price
                    if (!firstEnabledCard) {
                        firstEnabledCard = card;
                    }
                    if (price < lowestPrice) {
                        lowestPrice = price;
                        lowestPricePlan = card;
                    }
                }
            }
        }
        
        // If no cards are enabled, show default 6-month option
        if (!firstEnabledCard) {
            const defaultCard = document.getElementById('warranty6Month');
            if (defaultCard) {
                defaultCard.style.display = 'block';
                firstEnabledCard = defaultCard;
            }
        }
        
        // Select the first enabled card (or lowest price if preferred)
        if (firstEnabledCard) {
            // Remove selected class from all cards
            document.querySelectorAll('.warranty-card').forEach(c => c.classList.remove('selected'));
            // Select the first enabled card
            firstEnabledCard.classList.add('selected');
            appState.selectedWarranty = firstEnabledCard.getAttribute('data-plan') || '6month';
            saveState();
        }
        
        console.log('[Warranty Options] Updated warranty cards with dynamic pricing');
    } catch (error) {
        console.error('[Warranty Options] Error loading warranty options:', error);
    }
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
                marketing_consent: false,
                terms_version: appState.termsVersion,
                terms_accepted: true
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
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

// Get compatible part numbers based on part model number and type
function getCompatiblePartNumbers(partModelNumber, partType) {
    if (!partModelNumber || !partType) {
        return [];
    }
    
    // Common compatible part mappings
    // Case parts need Left and Right AirPods
    if (partType === 'case') {
        // For AirPods Pro 2nd Gen case (A2700), compatible parts are Left (A2699) and Right (A2698)
        if (partModelNumber === 'A2700' || partModelNumber.includes('2700')) {
            return ['Left AirPod (A2699)', 'Right AirPod (A2698)'];
        }
        // Generic case - return generic compatible parts
        return ['Left AirPod', 'Right AirPod'];
    }
    
    // Left AirPod needs Right AirPod and Case
    if (partType === 'left') {
        // For AirPods Pro 2nd Gen Left (A3047), compatible parts are Right (A3048) and Case (A2968)
        if (partModelNumber === 'A3047') {
            return ['A3048', 'A2968'];
        }
        // For AirPods Pro 2nd Gen Left (A2699), compatible parts are Right (A2698) and Case (A2700)
        if (partModelNumber === 'A2699') {
            return ['A2698', 'A2700'];
        }
        // Generic left - return generic compatible parts
        return ['Right AirPod', 'Case'];
    }
    
    // Right AirPod needs Left AirPod and Case
    if (partType === 'right') {
        // For AirPods Pro 2nd Gen Right (A3048), compatible parts are Left (A3047) and Case (A2968)
        if (partModelNumber === 'A3048') {
            return ['A3047', 'A2968'];
        }
        // For AirPods Pro 2nd Gen Right (A2698), compatible parts are Left (A2699) and Case (A2700)
        if (partModelNumber === 'A2698') {
            return ['A2699', 'A2700'];
        }
        // Generic right - return generic compatible parts
        return ['Left AirPod', 'Case'];
    }
    
    // Fallback
    return [];
}

// Display product info on step 1
function displayProductInfoOnStep1(data) {
    appState.productData = data;
    const partModelNumber = data.part_model_number || '';
    const partName = data.part_name || '';

    console.log('[Display Product Info] Data received:', {
        part_model_number: partModelNumber,
        part_name: partName,
        full_data: data
    });

    // Display eBay order number if available
    const ebayOrderEl = document.getElementById('ebayOrderNumberDisplay');
    if (ebayOrderEl && data.ebay_order_number) {
        ebayOrderEl.textContent = `eBay Order Number: ${data.ebay_order_number}`;
        ebayOrderEl.style.display = 'block';
    } else if (ebayOrderEl) {
        ebayOrderEl.style.display = 'none';
    }

    // Update purchased part number (will be updated with API data if available)
    const purchasedPartEl = document.getElementById('purchasedPartNumber');
    if (purchasedPartEl) {
        if (partName && partModelNumber) {
            const displayText = `${partName} (${partModelNumber})`;
            purchasedPartEl.textContent = displayText;
            console.log('[Display Product Info] Set purchased part text to:', displayText);
        } else if (partModelNumber) {
            purchasedPartEl.textContent = partModelNumber;
            console.log('[Display Product Info] Only model number available:', partModelNumber);
        } else {
            purchasedPartEl.textContent = 'your part';
            console.log('[Display Product Info] No part info available');
        }
    } else {
        console.warn('[Display Product Info] purchasedPartNumber element not found');
    }

    // Load and display compatible part examples (this will also update the message dynamically)
    console.log('=== DISPLAYING COMPATIBLE PART EXAMPLES ===');
    console.log('Part Model Number:', partModelNumber);
    console.log('Part Type:', data.part_type);
    console.log('Product Data:', data);
    console.log('Associated Parts from API:', data.associated_parts);

    // Use associated parts from API if available, otherwise fall back to hardcoded
    const compatiblePartsEl = document.getElementById('compatiblePartNumbers');
    if (compatiblePartsEl) {
        let compatiblePartsMessage = '';

        if (data.associated_parts && Array.isArray(data.associated_parts) && data.associated_parts.length > 0) {
            // Use dynamic associated parts from the database
            console.log('[Compatible Parts] Using associated parts from API:', data.associated_parts);
            const formatted = data.associated_parts.map(part => {
                const partTypeLabel = part.part_type === 'left' ? 'Left AirPod' :
                                    part.part_type === 'right' ? 'Right AirPod' : 'Case';
                return `${partTypeLabel} (${part.part_model_number})`;
            });
            compatiblePartsMessage = formatted.join(' & ');
        } else {
            // Fallback to hardcoded parts
            const compatibleParts = getCompatiblePartNumbers(partModelNumber, data.part_type);
            console.log('[Compatible Parts] Fallback compatible parts:', compatibleParts);

            // Format message with part numbers and names
            if (compatibleParts.length > 0) {
                // Check if we have part numbers (start with A and digits)
                const hasPartNumbers = compatibleParts.some(p => /^A\d+/.test(p));

                if (hasPartNumbers) {
                    // Format: "Part Name (PartNumber)"
                    // For A2968 (Right AirPod), compatible parts are A2699 (Left) and A2700 (Case)
                    const formatted = compatibleParts.map(partNum => {
                        if (/^A\d+/.test(partNum)) {
                            // Known part numbers - map to names
                            // A3047 is Left AirPod, A3048 is Right AirPod
                            if (partNum === 'A3047') {
                                return `Left AirPod (${partNum})`;
                            } else if (partNum === 'A3048') {
                                return `Right AirPod (${partNum})`;
                            } else if (partNum === 'A2699') {
                                return `Left AirPod (${partNum})`;
                            } else if (partNum === 'A2698') {
                                return `Right AirPod (${partNum})`;
                            } else if (partNum === 'A2968' || partNum === 'A2700' || partNum.includes('2700') || partNum.includes('2968')) {
                                return `Case (${partNum})`;
                            } else {
                                // For other AirPod part numbers, determine left/right based on purchased part type
                                if (data.part_type === 'right') {
                                    // Purchased right, compatible part must be left
                                    return `Left AirPod (${partNum})`;
                                } else if (data.part_type === 'left') {
                                    // Purchased left, compatible part must be right
                                    return `Right AirPod (${partNum})`;
                                } else {
                                    // Unknown, use generic
                                    return `AirPod (${partNum})`;
                                }
                            }
                        } else {
                            // Generic name (fallback like "Left AirPod" or "Charging Case")
                            return partNum;
                        }
                    });
                    compatiblePartsMessage = formatted.join(' & ');
                } else {
                    // Generic names only - use as is
                    compatiblePartsMessage = compatibleParts.join(' & ');
                }
            }
        }

        // Set the message
        if (compatiblePartsMessage) {
            compatiblePartsEl.textContent = compatiblePartsMessage;
        }
    }
    
    displayCompatiblePartExamples(partModelNumber, data.part_type).catch(err => {
        console.error('Error displaying examples:', err);
        // Message already set above as fallback
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
    
    // Load add-on sales for this product when product info is available
    if (data.generation && data.part_model_number) {
        loadAddonSalesForProduct(data.generation, data.part_model_number).catch(err => {
            console.error('Error loading add-on sales:', err);
        });
    }
}

// Load and display add-on sales for a product
async function loadAddonSalesForProduct(generation, partModelNumber) {
    console.log('[Add-On Sales] Loading add-on sales for generation:', generation, 'part_model_number:', partModelNumber);
    
    try {
        const params = new URLSearchParams();
        if (generation) params.append('generation', generation);
        if (partModelNumber) params.append('part_model_number', partModelNumber);
        
        const response = await fetch(`${API_BASE}/api/addon-sales?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Add-On Sales] API response:', data);
        
        if (data.addonSales && data.addonSales.length > 0) {
            displayAddonSales(data.addonSales);
        } else {
            // Hide add-on sales section if no add-ons available
            const addonSection = document.getElementById('addonSalesSection');
            if (addonSection) {
                addonSection.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('[Add-On Sales] Error loading add-on sales:', err);
        // Hide section on error
        const addonSection = document.getElementById('addonSalesSection');
        if (addonSection) {
            addonSection.style.display = 'none';
        }
    }
}

// Display add-on sales in step 6
function displayAddonSales(addonSales) {
    console.log('[Add-On Sales] Displaying', addonSales.length, 'add-on sales');
    
    // Store addon sales data globally for basket calculations
    appState.addonSalesData = addonSales;
    
    const grid = document.getElementById('addonSalesGrid');
    const pricingContainer = document.getElementById('addonSalesPricing');
    
    if (!grid) {
        console.error('[Add-On Sales] Grid container not found');
        return;
    }
    
    // Clear existing content
    grid.innerHTML = '';
    
    // Display each add-on sale
    addonSales.forEach((addon, index) => {
        const addonItem = document.createElement('div');
        addonItem.className = 'accessory-item';
        addonItem.dataset.item = addon.id;
        addonItem.dataset.addonId = addon.id;
        
        // Check if already selected
        const isSelected = appState.selectedAccessories.includes(addon.id);
        if (isSelected) {
            addonItem.classList.add('selected');
        }
        
        let imageHtml = '';
        if (addon.image) {
            const imagePath = addon.image.startsWith('/') ? addon.image : '/' + addon.image;
            imageHtml = `<img src="${imagePath}" alt="${addon.name}" style="width: 100%; max-width: 150px; height: auto; border-radius: 8px; margin-bottom: 8px;">`;
        }
        
        addonItem.innerHTML = `
            ${imageHtml}
            <h4>${escapeHtml(addon.name)}</h4>
            <div class="warranty-price" style="font-size: 1.25rem;">£${parseFloat(addon.price || 0).toFixed(2)}</div>
            ${addon.description ? `<p style="font-size: 0.85rem; color: #6c757d; margin-top: 4px;">${escapeHtml(addon.description)}</p>` : ''}
            ${isSelected ? '<div style="margin-top: 8px; color: #28a745; font-weight: 600; font-size: 0.9rem;">✓ Added to basket</div>' : ''}
        `;
        
        // Add click handler
        addonItem.addEventListener('click', function() {
            const wasSelected = this.classList.contains('selected');
            this.classList.toggle('selected');
            const addonId = this.dataset.addonId;
            
            if (this.classList.contains('selected')) {
                if (!appState.selectedAccessories.includes(addonId)) {
                    appState.selectedAccessories.push(addonId);
                }
                // Update visual feedback
                if (!this.querySelector('div[style*="color: #28a745"]')) {
                    const addedText = document.createElement('div');
                    addedText.style.cssText = 'margin-top: 8px; color: #28a745; font-weight: 600; font-size: 0.9rem;';
                    addedText.textContent = '✓ Added to basket';
                    this.appendChild(addedText);
                }
            } else {
                appState.selectedAccessories = appState.selectedAccessories.filter(id => id !== addonId);
                // Remove visual feedback
                const addedText = this.querySelector('div[style*="color: #28a745"]');
                if (addedText) {
                    addedText.remove();
                }
            }
            updateAddonSalesPricing(addonSales);
            updateBasketDisplay(); // Update basket display
            saveState();
        });
        
        grid.appendChild(addonItem);
    });
    
    // Calculate and display bundle pricing
    updateAddonSalesPricing(addonSales);
    
    // Show the section
    const addonSection = document.getElementById('addonSalesSection');
    if (addonSection) {
        addonSection.style.display = 'block';
    }
}

// Update add-on sales pricing display
function updateAddonSalesPricing(addonSales) {
    const pricingContainer = document.getElementById('addonSalesPricing');
    if (!pricingContainer) return;
    
    const selectedAddons = addonSales.filter(addon => appState.selectedAccessories.includes(addon.id));
    
    if (selectedAddons.length === 0) {
        pricingContainer.innerHTML = '';
        return;
    }
    
    const individualTotal = selectedAddons.reduce((sum, addon) => sum + parseFloat(addon.price || 0), 0);
    const bundlePrice = individualTotal * 0.8; // 20% discount for bundle
    const savings = individualTotal - bundlePrice;
    
    pricingContainer.innerHTML = `
        <div class="price-comparison">
            <span class="original-price">£${individualTotal.toFixed(2)}</span>
            <span class="bundle-price">£${bundlePrice.toFixed(2)}</span>
        </div>
        <p style="color: #6c757d; margin-top: 8px;">Save £${savings.toFixed(2)} when you buy the bundle</p>
    `;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load setup instructions from API
async function loadSetupInstructions(partModelNumber, generation) {
    console.log('[Setup Instructions] Loading instructions for:', { partModelNumber, generation });
    
    const setupStepsContainer = document.getElementById('setupSteps');
    if (!setupStepsContainer) {
        console.error('[Setup Instructions] Setup steps container not found');
        return;
    }
    
    if (!partModelNumber && !generation) {
        console.error('[Setup Instructions] No identifier provided (partModelNumber or generation)');
        return;
    }
    
    try {
        // Try to fetch by part_model_number first, then by generation
        let response;
        let identifier = partModelNumber;
        
        if (partModelNumber) {
            console.log('[Setup Instructions] Trying part_model_number:', partModelNumber);
            response = await fetch(`${API_BASE}/api/setup-instructions/${encodeURIComponent(partModelNumber)}`);
            
            // If not found and we have generation, try generation
            if (!response.ok && response.status === 404 && generation) {
                console.log('[Setup Instructions] Part-specific not found, trying generation:', generation);
                identifier = generation;
                response = await fetch(`${API_BASE}/api/setup-instructions/${encodeURIComponent(generation)}`);
            }
        } else if (generation) {
            console.log('[Setup Instructions] Trying generation:', generation);
            identifier = generation;
            response = await fetch(`${API_BASE}/api/setup-instructions/${encodeURIComponent(generation)}`);
        }
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('[Setup Instructions] No setup instructions found for:', identifier);
                // Keep default instructions if none found
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[Setup Instructions] Received data:', data);
        
        // The API returns 'instructions' array, not 'steps'
        if (!data.instructions || !Array.isArray(data.instructions) || data.instructions.length === 0) {
            console.warn('[Setup Instructions] No instructions found in response');
            return;
        }
        
        // Clear existing content
        setupStepsContainer.innerHTML = '';
        
        // Render each step - sort by step_number if available
        const sortedInstructions = [...data.instructions].sort((a, b) => {
            return (a.step_number || 0) - (b.step_number || 0);
        });
        
        sortedInstructions.forEach((step, index) => {
            const stepNum = step.step_number || (index + 1);
            const stepDiv = document.createElement('div');
            stepDiv.className = 'setup-step';
            stepDiv.dataset.stepNum = stepNum;
            if (index === 0) {
                stepDiv.classList.add('active');
            }
            
            // Use 'instruction' field, not 'description'
            // Add "Need help" option for every step
            const helpCheckboxHtml = `
                <div class="step-checkbox" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8ecf1;">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px;">
                        <input type="checkbox" data-step="${stepNum}" data-help="true" style="width: 20px; height: 20px; cursor: pointer;">
                        <span style="color: #856404; font-weight: 500;">I'm struggling with this step / I need help</span>
                    </label>
                </div>
            `;
            
            stepDiv.innerHTML = `
                <h3>${escapeHtml(step.title || `Step ${stepNum}`)}</h3>
                <p>${escapeHtml(step.instruction || '')}</p>
                <div class="step-checkbox">
                    <label>
                        <input type="checkbox" data-step="${stepNum}" data-completed="true">
                        <span>I've completed this step</span>
                    </label>
                </div>
                ${helpCheckboxHtml}
            `;
            
            setupStepsContainer.appendChild(stepDiv);
        });
        
        console.log('[Setup Instructions] Successfully loaded', sortedInstructions.length, 'steps');
        
        // Verify help checkboxes were added BEFORE setting up handlers
        const helpCheckboxesBefore = document.querySelectorAll('#setupSteps input[data-help="true"]');
        console.log('[Setup Instructions] Help checkboxes found BEFORE setupStepCheckboxes:', helpCheckboxesBefore.length, '(should be', sortedInstructions.length, ')');
        
        // Debug: Log the HTML structure of first step
        if (setupStepsContainer.children.length > 0) {
            const firstStep = setupStepsContainer.children[0];
            console.log('[Setup Instructions] First step HTML:', firstStep.innerHTML.substring(0, 500));
            const helpCheckboxInFirst = firstStep.querySelector('input[data-help="true"]');
            console.log('[Setup Instructions] Help checkbox in first step:', helpCheckboxInFirst ? 'FOUND' : 'NOT FOUND');
        }
        
        // Setup checkbox handlers for step progression
        setupStepCheckboxes();
        
        // Verify help checkboxes after setup
        const helpCheckboxesAfter = document.querySelectorAll('#setupSteps input[data-help="true"]');
        console.log('[Setup Instructions] Help checkboxes found AFTER setupStepCheckboxes:', helpCheckboxesAfter.length, '(should be', sortedInstructions.length, ')');
    } catch (error) {
        console.error('[Setup Instructions] Error loading instructions:', error);
        // Keep default instructions on error, but ensure event listeners are attached
        console.log('[Setup Instructions] Setting up event listeners for default instructions');
        setupStepCheckboxes();
    }
}

// Load payment summary for step 7
// Update basket display (can be called from anywhere)
function updateBasketDisplay() {
    // This function can be called to update any basket displays throughout the flow
    // Currently used to update payment summary when items are selected
    if (document.getElementById('step7') && document.getElementById('step7').style.display !== 'none') {
        loadPaymentSummary();
    }
}

function loadPaymentSummary() {
    console.log('[Payment] Loading payment summary');
    
    const paymentItemsContainer = document.getElementById('paymentItems');
    const paymentTotalEl = document.getElementById('paymentTotal');
    
    if (!paymentItemsContainer || !paymentTotalEl) {
        console.error('[Payment] Payment summary elements not found');
        return;
    }
    
    let total = 0;
    const items = [];
    
    // Add extended warranty if selected
    if (appState.selectedWarranty && appState.selectedWarranty !== 'none') {
        // Get warranty price from warranty options
        const warrantyCard = document.querySelector(`.warranty-card[data-plan="${appState.selectedWarranty}"]`);
        if (warrantyCard) {
            const priceText = warrantyCard.querySelector('.warranty-price')?.textContent || '£0.00';
            const price = parseFloat(priceText.replace(/[£,]/g, '')) || 0;
            if (price > 0) {
                const months = appState.selectedWarranty === '6month' ? '6' : appState.selectedWarranty === '12month' ? '12' : '3';
                items.push({
                    type: 'warranty',
                    id: appState.selectedWarranty,
                    name: `${months}-Month Extended Warranty`,
                    price: price
                });
                total += price;
            }
        }
    }
    
    // Add accessories if selected - use stored addon sales data
    if (appState.selectedAccessories && appState.selectedAccessories.length > 0 && appState.addonSalesData) {
        const selectedAddons = appState.addonSalesData.filter(addon => 
            appState.selectedAccessories.includes(addon.id)
        );
        
        selectedAddons.forEach(addon => {
            const price = parseFloat(addon.price || 0);
            items.push({
                type: 'addon',
                id: addon.id,
                name: escapeHtml(addon.name),
                price: price
            });
            total += price;
        });
    }
    
    // Render items with remove buttons
    paymentItemsContainer.innerHTML = '';
    
    if (items.length === 0) {
        paymentItemsContainer.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No items selected</p>';
    } else {
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e8ecf1;';
            itemDiv.dataset.itemType = item.type;
            itemDiv.dataset.itemId = item.id;
            itemDiv.innerHTML = `
                <div style="flex: 1;">
                    <span style="color: #1a1a1a;">${item.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #1a1a1a; font-weight: 500;">£${item.price.toFixed(2)}</span>
                    <button class="remove-item-btn" data-item-type="${item.type}" data-item-id="${item.id}" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s ease;" title="Remove item">
                        ✕
                    </button>
                </div>
            `;
            paymentItemsContainer.appendChild(itemDiv);
        });
        
        // Attach remove button handlers
        paymentItemsContainer.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const itemType = this.dataset.itemType;
                const itemId = this.dataset.itemId;
                removeItemFromBasket(itemType, itemId);
            });
        });
    }
    
    // Update total
    paymentTotalEl.textContent = `£${total.toFixed(2)}`;
    
    console.log('[Payment] Payment summary loaded:', { items, total });
}

// Remove item from basket
function removeItemFromBasket(itemType, itemId) {
    console.log('[Basket] Removing item:', itemType, itemId);
    
    if (itemType === 'warranty') {
        // Remove warranty
        appState.selectedWarranty = 'none';
        // Update warranty card selection
        document.querySelectorAll('.warranty-card').forEach(card => {
            card.classList.remove('selected');
        });
        // Update addon sales display if visible
        if (appState.addonSalesData && appState.addonSalesData.length > 0) {
            const addonItems = document.querySelectorAll('.accessory-item');
            addonItems.forEach(item => {
                const addonId = item.dataset.addonId;
                if (appState.selectedAccessories.includes(addonId)) {
                    item.classList.add('selected');
                    if (!item.querySelector('div[style*="color: #28a745"]')) {
                        const addedText = document.createElement('div');
                        addedText.style.cssText = 'margin-top: 8px; color: #28a745; font-weight: 600; font-size: 0.9rem;';
                        addedText.textContent = '✓ Added to basket';
                        item.appendChild(addedText);
                    }
                } else {
                    item.classList.remove('selected');
                    const addedText = item.querySelector('div[style*="color: #28a745"]');
                    if (addedText) {
                        addedText.remove();
                    }
                }
            });
        }
    } else if (itemType === 'addon') {
        // Remove addon
        appState.selectedAccessories = appState.selectedAccessories.filter(id => id !== itemId);
        // Update addon sales display if visible
        const addonItem = document.querySelector(`.accessory-item[data-addon-id="${itemId}"]`);
        if (addonItem) {
            addonItem.classList.remove('selected');
            const addedText = addonItem.querySelector('div[style*="color: #28a745"]');
            if (addedText) {
                addedText.remove();
            }
            // Update pricing display
            if (appState.addonSalesData) {
                updateAddonSalesPricing(appState.addonSalesData);
            }
        }
    }
    
    // Update basket display
    updateBasketDisplay();
    saveState();
    
    console.log('[Basket] Item removed. Updated state:', {
        warranty: appState.selectedWarranty,
        accessories: appState.selectedAccessories
    });
}

// Initialize Stripe payment
function initializeStripePayment() {
    console.log('[Payment] Initializing Stripe payment');
    
    // Set up Stripe Elements
    setupStripeElements();
}

// Setup Stripe Elements
async function setupStripeElements() {
    console.log('[Payment] Setting up Stripe Elements');
    
    // Check if Stripe.js is loaded
    if (typeof Stripe === 'undefined') {
        console.error('[Payment] Stripe.js library not loaded');
        const paymentElementContainer = document.getElementById('stripe-payment-element');
        if (paymentElementContainer) {
            paymentElementContainer.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; text-align: center;">
                    <p style="color: #721c24; margin: 0;">Stripe.js library failed to load. Please refresh the page.</p>
                </div>
            `;
        }
        return;
    }
    
    const paymentElementContainer = document.getElementById('stripe-payment-element');
    if (!paymentElementContainer) {
        console.error('[Payment] Payment element container not found');
        return;
    }
    
    // Show loading state
    paymentElementContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">Loading payment form...</div>';
    
    // Fetch Stripe publishable key from server
    try {
        console.log('[Payment] Fetching Stripe config from:', `${API_BASE}/api/stripe/config`);
        const configResponse = await fetch(`${API_BASE}/api/stripe/config`);
        
        if (!configResponse.ok) {
            throw new Error(`HTTP error! status: ${configResponse.status}`);
        }
        
        const configData = await configResponse.json();
        console.log('[Payment] Stripe config response:', configData);
        
        if (!configData.publishableKey) {
            console.warn('[Payment] Stripe not configured:', configData.error || 'No publishable key');
            paymentElementContainer.innerHTML = `
                <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; text-align: center;">
                    <p style="color: #856404; margin: 0 0 12px 0; font-weight: 500;">Payment processing not configured</p>
                    <p style="color: #856404; margin: 0; font-size: 0.9rem;">Please add STRIPE_PUBLISHABLE_KEY to your environment variables.</p>
                </div>
            `;
            // Disable payment button if Stripe isn't configured
            const processPaymentBtn = document.getElementById('processPaymentBtn');
            if (processPaymentBtn) {
                processPaymentBtn.disabled = true;
                processPaymentBtn.textContent = 'Payment Not Available';
            }
            return;
        }
        
        const stripePublishableKey = configData.publishableKey;
        console.log('[Payment] Stripe publishable key loaded:', stripePublishableKey.substring(0, 20) + '...');
        
        // Initialize Stripe
        const stripe = Stripe(stripePublishableKey);
        window.stripeInstance = stripe; // Store globally for payment processing
        
        // Calculate total amount first
        const totalAmount = calculateTotalAmount();
        
        if (totalAmount <= 0) {
            paymentElementContainer.innerHTML = `
                <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; text-align: center;">
                    <p style="color: #856404; margin: 0;">No items selected for purchase.</p>
                </div>
            `;
            return;
        }
        
        console.log('[Payment] Creating payment intent for amount:', totalAmount, 'pence (£' + (totalAmount / 100).toFixed(2) + ')');
        
        // Create payment intent on server to get clientSecret
        const intentResponse = await fetch(`${API_BASE}/api/stripe/create-payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: totalAmount,
                currency: 'gbp',
                description: `Extended warranty and accessories - ${appState.productData?.part_model_number || 'N/A'}`
            })
        });
        
        if (!intentResponse.ok) {
            const errorData = await intentResponse.json();
            throw new Error(errorData.message || errorData.error || 'Failed to create payment intent');
        }
        
        const intentData = await intentResponse.json();
        
        console.log('[Payment] Payment intent response:', intentData);
        
        if (!intentData.clientSecret) {
            console.error('[Payment] No clientSecret in response:', intentData);
            throw new Error('No client secret received from server');
        }
        
        console.log('[Payment] Payment intent created, clientSecret received:', intentData.clientSecret.substring(0, 20) + '...');
        
        // Store payment intent ID globally
        window.currentPaymentIntentId = intentData.paymentIntentId;
        
        // Validate clientSecret before creating Elements
        if (!intentData.clientSecret || typeof intentData.clientSecret !== 'string') {
            console.error('[Payment] Invalid clientSecret:', intentData.clientSecret);
            throw new Error('Invalid client secret received from server');
        }
        
        // Create Elements instance with clientSecret
        console.log('[Payment] Creating Elements with clientSecret...');
        const elements = stripe.elements({
            clientSecret: intentData.clientSecret,
            appearance: {
                theme: 'stripe',
                variables: {
                    colorPrimary: '#0064D2',
                    colorBackground: '#ffffff',
                    colorText: '#1a1a1a',
                    colorDanger: '#df1b41',
                    fontFamily: 'system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '8px',
                }
            }
        });
        
        // Create payment element
        console.log('[Payment] Creating payment element...');
        let paymentElement;
        try {
            paymentElement = elements.create('payment');
            console.log('[Payment] Payment element created successfully');
        } catch (elementError) {
            console.error('[Payment] Error creating payment element:', elementError);
            throw new Error('Failed to create payment element: ' + (elementError.message || 'Unknown error'));
        }
        
        // Mount payment element with error handling
        try {
            paymentElement.mount('#stripe-payment-element');
            window.paymentElementInstance = paymentElement; // Store globally
            window.paymentElements = elements; // Store elements instance
            console.log('[Payment] Stripe Elements initialized successfully');
        } catch (mountError) {
            console.error('[Payment] Error mounting Stripe Elements:', mountError);
            paymentElementContainer.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; text-align: center;">
                    <p style="color: #721c24; margin: 0;">Error loading payment form: ${mountError.message || 'Unknown error'}</p>
                    <p style="color: #721c24; margin: 10px 0 0 0; font-size: 0.9rem;">Please check the browser console for details.</p>
                </div>
            `;
            return;
        }
        
        // Handle payment button click
        const processPaymentBtn = document.getElementById('processPaymentBtn');
        if (processPaymentBtn) {
            // Remove any existing listeners
            const newBtn = processPaymentBtn.cloneNode(true);
            processPaymentBtn.parentNode.replaceChild(newBtn, processPaymentBtn);
            
            newBtn.addEventListener('click', async () => {
                await processStripePayment(stripe, paymentElement, intentData.clientSecret);
            });
        }
        
    } catch (error) {
        console.error('[Payment] Error setting up Stripe:', error);
        const paymentElementContainer = document.getElementById('stripe-payment-element');
        if (paymentElementContainer) {
            paymentElementContainer.innerHTML = `
                <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; text-align: center;">
                    <p style="color: #721c24; margin: 0;">Error loading payment system: ${error.message || 'Unknown error'}</p>
                    <p style="color: #721c24; margin: 10px 0 0 0; font-size: 0.9rem;">Please check the browser console for details.</p>
                </div>
            `;
        }
    }
}

// Process GoCardless payment
async function processGoCardlessPayment() {
    const processPaymentBtn = document.getElementById('processPaymentBtn');
    const paymentError = document.getElementById('paymentError');
    
    if (processPaymentBtn) {
        processPaymentBtn.disabled = true;
        processPaymentBtn.textContent = 'Processing...';
    }
    
    if (paymentError) {
        paymentError.style.display = 'none';
        paymentError.textContent = '';
    }
    
    try {
        // Calculate total amount
        const totalAmount = calculateTotalAmount();
        
        if (totalAmount <= 0) {
            throw new Error('No items selected for purchase');
        }
        
        console.log('[Payment] Creating GoCardless redirect flow for amount:', totalAmount, 'pence (£' + (totalAmount / 100).toFixed(2) + ')');
        
        // Get customer details from appState
        const customerEmail = appState.contactDetails?.email || '';
        const customerName = appState.contactDetails?.name || '';
        
        // Create redirect flow
        const response = await fetch(`${API_BASE}/api/gocardless/create-redirect-flow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: totalAmount,
                description: `Extended warranty and accessories - ${appState.productData?.part_model_number || 'N/A'}`,
                successUrl: `${window.location.origin}${window.location.pathname}?payment=success`,
                customerEmail: customerEmail,
                customerName: customerName
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.error || 'Failed to create payment');
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!data.redirectUrl) {
            throw new Error('No redirect URL received from server');
        }
        
        console.log('[Payment] Redirecting to GoCardless:', data.redirectUrl);
        
        // Track event
        trackEvent('payment_initiated', {
            amount: totalAmount,
            warranty: appState.selectedWarranty,
            accessories: appState.selectedAccessories.length,
            redirectFlowId: data.redirectFlowId
        });
        
        // Store redirect flow ID for completion
        sessionStorage.setItem('gocardless_redirect_flow_id', data.redirectFlowId);
        sessionStorage.setItem('gocardless_amount', totalAmount.toString());
        
        // Redirect to GoCardless
        window.location.href = data.redirectUrl;
        
    } catch (error) {
        console.error('[Payment] Payment error:', error);
        if (paymentError) {
            paymentError.style.cssText = 'display: block; background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #f5c6cb;';
            paymentError.textContent = error.message || 'Payment setup failed. Please try again.';
        }
        if (processPaymentBtn) {
            processPaymentBtn.disabled = false;
            processPaymentBtn.textContent = 'Pay Securely';
        }
    }
}

// Handle GoCardless payment success redirect
async function handleGoCardlessPaymentSuccess(redirectFlowId) {
    console.log('[Payment] Handling GoCardless payment success, redirect flow:', redirectFlowId);
    
    const paymentError = document.getElementById('paymentError');
    const amount = parseInt(sessionStorage.getItem('gocardless_amount') || '0');
    
    try {
        // Complete the redirect flow and create payment
        const response = await fetch(`${API_BASE}/api/gocardless/complete-redirect-flow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                redirectFlowId: redirectFlowId,
                amount: amount,
                description: `Extended warranty and accessories - ${appState.productData?.part_model_number || 'N/A'}`
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.error || 'Failed to complete payment');
        }
        
        const data = await response.json();
        
        console.log('[Payment] Payment completed successfully:', data);
        
        // Track success event
        trackEvent('payment_completed', {
            amount: amount,
            warranty: appState.selectedWarranty,
            accessories: appState.selectedAccessories.length,
            paymentId: data.paymentId,
            mandateId: data.mandateId
        });
        
        // Clear stored data
        sessionStorage.removeItem('gocardless_redirect_flow_id');
        sessionStorage.removeItem('gocardless_amount');
        
        // Remove payment success from URL
        const newUrl = window.location.pathname + (window.location.search.replace(/[?&]payment=success(&redirect_flow_id=[^&]*)?/g, '').replace(/^&/, '?') || '');
        window.history.replaceState({}, '', newUrl);
        
        // Show success message and complete registration
        if (paymentError) {
            paymentError.style.cssText = 'display: block; background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #c3e6cb;';
            paymentError.textContent = '✓ Payment successful! Completing registration...';
        }
        
        // Complete the registration process
        setTimeout(() => {
            finishSetup();
        }, 1500);
        
    } catch (error) {
        console.error('[Payment] Error completing payment:', error);
        if (paymentError) {
            paymentError.style.cssText = 'display: block; background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #f5c6cb;';
            paymentError.textContent = error.message || 'Payment completion failed. Please contact support.';
        }
        
        // Show step 7 so user can see the error
        showStep(7);
    }
}

// Process Stripe payment
async function processStripePayment(stripe, paymentElement, clientSecret) {
    const processPaymentBtn = document.getElementById('processPaymentBtn');
    const paymentError = document.getElementById('paymentError');
    
    if (processPaymentBtn) {
        processPaymentBtn.disabled = true;
        processPaymentBtn.textContent = 'Processing...';
    }
    
    if (paymentError) {
        paymentError.style.display = 'none';
        paymentError.textContent = '';
    }
    
    try {
        if (!clientSecret) {
            throw new Error('Payment intent not initialized. Please refresh the page.');
        }
        
        console.log('[Payment] Confirming payment with existing payment intent...');
        
        // Confirm payment with Stripe using the existing clientSecret
        const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
            elements: {
                payment: paymentElement
            },
            clientSecret: clientSecret,
            confirmParams: {
                return_url: `${window.location.origin}/warranty-registration.html?payment=success&intent=${window.currentPaymentIntentId}`
            },
            redirect: 'if_required' // Only redirect if required (3D Secure, etc.)
        });
        
        if (confirmError) {
            // Handle card errors
            let errorMessage = 'Payment failed. ';
            if (confirmError.type === 'card_error' || confirmError.type === 'validation_error') {
                errorMessage += confirmError.message;
            } else {
                errorMessage += 'Please try again.';
            }
            throw new Error(errorMessage);
        }
        
        // Payment successful
        console.log('[Payment] Payment successful:', paymentIntent);
        
        // Store payment intent ID in appState
        appState.paymentIntentId = window.currentPaymentIntentId;
        saveState();
        
        const totalAmount = calculateTotalAmount();
        trackEvent('payment_completed', {
            amount: totalAmount,
            warranty: appState.selectedWarranty,
            accessories: appState.selectedAccessories.length,
            paymentIntentId: window.currentPaymentIntentId
        });
        
        // Show success message
        if (paymentError) {
            paymentError.style.cssText = 'display: block; background: #d4edda; color: #155724; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #c3e6cb;';
            paymentError.textContent = '✓ Payment successful! Completing registration...';
        }
        
        // Complete the registration process
        setTimeout(() => {
            finishSetup();
        }, 1500);
        
    } catch (error) {
        console.error('[Payment] Payment error:', error);
        if (paymentError) {
            paymentError.style.cssText = 'display: block; background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #f5c6cb;';
            paymentError.textContent = error.message || 'Payment failed. Please try again.';
        }
        if (processPaymentBtn) {
            processPaymentBtn.disabled = false;
            processPaymentBtn.textContent = 'Pay Now';
        }
    }
}

// Calculate total amount in pence (Stripe uses smallest currency unit)
function calculateTotalAmount() {
    let total = 0;
    
    // Add warranty price
    if (appState.selectedWarranty && appState.selectedWarranty !== 'none') {
        const warrantyCard = document.querySelector(`.warranty-card[data-plan="${appState.selectedWarranty}"]`);
        if (warrantyCard) {
            const priceText = warrantyCard.querySelector('.warranty-price')?.textContent || '£0.00';
            const price = parseFloat(priceText.replace(/[£,]/g, '')) || 0;
            total += price * 100; // Convert to pence
        }
    }
    
    // Add accessory prices from stored addon sales data
    if (appState.selectedAccessories && appState.selectedAccessories.length > 0 && appState.addonSalesData) {
        const selectedAddons = appState.addonSalesData.filter(addon => 
            appState.selectedAccessories.includes(addon.id)
        );
        
        selectedAddons.forEach(addon => {
            const price = parseFloat(addon.price || 0);
            total += price * 100; // Convert to pence
        });
    }
    
    return Math.round(total);
}

// Setup checkbox handlers for setup steps
function setupStepCheckboxes() {
    const checkboxes = document.querySelectorAll('#setupSteps input[type="checkbox"][data-completed="true"]');
    const helpCheckboxes = document.querySelectorAll('#setupSteps input[type="checkbox"][data-help="true"]');
    const continueBtn = document.getElementById('continueBtn3');
    
    // Handle completion checkboxes
    checkboxes.forEach((checkbox, index) => {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                // Uncheck help checkbox if completion is checked
                const stepDiv = this.closest('.setup-step');
                const helpCheckbox = stepDiv?.querySelector('input[data-help="true"]');
                if (helpCheckbox && helpCheckbox.checked) {
                    helpCheckbox.checked = false;
                    // Remove any help message
                    const helpMessage = stepDiv.querySelector('.help-message');
                    if (helpMessage) {
                        helpMessage.remove();
                    }
                }
                
                // Mark this step as completed
                if (stepDiv) {
                    stepDiv.classList.add('completed');
                }
                
                // Show next step
                const nextStep = checkboxes[index + 1];
                if (nextStep) {
                    const nextStepDiv = nextStep.closest('.setup-step');
                    if (nextStepDiv) {
                        nextStepDiv.classList.add('active');
                        nextStepDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                } else {
                    // All steps completed, show finish button
                    if (continueBtn) {
                        continueBtn.style.display = 'block';
                    }
                }
            } else {
                // Unchecking - remove completed class
                const stepDiv = this.closest('.setup-step');
                if (stepDiv) {
                    stepDiv.classList.remove('completed');
                }
                
                // Hide finish button if not all steps are checked
                if (continueBtn) {
                    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                    if (!allChecked) {
                        continueBtn.style.display = 'none';
                    }
                }
            }
        });
    });
    
    // Handle help checkboxes
    helpCheckboxes.forEach((helpCheckbox) => {
        helpCheckbox.addEventListener('change', function() {
            if (this.checked) {
                // Uncheck completion checkbox if help is checked
                const stepDiv = this.closest('.setup-step');
                const completedCheckbox = stepDiv?.querySelector('input[data-completed="true"]');
                if (completedCheckbox && completedCheckbox.checked) {
                    completedCheckbox.checked = false;
                    // Remove completed class
                    if (stepDiv) {
                        stepDiv.classList.remove('completed');
                    }
                    // Hide continue button if it was shown
                    if (continueBtn) {
                        continueBtn.style.display = 'none';
                    }
                }
                
                // Track help request
                const stepNum = this.dataset.step;
                console.log('[Setup Instructions] Help requested for step:', stepNum);
                trackEvent('setup_help_requested', { step: stepNum });
                
                // Navigate to help options page
                showHelpOptionsPage();
            } else {
                // Unchecking help - nothing to do (we navigate away when checked)
            }
        });
    });
}

// Show help options page
function showHelpOptionsPage() {
    console.log('[Help Options] Showing help options page');
    
    // Hide all step containers
    document.querySelectorAll('.step-container').forEach(step => {
        step.style.display = 'none';
        step.classList.remove('active');
    });
    
    // Show help options step
    const helpOptionsStep = document.getElementById('helpOptionsStep');
    if (helpOptionsStep) {
        helpOptionsStep.style.display = 'block';
        helpOptionsStep.classList.add('active');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Setup option click handlers
        setupHelpOptionHandlers();
    } else {
        console.error('[Help Options] Help options step element not found');
    }
}

// Setup help option click handlers
function setupHelpOptionHandlers() {
    // Option 1: Restart Pairing Process
    const restartOption = document.getElementById('helpOptionRestart');
    if (restartOption && !restartOption.dataset.listenersAttached) {
        restartOption.addEventListener('click', () => {
            console.log('[Help Options] Restart pairing process selected');
            trackEvent('help_option_selected', { option: 'restart' });
            
            // Reset all setup step checkboxes
            document.querySelectorAll('#setupSteps input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            
            // Remove completed classes from all steps
            document.querySelectorAll('#setupSteps .setup-step').forEach(step => {
                step.classList.remove('completed', 'active');
            });
            
            // Show first step as active
            const firstStep = document.querySelector('#setupSteps .setup-step');
            if (firstStep) {
                firstStep.classList.add('active');
            }
            
            // Hide help options and show setup instructions (step 3)
            document.getElementById('helpOptionsStep').style.display = 'none';
            showStep(3);
        });
        restartOption.dataset.listenersAttached = 'true';
        
        // Add hover effect
        restartOption.addEventListener('mouseenter', () => {
            restartOption.style.borderColor = '#0064D2';
            restartOption.style.boxShadow = '0 4px 12px rgba(0, 100, 210, 0.15)';
        });
        restartOption.addEventListener('mouseleave', () => {
            restartOption.style.borderColor = '#e8ecf1';
            restartOption.style.boxShadow = 'none';
        });
    }
    
    // Option 2: Free Reconditioning Service
    const reconditionOption = document.getElementById('helpOptionRecondition');
    if (reconditionOption && !reconditionOption.dataset.listenersAttached) {
        reconditionOption.addEventListener('click', () => {
            console.log('[Help Options] Free reconditioning service selected');
            trackEvent('help_option_selected', { option: 'reconditioning' });
            
            // Hide help options and show reconditioning form
            document.getElementById('helpOptionsStep').style.display = 'none';
            showReconditioningForm();
        });
        reconditionOption.dataset.listenersAttached = 'true';
        
        // Add hover effect
        reconditionOption.addEventListener('mouseenter', () => {
            reconditionOption.style.transform = 'translateY(-2px)';
            reconditionOption.style.boxShadow = '0 6px 20px rgba(255, 193, 7, 0.3)';
        });
        reconditionOption.addEventListener('mouseleave', () => {
            reconditionOption.style.transform = 'translateY(0)';
            reconditionOption.style.boxShadow = 'none';
        });
    }
    
    // Option 3: Return Item
    const returnOption = document.getElementById('helpOptionReturn');
    if (returnOption && !returnOption.dataset.listenersAttached) {
        returnOption.addEventListener('click', () => {
            console.log('[Help Options] Return item selected');
            trackEvent('help_option_selected', { option: 'return' });
            
            // Redirect to return page
            window.location.href = 'ebay-return.html';
        });
        returnOption.dataset.listenersAttached = 'true';
        
        // Add hover effect
        returnOption.addEventListener('mouseenter', () => {
            returnOption.style.borderColor = '#dc3545';
            returnOption.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.15)';
        });
        returnOption.addEventListener('mouseleave', () => {
            returnOption.style.borderColor = '#e8ecf1';
            returnOption.style.boxShadow = 'none';
        });
    }
}

// Show reconditioning form
function showReconditioningForm() {
    console.log('[Reconditioning] Showing reconditioning form');
    
    // Hide all step containers
    document.querySelectorAll('.step-container').forEach(step => {
        step.style.display = 'none';
        step.classList.remove('active');
    });
    
    // Show reconditioning form step
    const reconditioningFormStep = document.getElementById('reconditioningFormStep');
    if (reconditioningFormStep) {
        reconditioningFormStep.style.display = 'block';
        reconditioningFormStep.classList.add('active');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Pre-fill form with contact details if available
        if (appState.contactDetails) {
            const nameField = document.getElementById('reconditionName');
            const emailField = document.getElementById('reconditionEmail');
            const phoneField = document.getElementById('reconditionPhone');
            
            if (nameField && appState.contactDetails.name) nameField.value = appState.contactDetails.name;
            if (emailField && appState.contactDetails.email) emailField.value = appState.contactDetails.email;
            if (phoneField && appState.contactDetails.phone) phoneField.value = appState.contactDetails.phone;
        }
        
        // Attach form submission handler
        const reconditioningForm = document.getElementById('reconditioningForm');
        if (reconditioningForm && !reconditioningForm.dataset.listenerAttached) {
            reconditioningForm.addEventListener('submit', handleReconditioningFormSubmit);
            reconditioningForm.dataset.listenerAttached = 'true';
        }
    } else {
        console.error('[Reconditioning] Reconditioning form step element not found');
    }
}

// Handle reconditioning form submission
async function handleReconditioningFormSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('reconditionName').value.trim();
    const email = document.getElementById('reconditionEmail').value.trim();
    const phone = document.getElementById('reconditionPhone').value.trim();
    const address = document.getElementById('reconditionAddress').value.trim();
    const feedbackAgree = document.getElementById('reconditionFeedbackAgree').checked;
    
    // Validate
    if (!name || !email || !phone || !address) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (!feedbackAgree) {
        alert('Please confirm that you will provide feedback in return for this free service');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    const submitBtn = document.getElementById('submitReconditioningForm');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }
    
    try {
        // Submit reconditioning request
        const response = await fetch(`${API_BASE}/api/reconditioning-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                phone,
                address,
                part_model_number: appState.productData?.part_model_number,
                part_name: appState.productData?.part_name,
                generation: appState.productData?.generation,
                security_barcode: appState.securityCode || sessionStorage.getItem('securityBarcode'),
                ebay_order_number: appState.productData?.ebay_order_number
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Show success message
            trackEvent('reconditioning_request_submitted', {
                part_model_number: appState.productData?.part_model_number
            });
            
            // Show success page
            showReconditioningSuccess();
        } else {
            throw new Error(data.error || 'Failed to submit request');
        }
    } catch (error) {
        console.error('[Reconditioning] Error submitting form:', error);
        alert('Failed to submit request. Please try again or contact support directly.');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Request';
        }
    }
}

// Show reconditioning success page
function showReconditioningSuccess() {
    const reconditioningFormStep = document.getElementById('reconditioningFormStep');
    if (reconditioningFormStep) {
        reconditioningFormStep.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 4px 20px rgba(40, 167, 69, 0.3);">
                    <span style="font-size: 40px; color: white;">✓</span>
                </div>
                <h2 style="color: #1a1a1a; margin-bottom: 16px; font-size: 1.75rem;">Request Submitted Successfully!</h2>
                <p style="color: #6c757d; margin-bottom: 24px; line-height: 1.6; max-width: 600px; margin-left: auto; margin-right: auto;">
                    Thank you for choosing our free reconditioning service. We'll send you a prepaid return label via email within 24 hours.
                </p>
                <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 24px auto; max-width: 600px; text-align: left;">
                    <h4 style="margin-top: 0; margin-bottom: 12px; color: #1a1a1a;">What Happens Next?</h4>
                    <ol style="color: #6c757d; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li>Check your email for the prepaid return label (within 24 hours)</li>
                        <li>Package your replacement part with your existing AirPods</li>
                        <li>Attach the label and send it back to us</li>
                        <li>We'll recondition, pair, and synchronise everything</li>
                        <li>We'll return your fully working AirPods set</li>
                        <li>You leave us positive feedback - that's it!</li>
                    </ol>
                </div>
                <div style="margin-top: 32px;">
                    <a href="index.html" class="button" style="display: inline-block; text-decoration: none;">Return to Home</a>
                </div>
            </div>
        `;
    }
}

// Get compatible part examples from API
async function getCompatiblePartExamples(partModelNumber, partType) {
    if (!partModelNumber) {
        console.warn('[Compatible Parts] No part model number provided');
        return { compatibleParts: [] };
    }
    
    try {
        const params = new URLSearchParams();
        if (partType) params.append('part_type', partType);
        
        const url = `${API_BASE}/api/compatible-parts/${encodeURIComponent(partModelNumber)}${params.toString() ? '?' + params.toString() : ''}`;
        console.log('[Compatible Parts] Fetching from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Compatible Parts] API response:', data);
        
        // API returns { ok: true, data: { compatibleParts: [...] } }
        // Return the data object directly so compatibleParts is accessible
        if (data && data.data && data.data.compatibleParts) {
            return { compatibleParts: data.data.compatibleParts };
        } else if (data && data.compatibleParts) {
            return { compatibleParts: data.compatibleParts };
        }
        
        return { compatibleParts: [] };
    } catch (error) {
        console.error('[Compatible Parts] Error fetching compatible parts:', error);
        return { compatibleParts: [] };
    }
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

    // Check if we have associated parts from the API in appState
    const associatedParts = appState.productData && appState.productData.associated_parts;
    console.log('Associated parts from appState:', associatedParts);

    // If we have associated parts from API, use them
    if (associatedParts && Array.isArray(associatedParts) && associatedParts.length > 0) {
        console.log('Using associated parts from API:', associatedParts);

        // Clear existing content
        examplesGrid.innerHTML = '';

        // Display each compatible part example
        associatedParts.forEach((part, index) => {
            console.log(`[Compatible Parts] Part ${index + 1}:`, {
                name: part.part_name,
                model: part.part_model_number,
                type: part.part_type,
                example_image: part.example_image,
                example_image_type: typeof part.example_image
            });

            const partCard = document.createElement('div');
            partCard.style.cssText = 'background: white; border: 2px solid #e8ecf1; border-radius: 12px; padding: 16px; text-align: center; transition: all 0.3s ease;';
            partCard.style.cursor = 'pointer';

            const partTypeLabel = part.part_type === 'left' ? 'Left AirPod' :
                                part.part_type === 'right' ? 'Right AirPod' : 'Case';

            // Use example image if available (check for null, empty, or "null" string)
            let imagePath;
            if (part.example_image && part.example_image !== 'null' && part.example_image !== 'undefined' && part.example_image.trim() !== '') {
                imagePath = part.example_image;
                console.log(`[Compatible Parts] Using uploaded image for ${part.part_model_number}:`, imagePath);
            } else {
                imagePath = getFallbackExampleImage(part.part_type, part.part_model_number);
                console.log(`[Compatible Parts] Using fallback image for ${part.part_model_number}:`, imagePath);
            }

            const finalImagePath = imagePath.includes('?')
                ? imagePath + `&v=${IMAGE_VERSION}`
                : imagePath + `?v=${IMAGE_VERSION}`;

            partCard.innerHTML = `
                <img src="${finalImagePath}"
                     alt="${partTypeLabel}"
                     onerror="console.error('[Compatible Parts] Failed to load image:', this.src); this.src='${getFallbackExampleImage(part.part_type, part.part_model_number)}';"
                     style="width: 100%; max-width: 200px; height: auto; min-height: 150px; border-radius: 8px; margin-bottom: 12px; object-fit: contain; background: #f8f9fa;">
                <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 0.95rem;">${partTypeLabel}</div>
                <div style="font-size: 0.85rem; color: #6c757d;">${part.part_model_number}</div>
            `;

            examplesGrid.appendChild(partCard);
        });

        examplesContainer.style.display = 'block';
        return;
    }

    // Fallback: Get example data from old API endpoint
    const exampleData = await getCompatiblePartExamples(partModelNumber, partType);
    console.log('Example data loaded from fallback API:', exampleData);

    if (!exampleData || !exampleData.compatibleParts || exampleData.compatibleParts.length === 0) {
        console.log('No example data found, using fallback');
        // Fallback to static message with proper formatting
        const compatiblePartsEl = document.getElementById('compatiblePartNumbers');
        if (compatiblePartsEl) {
            const compatibleParts = getCompatiblePartNumbers(partModelNumber, partType);
            console.log('[Compatible Parts] Fallback compatible parts:', compatibleParts);
            
            // Format the parts with names
            const formatted = compatibleParts.map(partNum => {
                if (/^A\d+/.test(partNum)) {
                    // Known part numbers - map to names
                    if (partNum === 'A3047') {
                        return `Left AirPod (${partNum})`;
                    } else if (partNum === 'A3048') {
                        return `Right AirPod (${partNum})`;
                    } else if (partNum === 'A2699') {
                        return `Left AirPod (${partNum})`;
                    } else if (partNum === 'A2698') {
                        return `Right AirPod (${partNum})`;
                    } else if (partNum === 'A2968' || partNum === 'A2700' || partNum.includes('2700') || partNum.includes('2968')) {
                        return `Case (${partNum})`;
                    } else {
                        // For other AirPod part numbers, determine left/right based on part type
                        if (partType === 'right') {
                            return `Left AirPod (${partNum})`;
                        } else if (partType === 'left') {
                            return `Right AirPod (${partNum})`;
                        } else {
                            return `Case (${partNum})`;
                        }
                    }
                } else {
                    return partNum;
                }
            });
            compatiblePartsEl.textContent = formatted.join(' & ');
        }
        
        // Still try to show images using fallback
        const compatibleParts = getCompatiblePartNumbers(partModelNumber, partType);
        if (compatibleParts.length > 0) {
            examplesGrid.innerHTML = '';
            compatibleParts.forEach((partNum, index) => {
                const partCard = document.createElement('div');
                partCard.style.cssText = 'background: white; border: 2px solid #e8ecf1; border-radius: 12px; padding: 16px; text-align: center; transition: all 0.3s ease;';
                
                // Determine part type for image
                let partTypeForImage = 'left';
                let partName = 'Left AirPod';
                if (partNum === 'A3047' || partNum === 'A2699') {
                    partTypeForImage = 'left';
                    partName = 'Left AirPod';
                } else if (partNum === 'A3048' || partNum === 'A2698') {
                    partTypeForImage = 'right';
                    partName = 'Right AirPod';
                } else if (partNum === 'A2968' || partNum === 'A2700' || partNum.includes('2700') || partNum.includes('2968')) {
                    partTypeForImage = 'case';
                    partName = 'Case';
                } else if (partType === 'right') {
                    partTypeForImage = 'left';
                    partName = 'Left AirPod';
                } else if (partType === 'left') {
                    partTypeForImage = 'right';
                    partName = 'Right AirPod';
                }
                
                const fallbackPath = getFallbackExampleImage(partTypeForImage, partNum);
                const finalImagePath = fallbackPath.includes('?') 
                    ? fallbackPath + `&v=${IMAGE_VERSION}`
                    : fallbackPath + `?v=${IMAGE_VERSION}`;
                
                partCard.innerHTML = `
                    <img src="${finalImagePath}" 
                         alt="${partName}" 
                         style="width: 100%; max-width: 200px; height: auto; min-height: 150px; border-radius: 8px; margin-bottom: 12px; object-fit: contain; background: #f8f9fa;">
                    <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 0.95rem;">${partName}</div>
                    <div style="font-size: 0.85rem; color: #6c757d;">${partNum}</div>
                `;
                
                examplesGrid.appendChild(partCard);
            });
            examplesContainer.style.display = 'block';
        } else {
            examplesContainer.style.display = 'none';
        }
        return;
    }
    
    // Update the message dynamically based on API response
    const compatiblePartsEl = document.getElementById('compatiblePartNumbers');
    if (compatiblePartsEl && exampleData.compatibleParts.length > 0) {
        // Build message with part names and model numbers: "Part Name (ModelNumber)"
        const formattedParts = exampleData.compatibleParts.map(p => {
            const partName = p.name || (p.partType === 'left' ? 'Left AirPod' : p.partType === 'right' ? 'Right AirPod' : p.partType === 'case' ? 'Case' : 'Part');
            const modelNumber = p.partModelNumber || '';
            if (modelNumber) {
                return `${partName} (${modelNumber})`;
            } else {
                return partName;
            }
        }).filter(Boolean);
        
        if (formattedParts.length > 0) {
            compatiblePartsEl.textContent = formattedParts.join(' & ');
        } else {
            // Fallback to part names if no formatting possible
            const partNames = exampleData.compatibleParts.map(p => p.name).filter(Boolean);
            compatiblePartsEl.textContent = partNames.join(' & ');
        }
    }
    
    // Clear existing content
    examplesGrid.innerHTML = '';
    
    // Display each compatible part example
    console.log('Displaying', exampleData.compatibleParts.length, 'compatible parts');
    console.log('[Compatible Parts] Full compatible parts data:', JSON.stringify(exampleData.compatibleParts, null, 2));
    exampleData.compatibleParts.forEach((part, index) => {
        console.log(`Part ${index + 1}:`, part.name, 'Model:', part.partModelNumber, 'Type:', part.partType, 'exampleImage:', part.exampleImage);
        const partCard = document.createElement('div');
        partCard.style.cssText = 'background: white; border: 2px solid #e8ecf1; border-radius: 12px; padding: 16px; text-align: center; transition: all 0.3s ease;';
        partCard.style.cursor = 'pointer';
        
        // Ensure image path is correct (add leading slash if needed)
        let imagePath = part.exampleImage || null;
        
        console.log(`[Compatible Parts] Part ${index + 1} (${part.partModelNumber}):`);
        console.log(`  - Name: ${part.name}`);
        console.log(`  - Type: ${part.partType}`);
        console.log(`  - exampleImage from API:`, part.exampleImage);
        console.log(`  - imagePath after processing:`, imagePath);
        
        // If no image from database, use fallback SVG
        if (!imagePath || imagePath === 'null' || imagePath === 'undefined' || imagePath === '') {
            // Fallback to static SVG based on part type and generation
            const fallbackSvg = getFallbackExampleImage(part.partType, part.partModelNumber);
            imagePath = fallbackSvg;
            console.log(`  - ⚠️ NO DATABASE IMAGE - Using fallback SVG:`, imagePath);
        } else {
            console.log(`  - ✅ USING DATABASE IMAGE:`, imagePath);
        }
        
        if (!imagePath.startsWith('/') && !imagePath.startsWith('http')) {
            imagePath = '/' + imagePath;
        }
        
        // Add cache-busting query parameter to force reload of updated SVG files
        // If imagePath already has a query param, append; otherwise add one
        const finalImagePath = imagePath.includes('?') 
            ? imagePath + `&v=${IMAGE_VERSION}`
            : imagePath + `?v=${IMAGE_VERSION}`;
        const fallbackPath = getFallbackExampleImage(part.partType, part.partModelNumber);
        console.log(`[Compatible Parts] Final image path for ${part.name}:`, finalImagePath);
        console.log(`[Compatible Parts] Fallback path for ${part.name}:`, fallbackPath);
        
        partCard.innerHTML = `
            <img src="${finalImagePath}" 
                 alt="${part.name}" 
                 style="width: 100%; max-width: 200px; height: auto; min-height: 150px; border-radius: 8px; margin-bottom: 12px; object-fit: contain; background: #f8f9fa;"
                 onerror="console.error('[Compatible Parts] Image failed to load:', '${finalImagePath}'); this.onerror=null; this.src='${fallbackPath}';"
                 onload="console.log('[Compatible Parts] Image loaded successfully:', '${finalImagePath}')">
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

// Image version for cache-busting - bump this when SVG files are updated
const IMAGE_VERSION = '1.2.0.047';

// Get fallback example image based on part type and model number
// Returns path with cache-busting query parameter
function getFallbackExampleImage(partType, partModelNumber) {
    // Map model numbers to their generation and type for fallback SVGs
    const modelToImage = {
        // AirPods Pro 2nd Gen
        'A2698': '/images/examples/airpod-pro-2nd-gen-left.svg',
        'A2699': '/images/examples/airpod-pro-2nd-gen-right.svg',
        'A2700': '/images/examples/airpod-pro-2nd-gen-case.svg',
        'A2968': '/images/examples/airpod-pro-2nd-gen-case.svg',  // USB-C MagSafe case
        'A2968-L': '/images/examples/airpod-pro-2nd-gen-case.svg', // Lightning case
        'A3047': '/images/examples/airpod-pro-2nd-gen-left.svg',  // Left earbud USB-C
        'A3048': '/images/examples/airpod-pro-2nd-gen-right.svg',  // Right earbud USB-C
        // AirPods Pro 1st Gen
        'A2084': '/images/examples/airpod-pro-1st-gen-left.svg',
        'A2083': '/images/examples/airpod-pro-1st-gen-right.svg',
        'A2190': '/images/examples/airpod-pro-1st-gen-case.svg',
        'A2190-L': '/images/examples/airpod-pro-1st-gen-case.svg', // Lightning case
        // AirPods 3rd Gen
        'A2564': '/images/examples/airpod-3rd-gen-left.svg',
        'A2565': '/images/examples/airpod-3rd-gen-right.svg',
        'A2566': '/images/examples/airpod-3rd-gen-case.svg',
        'A2566-L': '/images/examples/airpod-3rd-gen-case.svg', // Lightning case
        // AirPods 2nd Gen
        'A2032': '/images/examples/airpod-2nd-gen-left.svg',
        'A2031': '/images/examples/airpod-2nd-gen-right.svg',
        'A1602': '/images/examples/airpod-2nd-gen-case.svg'
    };
    
    // Try exact model number match first
    let basePath = modelToImage[partModelNumber];
    
    // If not found, use partType to determine fallback
    if (!basePath) {
        console.warn(`[Fallback Image] Model number ${partModelNumber} not in mapping, using partType: ${partType}`);
        if (partType === 'case') {
            basePath = '/images/examples/airpod-pro-2nd-gen-case.svg';
        } else if (partType === 'left') {
            basePath = '/images/examples/airpod-pro-2nd-gen-left.svg';
        } else if (partType === 'right') {
            basePath = '/images/examples/airpod-pro-2nd-gen-right.svg';
        } else {
            // Default fallback
            basePath = '/images/examples/airpod-pro-2nd-gen-left.svg';
        }
    }
    
    // Add cache-busting query parameter
    return `${basePath}?v=${IMAGE_VERSION}`;
}

// Update authenticity check images based on purchased part
async function updateAuthenticityImages(partModelNumber, partType) {
    console.log('[Authenticity] updateAuthenticityImages called for:', partModelNumber, partType);
    
    // Normalize partType to lowercase for consistent comparison
    const normalizedPartType = partType ? partType.toLowerCase().trim() : '';
    console.log('[Authenticity] Normalized partType:', normalizedPartType);
    
    const caseImgEl = document.getElementById('authenticityCaseImage');
    const airpodImgEl = document.getElementById('authenticityAirPodImage');
    const gridContainer = document.getElementById('authenticityImagesGrid');
    const caseImageContainer = document.getElementById('caseImageContainer');
    const airpodImageContainer = document.getElementById('airpodImageContainer');
    
    console.log('[Authenticity] Elements found:', {
        caseImgEl: !!caseImgEl,
        airpodImgEl: !!airpodImgEl,
        gridContainer: !!gridContainer,
        caseImageContainer: !!caseImageContainer,
        airpodImageContainer: !!airpodImageContainer
    });
    
    if (!caseImgEl || !airpodImgEl) {
        console.error('[Authenticity] Image elements not found');
        return;
    }
    
    if (!gridContainer || !caseImageContainer || !airpodImageContainer) {
        console.error('[Authenticity] Container elements not found');
        return;
    }
    
    // Immediately hide case image container if product is a case (before fetching images)
    if (normalizedPartType === 'case') {
        if (caseImageContainer) {
            caseImageContainer.style.display = 'none';
            console.log('[Authenticity] Immediately hiding case image container - product is a case');
        }
        if (caseImgEl) {
            caseImgEl.style.display = 'none';
        }
    }
    
    // Set up error handlers - but don't use fallback SVGs if image is intentionally hidden
    caseImgEl.onerror = (event) => {
        const currentSrc = caseImgEl.src;
        // Only log error if src is not empty (meaning we tried to load an image)
        if (currentSrc && currentSrc !== '') {
            console.error('[Authenticity] Case image failed to load:', currentSrc);
            console.error('[Authenticity] Error event:', event);
            // Don't fall back to SVG - if image fails, just hide it
            caseImgEl.style.display = 'none';
            const caseImageContainer = document.getElementById('caseImageContainer');
            if (caseImageContainer) {
                caseImageContainer.style.display = 'none';
            }
        }
    };
    
    caseImgEl.onload = () => {
        if (caseImgEl.src && caseImgEl.src !== '') {
            console.log('[Authenticity] Case image loaded successfully:', caseImgEl.src);
        }
    };
    
    airpodImgEl.onerror = (event) => {
        const currentSrc = airpodImgEl.src;
        // Only log error if src is not empty (meaning we tried to load an image)
        if (currentSrc && currentSrc !== '') {
            console.error('[Authenticity] AirPod image failed to load:', currentSrc);
            console.error('[Authenticity] Error event:', event);
            // Don't fall back to SVG - if image fails, just hide it
            airpodImgEl.style.display = 'none';
            const airpodImageContainer = document.getElementById('airpodImageContainer');
            if (airpodImageContainer) {
                airpodImageContainer.style.display = 'none';
            }
        }
    };
    
    airpodImgEl.onload = () => {
        if (airpodImgEl.src && airpodImgEl.src !== '') {
            console.log('[Authenticity] AirPod image loaded successfully:', airpodImgEl.src);
        }
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
        console.log('[Authenticity] Full API response:', JSON.stringify(data, null, 2));
        
        let images;
        if (data.data && data.data.images) {
            // New structured format
            images = data.data.images;
            console.log('[Authenticity] Using structured format from data.data.images');
        } else if (data.authenticity_case_image || data.authenticity_airpod_image) {
            // Old flat format
            images = {
                caseImage: data.authenticity_case_image || null,
                airpodImage: data.authenticity_airpod_image || null
            };
            console.log('[Authenticity] Using flat format from root level');
        } else {
            images = { caseImage: null, airpodImage: null };
            console.warn('[Authenticity] No image data found in API response');
        }
        
        console.log('[Authenticity] Extracted images:', images);
        console.log('[Authenticity] caseImage value:', images.caseImage);
        console.log('[Authenticity] airpodImage value:', images.airpodImage);
        
        // Determine which images should be shown (only if they exist and are not hidden by show flags)
        let caseSrc = null;
        let airpodSrc = null;
        let showCaseImage = false;
        let showAirpodImage = false;
        
        // Update case image - only set if image exists (show flag is handled by API returning null)
        if (images.caseImage) {
            // Ensure path starts with / and doesn't have double slashes
            caseSrc = images.caseImage.startsWith('/') 
                ? images.caseImage 
                : '/' + images.caseImage;
            // Remove any double slashes (except after http:// or https://)
            caseSrc = caseSrc.replace(/([^:]\/)\/+/g, '$1');
            showCaseImage = true;
            console.log('[Authenticity] Using uploaded case image:', caseSrc);
        } else {
            console.log('[Authenticity] No case image found in database (or hidden by show flag) - will hide container');
        }
        
        // If the product itself is a case, hide the case image in authenticity check
        // The case is secured behind the security seal until user confirms details and is instructed to open the box
        if (normalizedPartType === 'case') {
            showCaseImage = false;
            caseSrc = null;
            console.log('[Authenticity] Product is a case - hiding case image from authenticity check (case is sealed)');
        }
        
        // Update AirPod image - only set if image exists (show flag is handled by API returning null)
        if (images.airpodImage) {
            // Ensure path starts with / and doesn't have double slashes
            airpodSrc = images.airpodImage.startsWith('/') 
                ? images.airpodImage 
                : '/' + images.airpodImage;
            // Remove any double slashes (except after http:// or https://)
            airpodSrc = airpodSrc.replace(/([^:]\/)\/+/g, '$1');
            showAirpodImage = true;
            console.log('[Authenticity] Using uploaded AirPod image:', airpodSrc);
        } else {
            console.log('[Authenticity] No AirPod image found in database (or hidden by show flag) - will hide container');
        }
        
        // Only set image sources if we have actual images (not fallbacks)
        if (showCaseImage && caseSrc) {
            console.log('[Authenticity] Setting case image src to:', caseSrc);
        }
        if (showAirpodImage && airpodSrc) {
            console.log('[Authenticity] Setting AirPod image src to:', airpodSrc);
        }
        
        // Update instruction text based on part type and which images are shown
        const instructionText = document.querySelector('.verification-step[data-step="2"] p[style*="color: #6c757d"]');
        if (instructionText) {
            // If the product is a case, always instruct to check AirPod stem (case is sealed)
            if (normalizedPartType === 'case') {
                instructionText.textContent = 'Check on the AirPod stem for these markings:';
                console.log('[Authenticity] Updated instruction text for case part type (case is sealed)');
            } else {
                // For other part types, update based on which images are shown
                if (!showCaseImage && showAirpodImage) {
                    instructionText.textContent = 'Check on the AirPod stem for these markings:';
                } else if (showCaseImage && !showAirpodImage) {
                    instructionText.textContent = 'Check inside your case lid for these markings:';
                } else if (showCaseImage && showAirpodImage) {
                    instructionText.textContent = 'Check inside your case lid or on the AirPod stem for these markings:';
                } else {
                    instructionText.textContent = 'Check your parts for these markings:';
                }
                console.log('[Authenticity] Updated instruction text for', partType, 'part type');
            }
        }
        
        // Container references already obtained at function start
        
        // Set image sources BEFORE showing containers (so images can start loading)
        if (showCaseImage && caseSrc) {
            // Store the actual path BEFORE setting src (so we have it even if image fails)
            caseImgEl.dataset.actualImagePath = caseSrc;
            caseImgEl.src = caseSrc;
            console.log('[Authenticity] Set case image src to:', caseSrc);
        } else {
            // Clear src and dataset if image shouldn't be shown
            caseImgEl.src = '';
            caseImgEl.dataset.actualImagePath = '';
            console.log('[Authenticity] Case image not shown - cleared src');
        }
        
        if (showAirpodImage && airpodSrc) {
            // Store the actual path BEFORE setting src (so we have it even if image fails)
            airpodImgEl.dataset.actualImagePath = airpodSrc;
            airpodImgEl.src = airpodSrc;
            console.log('[Authenticity] Set AirPod image src to:', airpodSrc);
        } else {
            // Clear src and dataset if image shouldn't be shown
            airpodImgEl.src = '';
            airpodImgEl.dataset.actualImagePath = '';
            console.log('[Authenticity] AirPod image not shown - cleared src');
        }
        
        // Now show/hide containers based on what should be displayed
        // If API returned an image, show it (API already handled show flags by returning null if hidden)
        if (showCaseImage && caseSrc) {
            if (caseImageContainer) {
                caseImageContainer.style.display = 'block';
                console.log('[Authenticity] Showing case image container with src:', caseSrc);
            }
            caseImgEl.style.display = 'block';
        } else {
            if (caseImageContainer) {
                caseImageContainer.style.display = 'none';
                console.log('[Authenticity] Hiding case image container - showCaseImage:', showCaseImage, 'caseSrc:', caseSrc);
            }
            caseImgEl.style.display = 'none';
        }
        
        // If API returned an image, show it (API already handled show flags by returning null if hidden)
        if (showAirpodImage && airpodSrc) {
            if (airpodImageContainer) {
                airpodImageContainer.style.display = 'block';
                console.log('[Authenticity] Showing AirPod image container with src:', airpodSrc);
            }
            airpodImgEl.style.display = 'block';
        } else {
            if (airpodImageContainer) {
                airpodImageContainer.style.display = 'none';
                console.log('[Authenticity] Hiding AirPod image container - showAirpodImage:', showAirpodImage, 'airpodSrc:', airpodSrc);
            }
            airpodImgEl.style.display = 'none';
        }
        
        // Show grid and adjust layout based on which images are visible
        if (gridContainer) {
            if (showCaseImage && caseSrc || showAirpodImage && airpodSrc) {
                // At least one image visible - show grid
                gridContainer.style.display = 'grid';
                if ((showCaseImage && caseSrc) && (showAirpodImage && airpodSrc)) {
                    // Both visible - two columns
                    gridContainer.style.gridTemplateColumns = '1fr 1fr';
                    gridContainer.style.justifyItems = '';
                    console.log('[Authenticity] Showing grid with two columns (both images visible)');
                } else {
                    // One visible - single column
                    gridContainer.style.gridTemplateColumns = '1fr';
                    gridContainer.style.justifyItems = 'center';
                    console.log('[Authenticity] Showing grid with single column (one image visible)');
                }
            } else {
                // Both hidden - hide grid entirely
                gridContainer.style.display = 'none';
                console.log('[Authenticity] Hiding grid (no images to show)');
            }
        }
        
        // Update alt text
        caseImgEl.alt = images.caseImage 
            ? 'Example charging case showing markings' 
            : 'Generic case markings diagram';
        airpodImgEl.alt = images.airpodImage 
            ? 'Example AirPod showing markings' 
            : 'Generic AirPod markings diagram';
        
        // Log when images actually load or fail
        caseImgEl.addEventListener('load', function() {
            console.log('[Authenticity] Case image loaded successfully from:', this.src);
        });
        caseImgEl.addEventListener('error', function() {
            console.error('[Authenticity] Case image FAILED to load from:', this.src);
            console.error('[Authenticity] Stored path was:', this.dataset.actualImagePath);
        });
        
        airpodImgEl.addEventListener('load', function() {
            console.log('[Authenticity] AirPod image loaded successfully from:', this.src);
        });
        airpodImgEl.addEventListener('error', function() {
            console.error('[Authenticity] AirPod image FAILED to load from:', this.src);
            console.error('[Authenticity] Stored path was:', this.dataset.actualImagePath);
        });
        
        // Remove any existing click handlers first
        caseImgEl.onclick = null;
        airpodImgEl.onclick = null;
        
        // Ensure images are clickable
        caseImgEl.style.cursor = 'pointer';
        airpodImgEl.style.cursor = 'pointer';
        caseImgEl.style.pointerEvents = 'auto';
        airpodImgEl.style.pointerEvents = 'auto';
        
        // Create click handler function for case image
        const caseClickHandler = function(e) {
            console.log('[Authenticity] ===== CASE IMAGE CLICKED =====');
            e.preventDefault();
            e.stopPropagation();
            
            // Always use the stored actual path from dataset (set when image was loaded)
            // Don't use this.src as it might have been changed to a fallback SVG
            const imgPath = this.dataset.actualImagePath;
            
            console.log('[Authenticity] Case image clicked!');
            console.log('[Authenticity] Stored dataset.actualImagePath:', imgPath);
            console.log('[Authenticity] Current this.src:', this.src);
            console.log('[Authenticity] Current this.dataset:', JSON.stringify(this.dataset));
            
            if (!imgPath) {
                console.error('[Authenticity] No stored image path available for case image');
                console.error('[Authenticity] Image element src:', this.src);
                // Fallback to src only if dataset is missing
                const fallbackPath = this.src;
                if (fallbackPath && !fallbackPath.includes('airpod-case-markings.svg')) {
                    console.warn('[Authenticity] Using fallback src:', fallbackPath);
                    openModal(0, [fallbackPath]);
                } else {
                    console.error('[Authenticity] Cannot open modal - no valid image path');
                    alert('Image path not available. Please refresh the page.');
                }
                return false;
            }
            
            // Ensure we're using the relative path, not a full URL
            // The modal will handle converting it to the correct format
            const pathToUse = imgPath.startsWith('http') ? imgPath : imgPath;
            
            console.log('[Authenticity] Opening case image modal with path:', pathToUse);
            console.log('[Authenticity] Full URL would be:', window.location.origin + pathToUse);
            
            // Test if openModal exists
            if (typeof openModal !== 'function') {
                console.error('[Authenticity] openModal function not found!');
                alert('Modal function not available. Please refresh the page.');
                return false;
            }
            
            openModal(0, [pathToUse]);
            return false;
        };
        
        // Create click handler function for AirPod image
        const airpodClickHandler = function(e) {
            console.log('[Authenticity] ===== AIRPOD IMAGE CLICKED =====');
            e.preventDefault();
            e.stopPropagation();
            
            // Always use the stored actual path from dataset (set when image was loaded)
            // Don't use this.src as it might have been changed to a fallback SVG
            const imgPath = this.dataset.actualImagePath;
            
            console.log('[Authenticity] AirPod image clicked!');
            console.log('[Authenticity] Stored dataset.actualImagePath:', imgPath);
            console.log('[Authenticity] Current this.src:', this.src);
            console.log('[Authenticity] Current this.dataset:', JSON.stringify(this.dataset));
            
            if (!imgPath) {
                console.error('[Authenticity] No stored image path available for AirPod image');
                console.error('[Authenticity] Image element src:', this.src);
                // Fallback to src only if dataset is missing
                const fallbackPath = this.src;
                if (fallbackPath && !fallbackPath.includes('airpod-stem-markings.svg')) {
                    console.warn('[Authenticity] Using fallback src:', fallbackPath);
                    openModal(0, [fallbackPath]);
                } else {
                    console.error('[Authenticity] Cannot open modal - no valid image path');
                    alert('Image path not available. Please refresh the page.');
                }
                return false;
            }
            
            // Ensure we're using the relative path, not a full URL
            // The modal will handle converting it to the correct format
            const pathToUse = imgPath.startsWith('http') ? imgPath : imgPath;
            
            console.log('[Authenticity] Opening AirPod image modal with path:', pathToUse);
            console.log('[Authenticity] Full URL would be:', window.location.origin + pathToUse);
            
            // Test if openModal exists
            if (typeof openModal !== 'function') {
                console.error('[Authenticity] openModal function not found!');
                alert('Modal function not available. Please refresh the page.');
                return false;
            }
            
            openModal(0, [pathToUse]);
            return false;
        };
        
        // Use addEventListener to ensure handlers work
        caseImgEl.addEventListener('click', caseClickHandler, true); // Use capture phase
        airpodImgEl.addEventListener('click', airpodClickHandler, true); // Use capture phase
        
        // Also set onclick as backup
        caseImgEl.onclick = caseClickHandler;
        airpodImgEl.onclick = airpodClickHandler;
        
        // Add mousedown/mouseup listeners to verify clicks are being detected
        caseImgEl.addEventListener('mousedown', function() {
            console.log('[Authenticity] Case image mousedown detected');
        });
        caseImgEl.addEventListener('mouseup', function() {
            console.log('[Authenticity] Case image mouseup detected');
        });
        airpodImgEl.addEventListener('mousedown', function() {
            console.log('[Authenticity] AirPod image mousedown detected');
        });
        airpodImgEl.addEventListener('mouseup', function() {
            console.log('[Authenticity] AirPod image mouseup detected');
        });
        
        // Add visual indicator that images are clickable
        caseImgEl.title = 'Click to enlarge authenticity image';
        airpodImgEl.title = 'Click to enlarge authenticity image';
        
        // Check for any parent elements that might block clicks
        let parent = caseImgEl.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            const style = window.getComputedStyle(parent);
            if (style.pointerEvents === 'none') {
                console.warn('[Authenticity] WARNING: Parent element has pointer-events: none:', parent);
            }
            if (style.zIndex && parseInt(style.zIndex) > 1000) {
                console.warn('[Authenticity] WARNING: Parent element has high z-index:', parent, style.zIndex);
            }
            parent = parent.parentElement;
            depth++;
        }
        
        console.log('[Authenticity] Click handlers attached to images');
        console.log('[Authenticity] Case image element:', caseImgEl);
        console.log('[Authenticity] AirPod image element:', airpodImgEl);
        console.log('[Authenticity] openModal function exists:', typeof openModal);
        
        // Verify handlers are actually attached
        const caseHasHandler = caseImgEl.onclick !== null || caseImgEl.addEventListener.toString().includes('native');
        const airpodHasHandler = airpodImgEl.onclick !== null || airpodImgEl.addEventListener.toString().includes('native');
        console.log('[Authenticity] Case image has onclick handler:', caseHasHandler);
        console.log('[Authenticity] AirPod image has onclick handler:', airpodHasHandler);
        
        // Add a test function to window for manual testing
        window.testAuthenticityModal = function(imageType) {
            console.log('[Test] Testing authenticity modal for:', imageType);
            const el = imageType === 'case' ? caseImgEl : airpodImgEl;
            if (!el) {
                console.error('[Test] Element not found for:', imageType);
                return;
            }
            const path = el.dataset.actualImagePath || el.src;
            console.log('[Test] Using path:', path);
            console.log('[Test] openModal function:', typeof openModal);
            if (typeof openModal === 'function') {
                openModal(0, [path]);
            } else {
                console.error('[Test] openModal is not a function!');
            }
        };
        console.log('[Authenticity] Test function available: window.testAuthenticityModal("case") or window.testAuthenticityModal("airpod")');
        
        // Also test if we can manually trigger click
        console.log('[Authenticity] To test manually, run in console:');
        console.log('[Authenticity]   document.getElementById("authenticityCaseImage").click()');
        console.log('[Authenticity]   document.getElementById("authenticityAirPodImage").click()');
        
        console.log('[Authenticity] Set images:', { caseSrc, airpodSrc });
        console.log('[Authenticity] Updated onclick handlers for images');
    } catch (err) {
        console.error('[Authenticity] Fetch error:', err);
        // Don't use fallback SVGs - just hide containers if fetch fails
        const gridContainer = document.getElementById('authenticityImagesGrid');
        const caseImageContainer = document.getElementById('caseImageContainer');
        const airpodImageContainer = document.getElementById('airpodImageContainer');
        
        if (caseImageContainer) {
            caseImageContainer.style.display = 'none';
        }
        if (airpodImageContainer) {
            airpodImageContainer.style.display = 'none';
        }
        if (gridContainer) {
            gridContainer.style.display = 'none';
        }
        // Clear image sources
        caseImgEl.src = '';
        airpodImgEl.src = '';
    }
}

// Load authenticity images for the authenticity check step (shown when "No" on serial number uniqueness)
async function loadAuthenticityCheckImages(partModelNumber, partType) {
    console.log('[Authenticity Check] Loading images for:', partModelNumber, partType);
    
    try {
        const response = await fetch(`${API_BASE}/api/authenticity-images/${partModelNumber}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        let images;
        if (data.data && data.data.images) {
            images = data.data.images;
        } else if (data.authenticity_case_image || data.authenticity_airpod_image) {
            images = {
                caseImage: data.authenticity_case_image || null,
                airpodImage: data.authenticity_airpod_image || null
            };
        } else {
            images = { caseImage: null, airpodImage: null };
        }
        
        const caseImgEl = document.getElementById('authenticityCheckCaseImage');
        const airpodImgEl = document.getElementById('authenticityCheckAirpodImage');
        const caseContainer = document.getElementById('authenticityCheckCaseContainer');
        const airpodContainer = document.getElementById('authenticityCheckAirpodContainer');
        const gridContainer = document.getElementById('authenticityCheckImagesGrid');
        
        const normalizedPartType = partType ? partType.toLowerCase().trim() : '';
        
        // Handle case image
        if (images.caseImage && normalizedPartType !== 'case') {
            const caseSrc = images.caseImage.startsWith('/') ? images.caseImage : '/' + images.caseImage;
            if (caseImgEl) {
                caseImgEl.src = caseSrc;
                caseImgEl.style.display = 'block';
            }
            if (caseContainer) {
                caseContainer.style.display = 'block';
            }
        } else {
            if (caseContainer) caseContainer.style.display = 'none';
            if (caseImgEl) caseImgEl.style.display = 'none';
        }
        
        // Handle AirPod image
        if (images.airpodImage) {
            const airpodSrc = images.airpodImage.startsWith('/') ? images.airpodImage : '/' + images.airpodImage;
            if (airpodImgEl) {
                airpodImgEl.src = airpodSrc;
                airpodImgEl.style.display = 'block';
            }
            if (airpodContainer) {
                airpodContainer.style.display = 'block';
            }
        } else {
            if (airpodContainer) airpodContainer.style.display = 'none';
            if (airpodImgEl) airpodImgEl.style.display = 'none';
        }
        
        // Show grid if at least one image is visible
        if (gridContainer) {
            const hasCase = caseContainer && caseContainer.style.display !== 'none';
            const hasAirpod = airpodContainer && airpodContainer.style.display !== 'none';
            if (hasCase || hasAirpod) {
                gridContainer.style.display = 'grid';
                if (hasCase && hasAirpod) {
                    gridContainer.style.gridTemplateColumns = '1fr 1fr';
                } else {
                    gridContainer.style.gridTemplateColumns = '1fr';
                }
            } else {
                gridContainer.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('[Authenticity Check] Error loading images:', err);
    }
}

// Load authenticity images for the second-level authenticity step (shown when "Yes" on serial number uniqueness)
async function loadSecondLevelAuthenticityImages(partModelNumber, partType) {
    console.log('[Second Level Authenticity] Loading images for:', partModelNumber, partType);
    
    try {
        const response = await fetch(`${API_BASE}/api/authenticity-images/${partModelNumber}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        let images;
        if (data.data && data.data.images) {
            images = data.data.images;
        } else if (data.authenticity_case_image || data.authenticity_airpod_image) {
            images = {
                caseImage: data.authenticity_case_image || null,
                airpodImage: data.authenticity_airpod_image || null
            };
        } else {
            images = { caseImage: null, airpodImage: null };
        }
        
        const caseImgEl = document.getElementById('secondLevelCaseImage');
        const airpodImgEl = document.getElementById('secondLevelAirpodImage');
        const caseContainer = document.getElementById('secondLevelCaseContainer');
        const airpodContainer = document.getElementById('secondLevelAirpodContainer');
        const gridContainer = document.getElementById('secondLevelAuthenticityImagesGrid');
        
        const normalizedPartType = partType ? partType.toLowerCase().trim() : '';
        
        // Handle case image
        if (images.caseImage && normalizedPartType !== 'case') {
            const caseSrc = images.caseImage.startsWith('/') ? images.caseImage : '/' + images.caseImage;
            if (caseImgEl) {
                caseImgEl.src = caseSrc;
                caseImgEl.style.display = 'block';
            }
            if (caseContainer) {
                caseContainer.style.display = 'block';
            }
        } else {
            if (caseContainer) caseContainer.style.display = 'none';
            if (caseImgEl) caseImgEl.style.display = 'none';
        }
        
        // Handle AirPod image
        if (images.airpodImage) {
            const airpodSrc = images.airpodImage.startsWith('/') ? images.airpodImage : '/' + images.airpodImage;
            if (airpodImgEl) {
                airpodImgEl.src = airpodSrc;
                airpodImgEl.style.display = 'block';
            }
            if (airpodContainer) {
                airpodContainer.style.display = 'block';
            }
        } else {
            if (airpodContainer) airpodContainer.style.display = 'none';
            if (airpodImgEl) airpodImgEl.style.display = 'none';
        }
        
        // Show grid if at least one image is visible
        if (gridContainer) {
            const hasCase = caseContainer && caseContainer.style.display !== 'none';
            const hasAirpod = airpodContainer && airpodContainer.style.display !== 'none';
            if (hasCase || hasAirpod) {
                gridContainer.style.display = 'grid';
                if (hasCase && hasAirpod) {
                    gridContainer.style.gridTemplateColumns = '1fr 1fr';
                } else {
                    gridContainer.style.gridTemplateColumns = '1fr';
                }
            } else {
                gridContainer.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('[Second Level Authenticity] Error loading images:', err);
    }
}

// Setup event listeners for markings verification radio buttons
let markingsVerificationListenersAttached = false;
function setupMarkingsVerificationListeners() {
    // Prevent duplicate listeners
    if (markingsVerificationListenersAttached) {
        console.log('[Markings Verification] Listeners already attached, skipping');
        return;
    }
    
    const yesRadio = document.getElementById('verifyMarkingsYes');
    const noRadio = document.getElementById('verifyMarkingsNo');
    const explanation = document.getElementById('markingsExplanation');
    
    if (!yesRadio || !noRadio) {
        console.warn('[Markings Verification] Radio buttons not found');
        return;
    }
    
    // Handle "No" selection
    const handleNoSelection = () => {
        if (noRadio.checked && noRadio.value === 'no') {
            if (explanation) {
                explanation.style.display = 'block';
                explanation.style.animation = 'fadeIn 0.3s ease';
                setTimeout(() => {
                    explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            }
        }
    };
    
    // Handle "Yes" selection
    const handleYesSelection = () => {
        if (yesRadio.checked && yesRadio.value === 'yes') {
            console.log('[Markings Verification] "Yes" selected - proceeding to next step');
            if (explanation) {
                explanation.style.display = 'none';
            }
            
            // Mark all verification steps as complete (steps 1-5)
            for (let i = 1; i <= 5; i++) {
                verificationState.completedSteps.add(i);
            }
            console.log('[Markings Verification] All verification steps marked as complete');
            
            // Hide the second-level authenticity step
            const secondLevelStep = document.getElementById('secondLevelAuthenticityStep');
            if (secondLevelStep) {
                secondLevelStep.style.display = 'none';
            }
            
            // Hide step 1 container if still visible
            const step1 = document.getElementById('step1');
            if (step1) {
                step1.style.display = 'none';
            }
            
            // Hide verification steps container
            const verificationStepsContainer = document.getElementById('verificationSteps');
            if (verificationStepsContainer) {
                verificationStepsContainer.style.display = 'none';
            }
            
            // Hide the continue button
            const continueBtn = document.getElementById('continueBtn1');
            if (continueBtn) {
                continueBtn.style.display = 'none';
                continueBtn.disabled = true;
            }
            
            // Continue to Contact Information step (step 2 in main flow)
            setTimeout(() => {
                console.log('[Markings Verification] Navigating to Contact Information step (step 2)');
                // showStep will set appState.currentStep = 2 and call updateProgressIndicator() internally
                showStep(2, true); // Force navigation to step 2 (Contact Information)
            }, 300);
        }
    };
    
    // Attach event listeners (only once)
    noRadio.addEventListener('change', handleNoSelection);
    noRadio.addEventListener('click', handleNoSelection);
    yesRadio.addEventListener('change', handleYesSelection);
    yesRadio.addEventListener('click', handleYesSelection);
    
    markingsVerificationListenersAttached = true;
    console.log('[Markings Verification] Event listeners attached');
}

// Verification step state
let verificationState = {
    currentStep: 1,
    totalSteps: 5,
    completedSteps: new Set(),
    listenersAttached: false
};

// Initialize step-by-step verification flow
function initializeVerificationSteps() {
    // Reset state
    verificationState.currentStep = 1;
    verificationState.completedSteps.clear();
    verificationState.listenersAttached = false;
    
    // Reset all radio buttons
    const allRadioGroups = [
        { name: 'verifyCompatibility', yesId: 'verifyCompatibilityYes', noId: 'verifyCompatibilityNo' },
        { name: 'verifyAuthenticity', yesId: 'verifyAuthenticityYes', noId: 'verifyAuthenticityNo' },
        { name: 'verifySerialNumbers', yesId: 'verifySerialNumbersYes', noId: 'verifySerialNumbersNo' },
        { name: 'verifyCondition', yesId: 'verifyConditionYes', noId: 'verifyConditionNo' },
        { name: 'verifyReady', yesId: 'verifyReadyYes', noId: 'verifyReadyNo' }
    ];
    allRadioGroups.forEach(group => {
        const yesRadio = document.getElementById(group.yesId);
        const noRadio = document.getElementById(group.noId);
        if (yesRadio) yesRadio.checked = false;
        if (noRadio) noRadio.checked = false;
    });
    
    // Disable continue button initially
    const continueBtn = document.getElementById('continueBtn1');
    if (continueBtn) continueBtn.disabled = true;
    
    // Verification step counter removed - using main progress bar instead
    
    // Show first step
    showVerificationStep(1);
    
    // Setup radio button handlers for each verification step
    const radioGroups = {
        1: { name: 'verifyCompatibility', yesId: 'verifyCompatibilityYes', noId: 'verifyCompatibilityNo' },
        2: { name: 'verifyAuthenticity', yesId: 'verifyAuthenticityYes', noId: 'verifyAuthenticityNo' },
        3: { name: 'verifySerialNumbers', yesId: 'verifySerialNumbersYes', noId: 'verifySerialNumbersNo' },
        4: { name: 'verifyCondition', yesId: 'verifyConditionYes', noId: 'verifyConditionNo' },
        5: { name: 'verifyReady', yesId: 'verifyReadyYes', noId: 'verifyReadyNo' }
    };
    
    // Handle radio button changes
    if (!verificationState.listenersAttached) {
        Object.keys(radioGroups).forEach(stepNum => {
            const group = radioGroups[stepNum];
            const stepNumber = parseInt(stepNum);
            const yesRadio = document.getElementById(group.yesId);
            const noRadio = document.getElementById(group.noId);
            
            // Handle "Yes" selection - auto-advance immediately
            if (yesRadio) {
                // Use both 'change' and 'click' events to ensure it triggers
                const handleYesSelection = function() {
                    if (this.checked && this.value === 'yes') {
                        // Get the actual step number from the radio button's data or ID
                        const actualStepNumber = stepNumber; // This should be 1-5
                        
                        // Special handling for step 3 (Serial Number Uniqueness) - show second-level authenticity check
                        if (actualStepNumber === 3) {
                            console.log('[Verification] Step 3 - "Yes" selected, showing second-level authenticity check');
                            
                            // Hide step 1 container
                            const step1 = document.getElementById('step1');
                            if (step1) {
                                step1.style.display = 'none';
                            }
                            
                            // Hide all other step containers
                            document.querySelectorAll('.step-container').forEach(step => {
                                step.classList.remove('active');
                                step.style.display = 'none';
                            });
                            
                            // Hide verification steps container
                            const verificationStepsContainer = document.getElementById('verificationSteps');
                            if (verificationStepsContainer) {
                                verificationStepsContainer.style.display = 'none';
                            }
                            
                            // Hide the continue button
                            const continueBtn = document.getElementById('continueBtn1');
                            if (continueBtn) {
                                continueBtn.style.display = 'none';
                                continueBtn.disabled = true;
                            }
                            
                            // Show second-level authenticity step
                            const secondLevelStep = document.getElementById('secondLevelAuthenticityStep');
                            if (secondLevelStep) {
                                secondLevelStep.style.display = 'block';
                                secondLevelStep.style.animation = 'fadeIn 0.3s ease';
                                // Update progress indicator to ensure it's visible and shows Step 1 of 7
                                updateProgressIndicator();
                                console.log('[Verification] Second-level authenticity step displayed');
                                
                                // Load authenticity images
                                if (appState.productData && appState.productData.part_model_number) {
                                    loadSecondLevelAuthenticityImages(appState.productData.part_model_number, appState.productData.part_type);
                                }
                                
                                // Scroll to second-level step
                                setTimeout(() => {
                                    secondLevelStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                                
                                // Setup event listeners for markings verification
                                setupMarkingsVerificationListeners();
                            } else {
                                console.error('[Verification] Second-level authenticity step element not found!');
                            }
                            
                            // Don't auto-advance - stop here
                            return;
                        }
                        
                        // Skip step 3 - it's handled above with second-level authenticity check
                        if (actualStepNumber === 3) {
                            console.log('[Verification] Step 3 already handled - skipping auto-advance');
                            return;
                        }
                        
                        verificationState.completedSteps.add(actualStepNumber);
                        console.log(`[Verification] Step ${actualStepNumber} - "Yes" selected, auto-advancing...`);
                        console.log(`[Verification] Completed steps: ${verificationState.completedSteps.size}/${verificationState.totalSteps}`);
                        
                        // Auto-advance to next step immediately (with minimal delay for smooth transition)
                        setTimeout(() => {
                            // Check if all verification steps are complete FIRST
                            const completedCount = verificationState.completedSteps.size;
                            const totalCount = verificationState.totalSteps;
                            const allStepsComplete = completedCount === totalCount;
                            
                            // Special case: If step 5 (last step) is selected, proceed regardless
                            const isLastStep = actualStepNumber === totalCount;
                            
                            console.log(`[Verification] Checking completion: ${completedCount} === ${totalCount} = ${allStepsComplete}, isLastStep: ${isLastStep}`);
                            
                            if (allStepsComplete || isLastStep) {
                                console.log('[Verification] ✅ All steps complete!', {
                                    completedSteps: completedCount,
                                    totalSteps: totalCount,
                                    currentStep: verificationState.currentStep,
                                    completedSet: Array.from(verificationState.completedSteps)
                                });
                                
                                // Hide the continue button immediately
                                const continueBtn = document.getElementById('continueBtn1');
                                if (continueBtn) {
                                    continueBtn.style.display = 'none';
                                    continueBtn.disabled = true;
                                    console.log('[Verification] Continue button hidden');
                                }
                                
                                // Hide verification steps container
                                const verificationStepsContainer = document.getElementById('verificationSteps');
                                if (verificationStepsContainer) {
                                    verificationStepsContainer.style.display = 'none';
                                }
                                
                                // Hide product record display section to clean up
                                const productDisplay = document.getElementById('productRecordDisplay');
                                if (productDisplay) {
                                    // Don't hide it completely, just hide verification part
                                    const verificationSection = productDisplay.querySelector('#verificationSteps');
                                    if (verificationSection) {
                                        verificationSection.style.display = 'none';
                                    }
                                }
                                
                                // Automatically proceed to Contact Information step after a brief delay
                                setTimeout(() => {
                                    console.log('[Verification] 🚀 Navigating to Contact Information (step 2)');
                                    showStep(2, true); // Force navigation to step 2 (Contact Information) - NOT step 3!
                                }, 300); // Reduced delay for faster progression
                            } else if (verificationState.currentStep < verificationState.totalSteps) {
                                // There are more verification steps, advance to next one
                                verificationState.currentStep++;
                                console.log(`[Verification] Advancing to step ${verificationState.currentStep}`);
                                showVerificationStep(verificationState.currentStep);
                            } else {
                                // We're on the last step - check if we should proceed
                                console.log('[Verification] ⚠️ Last step reached - checking completion status');
                                console.log('[Verification] Debug info:', {
                                    completedSteps: completedCount,
                                    totalSteps: totalCount,
                                    currentStep: verificationState.currentStep,
                                    completedSet: Array.from(verificationState.completedSteps),
                                    allStepsComplete: allStepsComplete
                                });
                                
                                // If all steps are complete but the check above didn't catch it, proceed anyway
                                if (completedCount >= totalCount) {
                                    console.log('[Verification] ✅ All steps complete (fallback check)!');
                                    const continueBtn = document.getElementById('continueBtn1');
                                    if (continueBtn) {
                                        continueBtn.style.display = 'none';
                                        continueBtn.disabled = true;
                                    }
                                    const verificationStepsContainer = document.getElementById('verificationSteps');
                                    if (verificationStepsContainer) {
                                        verificationStepsContainer.style.display = 'none';
                                    }
                                    setTimeout(() => {
                                        console.log('[Verification] 🚀 Navigating to Contact Information (step 3)');
                                        showStep(3, true);
                                    }, 300);
                                }
                            }
                        }, 200); // Minimal delay for smooth UI transition
                    }
                };
                
                // Attach both events to ensure it works reliably
                yesRadio.addEventListener('change', handleYesSelection);
                yesRadio.addEventListener('click', handleYesSelection);
            }
            
            // Handle "No" selection
            if (noRadio) {
                const handleNoSelection = function() {
                    if (this.checked && this.value === 'no') {
                        console.log(`[Verification] Step ${stepNumber} - "No" selected`);
                        console.log(`[Verification] stepNumber type: ${typeof stepNumber}, value: ${stepNumber}`);
                        
                        // Special handling for step 1 (Compatibility) - show explanation
                        if (stepNumber === 1 || stepNumber === '1') {
                            console.log('[Verification] Step 1 - "No" selected, showing compatibility explanation');
                            const explanation = document.getElementById('compatibilityExplanation');
                            console.log('[Verification] Explanation element found:', !!explanation);
                            
                            if (explanation) {
                                explanation.style.display = 'block';
                                explanation.style.animation = 'fadeIn 0.3s ease';
                                
                                // Update explanation with current part numbers
                                const purchasedPartEl = document.getElementById('purchasedPartNumberExplanation');
                                const compatiblePartsEl = document.getElementById('compatiblePartNumbersExplanation');
                                const purchasedPart = document.getElementById('purchasedPartNumber');
                                const compatibleParts = document.getElementById('compatiblePartNumbers');
                                
                                if (purchasedPartEl && purchasedPart) {
                                    purchasedPartEl.textContent = purchasedPart.textContent || 'your part';
                                }
                                if (compatiblePartsEl && compatibleParts) {
                                    compatiblePartsEl.textContent = compatibleParts.textContent || 'compatible parts';
                                }
                                
                                // Scroll to explanation
                                setTimeout(() => {
                                    explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }, 100);
                            } else {
                                console.error('[Verification] Compatibility explanation element not found!');
                                alert('Explanation element not found. Please refresh the page.');
                            }
                            
                            // Always return for step 1 - prevent any redirect
                            return;
                        }
                        // Special handling for step 2 (Authenticity) - show explanation
                        else if (stepNumber === 2 || stepNumber === '2') {
                            const explanation = document.getElementById('authenticityExplanation');
                            if (explanation) {
                                explanation.style.display = 'block';
                                explanation.style.animation = 'fadeIn 0.3s ease';
                                
                                // Scroll to explanation
                                setTimeout(() => {
                                    explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }, 100);
                                
                                // Prevent default redirect - return early
                                return;
                            } else {
                                console.error('[Verification] Authenticity explanation element not found!');
                                // Fallback: redirect if element not found
                                window.location.href = 'ebay-return.html';
                            }
                            return; // Always return for step 2
                        }
                        // Special handling for step 5 (Ready to proceed) - show return process step
                        else if (stepNumber === 5 || stepNumber === '5') {
                            console.log('[Return Process] Showing return process step');
                            
                            // Hide step 1 container
                            const step1 = document.getElementById('step1');
                            if (step1) {
                                step1.style.display = 'none';
                            }
                            
                            // Hide all other step containers
                            document.querySelectorAll('.step-container').forEach(step => {
                                step.classList.remove('active');
                                step.style.display = 'none';
                            });
                            
                            // Show return process step
                            const returnProcessStep = document.getElementById('returnProcessStep');
                            if (returnProcessStep) {
                                returnProcessStep.style.display = 'block';
                                returnProcessStep.style.animation = 'fadeIn 0.3s ease';
                                console.log('[Return Process] Return step displayed');
                                
                                // Scroll to return step
                                setTimeout(() => {
                                    returnProcessStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            } else {
                                console.error('[Return Process] Return step element not found!');
                                // Fallback: redirect if element not found
                                window.location.href = 'ebay-return.html';
                            }
                        }
                        // Special handling for step 3 (Serial Number Uniqueness) - show authenticity check step
                        else if (stepNumber === 3 || stepNumber === '3') {
                            console.log('[Verification] Step 3 - "No" selected, showing authenticity check step');
                            
                            // Keep appState.currentStep at 1 (we're still on step 1 verification)
                            // Don't change appState.currentStep - we're still in the verification phase
                            
                            // Hide step 1 container
                            const step1 = document.getElementById('step1');
                            if (step1) {
                                step1.style.display = 'none';
                            }
                            
                            // Hide all other step containers
                            document.querySelectorAll('.step-container').forEach(step => {
                                step.classList.remove('active');
                                step.style.display = 'none';
                            });
                            
                            // Show authenticity check step
                            const authenticityCheckStep = document.getElementById('authenticityCheckStep');
                            if (authenticityCheckStep) {
                                authenticityCheckStep.style.display = 'block';
                                authenticityCheckStep.style.animation = 'fadeIn 0.3s ease';
                                // Update progress indicator to ensure it's visible and shows Step 1 of 7
                                updateProgressIndicator();
                                console.log('[Verification] Authenticity check step displayed');
                                
                                // Load authenticity images
                                if (appState.productData && appState.productData.part_model_number) {
                                    loadAuthenticityCheckImages(appState.productData.part_model_number, appState.productData.part_type);
                                }
                                
                                // Update progress indicator to show we're still on step 1
                                updateProgressIndicator();
                                
                                // Scroll to authenticity check step
                                setTimeout(() => {
                                    authenticityCheckStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            } else {
                                console.error('[Verification] Authenticity check step element not found!');
                                // Fallback: redirect if element not found
                                window.location.href = 'ebay-return.html';
                            }
                            return; // Always return for step 3 "No"
                        } else {
                            // For steps 4, redirect to eBay return
                            console.log(`[Verification] Step ${stepNumber} - "No" selected, redirecting to eBay return`);
                            window.location.href = 'ebay-return.html';
                        }
                    } else if (this.checked && this.value === 'yes') {
                        // Hide explanations when "Yes" is selected
                        if (stepNumber === 1 || stepNumber === '1') {
                            const explanation = document.getElementById('compatibilityExplanation');
                            if (explanation) explanation.style.display = 'none';
                        } else if (stepNumber === 2 || stepNumber === '2') {
                            const explanation = document.getElementById('authenticityExplanation');
                            if (explanation) explanation.style.display = 'none';
                        }
                        // Special handling for step 3 (Serial Number Uniqueness) - show second-level authenticity check
                        else if (stepNumber === 3 || stepNumber === '3') {
                            console.log('[Verification] Step 3 - "Yes" selected, showing second-level authenticity check');
                            
                            // Hide step 1 container
                            const step1 = document.getElementById('step1');
                            if (step1) {
                                step1.style.display = 'none';
                            }
                            
                            // Hide all other step containers
                            document.querySelectorAll('.step-container').forEach(step => {
                                step.classList.remove('active');
                                step.style.display = 'none';
                            });
                            
                            // Show second-level authenticity step
                            const secondLevelStep = document.getElementById('secondLevelAuthenticityStep');
                            if (secondLevelStep) {
                                secondLevelStep.style.display = 'block';
                                secondLevelStep.style.animation = 'fadeIn 0.3s ease';
                                // Update progress indicator to ensure it's visible and shows Step 1 of 7
                                updateProgressIndicator();
                                console.log('[Verification] Second-level authenticity step displayed');
                                
                                // Load authenticity images
                                if (appState.productData && appState.productData.part_model_number) {
                                    loadSecondLevelAuthenticityImages(appState.productData.part_model_number, appState.productData.part_type);
                                }
                                
                                // Scroll to second-level step
                                setTimeout(() => {
                                    secondLevelStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            } else {
                                console.error('[Verification] Second-level authenticity step element not found!');
                            }
                            
                            // Setup event listeners for markings verification
                            setupMarkingsVerificationListeners();
                        }
                    }
                };
                
                // Attach both change and click events
                noRadio.addEventListener('change', handleNoSelection);
                noRadio.addEventListener('click', handleNoSelection);
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
        
        // Update progress indicator to ensure it's visible and shows Step 1 of 7 during verification
        updateProgressIndicator();
        
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
    console.log('[Modal] ===== openModal CALLED =====');
    console.log('[Modal] Parameters:', { index, photos, photosLength: photos?.length });
    console.log('[Modal] Stack trace:', new Error().stack);
    
    currentReviewPhotoIndex = index;
    reviewPhotos = photos;
    
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalClose = document.getElementById('modalClose');
    
    console.log('[Modal] Modal element found:', !!modal);
    console.log('[Modal] ModalImage element found:', !!modalImage);
    console.log('[Modal] ModalClose element found:', !!modalClose);
    
    if (!modal) {
        console.error('[Modal] ERROR: Modal element not found!');
        console.error('[Modal] Searching for modal...');
        const allModals = document.querySelectorAll('[id*="modal"], [class*="modal"]');
        console.error('[Modal] Found elements with modal in id/class:', allModals.length);
        alert('Modal not found. Please refresh the page.');
        return;
    }
    
    if (!modalImage) {
        console.error('[Modal] ERROR: ModalImage element not found!');
        alert('Modal image element not found. Please refresh the page.');
        return;
    }
    
    const photo = photos[index];
    console.log('[Modal] Photo at index:', photo);
    
    if (!photo) {
        console.error('[Modal] ERROR: No photo at index', index);
        console.error('[Modal] Photos array:', photos);
        return;
    }
    
    // Handle both full URLs and relative paths
    let photoPath;
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
        // Already a full URL, use as is
        photoPath = photo;
        console.log('[Modal] Using full URL:', photoPath);
    } else {
        // Relative path - ensure it starts with /
        photoPath = photo.startsWith('/') ? photo : `/${photo}`;
        console.log('[Modal] Using relative path:', photoPath);
    }
    
    console.log('[Modal] Final photo path:', photoPath);
    console.log('[Modal] Modal current display:', window.getComputedStyle(modal).display);
    console.log('[Modal] ModalImage current src:', modalImage.src);
    
    // Set up error handler for modal image
    modalImage.onerror = function() {
        console.error('[Modal] ===== IMAGE FAILED TO LOAD =====');
        console.error('[Modal] Failed path:', photoPath);
        console.error('[Modal] Image element:', this);
        console.error('[Modal] Current src:', this.src);
        // Try to show a helpful message or fallback
        this.alt = 'Image failed to load';
    };
    
    modalImage.onload = function() {
        console.log('[Modal] ===== IMAGE LOADED SUCCESSFULLY =====');
        console.log('[Modal] Loaded path:', photoPath);
        console.log('[Modal] Image dimensions:', this.naturalWidth, 'x', this.naturalHeight);
    };
    
    console.log('[Modal] Setting image src to:', photoPath);
    modalImage.src = photoPath;
    
    console.log('[Modal] Setting modal display to block');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Check if modal is actually visible
    setTimeout(() => {
        const computedStyle = window.getComputedStyle(modal);
        console.log('[Modal] Modal display after setting:', computedStyle.display);
        console.log('[Modal] Modal visibility:', computedStyle.visibility);
        console.log('[Modal] Modal opacity:', computedStyle.opacity);
        console.log('[Modal] Modal z-index:', computedStyle.zIndex);
        
        if (computedStyle.display === 'none') {
            console.error('[Modal] ERROR: Modal display is still none!');
            console.error('[Modal] Modal element:', modal);
            console.error('[Modal] Modal inline style:', modal.style.cssText);
        }
    }, 100);
    
    // Ensure close button is visible
    if (modalClose) {
        modalClose.style.display = 'flex';
        modalClose.style.visibility = 'visible';
        modalClose.style.opacity = '1';
        console.log('[Modal] Close button styles set');
    }
    
    // Update navigation button states
    updateModalNavigation();
    
    console.log('[Modal] ===== openModal COMPLETE =====');
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
function showStep(stepNumber, force = false) {
    console.log('showStep called with stepNumber:', stepNumber, 'currentStep:', appState.currentStep, 'force:', force);
    console.trace('showStep call stack'); // This will show where it's being called from
    
    // If force is true (explicit button click), allow navigation regardless - skip ALL blocking checks
    if (force && stepNumber === 3) {
        console.log('[showStep] ✅ Force flag is TRUE - bypassing ALL blocking checks and allowing navigation to step 3');
        // Skip all blocking logic - continue to actual navigation below
    } else if (stepNumber === 3 && appState.currentStep === 1) {
        // Only run blocking checks if force is NOT true
        console.log('[showStep] ⚠️ Force flag is FALSE or not step 3 - checking blocking conditions');
        // Only run blocking checks if force is NOT true
        // Check if all verification steps are complete (allow navigation to step 3)
        const continueBtn = document.getElementById('continueBtn1');
        const buttonText = continueBtn ? continueBtn.textContent.trim() : '';
        const allVerificationStepsComplete = verificationState && verificationState.completedSteps && 
                                             verificationState.completedSteps.size === verificationState.totalSteps;
        const isVerificationComplete = allVerificationStepsComplete || buttonText === 'Continue to Contact Information';
        
        // Debug logging
        if (stepNumber === 2 && appState.currentStep === 1) {
            console.log('[showStep] Checking verification status:', {
                buttonText,
                allVerificationStepsComplete,
                isVerificationComplete,
                force,
                verificationStateExists: !!verificationState,
                completedStepsSize: verificationState?.completedSteps?.size,
                totalSteps: verificationState?.totalSteps
            });
        }
        
        // Prevent auto-advance from step 1 to step 3 if product is being displayed
        // BUT allow it if verification is complete OR button says "Continue to Contact Information"
        if (stepNumber === 3 && appState.currentStep === 1 && !isVerificationComplete) {
            const productDisplay = document.getElementById('productRecordDisplay');
            const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
            if (isProductDisplayed || appState.productData) {
                console.log('BLOCKED: Preventing auto-advance from step 1 to step 3 - product is displayed (verification not complete)');
                console.log('Product display visible:', isProductDisplayed, 'Product data exists:', !!appState.productData, 'Button text:', buttonText);
                return; // Stay on step 1
            }
        }
        
        // Also prevent if we're on step 1 and have product data but haven't shown it yet
        // BUT allow it if verification is complete OR button says "Continue to Contact Information"
        if (stepNumber === 2 && appState.currentStep === 1 && appState.productData && !isVerificationComplete) {
            console.log('BLOCKED: Preventing step 2 - product data loaded but should stay on step 1 (verification not complete)');
            console.log('Button text:', buttonText, 'Verification complete:', isVerificationComplete);
            return;
        }
        
        // If verification is complete, allow navigation
        if (stepNumber === 2 && isVerificationComplete) {
            console.log('ALLOWED: Navigation to step 2 - verification complete');
        }
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
        
        // Start countdown timer on warranty step and load warranty options
        if (stepNumber === 5) {
            setTimeout(() => startCountdownTimer(), 100);
            // Load and display warranty options dynamically
            loadAndDisplayWarrantyOptions();
        }
        
        // Load setup instructions when showing step 3
        if (stepNumber === 3) {
            console.log('[showStep] Step 3 detected - checking for setup instructions');
            console.log('[showStep] appState.productData:', appState.productData);
            if (appState.productData) {
                const partModelNumber = appState.productData.part_model_number;
                const generation = appState.productData.generation;
                console.log('[showStep] Part model number:', partModelNumber, 'Generation:', generation);
                if (partModelNumber || generation) {
                    console.log('[showStep] Calling loadSetupInstructions');
                    loadSetupInstructions(partModelNumber, generation);
                } else {
                    console.warn('[showStep] No partModelNumber or generation available - setting up default instructions');
                    setupStepCheckboxes();
                }
            } else {
                console.warn('[showStep] appState.productData is null/undefined - setting up default instructions');
                setupStepCheckboxes();
            }
        }
        
        // Load payment summary when showing step 7 (Stripe payment)
        if (stepNumber === 7) {
            loadPaymentSummary();
            initializeStripePayment();
        }
        
        // Load add-on sales when showing step 6
        if (stepNumber === 6 && appState.productData) {
            const generation = appState.productData.generation;
            const partModelNumber = appState.productData.part_model_number;
            if (generation && partModelNumber) {
                loadAddonSalesForProduct(generation, partModelNumber).catch(err => {
                    console.error('Error loading add-on sales:', err);
                });
            }
        }
        
        // Load T&Cs when showing step 2 (Contact Information)
        if (stepNumber === 2) {
            loadTermsAndConditions();
        }
        
        // Handle step 4 (30-day Warranty Confirmation) - CRITICAL: Must run immediately
        if (stepNumber === 4) {
            console.log('[showStep] Step 4 detected - executing step 4 handling code IMMEDIATELY');
            
            // Function to setup step 4 content - runs immediately and as backup
            const setupStep4Content = () => {
                const step4Container = document.getElementById('step4');
                if (!step4Container) {
                    console.error('[Step 4] Step 4 container not found!');
                    return;
                }
                
                // Ensure step container is visible
                step4Container.style.display = 'block';
                step4Container.classList.add('active');
                
                const successAnimation = document.getElementById('successAnimation');
                const warrantyConfirmation = document.getElementById('warrantyConfirmation');
                
                console.log('[Step 4] successAnimation:', !!successAnimation, 'warrantyConfirmation:', !!warrantyConfirmation);
                
                // Hide success animation immediately
                if (successAnimation) {
                    successAnimation.style.display = 'none';
                    successAnimation.style.visibility = 'hidden';
                }
                
                // Show warranty confirmation immediately - FORCE IT
                if (warrantyConfirmation) {
                    // Remove inline style that hides it and force display
                    warrantyConfirmation.removeAttribute('style');
                    warrantyConfirmation.style.cssText = 'display: block !important; visibility: visible !important;';
                    
                    // Load warranty pricing
                    loadAndDisplayLowestWarrantyPrice();
                    
                    // Display product details if available
                    if (appState.productData) {
                        const productDetailsDisplay = document.getElementById('productDetailsDisplay');
                        if (productDetailsDisplay) {
                            const product = appState.productData;
                            productDetailsDisplay.innerHTML = `
                                <div style="background: white; border: 2px solid #e8ecf1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                                    <h4 style="margin-top: 0; color: #1a1a1a; font-size: 1.1rem; margin-bottom: 12px;">Registered Product</h4>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                        <div>
                                            <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 4px;">Part</div>
                                            <div style="color: #1a1a1a; font-weight: 600;">${escapeHtml(product.part_name || product.part_model_number || 'N/A')}</div>
                                        </div>
                                        <div>
                                            <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 4px;">Model Number</div>
                                            <div style="color: #1a1a1a; font-weight: 600;">${escapeHtml(product.part_model_number || 'N/A')}</div>
                                        </div>
                                        ${product.generation ? `
                                        <div>
                                            <div style="color: #6c757d; font-size: 0.85rem; margin-bottom: 4px;">Generation</div>
                                            <div style="color: #1a1a1a; font-weight: 600;">${escapeHtml(product.generation)}</div>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }
                    }
                    
                    // Calculate and display warranty expiry date
                    const warrantyExpiryEl = document.getElementById('warrantyExpiry');
                    if (warrantyExpiryEl) {
                        const expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 30);
                        const formattedDate = expiryDate.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        });
                        warrantyExpiryEl.textContent = formattedDate;
                    }
                } else {
                    console.error('[Step 4] warrantyConfirmation element not found!');
                }
            };
            
            // Try immediately first
            setupStep4Content();
            
            // Also try after short delays as backup
            setTimeout(setupStep4Content, 50);
            setTimeout(setupStep4Content, 200);
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
    
    // Show progress indicator if:
    // - On step 2+ (always show)
    // - On step 1 with product displayed
    // - On step 1 with security code entered (even before product loads)
    // - On step 1 when coming from home page with barcode (security code entry hidden)
    // - Step 1 was skipped
    const productDisplay = document.getElementById('productRecordDisplay');
    const isProductDisplayed = productDisplay && productDisplay.style.display !== 'none';
    const securityCodeEntry = document.getElementById('securityCodeEntrySection');
    const isSecurityCodeEntered = securityCodeEntry && securityCodeEntry.style.display === 'none';
    // Check if barcode is in URL (coming from home page)
    const urlParams = new URLSearchParams(window.location.search);
    const hasBarcodeInUrl = urlParams.has('barcode');
    // Check if we have a security code stored
    const hasSecurityCode = appState.securityCode || sessionStorage.getItem('securityBarcode');
    
    const shouldShowProgress = appState.currentStep > 1 || 
                               (appState.currentStep === 1 && (isProductDisplayed || isSecurityCodeEntered || hasBarcodeInUrl || hasSecurityCode)) || 
                               appState.skippedStep1;
    
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
        console.log('[Progress Indicator] Updated:', {
            currentStep: appState.currentStep,
            displayStep: displayStep,
            displayTotal: displayTotal,
            skippedStep1: appState.skippedStep1
        });
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

// Handle return feedback submission
function handleReturnFeedback() {
    const submitBtn = document.getElementById('submitReturnFeedback');
    if (submitBtn) {
        submitBtn.addEventListener('click', async function() {
            const returnReason = document.getElementById('returnReason').value;
            const returnComments = document.getElementById('returnComments').value.trim();
            
            if (!returnReason) {
                alert('Please select a reason for return');
                return;
            }
            
            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            try {
                // Send feedback to server (optional - you can implement an API endpoint for this)
                // For now, we'll just log it and redirect
                console.log('Return feedback:', {
                    reason: returnReason,
                    comments: returnComments,
                    securityCode: appState.securityCode,
                    productData: appState.productData
                });
                
                // Track analytics
                trackEvent('return_feedback_submitted', {
                    reason: returnReason,
                    hasComments: returnComments.length > 0
                });
                
                // Small delay for UX
                setTimeout(() => {
                    // Redirect to eBay return page
                    window.location.href = 'ebay-return.html';
                }, 500);
            } catch (error) {
                console.error('Error submitting feedback:', error);
                // Still redirect even if feedback fails
                window.location.href = 'ebay-return.html';
            }
        });
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initializePage();
        handleReturnFeedback();
    });
} else {
    initializePage();
    handleReturnFeedback();
}