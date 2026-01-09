// Sales Management JavaScript
// Sales-specific code wrapped to avoid global scope conflicts
(function() {
    'use strict';
    
    // Use the API_BASE and authenticatedFetch already defined globally by admin.js
    const API_BASE = window.API_BASE || '';
    const authenticatedFetch = window.authenticatedFetch;
    
    let currentSaleId = null;
let selectedConsumables = [];
let productCost = 0;
let templateConsumables = [];
let allConsumables = [];
let consumablePickerConfirmHandler = null;

// Helper function to generate display names for products
function getDisplayName(partType, generation) {
    const typeMap = {
        'left': 'Left Earbud',
        'right': 'Right Earbud',
        'case': 'Charging Case',
        'ear_tips': 'Ear Tips',
        'box': 'Original Box',
        'cable': 'Charging Cable',
        'other': 'Accessory'
    };

    const displayName = typeMap[partType] || partType;
    return generation ? `${generation} - ${displayName}` : displayName;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSales();
    loadSummary();
    setupEventListeners();
    setupDateDefault();
});

function setupDateDefault() {
    // Set today's date as default
    const dateInput = document.getElementById('saleDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
}

function setupEventListeners() {
    // Add Sale Button
    document.getElementById('addSaleBtn')?.addEventListener('click', openAddSaleModal);
    
    // Manage Templates Button
    document.getElementById('manageTemplatesBtn')?.addEventListener('click', openTemplatesModal);
    
    // Sale Form Submit
    document.getElementById('saleForm')?.addEventListener('submit', handleSaleSubmit);
    
    // Selection Method Radio Buttons
    document.querySelectorAll('input[name="selectionMethod"]').forEach(radio => {
        radio.addEventListener('change', handleSelectionMethodChange);
    });
    
    // Security Barcode Input
    document.getElementById('securityBarcode')?.addEventListener('input', handleBarcodeInput);
    document.getElementById('securityBarcode')?.addEventListener('blur', handleBarcodeBlur);

    // Accessory Search Input
    document.getElementById('accessorySearch')?.addEventListener('input', handleAccessorySearch);
    document.getElementById('accessorySearch')?.addEventListener('focus', handleAccessorySearch);

    // Sale Price Input
    document.getElementById('salePrice')?.addEventListener('input', updatePreview);
    
    // Add Consumable Button
    document.getElementById('addConsumableBtn')?.addEventListener('click', addConsumableRow);
    
    // Load Template Button
    document.getElementById('loadTemplateBtn')?.addEventListener('click', loadTemplate);
    
    // Search and Filter
    document.getElementById('searchSales')?.addEventListener('input', filterSales);
    document.getElementById('filterPeriod')?.addEventListener('change', filterSales);
    
    // Add Template Button in templates modal
    document.getElementById('addTemplateBtn')?.addEventListener('click', openCreateTemplateModal);
    
    // Template Creation Modal
    document.getElementById('createTemplateForm')?.addEventListener('submit', handleTemplateSubmit);
    document.getElementById('addTemplateConsumableBtn')?.addEventListener('click', addTemplateConsumable);

    // Consumable Picker Modal
    document.getElementById('consumablePickerCancel')?.addEventListener('click', closeConsumablePickerModal);
    document.getElementById('consumablePickerConfirm')?.addEventListener('click', handleConsumablePickerConfirm);
}

function normalizeConsumableId(value) {
    return value ? String(value) : '';
}

function normalizeQuantity(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// ===== SALES LIST =====

async function loadSales() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/sales`);
        const data = await response.json();
        
        if (response.ok && data.sales) {
            displaySales(data.sales);
        } else {
            showError('Failed to load sales');
        }
    } catch (error) {
        console.error('Error loading sales:', error);
        showError('Error loading sales');
    }
}

function displaySales(sales) {
    const tbody = document.getElementById('salesTableBody');
    
    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">No sales found</td></tr>';
        return;
    }
    
    tbody.innerHTML = sales.map(sale => {
        const saleDate = new Date(sale.sale_date).toLocaleDateString();
        const salePrice = typeof sale.sale_price === 'number' ? sale.sale_price : 0;
        const totalCost = typeof sale.total_cost === 'number' ? sale.total_cost : 0;
        const profitValue = typeof sale.profit === 'number'
            ? sale.profit
            : (salePrice - totalCost);
        const profit = profitValue.toFixed(2);
        const margin = salePrice > 0 ? ((profitValue / salePrice) * 100).toFixed(1) : '0.0';
        const profitColor = profitValue >= 0 ? '#10b981' : '#ef4444';
        
        return `
            <tr>
                <td>${saleDate}</td>
                <td>
                    <div style="font-weight: 600;">${sale.product_name || 'Unknown Product'}</div>
                    <div style="font-size: 0.85rem; color: #666;">${sale.product_serial || 'N/A'}</div>
                </td>
                <td>${sale.platform || 'N/A'}</td>
                <td>
                    <div>${sale.order_number || 'N/A'}</div>
                    ${sale.outward_tracking_number ? `<div style="font-size: 0.85rem; color: #666;">Tracking: ${sale.outward_tracking_number}</div>` : ''}
                </td>
                <td style="font-weight: 600;">£${salePrice.toFixed(2)}</td>
                <td>£${totalCost.toFixed(2)}</td>
                <td style="font-weight: 700; color: ${profitColor};">£${profit}</td>
                <td style="font-weight: 600; color: ${profitColor};">${margin}%</td>
                <td>
                    <button class="button-icon" onclick="viewSale('${sale._id}')" title="Edit Sale">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z" stroke="currentColor" stroke-width="1.5"/>
                            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </button>
                    <button class="button-icon" onclick="deleteSale('${sale._id}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4h12M5 4V3h6v1M5 7v6M8 7v6M11 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterSales() {
    const searchTerm = document.getElementById('searchSales')?.value.toLowerCase() || '';
    const period = document.getElementById('filterPeriod')?.value || 'all';
    
    // This would filter the sales based on search and period
    // For now, just reload
    loadSales();
}

// ===== SUMMARY/P&L =====

async function loadSummary() {
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/sales/summary`);
        const data = await response.json();
        
        if (response.ok) {
            displaySummary(data);
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

function displaySummary(summary) {
    document.getElementById('totalSales').textContent = `£${summary.total_revenue?.toFixed(2) || '0.00'}`;
    document.getElementById('totalCosts').textContent = `£${summary.total_costs?.toFixed(2) || '0.00'}`;
    
    const profit = (summary.total_revenue || 0) - (summary.total_costs || 0);
    const profitEl = document.getElementById('totalProfit');
    profitEl.textContent = `£${profit.toFixed(2)}`;
    profitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
    
    const margin = summary.total_revenue > 0 ? ((profit / summary.total_revenue) * 100).toFixed(1) : '0.0';
    const marginEl = document.getElementById('profitMargin');
    marginEl.textContent = `${margin}%`;
    marginEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
}

// ===== ADD/EDIT SALE MODAL =====

// ===== PRODUCT SELECTION HANDLERS =====

function handleSelectionMethodChange(e) {
    const method = e.target.value;
    const barcodeGroup = document.getElementById('barcodeInputGroup');
    const accessoryGroup = document.getElementById('accessorySelectGroup');
    const barcodeInput = document.getElementById('securityBarcode');
    const accessorySearch = document.getElementById('accessorySearch');
    const selectedProductId = document.getElementById('selectedProductId');
    const barcodeStatus = document.getElementById('barcodeStatus');
    const accessoryStatus = document.getElementById('accessoryStatus');
    const accessoryResults = document.getElementById('accessorySearchResults');

    if (method === 'barcode') {
        // Show barcode input, hide accessory search
        barcodeGroup.style.display = 'block';
        accessoryGroup.style.display = 'none';
        barcodeInput.value = '';
        accessorySearch.value = '';
        selectedProductId.value = '';
        barcodeStatus.style.display = 'none';
        accessoryStatus.style.display = 'none';
        accessoryResults.style.display = 'none';
        productCost = 0;
    } else {
        // Show accessory search, hide barcode input
        barcodeGroup.style.display = 'none';
        accessoryGroup.style.display = 'block';
        barcodeInput.value = '';
        accessorySearch.value = '';
        selectedProductId.value = '';
        barcodeStatus.style.display = 'none';
        accessoryStatus.style.display = 'none';
        accessoryResults.style.display = 'none';
        productCost = 0;

        // Focus on search input
        setTimeout(() => accessorySearch.focus(), 100);
    }

    updatePreview();
}

let barcodeTimeout = null;

function handleBarcodeInput(e) {
    // Convert to uppercase as user types
    const input = e.target;
    input.value = input.value.toUpperCase();
    
    // Clear any existing timeout
    if (barcodeTimeout) {
        clearTimeout(barcodeTimeout);
    }
    
    // Set a timeout to lookup after user stops typing
    barcodeTimeout = setTimeout(() => {
        if (input.value.trim()) {
            lookupProductByBarcode(input.value.trim());
        }
    }, 500);
}

function handleBarcodeBlur(e) {
    const barcode = e.target.value.trim();
    if (barcode) {
        lookupProductByBarcode(barcode);
    }
}

async function lookupProductByBarcode(barcode) {
    const statusDiv = document.getElementById('barcodeStatus');
    const selectedProductId = document.getElementById('selectedProductId');
    
    try {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = 'transparent';
        statusDiv.style.color = '#666';
        statusDiv.style.border = '1px solid #d1d5db';
        statusDiv.style.borderLeft = '4px solid #9ca3af';
        statusDiv.textContent = 'Looking up product...';
        
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products/lookup-barcode?barcode=${encodeURIComponent(barcode)}`);
        const data = await response.json();
        
        if (response.ok && data.product) {
            const product = data.product;
            
            // Check if product is available for sale
            if (product.sales_order_number || product.status === 'sold' || product.status === 'faulty') {
                statusDiv.style.backgroundColor = 'transparent';
                statusDiv.style.color = '#dc2626';
                statusDiv.style.border = '1px solid #ef4444';
                statusDiv.style.borderLeft = '4px solid #ef4444';
                statusDiv.innerHTML = `<strong>❌ Product Not Available</strong><br><span style="color: #666; font-size: 0.9rem;">This product has already been sold or is marked as faulty.</span>`;
                selectedProductId.value = '';
                productCost = 0;
            } else {
                const displayName = product.product_name || product.product_type || getDisplayName(product.part_type, product.generation);
                statusDiv.style.backgroundColor = 'transparent';
                statusDiv.style.color = '#059669';
                statusDiv.style.border = '1px solid #10b981';
                statusDiv.style.borderLeft = '4px solid #10b981';
                statusDiv.innerHTML = `
                    <strong>✅ Product Found:</strong> ${displayName}<br>
                    <span style="color: #666; font-size: 0.9rem;">Serial: ${product.serial_number || 'N/A'} | Cost: £${(product.purchase_price || 0).toFixed(2)}</span>
                `;
                selectedProductId.value = product._id;
                productCost = product.purchase_price || 0;
                updatePreview();
            }
        } else {
            statusDiv.style.backgroundColor = 'transparent';
            statusDiv.style.color = '#dc2626';
            statusDiv.style.border = '1px solid #ef4444';
            statusDiv.style.borderLeft = '4px solid #ef4444';
            statusDiv.innerHTML = '<strong>❌ Product Not Found</strong><br><span style="color: #666; font-size: 0.9rem;">No product with this serial number or security barcode exists.</span>';
            selectedProductId.value = '';
            productCost = 0;
            updatePreview();
        }
    } catch (error) {
        console.error('Error looking up barcode:', error);
        statusDiv.style.backgroundColor = 'transparent';
        statusDiv.style.color = '#dc2626';
        statusDiv.style.border = '1px solid #ef4444';
        statusDiv.style.borderLeft = '4px solid #ef4444';
        statusDiv.textContent = '❌ Error looking up product. Please try again.';
        selectedProductId.value = '';
        productCost = 0;
        updatePreview();
    }
}

let accessorySearchTimeout = null;

function handleAccessorySearch(e) {
    const searchInput = e.target;
    const query = searchInput.value.trim();

    // Clear any existing timeout
    if (accessorySearchTimeout) {
        clearTimeout(accessorySearchTimeout);
    }

    // If empty, show all accessories
    if (!query) {
        accessorySearchTimeout = setTimeout(() => {
            searchAccessories('');
        }, 300);
        return;
    }

    // Set a timeout to search after user stops typing
    accessorySearchTimeout = setTimeout(() => {
        searchAccessories(query);
    }, 300);
}

async function searchAccessories(query) {
    const resultsDiv = document.getElementById('accessorySearchResults');
    const statusDiv = document.getElementById('accessoryStatus');

    try {
        // Fetch all available accessories
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products?accessories=true`);
        const data = await response.json();

        if (!data.products || data.products.length === 0) {
            resultsDiv.style.display = 'none';
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = 'transparent';
            statusDiv.style.color = '#dc2626';
            statusDiv.style.border = '1px solid #ef4444';
            statusDiv.style.borderLeft = '4px solid #ef4444';
            statusDiv.textContent = 'No accessories available for sale';
            return;
        }

        let products = data.products;

        // Filter by search query if provided
        if (query) {
            const lowerQuery = query.toLowerCase();
            products = products.filter(product => {
                const name = (product.product_name || product.product_type || '').toLowerCase();
                const serial = (product.serial_number || '').toLowerCase();
                const generation = (product.generation || '').toLowerCase();
                const partType = (product.part_type || '').toLowerCase();

                return name.includes(lowerQuery) ||
                       serial.includes(lowerQuery) ||
                       generation.includes(lowerQuery) ||
                       partType.includes(lowerQuery);
            });
        }

        if (products.length === 0) {
            resultsDiv.style.display = 'none';
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = 'transparent';
            statusDiv.style.color = '#d97706';
            statusDiv.style.border = '1px solid #f59e0b';
            statusDiv.style.borderLeft = '4px solid #f59e0b';
            statusDiv.textContent = `No accessories found matching "${query}"`;
            return;
        }

        // Display results
        statusDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = products.map(product => {
            const displayName = product.product_name || product.product_type || getDisplayName(product.part_type, product.generation);
            const serial = product.serial_number || 'N/A';
            const cost = (product.purchase_price || 0).toFixed(2);

            return `
                <div class="accessory-result-item"
                     data-id="${product._id}"
                     data-name="${displayName}"
                     data-serial="${serial}"
                     data-cost="${product.purchase_price || 0}"
                     style="padding: 12px; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s;"
                     onmouseover="this.style.background='#f3f4f6'"
                     onmouseout="this.style.background='white'"
                     onclick="selectAccessory('${product._id}', '${displayName}', '${serial}', ${product.purchase_price || 0})">
                    <div style="font-weight: 600; color: #111;">${displayName}</div>
                    <div style="font-size: 0.875rem; color: #666; margin-top: 4px;">
                        Serial: ${serial} | Cost: £${cost}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error searching accessories:', error);
        resultsDiv.style.display = 'none';
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = 'transparent';
        statusDiv.style.color = '#dc2626';
        statusDiv.style.border = '1px solid #ef4444';
        statusDiv.style.borderLeft = '4px solid #ef4444';
        statusDiv.textContent = 'Error searching accessories. Please try again.';
    }
}

function selectAccessory(productId, name, serial, cost) {
    const selectedProductId = document.getElementById('selectedProductId');
    const searchInput = document.getElementById('accessorySearch');
    const resultsDiv = document.getElementById('accessorySearchResults');
    const statusDiv = document.getElementById('accessoryStatus');

    // Set the selected product
    selectedProductId.value = productId;
    productCost = cost || 0;

    // Update search input to show selection
    searchInput.value = name;

    // Hide results, show selection confirmation
    resultsDiv.style.display = 'none';
    statusDiv.style.display = 'block';
    statusDiv.style.backgroundColor = 'transparent';
    statusDiv.style.color = '#059669';
    statusDiv.style.border = '1px solid #10b981';
    statusDiv.style.borderLeft = '4px solid #10b981';
    statusDiv.innerHTML = `
        <strong>✅ Selected:</strong> ${name}<br>
        <span style="color: #666; font-size: 0.9rem;">Serial: ${serial} | Cost: £${cost.toFixed(2)}</span>
    `;

    updatePreview();
}

// Make selectAccessory available globally
window.selectAccessory = selectAccessory;

async function openAddSaleModal() {
    currentSaleId = null;
    selectedConsumables = [];
    productCost = 0;
    setSaleEditingState(false);
    
    document.getElementById('saleModalTitle').textContent = 'Add Sale';
    document.getElementById('saleForm').reset();
    setupDateDefault();
    
    // Reset selection method to barcode
    document.querySelector('input[name="selectionMethod"][value="barcode"]').checked = true;
    document.getElementById('barcodeInputGroup').style.display = 'block';
    document.getElementById('accessorySelectGroup').style.display = 'none';
    document.getElementById('barcodeStatus').style.display = 'none';
    document.getElementById('selectedProductId').value = '';
    
    // Clear consumables
    document.getElementById('consumablesList').innerHTML = '<p style="text-align: center; color: #999;">No consumables added yet</p>';
    document.getElementById('consumablesCost').textContent = '0.00';
    
    updatePreview();
    
    document.getElementById('saleModal').style.display = 'flex';
}

function setSaleEditingState(isEditing) {
    const selectionInputs = document.querySelectorAll('input[name="selectionMethod"]');
    selectionInputs.forEach(input => {
        input.disabled = isEditing;
    });

    const barcodeInput = document.getElementById('saleBarcode');
    if (barcodeInput) {
        barcodeInput.disabled = isEditing;
    }

    const accessorySelect = document.getElementById('accessorySelect');
    if (accessorySelect) {
        accessorySelect.disabled = isEditing;
    }
}

async function openEditSaleModal(id) {
    currentSaleId = id;
    selectedConsumables = [];
    productCost = 0;

    document.getElementById('saleModalTitle').textContent = 'Edit Sale';
    document.getElementById('saleForm').reset();
    setupDateDefault();
    setSaleEditingState(true);
    const barcodeRadio = document.querySelector('input[name="selectionMethod"][value="barcode"]');
    if (barcodeRadio) {
        barcodeRadio.checked = true;
    }

    const barcodeInputGroup = document.getElementById('barcodeInputGroup');
    const accessorySelectGroup = document.getElementById('accessorySelectGroup');
    if (barcodeInputGroup) barcodeInputGroup.style.display = 'block';
    if (accessorySelectGroup) accessorySelectGroup.style.display = 'none';

    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/sales/${id}`);
        const data = await response.json();

        if (!response.ok || !data.sale) {
            alert(data.error || 'Failed to load sale details');
            setSaleEditingState(false);
            return;
        }

        const sale = data.sale;
        document.getElementById('selectedProductId').value = sale.product_id;
        document.getElementById('saleOrderNumber').value = sale.order_number || '';
        document.getElementById('salePlatform').value = sale.platform || 'Other';
        document.getElementById('salePrice').value = sale.sale_price ?? '';
        document.getElementById('saleDate').value = sale.sale_date ? new Date(sale.sale_date).toISOString().split('T')[0] : '';
        document.getElementById('saleNotes').value = sale.notes || '';
        productCost = parseFloat(sale.product_cost) || 0;

        const barcodeStatus = document.getElementById('barcodeStatus');
        if (barcodeStatus) {
            barcodeStatus.style.display = 'block';
            barcodeStatus.textContent = `Product: ${sale.product_name || 'Unknown'} | Serial: ${sale.product_serial || 'N/A'}`;
        }

        const consumablesResponse = await authenticatedFetch(`${API_BASE}/api/admin/consumables`);
        const consumablesData = await consumablesResponse.json();
        const currentConsumables = consumablesData.consumables || [];
        const consumablesMap = new Map(currentConsumables.map(item => [normalizeConsumableId(item._id), item]));

        selectedConsumables = (sale.consumables || []).map(item => {
            const consumableId = normalizeConsumableId(item.consumable_id);
            const consumable = consumablesMap.get(consumableId);
            return {
                consumable_id: consumableId,
                name: consumable?.item_name || consumable?.name || item.name || 'Unknown',
                cost: consumable?.unit_cost ?? consumable?.price_per_unit ?? item.cost ?? 0,
                quantity: normalizeQuantity(item.quantity)
            };
        });

        displayConsumables();
        updatePreview();

        document.getElementById('saleModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading sale:', error);
        alert('Error loading sale details');
        setSaleEditingState(false);
    }
}

// Accessory search is now handled by handleAccessorySearch and searchAccessories functions above


function updatePreview() {
    const salePrice = parseFloat(document.getElementById('salePrice')?.value) || 0;
    const consumablesCost = selectedConsumables.reduce((sum, c) => sum + (c.cost * c.quantity), 0);
    const totalCost = productCost + consumablesCost;
    const profit = salePrice - totalCost;
    
    document.getElementById('previewSalePrice').textContent = salePrice.toFixed(2);
    document.getElementById('previewProductCost').textContent = productCost.toFixed(2);
    document.getElementById('previewConsumablesCost').textContent = consumablesCost.toFixed(2);
    
    const profitEl = document.getElementById('previewProfit');
    profitEl.textContent = `£${profit.toFixed(2)}`;
    profitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
}

function closeSaleModal() {
    document.getElementById('saleModal').style.display = 'none';
    setSaleEditingState(false);
}

async function handleSaleSubmit(e) {
    e.preventDefault();
    
    const productId = document.getElementById('selectedProductId').value;
    
    if (!productId) {
        alert('Please select or scan a product');
        return;
    }
    
    // Get product details based on selection method
    let productName = 'Unknown';
    let productSerial = 'N/A';
    const selectionMethod = document.querySelector('input[name="selectionMethod"]:checked').value;

    if (selectionMethod === 'accessory') {
        // For accessory, get from the status div that shows the selected product
        const statusDiv = document.getElementById('accessoryStatus');
        if (statusDiv && statusDiv.textContent.includes('Selected:')) {
            const nameMatch = statusDiv.textContent.match(/Selected:\s*([^\n]+)/);
            const serialMatch = statusDiv.textContent.match(/Serial:\s*([^\|]+)/);
            if (nameMatch) productName = nameMatch[1].trim();
            if (serialMatch) productSerial = serialMatch[1].trim();
        }
    } else {
        // For barcode, get from the barcode status display
        const statusDiv = document.getElementById('barcodeStatus');
        if (statusDiv && statusDiv.textContent.includes('Product Found')) {
            const serialMatch = statusDiv.textContent.match(/Serial:\s*([^\|]+)/);
            const typeMatch = statusDiv.textContent.match(/Found:\s*([^\n]+)/);
            if (serialMatch) productSerial = serialMatch[1].trim();
            if (typeMatch) productName = typeMatch[1].trim();
        }
    }
    
    const saleData = {
        product_id: productId,
        product_name: productName,
        product_serial: productSerial,
        product_cost: productCost,
        platform: document.getElementById('salePlatform').value,
        order_number: document.getElementById('saleOrderNumber').value.trim(),
        sale_price: parseFloat(document.getElementById('salePrice').value),
        sale_date: document.getElementById('saleDate').value,
        consumables: selectedConsumables,
        consumables_cost: selectedConsumables.reduce((sum, c) => sum + (c.cost * c.quantity), 0),
        total_cost: productCost + selectedConsumables.reduce((sum, c) => sum + (c.cost * c.quantity), 0),
        notes: document.getElementById('saleNotes').value.trim()
    };
    
    try {
        const url = currentSaleId 
            ? `${API_BASE}/api/admin/sales/${currentSaleId}`
            : `${API_BASE}/api/admin/sales`;
        const method = currentSaleId ? 'PUT' : 'POST';
        
        const response = await authenticatedFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleData)
        });
        
        if (response.ok) {
            closeSaleModal();
            loadSales();
            loadSummary();
            alert('Sale saved successfully!');
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to save sale'}`);
        }
    } catch (error) {
        console.error('Error saving sale:', error);
        alert('Error saving sale');
    }
}

// ===== CONSUMABLES =====

function openConsumablePicker({ consumables, title, confirmLabel, onConfirm }) {
    const modal = document.getElementById('consumablePickerModal');
    const list = document.getElementById('consumablePickerList');
    const titleEl = document.getElementById('consumablePickerTitle');
    const confirmBtn = document.getElementById('consumablePickerConfirm');

    if (!modal || !list || !titleEl || !confirmBtn) {
        alert('Consumable picker is unavailable. Please refresh and try again.');
        return;
    }

    titleEl.textContent = title || 'Select consumables';
    confirmBtn.textContent = confirmLabel || 'Add Selected';
    consumablePickerConfirmHandler = onConfirm;

    if (!consumables || consumables.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 16px 0;">No consumables available.</p>';
        modal.style.display = 'flex';
        return;
    }

    list.innerHTML = consumables.map((consumable, index) => {
        const name = consumable.item_name || consumable.name;
        const cost = consumable.unit_cost ?? consumable.price_per_unit ?? 0;
        const stock = consumable.quantity_in_stock ?? 0;
        const checkboxId = `consumable-check-${index}`;
        const quantityId = `consumable-qty-${index}`;

        return `
            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid #f3f4f6;">
                <input type="checkbox" id="${checkboxId}" data-id="${consumable._id}" data-name="${name}" data-cost="${cost}" data-stock="${stock}">
                <label for="${checkboxId}" style="flex: 1;">
                    <div style="font-weight: 600; color: #111;">${name}</div>
                    <div style="font-size: 12px; color: #6b7280;">£${Number(cost).toFixed(2)} each · ${stock} in stock</div>
                </label>
                <input type="number" id="${quantityId}" min="1" value="1" disabled
                    style="width: 80px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px;">
            </div>
        `;
    }).join('');

    list.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
            const target = event.currentTarget;
            const quantityInput = target.closest('div')?.querySelector('input[type="number"]');
            if (quantityInput) {
                quantityInput.disabled = !target.checked;
                if (target.checked && (!quantityInput.value || Number(quantityInput.value) < 1)) {
                    quantityInput.value = '1';
                }
            }
        });
    });

    modal.style.display = 'flex';
}

function closeConsumablePickerModal() {
    const modal = document.getElementById('consumablePickerModal');
    if (modal) {
        modal.style.display = 'none';
    }
    consumablePickerConfirmHandler = null;
}

function handleConsumablePickerConfirm() {
    if (!consumablePickerConfirmHandler) {
        closeConsumablePickerModal();
        return;
    }

    const selections = getConsumablePickerSelections();
    if (selections.length === 0) {
        alert('Select at least one consumable.');
        return;
    }

    consumablePickerConfirmHandler(selections);
    closeConsumablePickerModal();
}

function getConsumablePickerSelections() {
    const list = document.getElementById('consumablePickerList');
    if (!list) {
        return [];
    }

    return Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => {
        const row = checkbox.closest('div');
        const quantityInput = row?.querySelector('input[type="number"]');
        const quantity = Number(quantityInput?.value || 0);

        return {
            id: checkbox.dataset.id,
            name: checkbox.dataset.name,
            cost: Number(checkbox.dataset.cost || 0),
            stock: Number(checkbox.dataset.stock || 0),
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0
        };
    }).filter(item => item.quantity > 0);
}

async function addConsumableRow() {
    // Load available consumables
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/consumables`);
        const data = await response.json();
        
        if (!data.consumables || data.consumables.length === 0) {
            alert('No consumables available. Please add consumables first.');
            return;
        }
        
        openConsumablePicker({
            consumables: data.consumables,
            title: 'Select consumables',
            confirmLabel: 'Add Selected',
            onConfirm: (items) => {
                let hasUpdates = false;

                items.forEach((item) => {
                    if (item.quantity > item.stock) {
                        const proceed = confirm(`Warning: Only ${item.stock} in stock for ${item.name}. Add ${item.quantity} anyway?`);
                        if (!proceed) {
                            return;
                        }
                    }

                    const existing = selectedConsumables.find((entry) => entry.consumable_id === item.id);
                    if (existing) {
                        existing.quantity += item.quantity;
                    } else {
                        selectedConsumables.push({
                            consumable_id: item.id,
                            name: item.name,
                            cost: item.cost,
                            quantity: item.quantity
                        });
                    }

                    hasUpdates = true;
                });

                if (hasUpdates) {
                    displayConsumables();
                    updatePreview();
                }
            }
        });
    } catch (error) {
        console.error('Error loading consumables:', error);
        alert('Error loading consumables. Please try again.');
    }
}

function displayConsumables() {
    const container = document.getElementById('consumablesList');
    const costEl = document.getElementById('consumablesCost');
    
    if (selectedConsumables.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">No consumables added yet</p>';
        costEl.textContent = '0.00';
        return;
    }
    
    const totalCost = selectedConsumables.reduce((sum, c) => sum + (c.cost * c.quantity), 0);
    
    container.innerHTML = selectedConsumables.map((c, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
            <div>
                <strong>${c.name}</strong> × ${c.quantity}
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>£${(c.cost * c.quantity).toFixed(2)}</span>
                <button type="button" onclick="removeConsumable(${index})" style="color: #ef4444; cursor: pointer; background: none; border: none;">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
    
    costEl.textContent = totalCost.toFixed(2);
}

function removeConsumable(index) {
    selectedConsumables.splice(index, 1);
    displayConsumables();
    updatePreview();
}

// ===== TEMPLATES =====

async function loadTemplate() {
    try {
        // Load both templates and current consumables
        const [templatesResponse, consumablesResponse] = await Promise.all([
            authenticatedFetch(`${API_BASE}/api/admin/consumable-templates`),
            authenticatedFetch(`${API_BASE}/api/admin/consumables`)
        ]);
        
        const templatesData = await templatesResponse.json();
        const consumablesData = await consumablesResponse.json();
        
        if (!templatesData.templates || templatesData.templates.length === 0) {
            alert('No templates available. Create one first!');
            return;
        }
        
        const currentConsumables = consumablesData.consumables || [];
        
        // Show template selection
        const templateNames = templatesData.templates.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
        const selection = prompt(`Select a template:\n${templateNames}\n\nEnter number:`);
        
        if (selection) {
            const index = parseInt(selection) - 1;
            const template = templatesData.templates[index];
            
            if (template) {
                // Map template consumables to current consumables data
                selectedConsumables = [];
                
                for (const templateItem of template.consumables) {
                    // Find current consumable by ID
                    const currentConsumable = currentConsumables.find(c =>
                        c._id === templateItem.consumable_id
                    );

                    if (currentConsumable) {
                        // Use current data from inventory
                        selectedConsumables.push({
                            consumable_id: currentConsumable._id,
                            name: currentConsumable.item_name || currentConsumable.name,
                            cost: currentConsumable.unit_cost || currentConsumable.price_per_unit || 0,
                            quantity: templateItem.quantity
                        });
                    } else {
                        // Consumable no longer exists - show warning but include with stored data
                        const templateName = templateItem.name || templateItem.item_name;
                        console.warn(`Consumable ${templateName} (ID: ${templateItem.consumable_id}) no longer exists`);
                        alert(`Warning: Consumable "${templateName}" no longer exists in inventory. It will be skipped.`);
                    }
                }
                
                if (selectedConsumables.length === 0) {
                    alert('None of the consumables in this template exist anymore. Please update the template.');
                    return;
                }
                
                displayConsumables();
                updatePreview();
            }
        }
    } catch (error) {
        console.error('Error loading templates:', error);
        alert('Error loading template. Please try again.');
    }
}

async function openTemplatesModal() {
    await loadTemplates();
    document.getElementById('templatesModal').style.display = 'flex';
}

function closeTemplatesModal() {
    document.getElementById('templatesModal').style.display = 'none';
}

async function loadTemplates() {
    try {
        // Load both templates and current consumables to show accurate data
        const [templatesResponse, consumablesResponse] = await Promise.all([
            authenticatedFetch(`${API_BASE}/api/admin/consumable-templates`),
            authenticatedFetch(`${API_BASE}/api/admin/consumables`)
        ]);
        
        const templatesData = await templatesResponse.json();
        const consumablesData = await consumablesResponse.json();
        
        const container = document.getElementById('templatesContainer');
        
        if (!templatesData.templates || templatesData.templates.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999;">No templates found</p>';
            return;
        }
        
        const currentConsumables = consumablesData.consumables || [];
        
        container.innerHTML = templatesData.templates.map(template => {
            const targetLabelMap = {
                airpod: 'Left/Right AirPod',
                case: 'Case',
                any: 'Any product'
            };
            const templateTarget = template.target_type || 'any';
            const targetLabel = targetLabelMap[templateTarget] || 'Any product';
            // Calculate current costs based on live consumable data
            let totalCost = 0;
            let hasInvalidItems = false;
            
            const consumablesList = template.consumables.map(c => {
                const currentConsumable = currentConsumables.find(curr => curr._id === c.consumable_id);

                if (currentConsumable) {
                    const currentCost = (currentConsumable.unit_cost || currentConsumable.price_per_unit || 0) * c.quantity;
                    totalCost += currentCost;
                    const consumableName = currentConsumable.item_name || currentConsumable.name;
                    return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                            <span>${consumableName} × ${c.quantity}</span>
                            <span>£${currentCost.toFixed(2)}</span>
                        </div>
                    `;
                } else {
                    hasInvalidItems = true;
                    const templateName = c.name || c.item_name;
                    return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #ef4444;">
                            <span>${templateName} × ${c.quantity} <em>(not found)</em></span>
                            <span>-</span>
                        </div>
                    `;
                }
            }).join('');
            
            return `
                <div class="card" style="margin-bottom: 15px; padding: 15px; ${hasInvalidItems ? 'border: 2px solid #ef4444;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <h3 style="margin: 0 0 5px 0;">${template.name}</h3>
                            <p style="margin: 0; color: #666; font-size: 0.9rem;">${template.description || 'No description'}</p>
                            <p style="margin: 6px 0 0 0; color: #4b5563; font-size: 0.85rem;">
                                Applies to: <strong>${targetLabel}</strong>
                            </p>
                            ${hasInvalidItems ? '<p style="margin: 5px 0 0 0; color: #ef4444; font-size: 0.85rem;">⚠️ Some consumables no longer exist</p>' : ''}
                        </div>
                        <button onclick="deleteTemplate('${template._id}')" class="button button-secondary button-sm">Delete</button>
                    </div>
                    <div style="background: #f9fafb; padding: 10px; border-radius: 4px;">
                        ${consumablesList}
                        <div style="border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px;">
                            <strong>Total: £${totalCost.toFixed(2)}</strong>
                            <small style="color: #666; display: block; margin-top: 4px; font-size: 0.85rem;">
                                (Based on current consumable prices)
                            </small>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading templates:', error);
        document.getElementById('templatesContainer').innerHTML = 
            '<p style="text-align: center; color: #ef4444;">Error loading templates</p>';
    }
}

async function openCreateTemplateModal() {
    templateConsumables = [];
    
    // Load all consumables
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/consumables`);
        const data = await response.json();
        allConsumables = data.consumables || [];
    } catch (error) {
        console.error('Error loading consumables:', error);
        allConsumables = [];
    }
    
    document.getElementById('createTemplateForm').reset();
    document.getElementById('templateConsumablesList').innerHTML = '<p style="text-align: center; color: #999;">No consumables added yet</p>';
    document.getElementById('createTemplateModal').style.display = 'flex';
}

function closeCreateTemplateModal() {
    document.getElementById('createTemplateModal').style.display = 'none';
}

async function addTemplateConsumable() {
    if (allConsumables.length === 0) {
        alert('No consumables available. Please add consumables first.');
        return;
    }

    openConsumablePicker({
        consumables: allConsumables,
        title: 'Select consumables for template',
        confirmLabel: 'Add to Template',
        onConfirm: (items) => {
            let hasUpdates = false;

            items.forEach((item) => {
                const existing = templateConsumables.find((entry) => entry.consumable_id === item.id);
                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    templateConsumables.push({
                        consumable_id: item.id,
                        name: item.name,
                        cost: item.cost,
                        quantity: item.quantity
                    });
                }
                hasUpdates = true;
            });

            if (hasUpdates) {
                displayTemplateConsumables();
            }
        }
    });
}

function displayTemplateConsumables() {
    const container = document.getElementById('templateConsumablesList');
    
    if (templateConsumables.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">No consumables added yet</p>';
        return;
    }
    
    container.innerHTML = templateConsumables.map((c, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
            <div>
                <strong>${c.name}</strong> × ${c.quantity}
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>£${(c.cost * c.quantity).toFixed(2)}</span>
                <button type="button" onclick="removeTemplateConsumable(${index})" style="color: #ef4444; cursor: pointer; background: none; border: none; font-size: 18px;">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

function removeTemplateConsumable(index) {
    templateConsumables.splice(index, 1);
    displayTemplateConsumables();
}

async function handleTemplateSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('templateName').value.trim();
    const description = document.getElementById('templateDescription').value.trim();
    const targetType = document.getElementById('templateTarget').value;
    
    if (!name) {
        alert('Please enter a template name');
        return;
    }
    
    if (!targetType) {
        alert('Please select a product type for this template');
        return;
    }

    if (templateConsumables.length === 0) {
        alert('Please add at least one consumable');
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/consumable-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                description: description,
                target_type: targetType,
                consumables: templateConsumables
            })
        });
        
        if (response.ok) {
            closeCreateTemplateModal();
            loadTemplates(); // Refresh templates list
            alert('Template created successfully!');
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to create template'}`);
        }
    } catch (error) {
        console.error('Error creating template:', error);
        alert('Error creating template');
    }
}

async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/consumable-templates/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTemplates();
        }
    } catch (error) {
        console.error('Error deleting template:', error);
    }
}

// ===== VIEW/DELETE SALE =====

async function viewSale(id) {
    openEditSaleModal(id);
}

async function deleteSale(id) {
    if (!confirm('Delete this sale? This will mark the product as unsold again.')) return;
    
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/sales/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadSales();
            loadSummary();
        } else {
            alert('Failed to delete sale');
        }
    } catch (error) {
        console.error('Error deleting sale:', error);
        alert('Error deleting sale');
    }
}

// ===== UTILITY =====

function showError(message) {
    console.error(message);
    // Could show a toast notification here
}

// Make functions available globally for onclick handlers
window.viewSale = viewSale;
window.deleteSale = deleteSale;
window.removeConsumable = removeConsumable;
window.closeSaleModal = closeSaleModal;
window.closeTemplatesModal = closeTemplatesModal;
window.deleteTemplate = deleteTemplate;
window.closeCreateTemplateModal = closeCreateTemplateModal;
window.removeTemplateConsumable = removeTemplateConsumable;
window.closeConsumablePickerModal = closeConsumablePickerModal;

})(); // End of IIFE
