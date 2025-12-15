// Admin Panel JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Reference the global API_BASE
var API_BASE = window.API_BASE;

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

// Auto-uppercase conversion for serial number, security barcode, and part number fields
function setupUppercaseFields() {
    const serialNumberField = document.getElementById('serialNumber');
    const securityBarcodeField = document.getElementById('securityBarcode');
    const partModelNumberField = document.getElementById('partModelNumber');
    
    // Function to convert to uppercase on input
    function convertToUppercase(e) {
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(start, end); // Maintain cursor position
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
        e.target.setSelectionRange(start + paste.length, start + paste.length);
    }
    
    if (serialNumberField) {
        serialNumberField.addEventListener('input', convertToUppercase);
        serialNumberField.addEventListener('paste', convertPasteToUppercase);
        // Also convert existing value if any
        if (serialNumberField.value) {
            serialNumberField.value = serialNumberField.value.toUpperCase();
        }
    }
    
    if (securityBarcodeField) {
        securityBarcodeField.addEventListener('input', convertToUppercase);
        securityBarcodeField.addEventListener('paste', convertPasteToUppercase);
        // Also convert existing value if any
        if (securityBarcodeField.value) {
            securityBarcodeField.value = securityBarcodeField.value.toUpperCase();
        }
    }
    
    if (partModelNumberField) {
        partModelNumberField.addEventListener('input', convertToUppercase);
        partModelNumberField.addEventListener('paste', convertPasteToUppercase);
        // Also convert existing value if any
        if (partModelNumberField.value) {
            partModelNumberField.value = partModelNumberField.value.toUpperCase();
        }
    }
}

// Setup uppercase conversion when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUppercaseFields);
} else {
    setupUppercaseFields();
}

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/check-auth`);
        const data = await response.json();
        
        if (!data.authenticated && window.location.pathname.includes('dashboard')) {
            window.location.href = '/admin/login';
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
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
            const response = await fetch(`${API_BASE}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                window.location.href = '/admin/dashboard';
            } else {
                showError(data.error || 'Invalid credentials');
                loginButton.disabled = false;
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please try again.');
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
            await fetch(`${API_BASE}/api/admin/logout`);
            window.location.href = '/admin/login';
        } catch (error) {
            console.error('Logout error:', error);
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
    try {
        // Get all products to find the one we're editing
        const response = await fetch(`${API_BASE}/api/admin/products`);
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
        
        // Validation - check required fields
        if (!serialNumber) {
            showError('Serial number is required');
            return;
        }
        if (!securityBarcode) {
            showError('Security barcode is required');
            return;
        }
        if (!partModelNumber) {
            showError('Part/Model number is required');
            return;
        }
        if (!generation) {
            showError('Generation is required');
            return;
        }
        if (!partSelection) {
            showError('Part selection is required');
            return;
        }
        if (!partType) {
            showError('Part type is required');
            return;
        }
        
        addProductButton.disabled = true;
        showSpinner();
        
        try {
            // Use FormData to support file uploads
            const formData = new FormData();
            formData.append('serial_number', serialNumber);
            formData.append('security_barcode', securityBarcode);
            formData.append('part_type', partType);
            formData.append('generation', generation);
            formData.append('part_model_number', partModelNumber);
            if (notes) formData.append('notes', notes);
            if (ebayOrderNumber) formData.append('ebay_order_number', ebayOrderNumber);
            
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
            
            const response = await fetch(url, {
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
async function loadProducts() {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/products`);
        const data = await response.json();
        
        if (response.ok && data.products) {
            if (data.products.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px;">No products found</td></tr>';
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
            
            return `
                <tr data-product-id="${escapeHtml(String(product.id))}">
                    <td>${escapeHtml(product.serial_number || '')}</td>
                    <td>${escapeHtml(product.security_barcode)}</td>
                    <td>${escapeHtml(product.generation || '')}</td>
                    <td>${escapeHtml(product.part_model_number || '')}</td>
                    <td>${partTypeMap[product.part_type] || product.part_type}</td>
                    <td>${escapeHtml(product.ebay_order_number || '')}</td>
                    <td>${photosDisplay}</td>
                    <td>${formattedDate}</td>
                    <td>${trackingDisplay}</td>
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
        } else {
            tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: red;">Error loading products</td></tr>';
        }
    } catch (error) {
        console.error('Load products error:', error);
        tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 20px; color: red;">Network error. Please refresh the page.</td></tr>';
    }
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Convert id to string and encode for URL
        const productId = String(id);
        const response = await fetch(`${API_BASE}/api/admin/product/${encodeURIComponent(productId)}`, {
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
    
    try {
        // Load product details
        const response = await fetch(`${API_BASE}/api/admin/product/${encodeURIComponent(String(productId))}`);
        const data = await response.json();
        
        if (response.ok && data.product) {
            const product = data.product;
            
            // Display product info
            productInfo.innerHTML = `
                <p style="margin: 0 0 8px 0;"><strong>Product:</strong> ${escapeHtml(product.generation || 'N/A')} - ${escapeHtml(product.part_model_number || 'N/A')}</p>
                <p style="margin: 0 0 8px 0;"><strong>Serial:</strong> ${escapeHtml(product.serial_number || 'N/A')}</p>
                <p style="margin: 0;"><strong>Security Barcode:</strong> ${escapeHtml(product.security_barcode || 'N/A')}</p>
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
        const response = await fetch(`${API_BASE}/api/admin/product/${encodeURIComponent(String(currentTrackingProductId))}/tracking`, {
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
    
    // Auto-uppercase tracking number input
    const trackingNumberInput = document.getElementById('trackingNumber');
    if (trackingNumberInput) {
        // Handle paste events - clean and format pasted text
        trackingNumberInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            // Clean up pasted text (remove extra whitespace, newlines)
            const cleaned = paste.trim().replace(/\s+/g, ' ');
            this.value = cleaned;
            // Trigger input event for any other handlers
            this.dispatchEvent(new Event('input', { bubbles: true }));
        });
        
        trackingNumberInput.addEventListener('input', function(e) {
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(start, end);
        });
    }
}

// Make functions available globally
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.openTrackingModal = openTrackingModal;

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

// Initialize dashboard
if (document.getElementById('productsTable')) {
    checkAuth();
    loadProducts();
    
    // Refresh products every 30 seconds
    setInterval(loadProducts, 30000);
}

