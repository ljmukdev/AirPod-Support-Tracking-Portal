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

// Product form
const productForm = document.getElementById('productForm');
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
            
            const response = await fetch(`${API_BASE}/api/admin/product`, {
                method: 'POST',
                body: formData // Don't set Content-Type header, browser will set it with boundary
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess('Product added successfully!');
                productForm.reset();
                // Reset part selection dropdown
                const partSelectionSelect = document.getElementById('partSelection');
                if (partSelectionSelect) {
                    partSelectionSelect.innerHTML = '<option value="">Select part</option>';
                }
                // Clear photo preview and reset selected files
                selectedFiles = [];
                const photoPreview = document.getElementById('photoPreview');
                if (photoPreview) {
                    photoPreview.style.display = 'none';
                    const photoPreviewGrid = document.getElementById('photoPreviewGrid');
                    if (photoPreviewGrid) {
                        photoPreviewGrid.innerHTML = '';
                    }
                }
                // Reset file input
                if (productPhotos) {
                    productPhotos.value = '';
                }
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
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No products found</td></tr>';
                return;
            }
            
            tableBody.innerHTML = data.products.map(product => {
                const date = new Date(product.date_added);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const confirmationStatus = product.confirmation_checked 
                    ? '<span class="status-badge confirmed">Confirmed</span>' 
                    : '<span class="status-badge pending">Pending</span>';
                
                const partTypeMap = {
                    'left': 'Left AirPod',
                    'right': 'Right AirPod',
                    'case': 'Case'
                };
                
                return `
                    <tr>
                        <td>${escapeHtml(product.serial_number || '')}</td>
                        <td>${escapeHtml(product.security_barcode)}</td>
                        <td>${escapeHtml(product.generation || '')}</td>
                        <td>${escapeHtml(product.part_model_number || '')}</td>
                        <td>${partTypeMap[product.part_type] || product.part_type}</td>
                        <td>${escapeHtml(product.ebay_order_number || '')}</td>
                        <td>${formattedDate}</td>
                        <td>${confirmationStatus}</td>
                        <td>
                            <button class="delete-button" onclick="deleteProduct(${product.id})">
                                Delete
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: red;">Error loading products</td></tr>';
        }
    } catch (error) {
        console.error('Load products error:', error);
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: red;">Network error. Please refresh the page.</td></tr>';
    }
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/product/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Product deleted successfully');
            loadProducts();
        } else {
            showError(data.error || 'Failed to delete product');
        }
    } catch (error) {
        console.error('Delete product error:', error);
        showError('Network error. Please try again.');
    }
}

// Make deleteProduct available globally
window.deleteProduct = deleteProduct;

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
                // Size: 10% of smaller dimension, but minimum 100px, maximum 200px
                const minDimension = Math.min(canvas.width, canvas.height);
                const logoSize = Math.max(100, Math.min(200, minDimension * 0.1));
                
                // Padding from edges - ensure logo is fully visible (40px from right and bottom)
                const paddingX = 40;
                const paddingY = 40;
                
                // Position: bottom right corner - calculate center point
                const centerX = canvas.width - paddingX - (logoSize / 2);
                const centerY = canvas.height - paddingY - (logoSize / 2);
                const radius = logoSize / 2;
                
                // Ensure logo fits within canvas bounds
                const maxX = canvas.width - paddingX;
                const maxY = canvas.height - paddingY;
                const finalCenterX = Math.min(centerX, maxX - radius);
                const finalCenterY = Math.min(centerY, maxY - radius);
                const finalRadius = Math.min(radius, finalCenterX - paddingX, finalCenterY - paddingY);
                
                // Save context for transparency
                ctx.save();
                ctx.globalAlpha = 0.65; // Faded/transparent watermark
                
                // Draw dark circle background (more opaque for visibility)
                ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
                ctx.beginPath();
                ctx.arc(finalCenterX, finalCenterY, finalRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw white circle border (more visible)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.lineWidth = Math.max(3, finalRadius * 0.08);
                ctx.beginPath();
                ctx.arc(finalCenterX, finalCenterY, finalRadius - ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.stroke();
                
                // Draw "LJM" text (white, bold) - ensure it's visible
                ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                const fontSize = finalRadius * 0.5;
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

