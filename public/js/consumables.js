// Consumables Management - Frontend Logic
console.log('[CONSUMABLES] Script loaded - v1.0.0');

// Use window.API_BASE directly to avoid conflicts
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
console.log('[CONSUMABLES] API_BASE:', window.API_BASE);

let allConsumables = [];
let activeRestockId = null;
let activeStockCheckId = null;
let hasInitialized = false;

// Initialize function
function initializeConsumables() {
    if (hasInitialized) {
        return;
    }
    hasInitialized = true;
    console.log('[CONSUMABLES] Initializing consumables page...');

    // Check if authenticatedFetch is available
    if (typeof authenticatedFetch !== 'function') {
        console.error('[CONSUMABLES] authenticatedFetch is not available yet, retrying...');
        // Retry after a short delay
        setTimeout(initializeConsumables, 100);
        return;
    }

    console.log('[CONSUMABLES] authenticatedFetch is available, loading consumables...');
    loadConsumables();
    loadLowStockAlert();
    attachEventListeners();
    attachModalHandlers();
}

// Load consumables on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CONSUMABLES] DOMContentLoaded fired');
    initializeConsumables();
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    console.log('[CONSUMABLES] Document still loading, waiting for DOMContentLoaded...');
} else {
    console.log('[CONSUMABLES] Document already loaded, initializing immediately...');
    initializeConsumables();
}

async function loadConsumables() {
    console.log('[CONSUMABLES] Loading consumables from API...');
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables`, {
            credentials: 'include'
        });

        console.log('[CONSUMABLES] Response status:', response.status);

        if (!response.ok) {
            if (response.status === 401) {
                console.error('[CONSUMABLES] Unauthorized - redirecting to login');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load consumables - status: ' + response.status);
        }

        const data = await response.json();
        console.log('[CONSUMABLES] Received data:', data);
        allConsumables = data.consumables || [];
        console.log('[CONSUMABLES] Total consumables:', allConsumables.length);

        renderConsumables(allConsumables);
        updateStats();
        handleDirectActions();
    } catch (error) {
        console.error('[CONSUMABLES] Error loading consumables:', error);
        document.getElementById('consumablesTable').innerHTML =
            '<tr><td colspan="11" style="text-align: center; padding: 20px; color: #dc3545;">Failed to load consumables: ' + error.message + '</td></tr>';
    }
}

async function loadLowStockAlert() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables/alerts/low-stock`, {
            credentials: 'include'
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const lowStockCount = data.count || 0;

        if (lowStockCount > 0) {
            document.getElementById('lowStockCount').textContent = lowStockCount;
            document.getElementById('lowStockAlert').style.display = 'block';
        }
    } catch (error) {
        console.error('[CONSUMABLES] Error loading low stock alert:', error);
    }
}

function renderConsumables(consumables) {
    const tableBody = document.getElementById('consumablesTable');

    if (consumables.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px; color: #666;">No consumables found. <a href="add-consumable.html">Add your first item</a></td></tr>';
        return;
    }

    tableBody.innerHTML = consumables.map(item => {
        // Category badge
        const categoryColors = {
            'packaging': '#6f42c1',
            'shipping': '#0dcaf0',
            'cleaning': '#20c997',
            'cables': '#fd7e14',
            'ear-tips': '#d63384',
            'protective': '#198754',
            'general': '#6c757d'
        };
        const categoryColor = categoryColors[item.category] || '#6c757d';
        const categoryLabel = item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'General';
        const categoryBadge = `<span style="display: inline-block; padding: 4px 8px; background-color: ${categoryColor}; color: white; border-radius: 4px; font-size: 0.85rem;">${escapeHtml(categoryLabel)}</span>`;

        // Status badge with low stock indicator
        let statusColor = '#28a745'; // active
        let statusLabel = 'Active';

        if (item.status === 'discontinued') {
            statusColor = '#dc3545';
            statusLabel = 'Discontinued';
        } else if (item.reorder_level && item.quantity_in_stock <= item.reorder_level) {
            statusColor = '#ffc107';
            statusLabel = 'Low Stock';
        }

        const statusBadge = `<span style="display: inline-block; padding: 4px 8px; background-color: ${statusColor}; color: white; border-radius: 4px; font-size: 0.85rem;">${statusLabel}</span>`;

        // Calculate total value
        const totalValue = item.unit_cost ? (item.quantity_in_stock * item.unit_cost).toFixed(2) : '—';
        const totalValueDisplay = item.unit_cost ? `£${totalValue}` : '<span style="color: #999;">—</span>';

        // Unit cost display
        const unitCostDisplay = item.unit_cost ? `£${parseFloat(item.unit_cost).toFixed(2)}` : '<span style="color: #999;">—</span>';

        // Reorder level display
        let reorderDisplay = '<span style="color: #999;">—</span>';
        if (item.reorder_level) {
            reorderDisplay = `${item.reorder_level}`;
            if (item.quantity_in_stock <= item.reorder_level) {
                reorderDisplay = `<span style="color: #dc3545; font-weight: 600;">${item.reorder_level} ⚠️</span>`;
            }
        }

        // Location display
        const locationDisplay = item.location || '<span style="color: #999;">—</span>';

        // Item name with size and optional link
        let itemNameDisplay = item.size
            ? `<strong>${escapeHtml(item.item_name)}</strong><br><span style="font-size: 0.85rem; color: #666;">${escapeHtml(item.size)}</span>`
            : `<strong>${escapeHtml(item.item_name)}</strong>`;

        // Add product link icon if URL exists
        if (item.product_url && item.product_url.trim()) {
            itemNameDisplay += ` <a href="${escapeHtml(item.product_url)}" target="_blank" rel="noopener noreferrer" title="View product page" style="color: #0066cc; text-decoration: none;">🔗</a>`;
        }

        return `
            <tr data-consumable-id="${escapeHtml(String(item._id || item.id))}">
                <td>${itemNameDisplay}</td>
                <td><code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-size: 0.9rem;">${escapeHtml(item.sku)}</code></td>
                <td>${categoryBadge}</td>
                <td style="text-align: center;"><strong>${item.quantity_in_stock}</strong></td>
                <td>${escapeHtml(item.unit_type)}</td>
                <td style="text-align: right;">${unitCostDisplay}</td>
                <td style="text-align: right;">${totalValueDisplay}</td>
                <td style="text-align: center;">${reorderDisplay}</td>
                <td>${statusBadge}</td>
                <td>${locationDisplay}</td>
                <td style="text-align: center;">
                    <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
                        <button class="button button-small restock-button" data-id="${escapeHtml(String(item._id || item.id))}" data-name="${escapeHtml(item.item_name)}" data-unit="${escapeHtml(item.unit_type)}" style="padding: 4px 8px; font-size: 0.85rem;">Restock</button>
                        <button class="button button-small checkin-button" data-id="${escapeHtml(String(item._id || item.id))}" data-name="${escapeHtml(item.item_name)}" data-unit="${escapeHtml(item.unit_type)}" style="padding: 4px 8px; font-size: 0.85rem;">Check-In</button>
                        <a href="edit-consumable.html?id=${encodeURIComponent(String(item._id || item.id))}" class="button button-small" style="padding: 4px 8px; font-size: 0.85rem;">Edit</a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.querySelectorAll('.restock-button').forEach(button => {
        button.addEventListener('click', () => {
            openRestockModal(button.dataset.id, button.dataset.name, button.dataset.unit);
        });
    });

    tableBody.querySelectorAll('.checkin-button').forEach(button => {
        button.addEventListener('click', () => {
            openStockCheckModal(button.dataset.id, button.dataset.name, button.dataset.unit);
        });
    });
}

function updateStats() {
    // Update count
    const count = allConsumables.length;
    document.getElementById('consumablesCount').textContent =
        count === 1 ? '1 item' : `${count} items`;

    // Calculate total value
    let totalValue = 0;
    allConsumables.forEach(item => {
        if (item.unit_cost && item.quantity_in_stock) {
            totalValue += item.unit_cost * item.quantity_in_stock;
        }
    });

    document.getElementById('totalValue').textContent = `£${totalValue.toFixed(2)}`;
}

function attachEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchConsumables');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            filterConsumables();
        });
    }

    // Category filter
    const categoryFilter = document.getElementById('filterCategory');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            filterConsumables();
        });
    }

    // Status filter
    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            filterConsumables();
        });
    }

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            document.getElementById('searchConsumables').value = '';
            document.getElementById('filterCategory').value = '';
            document.getElementById('filterStatus').value = '';
            filterConsumables();
        });
    }
}

function openRestockModal(consumableId, itemName, unitType) {
    activeRestockId = consumableId;
    document.getElementById('restockItemName').textContent = `${itemName} (${unitType})`;
    document.getElementById('restockQuantity').value = '';
    document.getElementById('restockReason').value = '';
    document.getElementById('restockModal').style.display = 'flex';
}

function closeRestockModal() {
    document.getElementById('restockModal').style.display = 'none';
    activeRestockId = null;
}

function openStockCheckModal(consumableId, itemName, unitType) {
    activeStockCheckId = consumableId;
    document.getElementById('stockCheckItemName').textContent = `${itemName} (${unitType})`;
    document.getElementById('checkedQuantity').value = '';
    document.getElementById('faultyQuantity').value = 0;
    document.getElementById('breakageQuantity').value = 0;
    document.getElementById('stockCheckNotes').value = '';
    document.getElementById('stockCheckModal').style.display = 'flex';
}

function closeStockCheckModal() {
    document.getElementById('stockCheckModal').style.display = 'none';
    activeStockCheckId = null;
}

function attachModalHandlers() {
    const restockForm = document.getElementById('restockForm');
    const stockCheckForm = document.getElementById('stockCheckForm');

    document.getElementById('cancelRestock').addEventListener('click', closeRestockModal);
    document.getElementById('cancelStockCheck').addEventListener('click', closeStockCheckModal);

    restockForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const adjustment = parseInt(document.getElementById('restockQuantity').value);
        const reason = document.getElementById('restockReason').value.trim();

        if (!activeRestockId || !adjustment || adjustment <= 0) {
            alert('Please enter a valid restock quantity.');
            return;
        }

        try {
            const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables/${activeRestockId}/adjust-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adjustment, reason }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to restock consumable');
            }

            closeRestockModal();
            loadConsumables();
            loadLowStockAlert();
        } catch (error) {
            console.error('[CONSUMABLES] Restock error:', error);
            alert('Error: ' + error.message);
        }
    });

    stockCheckForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const quantityChecked = parseInt(document.getElementById('checkedQuantity').value);
        const faultyQuantity = parseInt(document.getElementById('faultyQuantity').value) || 0;
        const breakageQuantity = parseInt(document.getElementById('breakageQuantity').value) || 0;
        const notes = document.getElementById('stockCheckNotes').value.trim();

        if (!activeStockCheckId || Number.isNaN(quantityChecked) || quantityChecked < 0) {
            alert('Please enter a valid checked quantity.');
            return;
        }

        if (faultyQuantity < 0 || breakageQuantity < 0 || faultyQuantity + breakageQuantity > quantityChecked) {
            alert('Faulty and breakage quantities must be zero or more and not exceed the checked quantity.');
            return;
        }

        try {
            const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables/${activeStockCheckId}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity_checked: quantityChecked,
                    faulty_quantity: faultyQuantity,
                    breakage_quantity: breakageQuantity,
                    notes
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save stock check');
            }

            closeStockCheckModal();
            loadConsumables();
            loadLowStockAlert();
        } catch (error) {
            console.error('[CONSUMABLES] Stock check error:', error);
            alert('Error: ' + error.message);
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('restockModal')) {
            closeRestockModal();
        }
        if (event.target === document.getElementById('stockCheckModal')) {
            closeStockCheckModal();
        }
    });
}

function filterConsumables() {
    const searchTerm = document.getElementById('searchConsumables').value.toLowerCase();
    const categoryFilter = document.getElementById('filterCategory').value;
    const statusFilter = document.getElementById('filterStatus').value;

    const filtered = allConsumables.filter(item => {
        // Search filter
        const matchesSearch = !searchTerm ||
            (item.item_name && item.item_name.toLowerCase().includes(searchTerm)) ||
            (item.sku && item.sku.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm));

        // Category filter
        const matchesCategory = !categoryFilter || item.category === categoryFilter;

        // Status filter
        let matchesStatus = true;
        if (statusFilter === 'low-stock') {
            matchesStatus = item.reorder_level && item.quantity_in_stock <= item.reorder_level;
        } else if (statusFilter) {
            matchesStatus = item.status === statusFilter;
        }

        return matchesSearch && matchesCategory && matchesStatus;
    });

    renderConsumables(filtered);

    // Update count for filtered results
    const count = filtered.length;
    document.getElementById('consumablesCount').textContent =
        count === 1 ? '1 item' : `${count} items`;
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function handleDirectActions() {
    const params = new URLSearchParams(window.location.search);
    const restockId = params.get('restockId');
    const checkInId = params.get('checkInId');

    if (restockId) {
        const item = allConsumables.find(consumable => String(consumable._id || consumable.id) === restockId);
        if (item) {
            openRestockModal(restockId, item.item_name, item.unit_type);
        }
    }

    if (checkInId) {
        const item = allConsumables.find(consumable => String(consumable._id || consumable.id) === checkInId);
        if (item) {
            openStockCheckModal(checkInId, item.item_name, item.unit_type);
        }
    }
}
