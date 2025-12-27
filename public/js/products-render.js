// Products Table Rendering - Flat UI Version

// Render products table (called by filter system)
window.renderFilteredProducts = function(products) {
    renderProductsTable(products);
};

async function renderProductsTable(products) {
    const tableBody = document.getElementById('productsTable');
    if (!tableBody) return;

    const statusOptions = await loadStatusOptions();

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="table-loading">No products match your filters</td></tr>';
        return;
    }

    const rows = products.map(product => {
        // Product Column: Generation + Part Type + Model
        const generation = product.generation || 'Unknown';
        const partTypeMap = {
            'left': 'Left AirPod',
            'right': 'Right AirPod',
            'case': 'Case'
        };
        const partType = partTypeMap[product.part_type] || product.part_type || '';
        const model = product.part_model_number || '';

        // Serial Column
        const serialNumber = product.serial_number || '—';

        // Order Column
        const orderNumber = product.ebay_order_number || '—';

        // Status
        let productStatus = product.status || 'active';
        if (productStatus === 'active' && product.tracking_number && !product.warranty) {
            productStatus = 'delivered_no_warranty';
        }

        // Warranty
        let warrantyClass = 'none';
        let warrantyText = 'No warranty';

        if (product.warranty) {
            const warranty = product.warranty;
            const warrantyEndDate = warranty.extended_warranty_end && warranty.extended_warranty !== 'none'
                ? new Date(warranty.extended_warranty_end)
                : warranty.standard_warranty_end
                    ? new Date(warranty.standard_warranty_end)
                    : null;

            if (warrantyEndDate) {
                const now = new Date();
                if (warrantyEndDate <= now) {
                    warrantyClass = 'expired';
                    warrantyText = 'Expired';
                } else {
                    if (warranty.payment_status === 'paid') {
                        warrantyClass = 'paid';
                        warrantyText = 'Paid warranty';
                    } else {
                        warrantyClass = 'active';
                        warrantyText = 'Active';
                    }
                }
            } else {
                warrantyClass = warranty.payment_status === 'paid' ? 'paid' : 'active';
                warrantyText = warranty.payment_status === 'paid' ? 'Paid warranty' : 'Free warranty';
            }
        }

        // Tracking
        const hasTracking = product.tracking_number && product.tracking_number.trim();
        const trackingIcon = hasTracking ? '✓' : '✗';
        const trackingClass = hasTracking ? 'has-tracking' : 'no-tracking';

        // Date
        const date = new Date(product.date_added);
        const dateText = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        // Build status options
        let statusOptionsHtml = '';
        statusOptions.forEach(option => {
            const selected = productStatus === option.value ? ' selected' : '';
            statusOptionsHtml += `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
        });

        return `
            <tr data-product-id="${escapeHtml(String(product.id))}">
                <td>
                    <div class="product-cell">
                        <div class="product-name">${escapeHtml(generation)}</div>
                        <div class="product-meta">${escapeHtml(partType)}${model ? ' · ' + escapeHtml(model) : ''}</div>
                    </div>
                </td>
                <td>
                    <span class="serial-number">${escapeHtml(serialNumber)}</span>
                </td>
                <td>
                    <a href="#" class="order-link">${escapeHtml(orderNumber)}</a>
                </td>
                <td>
                    <div class="status-cell">
                        <span class="status-badge ${productStatus}">${getStatusText(productStatus)}</span>
                        <select class="status-select" data-product-id="${escapeHtml(String(product.id))}" data-original-status="${escapeHtml(productStatus)}">
                            ${statusOptionsHtml}
                        </select>
                    </div>
                </td>
                <td>
                    <span class="warranty-badge ${warrantyClass}">${warrantyText}</span>
                </td>
                <td>
                    <span class="tracking-icon ${trackingClass}">${trackingIcon}</span>
                </td>
                <td>
                    <span class="date-text">${dateText}</span>
                </td>
                <td>
                    <div class="actions-menu">
                        <button class="actions-btn" data-product-id="${escapeHtml(String(product.id))}" onclick="toggleActionsMenu(event, '${escapeHtml(String(product.id))}')">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
                                <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
                                <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
                            </svg>
                        </button>
                        <div class="actions-dropdown" id="actions-${escapeHtml(String(product.id))}">
                            <button onclick="openTrackingModal('${escapeHtml(String(product.id))}')">Add Tracking</button>
                            <button onclick="editProduct('${escapeHtml(String(product.id))}')">Edit</button>
                            <button onclick="deleteProduct('${escapeHtml(String(product.id))}')">Delete</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;

    // Attach event listeners
    attachProductEventListeners(tableBody);
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Active',
        'delivered_no_warranty': 'No Warranty',
        'returned': 'Returned',
        'pending': 'Pending'
    };
    return statusMap[status] || status;
}

function toggleActionsMenu(event, productId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`actions-${productId}`);
    const allDropdowns = document.querySelectorAll('.actions-dropdown');

    // Close all other dropdowns
    allDropdowns.forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
    });

    // Toggle current dropdown
    dropdown.classList.toggle('open');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.actions-menu')) {
        document.querySelectorAll('.actions-dropdown').forEach(d => {
            d.classList.remove('open');
        });
    }
});

// Attach event listeners to product elements
function attachProductEventListeners(tableBody) {
    // Status select listeners
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
                const response = await authenticatedFetch(`${window.API_BASE}/api/admin/product/${encodeURIComponent(productId)}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: newStatus,
                        return_reason: returnReason || undefined
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Reload products from main admin.js
                    if (typeof loadProducts === 'function') {
                        loadProducts();
                    }
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

async function loadStatusOptions() {
    // Check cache first
    if (window.statusOptionsCache) {
        return window.statusOptionsCache;
    }

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/settings`);
        if (response.ok) {
            const settings = await response.json();
            if (settings.status_options && Array.isArray(settings.status_options)) {
                window.statusOptionsCache = settings.status_options;
                return settings.status_options;
            }
        }
    } catch (error) {
        console.error('Error loading status options:', error);
    }

    // Default options
    window.statusOptionsCache = [
        { value: 'active', label: 'Active' },
        { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
        { value: 'returned', label: 'Returned' },
        { value: 'pending', label: 'Pending' }
    ];

    return window.statusOptionsCache;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}
