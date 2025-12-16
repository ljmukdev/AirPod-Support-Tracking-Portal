// Products Filter and Sort Functionality

let allProducts = []; // Store all products for filtering
let filteredProducts = []; // Currently filtered products

// Filter state
const filterState = {
    search: '',
    status: '',
    generation: '',
    partType: '',
    warranty: '',
    tracking: '',
    sort: 'date_desc'
};

// Initialize filters when DOM is loaded
function initProductsFilter() {
    // Get filter elements
    const filterSearch = document.getElementById('filterSearch');
    const filterStatus = document.getElementById('filterStatus');
    const filterGeneration = document.getElementById('filterGeneration');
    const filterPartType = document.getElementById('filterPartType');
    const filterWarranty = document.getElementById('filterWarranty');
    const filterTracking = document.getElementById('filterTracking');
    const filterSort = document.getElementById('filterSort');
    const clearFiltersBtn = document.getElementById('clearFilters');

    if (!filterSearch) return; // Exit if not on products page

    // Add event listeners
    filterSearch.addEventListener('input', debounce((e) => {
        filterState.search = e.target.value.toLowerCase();
        applyFilters();
    }, 300));

    filterStatus.addEventListener('change', (e) => {
        filterState.status = e.target.value;
        applyFilters();
    });

    filterGeneration.addEventListener('change', (e) => {
        filterState.generation = e.target.value;
        applyFilters();
    });

    filterPartType.addEventListener('change', (e) => {
        filterState.partType = e.target.value;
        applyFilters();
    });

    filterWarranty.addEventListener('change', (e) => {
        filterState.warranty = e.target.value;
        applyFilters();
    });

    filterTracking.addEventListener('change', (e) => {
        filterState.tracking = e.target.value;
        applyFilters();
    });

    filterSort.addEventListener('change', (e) => {
        filterState.sort = e.target.value;
        applyFilters();
    });

    clearFiltersBtn.addEventListener('click', clearAllFilters);
}

// Debounce function for search input
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

// Store products for filtering
function setProductsForFiltering(products) {
    allProducts = products;
    filteredProducts = products;
    applyFilters();
}

// Apply all active filters
function applyFilters() {
    let filtered = [...allProducts];

    // Apply search filter
    if (filterState.search) {
        filtered = filtered.filter(product => {
            const searchStr = filterState.search;
            return (
                (product.serial_number || '').toLowerCase().includes(searchStr) ||
                (product.security_barcode || '').toLowerCase().includes(searchStr) ||
                (product.ebay_order_number || '').toLowerCase().includes(searchStr) ||
                (product.part_model_number || '').toLowerCase().includes(searchStr)
            );
        });
    }

    // Apply status filter
    if (filterState.status) {
        filtered = filtered.filter(product => {
            let productStatus = product.status || 'active';
            // Auto-detect "delivered_no_warranty"
            if (productStatus === 'active' && product.tracking_number && !product.warranty) {
                productStatus = 'delivered_no_warranty';
            }
            return productStatus === filterState.status;
        });
    }

    // Apply generation filter
    if (filterState.generation) {
        filtered = filtered.filter(product =>
            (product.generation || '') === filterState.generation
        );
    }

    // Apply part type filter
    if (filterState.partType) {
        filtered = filtered.filter(product =>
            (product.part_type || '') === filterState.partType
        );
    }

    // Apply warranty filter
    if (filterState.warranty) {
        filtered = filtered.filter(product => {
            if (filterState.warranty === 'none') {
                return !product.warranty;
            } else if (filterState.warranty === 'active') {
                if (!product.warranty) return false;
                const warrantyEndDate = product.warranty.extended_warranty_end && product.warranty.extended_warranty !== 'none'
                    ? new Date(product.warranty.extended_warranty_end)
                    : product.warranty.standard_warranty_end
                        ? new Date(product.warranty.standard_warranty_end)
                        : null;
                if (!warrantyEndDate) return false;
                return warrantyEndDate > new Date();
            } else if (filterState.warranty === 'expired') {
                if (!product.warranty) return false;
                const warrantyEndDate = product.warranty.extended_warranty_end && product.warranty.extended_warranty !== 'none'
                    ? new Date(product.warranty.extended_warranty_end)
                    : product.warranty.standard_warranty_end
                        ? new Date(product.warranty.standard_warranty_end)
                        : null;
                if (!warrantyEndDate) return false;
                return warrantyEndDate <= new Date();
            } else if (filterState.warranty === 'paid') {
                return product.warranty && product.warranty.payment_status === 'paid';
            }
            return true;
        });
    }

    // Apply tracking filter
    if (filterState.tracking) {
        if (filterState.tracking === 'tracked') {
            filtered = filtered.filter(product =>
                product.tracking_number && product.tracking_number.trim()
            );
        } else if (filterState.tracking === 'not_tracked') {
            filtered = filtered.filter(product =>
                !product.tracking_number || !product.tracking_number.trim()
            );
        }
    }

    // Apply sorting
    filtered = sortProducts(filtered, filterState.sort);

    filteredProducts = filtered;
    updateProductsDisplay();
    updateActiveFiltersDisplay();
    updateProductsCount();
}

// Sort products based on selected option
function sortProducts(products, sortOption) {
    const sorted = [...products];

    switch (sortOption) {
        case 'date_desc':
            sorted.sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
            break;
        case 'date_asc':
            sorted.sort((a, b) => new Date(a.date_added) - new Date(b.date_added));
            break;
        case 'serial_asc':
            sorted.sort((a, b) => (a.serial_number || '').localeCompare(b.serial_number || ''));
            break;
        case 'serial_desc':
            sorted.sort((a, b) => (b.serial_number || '').localeCompare(a.serial_number || ''));
            break;
        case 'warranty_desc':
            sorted.sort((a, b) => {
                const getWarrantyEnd = (product) => {
                    if (!product.warranty) return null;
                    return product.warranty.extended_warranty_end && product.warranty.extended_warranty !== 'none'
                        ? new Date(product.warranty.extended_warranty_end)
                        : product.warranty.standard_warranty_end
                            ? new Date(product.warranty.standard_warranty_end)
                            : null;
                };
                const aEnd = getWarrantyEnd(a);
                const bEnd = getWarrantyEnd(b);
                if (!aEnd && !bEnd) return 0;
                if (!aEnd) return 1;
                if (!bEnd) return -1;
                return aEnd - bEnd;
            });
            break;
    }

    return sorted;
}

// Update the products table display
function updateProductsDisplay() {
    // Call the original loadProducts function but with filtered data
    // This function will be integrated with admin.js
    if (typeof window.renderFilteredProducts === 'function') {
        window.renderFilteredProducts(filteredProducts);
    }
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const activeFiltersDiv = document.getElementById('activeFilters');
    if (!activeFiltersDiv) return;

    const activeFilters = [];

    if (filterState.search) {
        activeFilters.push({
            label: 'Search',
            value: filterState.search,
            key: 'search'
        });
    }

    if (filterState.status) {
        const statusLabels = {
            'active': 'Active',
            'delivered_no_warranty': 'Delivered (No Warranty)',
            'returned': 'Returned',
            'pending': 'Pending'
        };
        activeFilters.push({
            label: 'Status',
            value: statusLabels[filterState.status] || filterState.status,
            key: 'status'
        });
    }

    if (filterState.generation) {
        activeFilters.push({
            label: 'Generation',
            value: filterState.generation.replace('AirPods ', ''),
            key: 'generation'
        });
    }

    if (filterState.partType) {
        const typeLabels = {
            'left': 'Left AirPod',
            'right': 'Right AirPod',
            'case': 'Case'
        };
        activeFilters.push({
            label: 'Type',
            value: typeLabels[filterState.partType] || filterState.partType,
            key: 'partType'
        });
    }

    if (filterState.warranty) {
        const warrantyLabels = {
            'active': 'Active Warranty',
            'none': 'No Warranty',
            'expired': 'Expired',
            'paid': 'Paid'
        };
        activeFilters.push({
            label: 'Warranty',
            value: warrantyLabels[filterState.warranty] || filterState.warranty,
            key: 'warranty'
        });
    }

    if (filterState.tracking) {
        const trackingLabels = {
            'tracked': 'Tracked',
            'not_tracked': 'Not Tracked'
        };
        activeFilters.push({
            label: 'Tracking',
            value: trackingLabels[filterState.tracking] || filterState.tracking,
            key: 'tracking'
        });
    }

    if (activeFilters.length > 0) {
        activeFiltersDiv.style.display = 'flex';
        activeFiltersDiv.innerHTML = `
            <span class="active-filters-label">Active Filters:</span>
            ${activeFilters.map(filter => `
                <span class="filter-chip">
                    <strong>${filter.label}:</strong> ${filter.value}
                    <button class="filter-chip-remove" data-filter-key="${filter.key}" title="Remove filter">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </span>
            `).join('')}
        `;

        // Add event listeners to remove buttons
        activeFiltersDiv.querySelectorAll('.filter-chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterKey = e.currentTarget.getAttribute('data-filter-key');
                removeFilter(filterKey);
            });
        });
    } else {
        activeFiltersDiv.style.display = 'none';
    }
}

// Remove a single filter
function removeFilter(filterKey) {
    filterState[filterKey] = '';

    // Update the corresponding UI element
    const elementMap = {
        'search': 'filterSearch',
        'status': 'filterStatus',
        'generation': 'filterGeneration',
        'partType': 'filterPartType',
        'warranty': 'filterWarranty',
        'tracking': 'filterTracking'
    };

    const element = document.getElementById(elementMap[filterKey]);
    if (element) {
        element.value = '';
    }

    applyFilters();
}

// Clear all filters
function clearAllFilters() {
    filterState.search = '';
    filterState.status = '';
    filterState.generation = '';
    filterState.partType = '';
    filterState.warranty = '';
    filterState.tracking = '';

    // Reset all UI elements
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterGeneration').value = '';
    document.getElementById('filterPartType').value = '';
    document.getElementById('filterWarranty').value = '';
    document.getElementById('filterTracking').value = '';

    applyFilters();
}

// Update products count
function updateProductsCount() {
    const countElement = document.getElementById('productsCount');
    if (countElement) {
        const total = allProducts.length;
        const filtered = filteredProducts.length;

        if (filtered === total) {
            countElement.textContent = `${total} product${total !== 1 ? 's' : ''}`;
        } else {
            countElement.textContent = `${filtered} of ${total} products`;
        }
    }
}

// Expose functions to global scope
window.initProductsFilter = initProductsFilter;
window.setProductsForFiltering = setProductsForFiltering;
