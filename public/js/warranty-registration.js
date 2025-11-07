// Warranty Registration Flow - Enhanced UX
// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// State Management
const appState = {
    currentStep: 1,
    totalSteps: 5,
    securityCode: '',
    failedAttempts: 0,
    productData: null,
    selectedWarranty: '6month',
    selectedAccessories: [],
    setupStepsCompleted: [],
    exitIntentShown: false,
    sessionStartTime: Date.now(),
    skippedStep1: false // Track if step 1 was skipped (coming from home page)
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
            Object.assign(appState, state);
            // Hide step 1 if it was skipped
            if (appState.skippedStep1) {
                const step1 = document.getElementById('step1');
                if (step1) {
                    step1.style.display = 'none';
                }
            }
            return true;
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
    // Immediately check URL for barcode to hide step 1 if needed
    const urlParams = new URLSearchParams(window.location.search);
    const barcodeFromUrl = urlParams.get('barcode');
    
    // Hide step 1 immediately if barcode is in URL (coming from home page)
    if (barcodeFromUrl) {
        const step1 = document.getElementById('step1');
        if (step1) {
            step1.style.display = 'none';
        }
    }
    
    // Check if we should resume from saved state
    const resumed = loadSavedState();
    
    if (resumed && appState.currentStep > 1) {
        showWelcomeBack();
        // Load product info if we have security code
        if (appState.securityCode) {
            loadProductInfo(appState.securityCode, true);
        }
        showStep(appState.currentStep);
    } else {
        // Check URL for barcode
        const barcode = barcodeFromUrl || sessionStorage.getItem('securityBarcode');
        
        if (barcode) {
            appState.securityCode = barcode;
            // If coming from index.html with validated code, skip step 1 entirely
            if (barcodeFromUrl) {
                // Coming from index.html - code already validated, skip step 1
                appState.skippedStep1 = true;
                appState.currentStep = 2; // Start at step 2
                // Load product info and show step 2
                loadProductInfo(barcode, false).then(() => {
                    showStep(2);
                }).catch(() => {
                    // If product load fails, show step 1 for manual entry
                    appState.skippedStep1 = false;
                    appState.currentStep = 1;
                    const step1 = document.getElementById('step1');
                    if (step1) {
                        step1.style.display = 'block';
                    }
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
            if (e.key === 'Enter' && !document.getElementById('continueBtn1').disabled) {
                validateSecurityCode();
            }
        });
        // Auto-focus
        setTimeout(() => securityInput.focus(), 100);
    }
    
    // Continue buttons
    document.getElementById('continueBtn1')?.addEventListener('click', validateSecurityCode);
    document.getElementById('continueBtn2')?.addEventListener('click', () => showStep(3));
    document.getElementById('continueBtn3')?.addEventListener('click', () => {
        trackEvent('warranty_selected', { plan: appState.selectedWarranty });
        showStep(4);
    });
    document.getElementById('continueBtn4')?.addEventListener('click', () => {
        trackEvent('accessories_selected', { items: appState.selectedAccessories });
        showStep(5);
    });
    document.getElementById('continueBtn5')?.addEventListener('click', finishSetup);
    
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
        showStep(4);
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
        showStep(5);
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
                        document.getElementById('continueBtn5').style.display = 'block';
                        
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
            
            // Show success animation
            showSuccessAnimation();
            
            // Load product info and show step 2
            setTimeout(() => {
                loadProductInfo(securityCode, false);
                showStep(2);
            }, 2000);
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
    try {
        const response = await fetch(`${API_BASE}/api/product-info/${encodeURIComponent(barcode)}`);
        const data = await response.json();
        
        if (data.error) {
            if (!skipValidation) {
                showError('Product not found. Please check your security code.');
            }
            return Promise.reject(new Error('Product not found'));
        }
        
        appState.productData = data;
        saveState();
        
        // Display product info
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
            const confirmationEl = document.getElementById('warrantyConfirmation');
            const animationEl = document.getElementById('successAnimation');
            if (confirmationEl) confirmationEl.style.display = 'block';
            if (animationEl) animationEl.classList.remove('show');
        }
        
        return Promise.resolve(data);
        
    } catch (error) {
        console.error('Error loading product:', error);
        if (!skipValidation) {
            showError('Failed to load product information. Please try again.');
        }
        return Promise.reject(error);
    }
}

// Display product info
function displayProductInfo(data) {
                const partTypeMap = {
                    'left': 'Left AirPod',
                    'right': 'Right AirPod',
                    'case': 'Charging Case'
                };
            const partType = partTypeMap[data.part_type] || data.part_type || 'Unknown';
            const productTitle = `${partType}${data.generation ? ' - ' + data.generation : ''}`;
            
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
    
    document.getElementById('productDetailsDisplay').innerHTML = detailsHtml;
}

// Show step
function showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.step-container').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show current step
    const currentStep = document.getElementById(`step${stepNumber}`);
    if (currentStep) {
        currentStep.classList.add('active');
        appState.currentStep = stepNumber;
        saveState();
        updateProgressIndicator();
        
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
        if (stepNumber === 3) {
            setTimeout(() => startCountdownTimer(), 100);
        }
        
        // Auto-dismiss keyboard on mobile
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Update progress indicator
function updateProgressIndicator() {
    const progressIndicator = document.getElementById('progressIndicator');
    const progressSteps = document.getElementById('progressSteps');
    const progressText = document.getElementById('progressText');
    
    if (appState.currentStep > 1 || appState.skippedStep1) {
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
        showStep(3);
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
