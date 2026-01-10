// Products Filter and Sort Handler

// Use existing API_BASE if available, otherwise set it
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// Store all products in memory
let allProductsData = [];
let statusOptionsCache = [];
let filtersInitialized = false;

// Universal search function
window.handleUniversalSearch = function(event) {
    event.preventDefault();
    
    const searchInput = document.getElementById('universalSearchInput');
    const searchTerm = searchInput.value.trim().toUpperCase();
    
    if (!searchTerm) {
        // If empty, show all products
        applyFiltersAndRender();
        return false;
    }
    
    console.log('[UNIVERSAL SEARCH] Searching for:', searchTerm);
    
    // Filter products that match any of the search fields
    const matchingProducts = allProductsData.filter(product => {
        // Search in serial number
        if (product.serial_number && product.serial_number.toUpperCase().includes(searchTerm)) {
            return true;
        }
        
        // Search in security barcode
        if (product.security_barcode && product.security_barcode.toUpperCase().includes(searchTerm)) {
            return true;
        }
        
        // Search in eBay order number
        if (product.ebay_order_number && product.ebay_order_number.toUpperCase().includes(searchTerm)) {
            return true;
        }
        
        // Search in tracking number
        if (product.tracking_number && product.tracking_number.toUpperCase().includes(searchTerm)) {
            return true;
        }
        
        // Search in product name
        if (product.product_name && product.product_name.toUpperCase().includes(searchTerm)) {
            return true;
        }
        
        return false;
    });
    
    console.log('[UNIVERSAL SEARCH] Found', matchingProducts.length, 'matching products');
    
    if (matchingProducts.length === 0) {
        // Show no results message
        const tbody = document.querySelector('#productsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 40px; color: #6b7280;">
                        <div style="font-size: 1.2rem; margin-bottom: 8px;">No products found</div>
                        <div style="font-size: 0.9rem;">No products match "${searchTerm}"</div>
                        <button onclick="clearUniversalSearch()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Clear Search
                        </button>
                    </td>
                </tr>
            `;
        }
    } else {
        // Render matching products
        if (typeof window.renderProductsTable === 'function') {
            window.renderProductsTable(matchingProducts);
        }
    }
    
    return false;
};

// Clear search function
window.clearUniversalSearch = function() {
    const searchInput = document.getElementById('universalSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    applyFiltersAndRender();
};

// Override loadProducts immediately before admin.js calls it
(function() {
    // Check if we're on the products page
    const isProductsPage = window.location.pathname.includes('products.html');
    if (!isProductsPage) return;
    
    // Override loadProducts immediately
    const originalLoadProducts = window.loadProducts;
    window.loadProducts = async function() {
        // Fetch and store products first
        await fetchAndStoreProducts();
        // Then render with filters
        if (filtersInitialized) {
            applyFiltersAndRender();
        } else {
            // If filters not initialized yet, use original function
            if (originalLoadProducts) {
                await originalLoadProducts();
            }
        }
    };
})();

// Initialize filters and sorting
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the products page
    const isProductsPage = window.location.pathname.includes('products.html');
    if (!isProductsPage) return;
    
    // Wait for admin.js to be ready
    setTimeout(initFilters, 100);
});

async function loadStatusOptions() {
    if (statusOptionsCache.length > 0) {
        return statusOptionsCache;
    }
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/settings`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok && data.settings && data.settings.product_status_options) {
            statusOptionsCache = data.settings.product_status_options;
        } else {
            statusOptionsCache = [
                { value: 'active', label: 'Active' },
                { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
                { value: 'returned', label: 'Returned' },
                { value: 'pending', label: 'Pending' }
            ];
        }
    } catch (error) {
        console.error('Error loading status options:', error);
        statusOptionsCache = [
            { value: 'active', label: 'Active' },
            { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
            { value: 'returned', label: 'Returned' },
            { value: 'pending', label: 'Pending' }
        ];
    }
    
    return statusOptionsCache;
}

async function initFilters() {
    filtersInitialized = true;
    
    // Populate status filter dropdown
    const statusOptions = await loadStatusOptions();
    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) {
        statusOptions.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            statusFilter.appendChild(optionEl);
        });
    }
    
    // Attach event listeners
    const filterInputs = [
        'filterStatus',
        'filterGeneration',
        'filterPartType',
        'filterWarranty',
        'filterTracking',
        'filterSearch',
        'filterSort'
    ];
    
    filterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'filterSearch') {
                element.addEventListener('input', debounce(applyFiltersAndRender, 300));
            } else {
                element.addEventListener('change', applyFiltersAndRender);
            }
        }
    });
    
    // Also sync headerSearch if it exists
    const headerSearch = document.getElementById('headerSearch');
    const filterSearch = document.getElementById('filterSearch');
    if (headerSearch && filterSearch) {
        headerSearch.addEventListener('input', debounce((e) => {
            filterSearch.value = e.target.value;
            applyFiltersAndRender();
        }, 300));
        filterSearch.addEventListener('input', debounce((e) => {
            headerSearch.value = e.target.value;
        }, 300));
    }
    
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // Initial load - fetch products and render
    await fetchAndStoreProducts();
    applyFiltersAndRender();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchAndStoreProducts() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok && data.products) {
            allProductsData = data.products;
        }
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

function getWarrantyInfo(product) {
    const info = {
        hasWarranty: !!product.warranty,
        isExpired: false,
        daysUntilExpiry: Infinity,
        paymentStatus: null
    };

    if (!product.warranty) {
        return info;
    }

    const warranty = product.warranty;
    info.paymentStatus = warranty.payment_status || null;

    const warrantyEndDate = warranty.extended_warranty_end && warranty.extended_warranty !== 'none'
        ? new Date(warranty.extended_warranty_end)
        : warranty.standard_warranty_end
            ? new Date(warranty.standard_warranty_end)
            : null;

    if (warrantyEndDate) {
        const now = new Date();
        const diffDays = Math.ceil((warrantyEndDate - now) / (1000 * 60 * 60 * 24));
        info.daysUntilExpiry = isNaN(diffDays) ? Infinity : diffDays;
        info.isExpired = diffDays < 0;
    }

    return info;
}

function applyFiltersAndRender() {
    if (allProductsData.length === 0) {
        // If no products stored yet, fetch them first
        fetchAndStoreProducts().then(() => {
            applyFiltersAndRender();
        });
        return;
    }
    
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const generationFilter = document.getElementById('filterGeneration')?.value || '';
    const partTypeFilter = document.getElementById('filterPartType')?.value || '';
    const warrantyFilter = document.getElementById('filterWarranty')?.value || '';
    const trackingFilter = document.getElementById('filterTracking')?.value || '';
    const searchFilter = document.getElementById('filterSearch')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('filterSort')?.value || 'date_desc';
    
    // Filter products
    let filteredProducts = allProductsData.filter(product => {
        // Status filter
        let productStatus = product.status || 'active';
        if (productStatus === 'active' && product.tracking_number && !product.warranty) {
            productStatus = 'delivered_no_warranty';
        }
        if (statusFilter && productStatus !== statusFilter) {
            return false;
        }
        
        // Generation filter
        if (generationFilter && product.generation !== generationFilter) {
            return false;
        }
        
        // Part type filter
        if (partTypeFilter && product.part_type !== partTypeFilter) {
            return false;
        }
        
        // Warranty filter
        if (warrantyFilter) {
            const warrantyInfo = getWarrantyInfo(product);

            switch (warrantyFilter) {
                case 'active':
                    if (!warrantyInfo.hasWarranty || warrantyInfo.isExpired) return false;
                    break;
                case 'none':
                    if (warrantyInfo.hasWarranty) return false;
                    break;
                case 'expired':
                    if (!warrantyInfo.hasWarranty || !warrantyInfo.isExpired) return false;
                    break;
                case 'paid':
                    if (!warrantyInfo.hasWarranty || warrantyInfo.paymentStatus !== 'paid') return false;
                    break;
            }
        }
        
        // Tracking Status filter (shipping tracking)
        if (trackingFilter) {
            const hasTracking = !!product.tracking_number;
            if (trackingFilter === 'tracked' && !hasTracking) {
                return false;
            }
            if (trackingFilter === 'not_tracked' && hasTracking) {
                return false;
            }
        }
        
        // Search filter
        if (searchFilter) {
            const searchText = (
                (product.serial_number || '') + ' ' +
                (product.security_barcode || '') + ' ' +
                (product.ebay_order_number || '') + ' ' +
                (product.part_model_number || '')
            ).toLowerCase();
            if (!searchText.includes(searchFilter)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Sort products
    filteredProducts.sort((a, b) => {
        switch (sortBy) {
            case 'date_desc':
                return new Date(b.date_added || 0) - new Date(a.date_added || 0);
            case 'date_asc':
                return new Date(a.date_added || 0) - new Date(b.date_added || 0);
            case 'serial_asc':
                return (a.serial_number || '').localeCompare(b.serial_number || '');
            case 'serial_desc':
                return (b.serial_number || '').localeCompare(a.serial_number || '');
            case 'barcode_asc':
                return (a.security_barcode || '').localeCompare(b.security_barcode || '');
            case 'barcode_desc':
                return (b.security_barcode || '').localeCompare(a.security_barcode || '');
            case 'status_asc':
                return ((a.status || 'active')).localeCompare(b.status || 'active');
            case 'status_desc':
                return ((b.status || 'active')).localeCompare(a.status || 'active');
            case 'warranty_desc': {
                const aInfo = getWarrantyInfo(a);
                const bInfo = getWarrantyInfo(b);

                // Sort by soonest expiry first, expired items (negative) come before active, and items without warranty last
                return aInfo.daysUntilExpiry - bInfo.daysUntilExpiry;
            }
            default:
                return 0;
        }
    });
    
    // Render filtered products
    renderProducts(filteredProducts);
    
    // Update counts
    updateCounts(filteredProducts.length);
}

async function renderProducts(products) {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;
    
    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 20px;">No products match the current filters</td></tr>';
        return;
    }
    
    // Load status options
    const statusOptions = await loadStatusOptions();
    
    // Render products using the same logic as admin.js
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
                    
                    warrantyStatus = warranty.payment_status === 'paid' 
                        ? '<span class="status-badge paid">Paid Warranty</span>'
                        : '<span class="status-badge confirmed">Free Warranty</span>';
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
        
        // eBay Order Number (editable) - for column 6
        const ebayOrderNumber = product.ebay_order_number || '';
        const hasEbayOrder = ebayOrderNumber && ebayOrderNumber.trim();
        const ebayOrderClass = hasEbayOrder ? 'has-ebay-order' : 'no-ebay-order';
        const ebayOrderInput = `<input 
            type="text" 
            class="ebay-order-input ${ebayOrderClass}" 
            data-product-id="${escapeHtml(String(product.id))}" 
            value="${escapeHtml(ebayOrderNumber)}"
            placeholder="Paste order number"
            style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;"
        >`;
        
        // Tracking Status (shipping tracking) - for column 9
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
        
        return `
            <tr data-product-id="${escapeHtml(String(product.id))}">
                <td>${escapeHtml(product.serial_number || '')}</td>
                <td>${escapeHtml(product.security_barcode)}</td>
                <td>${escapeHtml(shortenProductName(product.generation))}</td>
                <td>${escapeHtml(product.part_model_number || '')}</td>
                <td>${partTypeMap[product.part_type] || product.part_type}</td>
                <td>${ebayOrderInput}</td>
                <td>${photosDisplay}</td>
                <td>${formattedDate}</td>
                <td>${trackingDisplay}</td>
                <td>${statusDisplay}</td>
                <td>${warrantyStatus}</td>
                <td>${daysRemaining}</td>
                <td>
                    <div class="action-buttons">
                        <button class="view-button" data-action="view" data-product-id="${escapeHtml(String(product.id))}">
                            View
                        </button>
                        <button class="track-button" data-action="track" data-product-id="${escapeHtml(String(product.id))}">
                            Track
                        </button>
                        <button class="edit-button" data-action="edit" data-product-id="${escapeHtml(String(product.id))}">
                            Edit
                        </button>
                        <button class="delete-button" data-action="delete" data-product-id="${escapeHtml(String(product.id))}">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Attach event listeners
    attachEventListeners();
}

function updateCounts(filteredCount) {
    const filteredCountEl = document.getElementById('filteredCount');
    const totalCountEl = document.getElementById('totalCount');
    
    if (filteredCountEl) {
        filteredCountEl.textContent = filteredCount;
    }
    if (totalCountEl) {
        totalCountEl.textContent = allProductsData.length;
    }
}

function clearAllFilters() {
    const filterStatus = document.getElementById('filterStatus');
    const filterGeneration = document.getElementById('filterGeneration');
    const filterPartType = document.getElementById('filterPartType');
    const filterWarranty = document.getElementById('filterWarranty');
    const filterTracking = document.getElementById('filterTracking');
    const filterSearch = document.getElementById('filterSearch');
    const filterSort = document.getElementById('filterSort');
    
    if (filterStatus) filterStatus.value = '';
    if (filterGeneration) filterGeneration.value = '';
    if (filterPartType) filterPartType.value = '';
    if (filterWarranty) filterWarranty.value = '';
    if (filterTracking) filterTracking.value = '';
    if (filterSearch) filterSearch.value = '';
    if (filterSort) filterSort.value = 'date_desc';
    
    applyFiltersAndRender();
}

function attachEventListeners() {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;
    
    // eBay order number input listeners
    tableBody.querySelectorAll('.ebay-order-input').forEach(input => {
        let saveTimeout = null;
        
        input.addEventListener('input', function(e) {
            // Clear previous timeout
            if (saveTimeout) clearTimeout(saveTimeout);
            
            // Set a new timeout to save after user stops typing
            saveTimeout = setTimeout(async () => {
                const productId = this.getAttribute('data-product-id');
                const newEbayOrder = this.value.trim();
                
                if (!productId) return;
                
                // Visual feedback
                this.style.backgroundColor = '#fff3cd';
                this.disabled = true;
                
                try {
                    const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(productId)}/ebay-order`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ebay_order_number: newEbayOrder }),
                        credentials: 'include'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                        // Success feedback
                        this.style.backgroundColor = '#d4edda';
                        setTimeout(() => {
                            this.style.backgroundColor = '';
                        }, 1000);
                        
                        // Reload products and reapply filters
                        await fetchAndStoreProducts();
                        applyFiltersAndRender();
                    } else {
                        // Error feedback
                        this.style.backgroundColor = '#f8d7da';
                        alert(data.error || 'Failed to update eBay order number');
                        setTimeout(() => {
                            this.style.backgroundColor = '';
                        }, 2000);
                    }
                } catch (error) {
                    console.error('eBay order update error:', error);
                    this.style.backgroundColor = '#f8d7da';
                    alert('Network error. Please try again.');
                    setTimeout(() => {
                        this.style.backgroundColor = '';
                    }, 2000);
                } finally {
                    this.disabled = false;
                }
            }, 800); // Wait 800ms after user stops typing
        });
        
        // Also handle paste events
        input.addEventListener('paste', function(e) {
            // Clear any existing timeout
            if (saveTimeout) clearTimeout(saveTimeout);
            // The timeout will handle the save after paste
        });
    });
    
    // Re-attach event listeners (same as in admin.js)
    tableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId) {
                if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
                    return;
                }
                
                try {
                    const response = await authenticatedFetch(`${API_BASE}/api/admin/product/${encodeURIComponent(String(productId))}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                        // Reload products and reapply filters
                        await fetchAndStoreProducts();
                        applyFiltersAndRender();
                    } else {
                        alert(data.error || 'Failed to delete product');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    alert('Network error. Please try again.');
                }
            }
        });
    });
    
    tableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId && typeof editProduct === 'function') {
                editProduct(productId);
            }
        });
    });
    
    tableBody.querySelectorAll('[data-action="track"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId && typeof openTrackingModal === 'function') {
                openTrackingModal(productId);
            }
        });
    });

    tableBody.querySelectorAll('[data-action="view"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-product-id');
            if (productId && typeof openViewProductModal === 'function') {
                openViewProductModal(productId);
            }
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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        status: newStatus,
                        return_reason: returnReason || undefined
                    }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Reload products and reapply filters
                    await fetchAndStoreProducts();
                    applyFiltersAndRender();
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

// Helper function for HTML escaping (if not available globally)
// Helper function to shorten product names for table display
function shortenProductName(generation) {
    if (!generation) return '';
    
    let shortened = generation;
    
    // Remove "AirPods" and extra parentheses
    shortened = shortened.replace(/AirPods\s*/gi, '');
    shortened = shortened.replace(/^\(|\)$/g, '');
    
    // Handle Pro models
    if (shortened.includes('Pro')) {
        // "Pro (1st Gen)" → "Pro Gen1"
        shortened = shortened.replace(/Pro\s*\((\d+)(?:st|nd|rd|th)\s*Gen\)/i, 'Pro Gen$1');
    } else {
        // Regular AirPods - abbreviate generation
        // "(1st Gen)" → "Gen1"
        shortened = shortened.replace(/\((\d+)(?:st|nd|rd|th)\s*Gen\)/i, 'Gen$1');
        // "1st Gen" → "Gen1"
        shortened = shortened.replace(/(\d+)(?:st|nd|rd|th)\s*Gen/i, 'Gen$1');
    }
    
    // Handle 4th Gen special cases
    // "standard line (ANC version)" → "ANC"
    shortened = shortened.replace(/standard line\s*\(ANC version\)/i, 'ANC');
    // "standard line (non-Pro)" → remove it (no need to mention)
    shortened = shortened.replace(/standard line\s*\(non-Pro\)/i, '');
    
    // Clean up extra spaces and parentheses
    shortened = shortened.replace(/\s+/g, ' ').trim();
    shortened = shortened.replace(/^\(|\)$/g, '').trim();
    
    return shortened;
}

function escapeHtml(text) {
    if (typeof window.escapeHtml === 'function') {
        return window.escapeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
