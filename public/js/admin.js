// Admin Panel JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Reference the global API_BASE
const API_BASE = window.API_BASE;

// Session Management Configuration
const SESSION_CONFIG = {
    IDLE_TIMEOUT: 15 * 60 * 1000, // 15 minutes in milliseconds
    WARNING_BEFORE_LOGOUT: 2 * 60 * 1000, // Show warning 2 minutes before logout
    STORAGE_TYPE: 'localStorage' // Use localStorage (persists across tabs and page reloads)
};

// Idle timeout management
let idleTimer = null;
let warningTimer = null;
let lastActivity = Date.now();

// Get storage (sessionStorage or localStorage based on config)
function getStorage() {
    return SESSION_CONFIG.STORAGE_TYPE === 'sessionStorage' ? sessionStorage : localStorage;
}

// Migrate tokens to the configured storage (one-time migration)
function migrateTokenStorage() {
    // If using localStorage, migrate from sessionStorage to localStorage
    if (SESSION_CONFIG.STORAGE_TYPE === 'localStorage') {
        const sessionAccessToken = sessionStorage.getItem('accessToken');
        const localAccessToken = localStorage.getItem('accessToken');

        // Migrate from sessionStorage to localStorage if tokens exist in session but not local
        if (sessionAccessToken && !localAccessToken) {
            console.log('[SESSION] Migrating tokens from sessionStorage to localStorage');

            localStorage.setItem('accessToken', sessionAccessToken);

            const sessionRefreshToken = sessionStorage.getItem('refreshToken');
            if (sessionRefreshToken) {
                localStorage.setItem('refreshToken', sessionRefreshToken);
            }

            const sessionUser = sessionStorage.getItem('user');
            if (sessionUser) {
                localStorage.setItem('user', sessionUser);
            }
        }

        // Clear sessionStorage tokens after migration
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
    }
    // If using sessionStorage, migrate from localStorage to sessionStorage
    else if (SESSION_CONFIG.STORAGE_TYPE === 'sessionStorage') {
        const localAccessToken = localStorage.getItem('accessToken');
        const sessionAccessToken = sessionStorage.getItem('accessToken');

        if (localAccessToken && !sessionAccessToken) {
            console.log('[SESSION] Migrating tokens from localStorage to sessionStorage');

            sessionStorage.setItem('accessToken', localAccessToken);

            const localRefreshToken = localStorage.getItem('refreshToken');
            if (localRefreshToken) {
                sessionStorage.setItem('refreshToken', localRefreshToken);
            }

            const localUser = localStorage.getItem('user');
            if (localUser) {
                sessionStorage.setItem('user', localUser);
            }
        }

        // Clear localStorage tokens after migration
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    }
}

// Run migration on page load
migrateTokenStorage();

// Reset idle timer on user activity
function resetIdleTimer() {
    lastActivity = Date.now();

    // Clear existing timers
    if (idleTimer) clearTimeout(idleTimer);
    if (warningTimer) clearTimeout(warningTimer);

    // Set warning timer (2 minutes before logout)
    warningTimer = setTimeout(() => {
        showIdleWarning();
    }, SESSION_CONFIG.IDLE_TIMEOUT - SESSION_CONFIG.WARNING_BEFORE_LOGOUT);

    // Set logout timer
    idleTimer = setTimeout(() => {
        handleIdleLogout();
    }, SESSION_CONFIG.IDLE_TIMEOUT);
}

// Show warning before auto-logout
function showIdleWarning() {
    const minutesLeft = Math.floor(SESSION_CONFIG.WARNING_BEFORE_LOGOUT / 60000);
    const warningMessage = `You will be logged out in ${minutesLeft} minutes due to inactivity. Move your mouse or press a key to stay logged in.`;

    // Create warning banner
    let warningBanner = document.getElementById('idle-warning-banner');
    if (!warningBanner) {
        warningBanner = document.createElement('div');
        warningBanner.id = 'idle-warning-banner';
        warningBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff9800;
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 10000;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(warningBanner);
    }
    warningBanner.textContent = warningMessage;
    warningBanner.style.display = 'block';
}

// Hide warning banner
function hideIdleWarning() {
    const warningBanner = document.getElementById('idle-warning-banner');
    if (warningBanner) {
        warningBanner.style.display = 'none';
    }
}

// Handle auto-logout due to inactivity
function handleIdleLogout() {
    console.log('[SESSION] Auto-logout due to inactivity');

    // Clear tokens
    const storage = getStorage();
    storage.removeItem('accessToken');
    storage.removeItem('refreshToken');
    storage.removeItem('user');

    // Show logout message
    alert('You have been logged out due to inactivity. Please log in again.');

    // Redirect to login
    window.location.href = '/admin/login';
}

// Initialize activity tracking
function initActivityTracking() {
    // Don't track on login page
    if (window.location.pathname.includes('login')) {
        return;
    }

    // Track various user activities
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Throttle activity tracking (don't reset timer on every single event)
    let throttleTimer = null;
    const throttleDelay = 1000; // Only reset timer once per second max

    activityEvents.forEach(eventType => {
        document.addEventListener(eventType, () => {
            hideIdleWarning(); // Hide warning on any activity

            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    resetIdleTimer();
                    throttleTimer = null;
                }, throttleDelay);
            }
        }, true);
    });

    // Start initial timer
    resetIdleTimer();

    console.log(`[SESSION] Activity tracking initialized (timeout: ${SESSION_CONFIG.IDLE_TIMEOUT / 60000} minutes)`);
}

// Utility functions
function showError(message, elementId = 'errorMessage') {
    const errorDiv = document.getElementById(elementId);
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

// Auto-uppercase conversion for serial number, security barcode, and related fields
function setupUppercaseFields() {
    const fields = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], textarea'));
    const targets = fields.filter((field) => {
        const id = field.id || '';
        const name = field.name || '';
        return /serial|security/i.test(id) || /serial|security/i.test(name);
    });

    // Function to convert to uppercase on input
    function convertToUppercase(e) {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        if (typeof start === 'number' && typeof end === 'number') {
            e.target.setSelectionRange(start, end); // Maintain cursor position
        }
    }

    // Function to convert to uppercase on paste
    function convertPasteToUppercase(e) {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const currentValue = e.target.value;
        const newValue = currentValue.substring(0, start) + paste.toUpperCase() + currentValue.substring(end);
        e.target.value = newValue;
        if (typeof start === 'number') {
            e.target.setSelectionRange(start + paste.length, start + paste.length);
        }
    }

    targets.forEach((field) => {
        if (field.dataset.uppercaseBound === 'true') {
            return;
        }
        field.dataset.uppercaseBound = 'true';
        field.addEventListener('input', convertToUppercase);
        field.addEventListener('paste', convertPasteToUppercase);
        if (field.value) {
            field.value = field.value.toUpperCase();
        }
    });
}

// Setup uppercase conversion when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUppercaseFields);
} else {
    setupUppercaseFields();
}

// Support bubble is now handled by main.js with screenshot/annotation support

// Toggle submenu function (for Settings dropdown)
function toggleSubmenu(navItem) {
    if (navItem && navItem.classList) {
        navItem.classList.toggle('expanded');
    }
}

// Make toggleSubmenu available globally
window.toggleSubmenu = toggleSubmenu;

// Check for token in URL (from User Service callback) - MUST be called FIRST on page load
function checkUrlToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const refreshToken = urlParams.get('refresh_token');

    if (token) {
        const storage = getStorage();
        console.log(`✅ Found token in URL, storing in ${SESSION_CONFIG.STORAGE_TYPE}`);
        // Store tokens from URL immediately using configured storage
        storage.setItem('accessToken', token);
        if (refreshToken) {
            storage.setItem('refreshToken', refreshToken);
        }

        // Mark that we just processed a token from URL (to prevent immediate redirect)
        sessionStorage.setItem('tokenJustProcessed', 'true');
        sessionStorage.setItem('tokenProcessedAt', Date.now().toString());

        // Clean up URL (remove token from query string) immediately
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Remove flag after 5 seconds (enough time for page to load)
        setTimeout(() => {
            sessionStorage.removeItem('tokenJustProcessed');
            sessionStorage.removeItem('tokenProcessedAt');
        }, 5000);

        return true; // Indicate token was found and stored
    }
    return false; // No token found
}

// Call this IMMEDIATELY when script loads (before DOMContentLoaded)
checkUrlToken();

// Check authentication status
async function checkAuth() {
    // Check if we just processed a token from URL (within last 5 seconds)
    const tokenJustProcessed = sessionStorage.getItem('tokenJustProcessed') === 'true';
    const tokenProcessedAt = sessionStorage.getItem('tokenProcessedAt');
    const timeSinceProcessed = tokenProcessedAt ? Date.now() - parseInt(tokenProcessedAt) : Infinity;

    if (tokenJustProcessed && timeSinceProcessed < 5000) {
        console.log('⏳ Token just processed from URL (' + Math.round(timeSinceProcessed) + 'ms ago), skipping auth check to prevent redirect loop');
        return; // Don't check auth immediately, let the page load
    }

    // Don't check auth on login page
    if (window.location.pathname.includes('login')) {
        return;
    }

    try {
        const storage = getStorage();
        const token = storage.getItem('accessToken') || document.cookie.split('; ').find(row => row.startsWith('accessToken='))?.split('=')[1];

        if (!token) {
            // Only redirect if we're on a protected page
            if (window.location.pathname.includes('dashboard') ||
                (window.location.pathname.includes('admin') && !window.location.pathname.includes('login'))) {
                console.log('❌ No token found, redirecting to login');
                window.location.href = '/admin/login';
            }
            return;
        }

        // Verify token with User Service (but don't block if it fails immediately after getting token from URL)
        const USER_SERVICE_URL = 'https://autorestock-user-service-production.up.railway.app';
        try {
            const response = await fetch(`${USER_SERVICE_URL}/api/v1/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Only logout on 401 Unauthorized (actual auth failure)
            // Don't logout on service errors (404, 500, etc.) - those are non-fatal
            if (response.status === 401) {
                // Token is actually invalid/expired - logout required
                console.error('❌ Token verification failed: 401 Unauthorized');
                storage.removeItem('accessToken');
                storage.removeItem('refreshToken');
                storage.removeItem('user');
                if (window.location.pathname.includes('dashboard') ||
                    (window.location.pathname.includes('admin') && !window.location.pathname.includes('login'))) {
                    window.location.href = '/admin/login';
                }
            } else if (!response.ok) {
                // Service error (404, 500, etc.) - log warning but keep user logged in
                console.warn(`⚠️ Token verification service error: ${response.status} - keeping session active`);
            } else {
                const data = await response.json();
                if (data.success) {
                    console.log('✅ Token verified successfully');
                } else {
                    console.warn('⚠️ Token verification returned non-success, but not 401 - keeping session active');
                }
            }
        } catch (verifyError) {
            // If verification fails due to network error, don't redirect immediately
            // This prevents redirect loops during network issues
            console.warn('⚠️ Token verification error (non-fatal):', verifyError);
        }
    } catch (error) {
        // Unexpected error in auth check - log but DON'T logout
        // Only logout on explicit 401 responses, not on unexpected errors
        console.error('❌ Auth check error (non-fatal):', error);
        console.warn('⚠️ Keeping user logged in despite auth check error');
    }
}

// Helper function to add auth headers to fetch requests
function authenticatedFetch(url, options = {}) {
    const storage = getStorage();
    const token = storage.getItem('accessToken');
    const headers = {
        ...options.headers
    };

    // Only set Content-Type if not already set and not sending FormData
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log(`[AUTH] Making authenticated request to ${url} with token: ${token.substring(0, 20)}...`);
    } else {
        console.warn(`[AUTH] ⚠️  No token found in ${SESSION_CONFIG.STORAGE_TYPE} for request to ${url}`);
    }

    return fetch(url, {
        ...options,
        headers
    });
}

// Login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const loginButton = document.getElementById('loginButton');
        
        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }
        
        loginButton.disabled = true;
        showSpinner();
        
        try {
            // Try legacy login first (for existing accounts)
            let legacyData;
            try {
                const legacyResponse = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });
                
                // Check if response is JSON
                const contentType = legacyResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    legacyData = await legacyResponse.json();
                } else {
                    // Server returned HTML (error page) instead of JSON
                    const text = await legacyResponse.text();
                    console.error('Legacy login returned non-JSON response:', text.substring(0, 200));
                    throw new Error(`Server error (${legacyResponse.status}): Server returned HTML instead of JSON. The server may be down or misconfigured.`);
                }
                
                if (legacyResponse.ok && legacyData.success) {
                    // Legacy login successful - redirect to dashboard
                    console.log('✅ Legacy login successful');
                    window.location.href = '/admin/dashboard';
                    return;
                }
                
                // If credentials are wrong, show error
                if (legacyResponse.status === 401) {
                    showError(legacyData.message || 'Invalid username or password');
                    loginButton.disabled = false;
                    hideSpinner();
                    return;
                }
            } catch (legacyError) {
                console.error('Legacy login error:', legacyError);
                // If legacy login fails due to server error, try User Service
                console.log('Legacy login failed, trying User Service...');
            }
            
            // If legacy login fails, try User Service
            if (!legacyData || !legacyData.success) {
                console.log('Trying User Service login...');
                const USER_SERVICE_URL = 'https://autorestock-user-service-production.up.railway.app';

                const response = await fetch(`${USER_SERVICE_URL}/api/v1/users/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        email: username, // Use email field (username is email)
                        password: password,
                        serviceName: 'AirPod-Support-Tracking-Portal'
                    })
                });

                console.log('User Service login response status:', response.status);

                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    const text = await response.text();
                    console.error('Failed to parse response:', text);
                    showError(`Server error (${response.status}): ${text || response.statusText}`);
                    loginButton.disabled = false;
                    hideSpinner();
                    return;
                }

                if (response.ok && data.success) {
                    // Store tokens in session storage
                    const storage = getStorage();
                    storage.setItem('accessToken', data.data.accessToken);
                    storage.setItem('refreshToken', data.data.refreshToken);
                    storage.setItem('user', JSON.stringify(data.data.user));

                    console.log(`[SESSION] Tokens stored in ${SESSION_CONFIG.STORAGE_TYPE}`);

                    // Redirect to dashboard
                    window.location.href = '/admin/dashboard';
                } else {
                    // Show detailed error message
                    const errorMsg = data.message || data.error || 'Invalid credentials';
                    console.error('Login failed:', errorMsg, data);

                    let userFriendlyMsg = errorMsg;
                    if (response.status === 401) {
                        userFriendlyMsg = `Authentication failed: ${errorMsg}. Please check your credentials or use the "Login with User Service" button above.`;
                    }

                    showError(userFriendlyMsg);
                    loginButton.disabled = false;
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showError(`Network error: ${error.message}. Please check your connection and try again.`);
            loginButton.disabled = false;
        } finally {
            hideSpinner();
        }
    });
}

// Logout
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        try {
            console.log('[SESSION] Manual logout initiated');

            // Clear session storage
            const storage = getStorage();
            storage.removeItem('accessToken');
            storage.removeItem('refreshToken');
            storage.removeItem('user');

            // Clear timers
            if (idleTimer) clearTimeout(idleTimer);
            if (warningTimer) clearTimeout(warningTimer);

            window.location.href = '/admin/login';
        } catch (error) {
            console.error('Logout error:', error);
            // Clear tokens anyway
            const storage = getStorage();
            storage.removeItem('accessToken');
            storage.removeItem('refreshToken');
            storage.removeItem('user');
            window.location.href = '/admin/login';
        }
    });
}

// Product form - track if we're editing
let editingProductId = null;
const productForm = document.getElementById('productForm');
const addProductButton = document.getElementById('addProductButton');
const cancelEditButton = document.getElementById('cancelEditButton');

// Edit product function
async function editProduct(id) {
    // Check if we're on add-product.html (form page) or products.html (table page)
    const isAddProductPage = window.location.pathname.includes('add-product.html');
    
    if (!isAddProductPage) {
        // If on products page, redirect to add-product page with the product ID
        window.location.href = `add-product.html?edit=${encodeURIComponent(String(id))}`;
        return;
    }
    
    // If on add-product page, populate the form
    try {
        // Get all products to find the one we're editing
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products`);
        const data = await response.json();
        
        if (response.ok && data.products) {
            const product = data.products.find(p => String(p.id) === String(id));
            if (product) {
                // Store editing ID
                editingProductId = product.id;
                
                // Populate form fields
                document.getElementById('serialNumber').value = product.serial_number || '';
                document.getElementById('securityBarcode').value = product.security_barcode || '';
                document.getElementById('partModelNumber').value = product.part_model_number || '';
                
                // Set generation and trigger change to populate part selection
                const generationSelect = document.getElementById('generation');
                if (generationSelect && product.generation) {
                    generationSelect.value = product.generation;
                    generationSelect.dispatchEvent(new Event('change'));
                    
                    // Wait for dropdown to populate, then set part selection
                    setTimeout(() => {
                        const partSelectionSelect = document.getElementById('partSelection');
                        if (partSelectionSelect) {
                            // Find the option that matches the part model number
                            const options = Array.from(partSelectionSelect.options);
                            const matchingOption = options.find(opt => 
                                opt.dataset.modelNumber === product.part_model_number
                            );
                            if (matchingOption) {
                                partSelectionSelect.value = matchingOption.value;
                                partSelectionSelect.dispatchEvent(new Event('change'));
                            }
                        }
                    }, 200);
                }
                
                // Set part type
                const partTypeSelect = document.getElementById('partType');
                if (partTypeSelect && product.part_type) {
                    partTypeSelect.value = product.part_type;
                }
                
                // Set notes and eBay order number
                document.getElementById('notes').value = product.notes || '';
                document.getElementById('ebayOrderNumber').value = product.ebay_order_number || '';
                
                // Update button text and show cancel button
                if (addProductButton) {
                    addProductButton.textContent = 'Update Product';
                }
                if (cancelEditButton) {
                    cancelEditButton.style.display = 'inline-block';
                }
                
                // Scroll to form
                document.querySelector('.admin-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                showSuccess('Product loaded for editing. Make changes and click "Update Product"');
            } else {
                showError('Product not found');
            }
        }
    } catch (error) {
        console.error('Edit product error:', error);
        showError('Failed to load product for editing');
    }
}

// Cancel edit function
function cancelEdit() {
    // If we came from products page (via edit parameter), go back to products page
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('edit')) {
        window.location.href = 'products.html';
        return;
    }
    
    // Otherwise just reset the form
    editingProductId = null;
    productForm.reset();
    const partSelectionSelect = document.getElementById('partSelection');
    if (partSelectionSelect) {
        partSelectionSelect.innerHTML = '<option value="">Select part</option>';
    }
    if (addProductButton) {
        addProductButton.textContent = 'Add Product';
    }
    // Hide cancel button
    if (cancelEditButton) {
        cancelEditButton.style.display = 'none';
    }
    // Clear photo preview
    selectedFiles = [];
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
        photoPreview.style.display = 'none';
        const photoPreviewGrid = document.getElementById('photoPreviewGrid');
        if (photoPreviewGrid) {
            photoPreviewGrid.innerHTML = '';
        }
    }
    if (productPhotos) {
        productPhotos.value = '';
    }
}

// Add event listener for part type changes to handle accessories
const partTypeField = document.getElementById('partType');
const generationField = document.getElementById('generation');
const partSelectionField = document.getElementById('partSelection');

if (partTypeField) {
    partTypeField.addEventListener('change', function() {
        const selectedType = this.value;
        const isAccessory = ['ear_tips', 'box', 'cable', 'other'].includes(selectedType);
        
        if (isAccessory) {
            // Hide generation and part selection fields for accessories
            if (generationField) {
                generationField.removeAttribute('required');
                // Set a placeholder value to satisfy any validation
                if (!generationField.querySelector('option[value="N/A"]')) {
                    const naOption = document.createElement('option');
                    naOption.value = 'N/A';
                    naOption.textContent = 'N/A';
                    generationField.appendChild(naOption);
                }
                generationField.value = 'N/A';
                const generationFormGroup = generationField.closest('.form-group');
                if (generationFormGroup) {
                    generationFormGroup.style.display = 'none';
                }
            }
            if (partSelectionField) {
                partSelectionField.removeAttribute('required');
                // Set a placeholder value to satisfy any validation
                if (!partSelectionField.querySelector('option[value="N/A"]')) {
                    const naOption = document.createElement('option');
                    naOption.value = 'N/A';
                    naOption.textContent = 'N/A';
                    partSelectionField.appendChild(naOption);
                }
                partSelectionField.value = 'N/A';
                const partSelectionFormGroup = partSelectionField.closest('.form-group');
                if (partSelectionFormGroup) {
                    partSelectionFormGroup.style.display = 'none';
                }
            }
        } else {
            // Show and restore required status for AirPod parts
            if (generationField) {
                generationField.setAttribute('required', 'required');
                // Remove N/A option if it exists
                const naOption = generationField.querySelector('option[value="N/A"]');
                if (naOption) {
                    naOption.remove();
                }
                generationField.value = ''; // Reset to empty
                const generationFormGroup = generationField.closest('.form-group');
                if (generationFormGroup) {
                    generationFormGroup.style.display = 'block';
                }
            }
            if (partSelectionField) {
                partSelectionField.setAttribute('required', 'required');
                // Remove N/A option if it exists
                const naOption = partSelectionField.querySelector('option[value="N/A"]');
                if (naOption) {
                    naOption.remove();
                }
                partSelectionField.value = ''; // Reset to empty
                const partSelectionFormGroup = partSelectionField.closest('.form-group');
                if (partSelectionFormGroup) {
                    partSelectionFormGroup.style.display = 'block';
                }
            }
        }
    });
    
    // Trigger the change event on page load to handle pre-selected values (e.g., when editing)
    if (partTypeField.value) {
        partTypeField.dispatchEvent(new Event('change'));
    }
}

if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const serialNumber = document.getElementById('serialNumber').value.trim();
        const securityBarcode = document.getElementById('securityBarcode').value.trim();
        const generation = document.getElementById('generation').value;
        const partSelection = document.getElementById('partSelection').value;
        const partType = document.getElementById('partType').value;
        const partModelNumber = document.getElementById('partModelNumber').value.trim();
        const notes = document.getElementById('notes').value.trim();
        const ebayOrderNumber = document.getElementById('ebayOrderNumber').value.trim();
        const productPhotos = document.getElementById('productPhotos');
        const addProductButton = document.getElementById('addProductButton');
        const sparesRepairs = document.getElementById('sparesRepairs') ? document.getElementById('sparesRepairs').checked : false;

        // Check if this is an accessory type - accessories automatically skip photo/security requirements
        const isAccessory = ['ear_tips', 'box', 'cable', 'other'].includes(partType);
        const skipPhotoSecurity = isAccessory || sparesRepairs; // Accessories and spares/repairs both skip

        // Validation - check required fields
        // Serial number and security barcode are optional for accessories and spares/repairs
        if (!isAccessory && !sparesRepairs) {
            if (!serialNumber) {
                showError('Serial number is required for AirPod parts');
                return;
            }
            if (!securityBarcode) {
                showError('Security barcode is required for AirPod parts');
                return;
            }
        }
        
        if (!partModelNumber) {
            showError('Part/Model number is required');
            return;
        }
        
        // Generation and Part Selection are only required for AirPod parts (left, right, case)
        if (!isAccessory) {
            if (!generation || generation === '') {
                showError('Generation is required for AirPod parts');
                return;
            }
            if (!partSelection || partSelection === '') {
                showError('Part selection is required for AirPod parts');
                return;
            }
        }
        // For accessories, generation and partSelection should be 'N/A'
        // This is handled by the change event listener above
        
        if (!partType) {
            showError('Part type is required');
            return;
        }
        
        addProductButton.disabled = true;
        showSpinner();
        
        try {
            // Use FormData to support file uploads
            const formData = new FormData();
            // If skip checkbox is checked and fields are empty, use placeholder values
            formData.append('serial_number', serialNumber || (skipPhotoSecurity ? 'N/A' : ''));
            formData.append('security_barcode', securityBarcode || (skipPhotoSecurity ? 'N/A' : ''));
            formData.append('part_type', partType);
            // For accessories, generation and part selection are optional
            formData.append('generation', generation || (isAccessory ? 'N/A' : ''));
            formData.append('part_selection', partSelection || (isAccessory ? 'N/A' : ''));
            formData.append('part_model_number', partModelNumber);
            if (notes) formData.append('notes', notes);
            if (ebayOrderNumber) formData.append('ebay_order_number', ebayOrderNumber);
            formData.append('skip_photos_security', skipPhotoSecurity);
            formData.append('spares_repairs', sparesRepairs);
            
            // Append photos if selected (use selectedFiles array)
            if (selectedFiles && selectedFiles.length > 0) {
                selectedFiles.forEach(file => {
                    formData.append('photos', file);
                });
            }
            
            // Determine if we're updating or adding
            const url = editingProductId
                ? `${API_BASE}/api/admin/product/${encodeURIComponent(String(editingProductId))}`
                : `${API_BASE}/api/admin/product`;
            const method = editingProductId ? 'PUT' : 'POST';

            const response = await authenticatedFetch(url, {
                method: method,
                body: formData // Don't set Content-Type header, browser will set it with boundary
            });
            
            // Log response for debugging
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse response:', responseText);
                showError('Server error: ' + responseText);
                return;
            }
            
            console.log('Server response:', data);
            
            if (response.ok && data.success) {
                if (editingProductId) {
                    showSuccess('Product updated successfully!');
                    // If we came from products page (via edit parameter), go back after a brief delay
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has('edit')) {
                        setTimeout(() => {
                            window.location.href = 'products.html';
                        }, 1000);
                        return;
                    }
                } else {
                    showSuccess('Product added successfully!');
                }
                cancelEdit(); // Reset form and clear edit mode
                loadProducts(); // Reload the products table
            } else {
                showError(data.error || 'Failed to add product');
            }
        } catch (error) {
            console.error('Add product error:', error);
            showError('Network error. Please try again.');
        } finally {
            addProductButton.disabled = false;
            hideSpinner();
        }
    });
}

// Load products table
// Cache for status options
let statusOptionsCache = null;

// Clear status options cache (called when settings are updated)
window.clearStatusOptionsCache = function() {
    statusOptionsCache = null;
    console.log('Status options cache cleared');
    
    // If products table exists, reload it to use new status options
    if (typeof loadProducts === 'function') {
        console.log('Reloading products table with updated status options...');
        loadProducts();
    }
};

// Load status options from settings
async function loadStatusOptions() {
    if (statusOptionsCache) {
        return statusOptionsCache;
    }
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/settings`);
        const data = await response.json();
        
        if (response.ok && data.settings && data.settings.product_status_options) {
            statusOptionsCache = data.settings.product_status_options;
        } else {
            // Use defaults
            statusOptionsCache = [
                { value: 'active', label: 'Active' },
                { value: 'item_in_dispute', label: 'Item in Dispute' },
                { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
                { value: 'returned', label: 'Returned' },
                { value: 'pending', label: 'Pending' }
            ];
        }
    } catch (error) {
        console.error('Error loading status options:', error);
        // Use defaults on error
        statusOptionsCache = [
            { value: 'active', label: 'Active' },
            { value: 'item_in_dispute', label: 'Item in Dispute' },
            { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
            { value: 'returned', label: 'Returned' },
            { value: 'pending', label: 'Pending' }
        ];
    }
    
    return statusOptionsCache;
}

async function loadProducts() {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;
    
    // Load status options first
    const statusOptions = await loadStatusOptions();
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products`);
        const data = await response.json();
        
        if (response.ok && data.products) {
            if (data.products.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px;">No products found</td></tr>';
                return;
            }
            
            tableBody.innerHTML = data.products.map(product => {
            const date = new Date(product.date_added);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Determine warranty status
            let warrantyStatus = '<span class="status-badge pending">No Warranty</span>';
            let daysRemaining = '<span style="color: #999;">-</span>';
            
            if (product.warranty) {
                const warranty = product.warranty;
                const now = new Date();
                
                // Determine which warranty end date to use (extended if available, otherwise standard)
                const warrantyEndDate = warranty.extended_warranty_end && warranty.extended_warranty !== 'none' 
                    ? new Date(warranty.extended_warranty_end)
                    : warranty.standard_warranty_end 
                        ? new Date(warranty.standard_warranty_end)
                        : null;
                
                // Calculate days remaining
                if (warrantyEndDate) {
                    const diffTime = warrantyEndDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                        daysRemaining = '<span style="color: #dc3545; font-weight: 600;">Expired</span>';
                        warrantyStatus = '<span class="status-badge expired">Warranty Expired</span>';
                    } else if (diffDays === 0) {
                        daysRemaining = '<span style="color: #ff9800; font-weight: 600;">0 days</span>';
                        warrantyStatus = warranty.payment_status === 'paid' 
                            ? '<span class="status-badge paid">Paid Warranty</span>'
                            : '<span class="status-badge confirmed">Free Warranty</span>';
                    } else {
                        daysRemaining = diffDays <= 7 
                            ? `<span style="color: #ff9800; font-weight: 600;">${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`
                            : `<span style="color: var(--accent-teal);">${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`;
                        
                        // Set warranty status based on payment status
                        if (warranty.payment_status === 'paid') {
                            warrantyStatus = '<span class="status-badge paid">Paid Warranty</span>';
                        } else {
                            warrantyStatus = '<span class="status-badge confirmed">Free Warranty</span>';
                        }
                    }
                } else {
                    // Warranty exists but no end date (shouldn't happen, but handle it)
                    warrantyStatus = warranty.payment_status === 'paid' 
                        ? '<span class="status-badge paid">Paid Warranty</span>'
                        : '<span class="status-badge confirmed">Free Warranty</span>';
                }
            } else {
                // No warranty registered
                warrantyStatus = '<span class="status-badge pending">No Warranty</span>';
            }
            
            const partTypeMap = {
                'left': 'Left AirPod',
                'right': 'Right AirPod',
                'case': 'Case'
            };
            
            // Format tracking info
            let trackingDisplay = '<span style="color: #999;">Not tracked</span>';
            if (product.tracking_number) {
                const trackingDate = product.tracking_date ? new Date(product.tracking_date).toLocaleDateString() : '';
                trackingDisplay = `<span style="color: var(--accent-teal); font-weight: 500;">${escapeHtml(product.tracking_number)}</span>${trackingDate ? '<br><small style="color: #666;">' + trackingDate + '</small>' : ''}`;
            }
            
            // Format photos - simple tick or cross
            let photosDisplay = '<span style="color: #dc3545; font-size: 1.2rem; font-weight: bold;">✗</span>';
            if (product.photos && product.photos.length > 0) {
                photosDisplay = '<span style="color: #28a745; font-size: 1.2rem; font-weight: bold;">✓</span>';
            }
            
            // Format product status
            let productStatus = product.status || 'active';
            
            // Auto-detect "delivered_no_warranty" if tracking exists but no warranty
            if (productStatus === 'active' && product.tracking_number && !product.warranty) {
                productStatus = 'delivered_no_warranty';
            }
            
            // Build status dropdown options dynamically from settings
            let statusOptionsHtml = '';
            statusOptions.forEach(option => {
                const selected = productStatus === option.value ? ' selected' : '';
                statusOptionsHtml += '<option value="' + escapeHtml(option.value) + '"' + selected + '>' + escapeHtml(option.label) + '</option>';
            });
            
            // Create status dropdown HTML - don't escape the HTML itself, only the values
            const statusDisplay = '<select class="status-select" data-product-id="' + escapeHtml(String(product.id)) + '" data-original-status="' + escapeHtml(productStatus) + '" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; font-size: 0.9rem; cursor: pointer; min-width: 150px; background-color: white;">' +
                statusOptionsHtml +
                '</select>';

            // Part Value display
            let partValueDisplay = '<span style="color: #999;">—</span>';
            if (product.part_value !== null && product.part_value !== undefined) {
                partValueDisplay = `<span style="font-weight: 600; color: #6c757d;">£${parseFloat(product.part_value).toFixed(2)}</span>`;
            }

            return `
                <tr data-product-id="${escapeHtml(String(product.id))}">
                    <td>${escapeHtml(product.serial_number || '')}</td>
                    <td>${escapeHtml(product.security_barcode)}</td>
                    <td>${escapeHtml(product.generation || '')}</td>
                    <td>${escapeHtml(product.part_model_number || '')}</td>
                    <td>${partTypeMap[product.part_type] || product.part_type}</td>
                    <td>${escapeHtml(product.ebay_order_number || '')}</td>
                    <td>${partValueDisplay}</td>
                    <td>${photosDisplay}</td>
                    <td>${formattedDate}</td>
                    <td>${trackingDisplay}</td>
                    <td>${statusDisplay}</td>
                    <td>${warrantyStatus}</td>
                    <td>${daysRemaining}</td>
                    <td>
                        <button class="track-button" data-action="track" data-product-id="${escapeHtml(String(product.id))}" style="margin-right: 5px;">
                            Track
                        </button>
                        <button class="edit-button" data-action="edit" data-product-id="${escapeHtml(String(product.id))}" style="margin-right: 5px;">
                            Edit
                        </button>
                        <button class="delete-button" data-action="delete" data-product-id="${escapeHtml(String(product.id))}">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
            
            // Attach event listeners to delete buttons
            tableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const productId = e.target.getAttribute('data-product-id');
                    if (productId) {
                        deleteProduct(productId);
                    }
                });
            });
            
            // Attach event listeners to edit buttons
            tableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const productId = e.target.getAttribute('data-product-id');
                    if (productId) {
                        editProduct(productId);
                    }
                });
            });
            
            // Attach event listeners to track buttons
            tableBody.querySelectorAll('[data-action="track"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const productId = e.target.getAttribute('data-product-id');
                    if (productId) {
                        openTrackingModal(productId);
                    }
                });
            });
            
            // Attach event listeners to status dropdowns
            tableBody.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async function(e) {
                    const productId = this.getAttribute('data-product-id');
                    const newStatus = this.value;
                    const oldStatus = this.getAttribute('data-original-status') || this.value;
                    
                    if (!productId) return;
                    
                    // Store original value for revert
                    if (!this.getAttribute('data-original-status')) {
                        this.setAttribute('data-original-status', oldStatus);
                    }
                    
                    // If marking as returned, prompt for reason
                    let returnReason = null;
                    if (newStatus === 'returned') {
                        returnReason = prompt('Enter return reason (optional):');
                        if (returnReason === null) {
                            // User cancelled, revert dropdown
                            this.value = oldStatus;
                            return;
                        }
                    }
                    
                    // Show loading state
                    this.disabled = true;
                    this.style.opacity = '0.6';
                    
                    try {
                        const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(productId)}/status`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ 
                                status: newStatus,
                                return_reason: returnReason || undefined
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok && data.success) {
                            // Reload products to show updated status
                            loadProducts();
                        } else {
                            // Revert on error
                            this.value = oldStatus;
                            alert(data.error || 'Failed to update status');
                        }
                    } catch (error) {
                        console.error('Status update error:', error);
                        this.value = oldStatus;
                        alert('Network error. Please try again.');
                    } finally {
                        this.disabled = false;
                        this.style.opacity = '1';
                    }
                });
            });

            // Pass products to filter system if available
            if (typeof setProductsForFiltering === 'function') {
                setProductsForFiltering(data.products);
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px; color: red;">Error loading products</td></tr>';
        }
    } catch (error) {
        console.error('Load products error:', error);
        tableBody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px; color: red;">Network error. Please refresh the page.</td></tr>';
    }
}

// Render filtered products (called by filter system)
window.renderFilteredProducts = function(products) {
    renderProductsTable(products);
};

// Refactored function to render products table
async function renderProductsTable(products) {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;

    const statusOptions = await loadStatusOptions();

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 20px;">No products match your filters</td></tr>';
        return;
    }

    tableBody.innerHTML = products.map(product => {
        const date = new Date(product.date_added);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Determine warranty status
        let warrantyStatus = '<span class="status-badge pending">No Warranty</span>';
        let daysRemaining = '<span style="color: #999;">-</span>';

        if (product.warranty) {
            const warranty = product.warranty;
            const now = new Date();

            const warrantyEndDate = warranty.extended_warranty_end && warranty.extended_warranty !== 'none'
                ? new Date(warranty.extended_warranty_end)
                : warranty.standard_warranty_end
                    ? new Date(warranty.standard_warranty_end)
                    : null;

            if (warrantyEndDate) {
                const diffTime = warrantyEndDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    daysRemaining = '<span style="color: #dc3545; font-weight: 600;">Expired</span>';
                    warrantyStatus = '<span class="status-badge expired">Warranty Expired</span>';
                } else if (diffDays === 0) {
                    daysRemaining = '<span style="color: #ff9800; font-weight: 600;">0 days</span>';
                    warrantyStatus = warranty.payment_status === 'paid'
                        ? '<span class="status-badge paid">Paid Warranty</span>'
                        : '<span class="status-badge confirmed">Free Warranty</span>';
                } else {
                    daysRemaining = diffDays <= 7
                        ? `<span style="color: #ff9800; font-weight: 600;">${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`
                        : `<span style="color: var(--accent-teal);">${diffDays} day${diffDays !== 1 ? 's' : ''}</span>`;

                    if (warranty.payment_status === 'paid') {
                        warrantyStatus = '<span class="status-badge paid">Paid Warranty</span>';
                    } else {
                        warrantyStatus = '<span class="status-badge confirmed">Free Warranty</span>';
                    }
                }
            } else {
                warrantyStatus = warranty.payment_status === 'paid'
                    ? '<span class="status-badge paid">Paid Warranty</span>'
                    : '<span class="status-badge confirmed">Free Warranty</span>';
            }
        }

        const partTypeMap = {
            'left': 'Left AirPod',
            'right': 'Right AirPod',
            'case': 'Case'
        };

        let trackingDisplay = '<span style="color: #999;">Not tracked</span>';
        if (product.tracking_number) {
            const trackingDate = product.tracking_date ? new Date(product.tracking_date).toLocaleDateString() : '';
            trackingDisplay = `<span style="color: var(--accent-teal); font-weight: 500;">${escapeHtml(product.tracking_number)}</span>${trackingDate ? '<br><small style="color: #666;">' + trackingDate + '</small>' : ''}`;
        }

        let photosDisplay = '<span style="color: #dc3545; font-size: 1.2rem; font-weight: bold;">✗</span>';
        if (product.photos && product.photos.length > 0) {
            photosDisplay = '<span style="color: #28a745; font-size: 1.2rem; font-weight: bold;">✓</span>';
        }

        let productStatus = product.status || 'active';
        if (productStatus === 'active' && product.tracking_number && !product.warranty) {
            productStatus = 'delivered_no_warranty';
        }

        let statusOptionsHtml = '';
        statusOptions.forEach(option => {
            const selected = productStatus === option.value ? ' selected' : '';
            statusOptionsHtml += '<option value="' + escapeHtml(option.value) + '"' + selected + '>' + escapeHtml(option.label) + '</option>';
        });

        const statusDisplay = '<select class="status-select" data-product-id="' + escapeHtml(String(product.id)) + '" data-original-status="' + escapeHtml(productStatus) + '" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; font-size: 0.9rem; cursor: pointer; min-width: 150px; background-color: white;">' +
            statusOptionsHtml +
            '</select>';

        // Part Value display
        let partValueDisplay = '<span style="color: #999;">—</span>';
        if (product.part_value !== null && product.part_value !== undefined) {
            partValueDisplay = `<span style="font-weight: 600; color: #6c757d;">£${parseFloat(product.part_value).toFixed(2)}</span>`;
        }

        return `
            <tr data-product-id="${escapeHtml(String(product.id))}">
                <td>${escapeHtml(product.serial_number || '')}</td>
                <td>${escapeHtml(product.security_barcode)}</td>
                <td>${escapeHtml(product.generation || '')}</td>
                <td>${escapeHtml(product.part_model_number || '')}</td>
                <td>${partTypeMap[product.part_type] || product.part_type}</td>
                <td>${escapeHtml(product.ebay_order_number || '')}</td>
                <td>${partValueDisplay}</td>
                <td>${photosDisplay}</td>
                <td>${formattedDate}</td>
                <td>${trackingDisplay}</td>
                <td>${statusDisplay}</td>
                <td>${warrantyStatus}</td>
                <td>${daysRemaining}</td>
                <td>
                    <button class="track-button" data-action="track" data-product-id="${escapeHtml(String(product.id))}" style="margin-right: 5px;">
                        Track
                    </button>
                    <button class="edit-button" data-action="edit" data-product-id="${escapeHtml(String(product.id))}" style="margin-right: 5px;">
                        Edit
                    </button>
                    <button class="delete-button" data-action="delete" data-product-id="${escapeHtml(String(product.id))}">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach event listeners
    attachProductEventListeners(tableBody);
}

// Attach event listeners to product buttons
function attachProductEventListeners(tableBody) {
    tableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId) deleteProduct(productId);
        });
    });

    tableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId) editProduct(productId);
        });
    });

    tableBody.querySelectorAll('[data-action="track"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId) openTrackingModal(productId);
        });
    });

    tableBody.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async function(e) {
            const productId = this.getAttribute('data-product-id');
            const newStatus = this.value;
            const oldStatus = this.getAttribute('data-original-status') || this.value;

            if (!productId) return;

            if (!this.getAttribute('data-original-status')) {
                this.setAttribute('data-original-status', oldStatus);
            }

            let returnReason = null;
            if (newStatus === 'returned') {
                returnReason = prompt('Enter return reason (optional):');
                if (returnReason === null) {
                    this.value = oldStatus;
                    return;
                }
            }

            this.disabled = true;
            this.style.opacity = '0.6';

            try {
                const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(productId)}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: newStatus,
                        return_reason: returnReason || undefined
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    loadProducts();
                } else {
                    this.value = oldStatus;
                    alert(data.error || 'Failed to update status');
                }
            } catch (error) {
                console.error('Status update error:', error);
                this.value = oldStatus;
                alert('Network error. Please try again.');
            } finally {
                this.disabled = false;
                this.style.opacity = '1';
            }
        });
    });
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Convert id to string and encode for URL
        const productId = String(id);
        const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(productId)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Product deleted successfully');
            loadProducts(); // Reload the table
        } else {
            showError(data.error || 'Failed to delete product');
        }
    } catch (error) {
        console.error('Delete product error:', error);
        showError('Network error. Please try again.');
    }
}

// Tracking modal functionality
let currentTrackingProductId = null;
let trackingQuaggaActive = false;

async function openTrackingModal(productId) {
    currentTrackingProductId = productId;
    const modal = document.getElementById('trackingModal');
    const modalBody = document.getElementById('trackingModalBody');
    const productInfo = document.getElementById('trackingProductInfo');
    const trackingNumberInput = document.getElementById('trackingNumber');
    const currentInfo = document.getElementById('trackingCurrentInfo');
    const currentTrackingNumber = document.getElementById('currentTrackingNumber');
    const currentTrackingDate = document.getElementById('currentTrackingDate');
    
    // Show modal
    modal.style.display = 'block';
    
    // Clear previous data
    trackingNumberInput.value = '';
    document.getElementById('trackingError').style.display = 'none';
    document.getElementById('trackingSuccess').style.display = 'none';
    currentInfo.style.display = 'none';
    
    // Focus the input field for easy pasting after modal is shown
    // Also ensure paste is enabled - remove any readonly or disabled attributes
    setTimeout(() => {
        trackingNumberInput.removeAttribute('readonly');
        trackingNumberInput.removeAttribute('disabled');
        trackingNumberInput.focus();
    }, 150);
    
    try {
        // Load product details
        const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(String(productId))}`);
        const data = await response.json();
        
        if (response.ok && data.product) {
            const product = data.product;
            
            // Display product info
            productInfo.innerHTML = `
                <p style="margin: 0 0 8px 0;"><strong>Product:</strong> ${escapeHtml(product.generation || 'N/A')} - ${escapeHtml(product.part_model_number || 'N/A')}</p>
                <p style="margin: 0 0 8px 0;"><strong>Serial:</strong> ${escapeHtml(product.serial_number || 'N/A')}</p>
                <p style="margin: 0 0 8px 0;"><strong>Security Barcode:</strong> ${escapeHtml(product.security_barcode || 'N/A')}</p>
                <p style="margin: 0 0 8px 0;"><strong>eBay Purchase Order:</strong> ${escapeHtml(product.ebay_order_number || 'N/A')}</p>
                <p style="margin: 0;"><strong>eBay Sales Order:</strong> ${escapeHtml(product.sales_order_number || 'Not yet sold')}</p>
            `;
            
            // Show current tracking if exists
            if (product.tracking_number) {
                currentTrackingNumber.textContent = product.tracking_number;
                if (product.tracking_date) {
                    const date = new Date(product.tracking_date);
                    currentTrackingDate.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                    currentTrackingDate.textContent = 'Unknown';
                }
                currentInfo.style.display = 'block';
                trackingNumberInput.value = product.tracking_number;
            } else {
                currentInfo.style.display = 'none';
            }
        } else {
            productInfo.innerHTML = '<p style="color: red;">Failed to load product details</p>';
        }
    } catch (error) {
        console.error('Load product error:', error);
        productInfo.innerHTML = '<p style="color: red;">Network error loading product</p>';
    }
}

function closeTrackingModal() {
    const modal = document.getElementById('trackingModal');
    modal.style.display = 'none';
    currentTrackingProductId = null;
    
    // Stop barcode scanner if active
    if (trackingQuaggaActive) {
        stopTrackingBarcodeScan();
    }
}

async function saveTracking() {
    if (!currentTrackingProductId) return;
    
    const trackingNumber = document.getElementById('trackingNumber').value.trim();
    const errorDiv = document.getElementById('trackingError');
    const successDiv = document.getElementById('trackingSuccess');
    
    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (!trackingNumber) {
        errorDiv.textContent = 'Please enter or scan a tracking number';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(String(currentTrackingProductId))}/tracking`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tracking_number: trackingNumber })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            successDiv.textContent = 'Tracking information saved successfully!';
            successDiv.style.display = 'block';
            
            // Reload products table
            setTimeout(() => {
                loadProducts();
                closeTrackingModal();
            }, 1000);
        } else {
            errorDiv.textContent = data.error || 'Failed to save tracking information';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Save tracking error:', error);
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
    }
}

// Barcode scanning for tracking
function startTrackingBarcodeScan() {
    const scannerDiv = document.getElementById('trackingBarcodeScanner');
    const video = document.getElementById('trackingBarcodeVideo');
    const canvas = document.getElementById('trackingBarcodeCanvas');
    
    scannerDiv.style.display = 'block';
    video.style.display = 'block';
    
    if (typeof Quagga === 'undefined') {
        alert('Barcode scanner library not loaded. Please refresh the page.');
        return;
    }
    
    trackingQuaggaActive = true;
    
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: video,
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Use back camera
            }
        },
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader", "qr_reader", "datamatrix_reader"]
        },
        locator: {
            halfSample: true,
            patchSize: "medium"
        }
    }, function(err) {
        if (err) {
            console.error('Quagga initialization error:', err);
            alert('Failed to initialize barcode scanner. Please check camera permissions.');
            stopTrackingBarcodeScan();
            return;
        }
        Quagga.start();
    });
    
    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        console.log('Barcode detected:', code);
        
        // Set tracking number and stop scanning
        document.getElementById('trackingNumber').value = code.toUpperCase();
        stopTrackingBarcodeScan();
        
        // Show success feedback
        const successDiv = document.getElementById('trackingSuccess');
        successDiv.textContent = 'Barcode scanned successfully!';
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 2000);
    });
}

function stopTrackingBarcodeScan() {
    if (trackingQuaggaActive && typeof Quagga !== 'undefined') {
        Quagga.stop();
        trackingQuaggaActive = false;
    }
    
    const scannerDiv = document.getElementById('trackingBarcodeScanner');
    const video = document.getElementById('trackingBarcodeVideo');
    scannerDiv.style.display = 'none';
    video.style.display = 'none';
}

// Modal event listeners - set up when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTrackingModalListeners);
} else {
    setupTrackingModalListeners();
}

function setupTrackingModalListeners() {
    const modal = document.getElementById('trackingModal');
    const closeBtn = document.getElementById('closeTrackingModal');
    const cancelBtn = document.getElementById('cancelTracking');
    const saveBtn = document.getElementById('saveTracking');
    const scanBtn = document.getElementById('scanTrackingBarcode');
    const stopScanBtn = document.getElementById('stopTrackingScan');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTrackingModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeTrackingModal);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveTracking);
    }
    
    if (scanBtn) {
        scanBtn.addEventListener('click', startTrackingBarcodeScan);
    }
    
    if (stopScanBtn) {
        stopScanBtn.addEventListener('click', stopTrackingBarcodeScan);
    }
    
    // Close modal when clicking outside
    if (modal) {
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeTrackingModal();
            }
        });
    }
    
    // Auto-uppercase tracking number input - set up when modal opens
    const trackingNumberInput = document.getElementById('trackingNumber');
    if (trackingNumberInput) {
        // Remove any existing paste listeners to avoid duplicates
        const newPasteHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            if (paste) {
                // Clean up pasted text (remove extra whitespace, newlines)
                const cleaned = paste.trim().replace(/\s+/g, ' ').toUpperCase();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                const currentValue = this.value;
                this.value = currentValue.substring(0, start) + cleaned + currentValue.substring(end);
                // Set cursor position after pasted text
                const newPosition = start + cleaned.length;
                this.setSelectionRange(newPosition, newPosition);
                // Trigger input event for uppercase conversion
                this.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
        
        // Remove old listener if exists and add new one
        trackingNumberInput.removeEventListener('paste', trackingNumberInput._pasteHandler);
        trackingNumberInput._pasteHandler = newPasteHandler;
        trackingNumberInput.addEventListener('paste', newPasteHandler, { capture: true });
        
        trackingNumberInput.addEventListener('input', function(e) {
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(start, end);
        });
    }
}

// ==========================================
// VIEW PRODUCT MODAL FUNCTIONALITY
// ==========================================

let currentViewProductId = null;

async function openViewProductModal(productId) {
    currentViewProductId = productId;

    const modal = document.getElementById('viewProductModal');
    const productInfoDiv = document.getElementById('viewProductInfo');
    const photosGrid = document.getElementById('photosGrid');

    if (!modal) return;

    // Show modal
    modal.style.display = 'flex';

    // Reset content
    productInfoDiv.innerHTML = '<p><strong>Loading product details...</strong></p>';
    photosGrid.innerHTML = '<p style="color: #666;">Loading photos...</p>';

    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(String(productId))}`);

        if (response.ok) {
            const product = await response.json();

            // Display product info
            const partTypeMap = {
                'left': 'Left AirPod',
                'right': 'Right AirPod',
                'case': 'Case'
            };
            const partType = partTypeMap[product.part_type] || product.part_type || 'Unknown';
            const generation = product.generation || 'Unknown';
            const serialNumber = product.serial_number || '—';
            const securityBarcode = product.security_barcode || '—';
            const dateAdded = product.date_added ? new Date(product.date_added).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

            productInfoDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <p style="margin: 0;"><strong>Product:</strong> ${escapeHtml(generation)}</p>
                    <p style="margin: 0;"><strong>Part Type:</strong> ${escapeHtml(partType)}</p>
                    <p style="margin: 0;"><strong>Serial Number:</strong> ${escapeHtml(serialNumber)}</p>
                    <p style="margin: 0;"><strong>Security Barcode:</strong> ${escapeHtml(securityBarcode)}</p>
                    <p style="margin: 0;"><strong>Date Added:</strong> ${escapeHtml(dateAdded)}</p>
                    ${product.ebay_order_number ? `<p style="margin: 0;"><strong>Purchase Order:</strong> ${escapeHtml(product.ebay_order_number)}</p>` : ''}
                </div>
            `;

            // Display photos
            if (product.photos && product.photos.length > 0) {
                photosGrid.innerHTML = product.photos.map((photo, index) => {
                    const photoUrl = photo.startsWith('/') ? photo : '/' + photo;
                    return `
                        <div style="position: relative; cursor: pointer;" onclick="openPhotoLightbox('${escapeHtml(photoUrl)}')">
                            <img
                                src="${escapeHtml(photoUrl)}"
                                alt="Product photo ${index + 1}"
                                style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;"
                                onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2Y0ZjRmNSIvPjx0ZXh0IHg9Ijc1IiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; this.style.objectFit='contain';"
                            >
                            <div style="position: absolute; bottom: 5px; right: 5px; background: rgba(0,0,0,0.6); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                                ${index + 1}/${product.photos.length}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                photosGrid.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No photos uploaded for this product.</p>';
            }
        } else {
            productInfoDiv.innerHTML = '<p style="color: red;">Failed to load product details</p>';
            photosGrid.innerHTML = '';
        }
    } catch (error) {
        console.error('Load product error:', error);
        productInfoDiv.innerHTML = '<p style="color: red;">Network error loading product</p>';
        photosGrid.innerHTML = '';
    }
}

function closeViewProductModal() {
    const modal = document.getElementById('viewProductModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentViewProductId = null;
}

function openPhotoLightbox(photoUrl) {
    const lightbox = document.getElementById('photoLightbox');
    const lightboxImg = document.getElementById('lightboxImage');

    if (lightbox && lightboxImg) {
        lightboxImg.src = photoUrl;
        lightbox.style.display = 'flex';
    }
}

function closePhotoLightbox() {
    const lightbox = document.getElementById('photoLightbox');
    if (lightbox) {
        lightbox.style.display = 'none';
    }
}

// Set up view product modal listeners
function setupViewProductModalListeners() {
    const modal = document.getElementById('viewProductModal');
    const closeBtn = document.getElementById('closeViewProductModal');
    const closeFooterBtn = document.getElementById('closeViewProductBtn');
    const lightbox = document.getElementById('photoLightbox');
    const closeLightboxBtn = document.getElementById('closeLightbox');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeViewProductModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeViewProductModal);
    }

    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeViewProductModal();
            }
        });
    }

    // Lightbox close
    if (closeLightboxBtn) {
        closeLightboxBtn.addEventListener('click', closePhotoLightbox);
    }

    if (lightbox) {
        lightbox.addEventListener('click', function(event) {
            if (event.target === lightbox) {
                closePhotoLightbox();
            }
        });
    }
}

// Set up view modal listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupViewProductModalListeners);
} else {
    setupViewProductModalListeners();
}

// Make functions available globally
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.openTrackingModal = openTrackingModal;
window.openViewProductModal = openViewProductModal;
window.openPhotoLightbox = openPhotoLightbox;
window.authenticatedFetch = authenticatedFetch;

// Cancel edit button
if (cancelEditButton) {
    cancelEditButton.addEventListener('click', cancelEdit);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Photo preview functionality - supports adding multiple photos incrementally
const productPhotos = document.getElementById('productPhotos');
const photoPreview = document.getElementById('photoPreview');
const photoPreviewGrid = document.getElementById('photoPreviewGrid');

// Store all selected files
let selectedFiles = [];

// Watermark function - adds LJM logo to bottom right corner
async function addWatermarkToImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.onload = () => {
                // Create canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size to match image
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw original image
                ctx.drawImage(img, 0, 0);
                
                // Add grey border around the entire image
                const borderWidth = 3;
                ctx.strokeStyle = '#999999'; // Grey color
                ctx.lineWidth = borderWidth;
                ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth);
                
                // Create watermark logo (white "LJM" text in dark circle)
                // Size: 15-20% of image width, but minimum 120px, maximum 350px (bigger logo)
                const logoSize = Math.max(120, Math.min(350, canvas.width * 0.18));
                const radius = logoSize / 2;
                
                // Padding from edges - 30px from right and bottom
                const padding = 30;
                
                // Position: bottom right corner
                // Center of circle positioned at (width - padding - radius, height - padding - radius)
                const centerX = canvas.width - padding - radius;
                const centerY = canvas.height - padding - radius;
                
                // Ensure logo doesn't go outside canvas bounds
                const finalCenterX = Math.max(radius + padding, Math.min(centerX, canvas.width - radius));
                const finalCenterY = Math.max(radius + padding, Math.min(centerY, canvas.height - radius));
                const finalRadius = Math.min(radius, finalCenterX - padding, finalCenterY - padding, (canvas.width - padding * 2) / 2, (canvas.height - padding * 2) / 2);
                
                // Save context for watermark
                ctx.save();
                
                // Draw dark circle background (semi-transparent but visible)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Dark background, 75% opaque
                ctx.beginPath();
                ctx.arc(finalCenterX, finalCenterY, finalRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw white circle border for better visibility
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = Math.max(2, finalRadius * 0.06);
                ctx.beginPath();
                ctx.arc(finalCenterX, finalCenterY, finalRadius - ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.stroke();
                
                // Draw "LJM" text (white, bold) - ensure it's clearly visible
                ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Fully opaque white text
                const fontSize = Math.max(24, finalRadius * 0.45); // Larger text for visibility
                ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('LJM', finalCenterX, finalCenterY);
                
                // Restore context
                ctx.restore();
                
                // Convert canvas to blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        // Create new File object with same name and type
                        const watermarkedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        resolve(watermarkedFile);
                    } else {
                        reject(new Error('Failed to create watermarked image'));
                    }
                }, file.type || 'image/jpeg', 0.92);
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

// Function to render all photo previews
function renderPhotoPreviews() {
    if (!photoPreviewGrid) return;
    
    photoPreviewGrid.innerHTML = '';
    
    // Update photo count
    const photoCount = document.getElementById('photoCount');
    if (photoCount) {
        photoCount.textContent = selectedFiles.length;
    }
    
    if (selectedFiles.length > 0) {
        photoPreview.style.display = 'block';
        
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const div = document.createElement('div');
                div.style.position = 'relative';
                div.style.border = '2px solid #ddd';
                div.style.borderRadius = '8px';
                div.style.overflow = 'hidden';
                div.dataset.fileIndex = index;
                
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.width = '100%';
                img.style.height = '150px';
                img.style.objectFit = 'cover';
                img.style.display = 'block';
                img.style.border = '3px solid #999999'; // Grey border
                img.style.borderRadius = '4px';
                
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '×';
                removeBtn.style.position = 'absolute';
                removeBtn.style.top = '5px';
                removeBtn.style.right = '5px';
                removeBtn.style.background = 'rgba(255, 0, 0, 0.8)';
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '25px';
                removeBtn.style.height = '25px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.fontSize = '18px';
                removeBtn.style.lineHeight = '1';
                removeBtn.onclick = () => {
                    // Remove file from array
                    selectedFiles.splice(index, 1);
                    // Update the file input
                    updateFileInput();
                    // Re-render previews
                    renderPhotoPreviews();
                };
                
                div.appendChild(img);
                div.appendChild(removeBtn);
                photoPreviewGrid.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    } else {
        photoPreview.style.display = 'none';
    }
}

// Function to update the file input with all selected files
function updateFileInput() {
    if (!productPhotos) return;

    const dt = new DataTransfer();
    selectedFiles.forEach(file => {
        dt.items.add(file);
    });
    productPhotos.files = dt.files;
}

// Handle "Choose Photos from Library" button
const chooseProductPhotosButton = document.getElementById('chooseProductPhotosButton');
const takeProductPhotoButton = document.getElementById('takeProductPhotoButton');
const productPhotosCamera = document.getElementById('productPhotosCamera');

if (chooseProductPhotosButton && productPhotos) {
    chooseProductPhotosButton.addEventListener('click', () => {
        productPhotos.click();
    });
}

if (takeProductPhotoButton && productPhotosCamera) {
    takeProductPhotoButton.addEventListener('click', () => {
        productPhotosCamera.click();
    });
}

// Handle camera input for product photos
if (productPhotosCamera && productPhotos) {
    productPhotosCamera.addEventListener('change', (e) => {
        // Transfer files from camera input to main input to trigger watermarking
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Create a new change event on productPhotos to trigger watermarking
            const dt = new DataTransfer();
            files.forEach(file => dt.items.add(file));
            productPhotos.files = dt.files;
            productPhotos.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

if (productPhotos && photoPreviewGrid) {
    productPhotos.addEventListener('change', async (e) => {
        // Add new files to the existing array (don't replace)
        const newFiles = Array.from(e.target.files);
        
        // Show loading indicator
        const loadingMsg = document.createElement('p');
        loadingMsg.id = 'watermarkLoading';
        loadingMsg.textContent = 'Adding watermark to photos...';
        loadingMsg.style.color = '#666';
        loadingMsg.style.fontSize = '0.85rem';
        loadingMsg.style.marginTop = '10px';
        if (!document.getElementById('watermarkLoading')) {
            photoPreview.parentNode.insertBefore(loadingMsg, photoPreview);
        }
        
        // Process each new file - add watermark and check for duplicates
        for (const newFile of newFiles) {
            // Check for duplicates
            const isDuplicate = selectedFiles.some(existingFile => 
                existingFile.name === newFile.name && 
                existingFile.size === newFile.size
            );
            
            if (!isDuplicate) {
                try {
                    // Add watermark to the image
                    const watermarkedFile = await addWatermarkToImage(newFile);
                    selectedFiles.push(watermarkedFile);
                } catch (error) {
                    console.error('Error adding watermark:', error);
                    // If watermarking fails, add original file
                    selectedFiles.push(newFile);
                }
            }
        }
        
        // Remove loading indicator
        const loadingEl = document.getElementById('watermarkLoading');
        if (loadingEl) {
            loadingEl.remove();
        }
        
        // Update the file input
        updateFileInput();
        
        // Render all previews
        renderPhotoPreviews();
        
        // Reset the input so same files can be selected again if needed
        e.target.value = '';
    });
}

// Phone photo upload via QR code (Add Product page)
const phoneUploadQr = document.getElementById('phoneUploadQr');
const loadPhoneUploadsButton = document.getElementById('loadPhoneUploads');
const phoneUploadSessionDisplay = document.getElementById('phoneUploadSession');
const phoneUploadStatus = document.getElementById('phoneUploadStatus');

let phoneUploadSessionId = null;
let phoneUploadSessionUrl = null;
const phoneUploadLoadedUrls = new Set();

function setPhoneUploadStatus(message, tone = 'neutral') {
    if (!phoneUploadStatus) return;
    phoneUploadStatus.textContent = message;
    phoneUploadStatus.style.color = tone === 'error' ? '#c62828' : tone === 'success' ? '#1f7a1f' : '#666';
}

function updatePhoneUploadSessionDisplay(sessionId) {
    if (!phoneUploadSessionDisplay) return;
    phoneUploadSessionDisplay.textContent = sessionId
        ? `Session ID: ${sessionId}`
        : 'Session not created yet.';
}

function renderPhoneUploadQr(sessionId) {
    if (!phoneUploadQr) return;
    const uploadUrl = `${window.location.origin}/mobile-photo-upload.html?session=${sessionId}`;
    phoneUploadSessionUrl = uploadUrl;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(uploadUrl)}`;
    phoneUploadQr.src = qrSrc;
    phoneUploadQr.alt = `QR code for ${uploadUrl}`;
}

async function createPhoneUploadSession() {
    try {
        setPhoneUploadStatus('Generating QR code...', 'neutral');

        const response = await authenticatedFetch(`${API_BASE}/api/admin/photo-upload-session`, {
            method: 'POST'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to create upload session.');
        }

        phoneUploadSessionId = data.sessionId;
        phoneUploadLoadedUrls.clear();
        updatePhoneUploadSessionDisplay(phoneUploadSessionId);

        renderPhoneUploadQr(phoneUploadSessionId);
        setPhoneUploadStatus('Scan the QR code with your phone to upload photos.', 'success');

        if (loadPhoneUploadsButton) {
            loadPhoneUploadsButton.disabled = false;
        }
    } catch (error) {
        console.error('Phone upload session error:', error);
        setPhoneUploadStatus(error.message || 'Failed to generate QR code.', 'error');
    }
}

async function loadPhoneUploadedPhotos() {
    if (!phoneUploadSessionId) {
        setPhoneUploadStatus('Generate a QR code first.', 'error');
        return;
    }

    try {
        if (loadPhoneUploadsButton) {
            loadPhoneUploadsButton.disabled = true;
        }
        setPhoneUploadStatus('Checking for uploaded photos...', 'neutral');

        const response = await authenticatedFetch(`${API_BASE}/api/admin/photo-upload-session/${encodeURIComponent(phoneUploadSessionId)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to fetch uploaded photos.');
        }

        const photos = data.photos || [];
        const newPhotos = photos.filter(photo => !phoneUploadLoadedUrls.has(photo));

        if (newPhotos.length === 0) {
            setPhoneUploadStatus('No new photos found yet.', 'neutral');
            return;
        }

        for (const photoUrl of newPhotos) {
            const photoResponse = await fetch(photoUrl, { cache: 'no-store' });
            if (!photoResponse.ok) {
                console.warn('Failed to fetch phone photo:', photoUrl);
                continue;
            }
            const blob = await photoResponse.blob();
            const fileName = photoUrl.split('/').pop() || `phone-upload-${Date.now()}.jpg`;
            const file = new File([blob], fileName, {
                type: blob.type || 'image/jpeg',
                lastModified: Date.now()
            });

            let finalFile = file;
            try {
                finalFile = await addWatermarkToImage(file);
            } catch (error) {
                console.warn('Failed to watermark phone photo:', error);
            }

            const isDuplicate = selectedFiles.some(existingFile =>
                existingFile.name === finalFile.name &&
                existingFile.size === finalFile.size
            );

            if (!isDuplicate) {
                selectedFiles.push(finalFile);
            }

            phoneUploadLoadedUrls.add(photoUrl);
        }

        updateFileInput();
        renderPhotoPreviews();

        setPhoneUploadStatus(`Loaded ${newPhotos.length} new photo(s).`, 'success');
    } catch (error) {
        console.error('Failed to load phone uploads:', error);
        setPhoneUploadStatus(error.message || 'Failed to load phone photos.', 'error');
    } finally {
        if (loadPhoneUploadsButton) {
            loadPhoneUploadsButton.disabled = false;
        }
    }
}

if (loadPhoneUploadsButton && phoneUploadQr) {
    loadPhoneUploadsButton.addEventListener('click', loadPhoneUploadedPhotos);
}

if (phoneUploadQr) {
    phoneUploadQr.addEventListener('error', () => {
        if (phoneUploadSessionUrl) {
            setPhoneUploadStatus('Failed to load QR code. Use the link below on your phone.', 'error');
            if (phoneUploadSessionDisplay) {
                phoneUploadSessionDisplay.innerHTML = `Upload link: <a href="${phoneUploadSessionUrl}" target="_blank" rel="noopener">${phoneUploadSessionUrl}</a>`;
            }
        } else {
            setPhoneUploadStatus('Failed to load QR code.', 'error');
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createPhoneUploadSession();
        });
    } else {
        createPhoneUploadSession();
    }
}

// Initialize auth check on ALL admin pages (not just products page)
// Run checkAuth on page load for any admin page
if (!window.location.pathname.includes('login')) {
    checkAuth();
}

// Initialize dashboard/products page
if (document.getElementById('productsTable')) {
    // Initialize filters if available
    if (typeof initProductsFilter === 'function') {
        initProductsFilter();
    }

    loadProducts();

    // Refresh products every 30 seconds
    setInterval(loadProducts, 30000);
}

// Initialize session management on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initActivityTracking);
} else {
    initActivityTracking();
}
