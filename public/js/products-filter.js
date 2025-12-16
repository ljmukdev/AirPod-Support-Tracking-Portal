// Products Filter and Sort - Flat UI Version

let allProducts = [];
let filteredProducts = [];

const filterState = {
    search: '',
    status: '',
    generation: '',
    partType: '',
    warranty: '',
    tracking: '',
    sort: 'date_desc'
};

// Initialize filters
function initProductsFilter() {
    const filterSearch = document.getElementById('filterSearch');
    const headerSearch = document.getElementById('headerSearch');
    const filterStatus = document.getElementById('filterStatus');
    const filterGeneration = document.getElementById('filterGeneration');
    const filterPartType = document.getElementById('filterPartType');
    const filterWarranty = document.getElementById('filterWarranty');
    const filterTracking = document.getElementById('filterTracking');
    const filterSort = document.getElementById('filterSort');
    const clearFiltersBtn = document.getElementById('clearFilters');

    if (!filterSearch && !headerSearch) return;

    // Sync both search inputs
    const handleSearchChange = debounce((value) => {
        filterState.search = value.toLowerCase();
        syncSearchInputs(value);
        applyFilters();
    }, 300);

    if (filterSearch) {
        filterSearch.addEventListener('input', (e) => handleSearchChange(e.target.value));
    }

    if (headerSearch) {
        headerSearch.addEventListener('input', (e) => handleSearchChange(e.target.value));
    }

    if (filterStatus) filterStatus.addEventListener('change', (e) => {
        filterState.status = e.target.value;
        applyFilters();
    });

    if (filterGeneration) filterGeneration.addEventListener('change', (e) => {
        filterState.generation = e.target.value;
        applyFilters();
    });

    if (filterPartType) filterPartType.addEventListener('change', (e) => {
        filterState.partType = e.target.value;
        applyFilters();
    });

    if (filterWarranty) filterWarranty.addEventListener('change', (e) => {
        filterState.warranty = e.target.value;
        applyFilters();
    });

    if (filterTracking) filterTracking.addEventListener('change', (e) => {
        filterState.tracking = e.target.value;
        applyFilters();
    });

    if (filterSort) filterSort.addEventListener('change', (e) => {
        filterState.sort = e.target.value;
        applyFilters();
    });

    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function syncSearchInputs(value) {
    const filterSearch = document.getElementById('filterSearch');
    const headerSearch = document.getElementById('headerSearch');

    if (filterSearch) filterSearch.value = value;
    if (headerSearch) headerSearch.value = value;
}

function setProductsForFiltering(products) {
    allProducts = products;
    filteredProducts = products;
    applyFilters();
}

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
    updateProductsCount();
}

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

function updateProductsDisplay() {
    if (typeof window.renderFilteredProducts === 'function') {
        window.renderFilteredProducts(filteredProducts);
    }

    // Ensure legacy action buttons continue to work after filtering
    attachEventListeners();
}

function clearAllFilters() {
    filterState.search = '';
    filterState.status = '';
    filterState.generation = '';
    filterState.partType = '';
    filterState.warranty = '';
    filterState.tracking = '';
    filterState.sort = 'date_desc';

    const filterStatus = document.getElementById('filterStatus');
    const filterGeneration = document.getElementById('filterGeneration');
    const filterPartType = document.getElementById('filterPartType');
    const filterWarranty = document.getElementById('filterWarranty');
    const filterTracking = document.getElementById('filterTracking');
    const filterSort = document.getElementById('filterSort');

    syncSearchInputs('');
    if (filterStatus) filterStatus.value = '';
    if (filterGeneration) filterGeneration.value = '';
    if (filterPartType) filterPartType.value = '';
    if (filterWarranty) filterWarranty.value = '';
    if (filterTracking) filterTracking.value = '';
    if (filterSort) filterSort.value = 'date_desc';

    applyFilters();
}

function updateProductsCount() {
    const countElements = [
        ...document.querySelectorAll('[data-products-count]'),
        ...document.querySelectorAll('#productsCount')
    ];

    if (!countElements.length) return;

    const total = allProducts.length;
    const filtered = filteredProducts.length;
    const text = filtered === total
        ? `${total} product${total !== 1 ? 's' : ''}`
        : `${filtered} of ${total} products`;

    countElements.forEach(el => {
        el.textContent = text;
    });
}

function attachEventListeners() {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;

    tableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.currentTarget.getAttribute('data-product-id');
            if (productId) {
                deleteProduct(productId);
            }
        });
    });

    tableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.currentTarget.getAttribute('data-product-id');
            if (productId) {
                editProduct(productId);
            }
        });
    });

    tableBody.querySelectorAll('[data-action="track"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.currentTarget.getAttribute('data-product-id');
            if (productId) {
                openTrackingModal(productId);
            }
        });
    });
}

// Expose functions
window.initProductsFilter = initProductsFilter;
window.setProductsForFiltering = setProductsForFiltering;
