// Admin Panel JavaScript

const API_BASE = '';

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
        const partType = document.getElementById('partType').value;
        const addProductButton = document.getElementById('addProductButton');
        
        if (!serialNumber || !securityBarcode || !partType) {
            showError('All fields are required');
            return;
        }
        
        addProductButton.disabled = true;
        showSpinner();
        
        try {
            const response = await fetch(`${API_BASE}/api/admin/product`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serial_number: serialNumber,
                    security_barcode: securityBarcode,
                    part_type: partType
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess('Product added successfully!');
                productForm.reset();
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
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No products found</td></tr>';
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
                        <td>${escapeHtml(product.serial_number)}</td>
                        <td>${escapeHtml(product.security_barcode)}</td>
                        <td>${partTypeMap[product.part_type] || product.part_type}</td>
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
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">Error loading products</td></tr>';
        }
    } catch (error) {
        console.error('Load products error:', error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: red;">Network error. Please refresh the page.</td></tr>';
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

// Initialize dashboard
if (document.getElementById('productsTable')) {
    checkAuth();
    loadProducts();
    
    // Refresh products every 30 seconds
    setInterval(loadProducts, 30000);
}

