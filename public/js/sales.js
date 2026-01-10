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
let selectedProducts = []; // Array to hold multiple products for a sale
let currentStep = 1; // Wizard step tracker
let pendingProduct = null; // Product found but not yet added

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

    // Fee Inputs - update preview when changed (using event delegation on form as backup)
    const saleForm = document.getElementById('saleForm');
    if (saleForm) {
        saleForm.addEventListener('input', (e) => {
            if (['transactionFees', 'adFeeGeneral', 'postageLabelCost', 'salePrice'].includes(e.target.id)) {
                updatePreview();
            }
        });
        saleForm.addEventListener('change', (e) => {
            if (['transactionFees', 'adFeeGeneral', 'postageLabelCost', 'salePrice'].includes(e.target.id)) {
                updatePreview();
            }
        });
    }
    
    // Add Consumable Button
    document.getElementById('addConsumableBtn')?.addEventListener('click', addConsumableRow);
    
    // Load Template Button
    document.getElementById('loadTemplateBtn')?.addEventListener('click', loadTemplate);
    
    // Search and Filter
    document.getElementById('filterSearch')?.addEventListener('input', filterSales);
    document.getElementById('headerSearch')?.addEventListener('input', filterSales);
    document.getElementById('filterSort')?.addEventListener('change', filterSales);
    document.getElementById('filterPeriod')?.addEventListener('change', handlePeriodChange);
    document.getElementById('filterDateFrom')?.addEventListener('change', filterSales);
    document.getElementById('filterDateTo')?.addEventListener('change', filterSales);
    document.getElementById('filterPlatform')?.addEventListener('change', filterSales);
    document.getElementById('filterProductType')?.addEventListener('change', filterSales);
    document.getElementById('filterProfit')?.addEventListener('change', filterSales);
    document.getElementById('clearFilters')?.addEventListener('click', clearAllFilters);
    
    // Add Template Button in templates modal
    document.getElementById('addTemplateBtn')?.addEventListener('click', openCreateTemplateModal);
    
    // Template Creation Modal
    document.getElementById('createTemplateForm')?.addEventListener('submit', handleTemplateSubmit);
    document.getElementById('addTemplateConsumableBtn')?.addEventListener('click', addTemplateConsumable);

    // Consumable Picker Modal
    document.getElementById('consumablePickerCancel')?.addEventListener('click', closeConsumablePickerModal);
    document.getElementById('consumablePickerConfirm')?.addEventListener('click', handleConsumablePickerConfirm);

    // Add Another Product Button (for multi-product sales)
    document.getElementById('addAnotherProductBtn')?.addEventListener('click', handleAddAnotherProduct);
}

// ===== WIZARD NAVIGATION =====

function goToStep(step) {
    const step1 = document.getElementById('saleStep1');
    const step2 = document.getElementById('saleStep2');
    const step1Indicator = document.getElementById('step1Indicator');
    const step2Indicator = document.getElementById('step2Indicator');
    const nextBtn = document.getElementById('nextStepBtn');
    const prevBtn = document.getElementById('prevStepBtn');
    const submitBtn = document.getElementById('submitSaleBtn');

    if (step === 2) {
        // Validate step 1 - must have at least one product
        if (selectedProducts.length === 0) {
            alert('Please add at least one product before continuing.');
            return;
        }

        // Update step 2 product summary and P&L preview
        updateStep2Summary();
        updatePreview();

        // Show step 2
        step1.style.display = 'none';
        step2.style.display = 'block';

        // Update indicators
        step1Indicator.style.opacity = '0.5';
        step1Indicator.querySelector('div').style.background = '#10b981';
        step2Indicator.style.opacity = '1';
        step2Indicator.querySelector('div').style.background = '#3b82f6';
        step2Indicator.querySelector('div').style.color = 'white';
        step2Indicator.querySelector('span').style.fontWeight = '600';
        step2Indicator.querySelector('span').style.color = '#111';

        // Update buttons
        nextBtn.style.display = 'none';
        prevBtn.style.display = 'inline-flex';
        submitBtn.style.display = 'inline-flex';

        currentStep = 2;
    } else {
        // Show step 1
        step1.style.display = 'block';
        step2.style.display = 'none';

        // Update indicators
        step1Indicator.style.opacity = '1';
        step1Indicator.querySelector('div').style.background = '#3b82f6';
        step2Indicator.style.opacity = '0.5';
        step2Indicator.querySelector('div').style.background = '#dee2e6';
        step2Indicator.querySelector('div').style.color = '#6b7280';
        step2Indicator.querySelector('span').style.fontWeight = '500';
        step2Indicator.querySelector('span').style.color = '#6b7280';

        // Update buttons
        nextBtn.style.display = 'inline-flex';
        prevBtn.style.display = 'none';
        submitBtn.style.display = 'none';

        currentStep = 1;
    }
}

function updateStep2Summary() {
    const countEl = document.getElementById('step2ProductCount');
    const costEl = document.getElementById('step2ProductCost');
    const listEl = document.getElementById('step2ProductList');

    const count = selectedProducts.length;
    const totalCost = selectedProducts.reduce((sum, p) => sum + (p.product_cost || 0), 0);

    countEl.textContent = `${count} product${count !== 1 ? 's' : ''}`;
    costEl.textContent = totalCost.toFixed(2);

    // Show abbreviated product list
    const productNames = selectedProducts.map(p => p.product_name).join(', ');
    listEl.textContent = productNames.length > 100 ? productNames.substring(0, 100) + '...' : productNames;
}

// Make goToStep available globally
window.goToStep = goToStep;

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

let allSalesData = [];

function displaySales(sales) {
    const tbody = document.getElementById('salesTableBody');
    allSalesData = sales || [];

    // Apply filters
    const filtered = applyFilters(allSalesData);

    // Update count
    const countEl = document.getElementById('salesCount');
    if (countEl) {
        countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'sale' : 'sales'}`;
    }

    if (!filtered || filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="table-loading">No sales found matching filters</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(sale => {
        const saleDate = new Date(sale.sale_date).toLocaleDateString();
        const amountPaid = typeof sale.order_total === 'number'
            ? sale.order_total
            : (typeof sale.sale_price === 'number' ? sale.sale_price : 0);
        const purchasePrice = typeof sale.product_cost === 'number' ? sale.product_cost : 0;
        const transactionFees = typeof sale.transaction_fees === 'number' ? sale.transaction_fees : 0;
        const adFeeGeneral = typeof sale.ad_fee_general === 'number' ? sale.ad_fee_general : 0;
        const feesTotal = transactionFees + adFeeGeneral;
        const postageCost = typeof sale.postage_label_cost === 'number' ? sale.postage_label_cost : 0;
        const consumablesCost = typeof sale.consumables_cost === 'number' ? sale.consumables_cost : 0;
        const totalCost = typeof sale.total_cost === 'number'
            ? sale.total_cost
            : (purchasePrice + feesTotal + postageCost + consumablesCost);
        const profitValue = typeof sale.profit === 'number'
            ? sale.profit
            : (amountPaid - totalCost);
        const profit = profitValue.toFixed(2);
        const profitColor = profitValue >= 0 ? '#10b981' : '#ef4444';

        // Sales order number as clickable link to edit sale
        const salesOrderLink = sale.order_number
            ? `<a href="#" onclick="editSale('${sale._id}'); return false;" style="color: #0ea5e9; text-decoration: none; font-weight: 500;">${sale.order_number}</a>`
            : 'N/A';

        // Purchase order number as clickable link to purchases page
        const purchaseOrderLink = sale.purchase_order_number
            ? `<a href="purchases.html?order=${encodeURIComponent(sale.purchase_order_number)}" style="color: #0ea5e9; text-decoration: none; font-weight: 500;">${sale.purchase_order_number}</a>`
            : '<span style="color: #999;">N/A</span>';

        // Build product display - show multiple products if available
        let productDisplay = '';
        if (sale.products && Array.isArray(sale.products) && sale.products.length > 1) {
            // Multiple products - show each on its own line
            productDisplay = sale.products.map((p, idx) => `
                <div style="${idx > 0 ? 'margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e5e7eb;' : ''}">
                    <div style="font-weight: 600; font-size: 0.9rem;">${p.product_name || 'Unknown'}</div>
                    <div style="font-size: 0.8rem; color: #666;">${p.product_serial || 'N/A'}</div>
                </div>
            `).join('');
        } else {
            // Single product
            productDisplay = `
                <div style="font-weight: 600;">${sale.product_name || 'Unknown Product'}</div>
                <div style="font-size: 0.85rem; color: #666;">${sale.product_serial || 'N/A'}</div>
            `;
        }

        return `
            <tr>
                <td>${saleDate}</td>
                <td>${productDisplay}</td>
                <td>${sale.platform || 'N/A'}</td>
                <td>
                    <div>${salesOrderLink}</div>
                    ${sale.outward_tracking_number ? `<div style="font-size: 0.85rem; color: #666;">Tracking: ${sale.outward_tracking_number}</div>` : ''}
                </td>
                <td>${purchaseOrderLink}</td>
                <td style="font-weight: 600;">£${amountPaid.toFixed(2)}</td>
                <td>£${purchasePrice.toFixed(2)}</td>
                <td>
                    £${feesTotal.toFixed(2)}
                    ${(transactionFees || adFeeGeneral)
                        ? `<div style="font-size: 0.8rem; color: #666;">(${transactionFees.toFixed(2)} fees + ${adFeeGeneral.toFixed(2)} ad)</div>`
                        : ''}
                </td>
                <td>£${postageCost.toFixed(2)}</td>
                <td>£${consumablesCost.toFixed(2)}</td>
                <td style="font-weight: 700; color: ${profitColor};">£${profit}</td>
                <td>
                    <button class="button-icon" onclick="viewSale('${sale._id}')" title="View Sale">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z" stroke="currentColor" stroke-width="1.5"/>
                            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                    </button>
                    <button class="button-icon" onclick="editSale('${sale._id}')" title="Edit Sale">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 1.5l3 3L6 13H3v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M10 3l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="button-icon" onclick="deleteSale('${sale._id}')" title="Delete Sale">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4h12M5 4V3h6v1M5 7v6M8 7v6M11 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function applyFilters(sales) {
    let filtered = [...sales];

    // Search filter (both sidebar and header)
    const sidebarSearch = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();
    const headerSearch = (document.getElementById('headerSearch')?.value || '').toLowerCase().trim();
    const searchTerm = sidebarSearch || headerSearch;

    if (searchTerm) {
        filtered = filtered.filter(sale => {
            const orderNumber = (sale.order_number || '').toLowerCase();
            const productName = (sale.product_name || '').toLowerCase();
            const productSerial = (sale.product_serial || '').toLowerCase();
            return orderNumber.includes(searchTerm) ||
                   productName.includes(searchTerm) ||
                   productSerial.includes(searchTerm);
        });
    }

    // Platform filter
    const platform = document.getElementById('filterPlatform')?.value || '';
    if (platform) {
        filtered = filtered.filter(sale => sale.platform === platform);
    }

    // Product type filter
    const productType = document.getElementById('filterProductType')?.value || '';
    if (productType) {
        filtered = filtered.filter(sale => {
            const productName = sale.product_name || '';
            return productName.includes(productType);
        });
    }

    // Profit range filter
    const profitFilter = document.getElementById('filterProfit')?.value || '';
    if (profitFilter) {
        filtered = filtered.filter(sale => {
            const profit = typeof sale.profit === 'number' ? sale.profit : 0;
            switch (profitFilter) {
                case 'positive':
                    return profit > 0;
                case 'negative':
                    return profit < 0;
                case 'high':
                    return profit > 20;
                case 'medium':
                    return profit >= 10 && profit <= 20;
                case 'low':
                    return profit < 10;
                default:
                    return true;
            }
        });
    }

    // Date range filter
    const period = document.getElementById('filterPeriod')?.value || 'all';
    if (period !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        filtered = filtered.filter(sale => {
            const saleDate = new Date(sale.sale_date);
            switch (period) {
                case 'today':
                    return saleDate >= today;
                case 'week': {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(today.getDate() - 7);
                    return saleDate >= weekAgo;
                }
                case 'month': {
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(today.getMonth() - 1);
                    return saleDate >= monthAgo;
                }
                case 'year': {
                    const yearAgo = new Date(today);
                    yearAgo.setFullYear(today.getFullYear() - 1);
                    return saleDate >= yearAgo;
                }
                case 'custom': {
                    const dateFrom = document.getElementById('filterDateFrom')?.value;
                    const dateTo = document.getElementById('filterDateTo')?.value;
                    if (dateFrom && dateTo) {
                        return saleDate >= new Date(dateFrom) && saleDate <= new Date(dateTo);
                    }
                    return true;
                }
                default:
                    return true;
            }
        });
    }

    // Sort
    const sortBy = document.getElementById('filterSort')?.value || 'date_desc';
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'date_desc':
                return new Date(b.sale_date) - new Date(a.sale_date);
            case 'date_asc':
                return new Date(a.sale_date) - new Date(b.sale_date);
            case 'profit_desc': {
                const profitA = typeof a.profit === 'number' ? a.profit : 0;
                const profitB = typeof b.profit === 'number' ? b.profit : 0;
                return profitB - profitA;
            }
            case 'profit_asc': {
                const profitA = typeof a.profit === 'number' ? a.profit : 0;
                const profitB = typeof b.profit === 'number' ? b.profit : 0;
                return profitA - profitB;
            }
            case 'amount_desc': {
                const amountA = typeof a.order_total === 'number' ? a.order_total : (typeof a.sale_price === 'number' ? a.sale_price : 0);
                const amountB = typeof b.order_total === 'number' ? b.order_total : (typeof b.sale_price === 'number' ? b.sale_price : 0);
                return amountB - amountA;
            }
            case 'amount_asc': {
                const amountA = typeof a.order_total === 'number' ? a.order_total : (typeof a.sale_price === 'number' ? a.sale_price : 0);
                const amountB = typeof b.order_total === 'number' ? b.order_total : (typeof b.sale_price === 'number' ? b.sale_price : 0);
                return amountA - amountB;
            }
            default:
                return 0;
        }
    });

    return filtered;
}

function filterSales() {
    // Re-render with current data and filters
    displaySales(allSalesData);
}

function handlePeriodChange() {
    const period = document.getElementById('filterPeriod')?.value || 'all';
    const customDateRange = document.getElementById('customDateRange');

    if (customDateRange) {
        if (period === 'custom') {
            customDateRange.style.display = 'block';
        } else {
            customDateRange.style.display = 'none';
        }
    }

    filterSales();
}

function clearAllFilters() {
    // Clear all filter inputs
    const filterSearch = document.getElementById('filterSearch');
    const headerSearch = document.getElementById('headerSearch');
    const filterSort = document.getElementById('filterSort');
    const filterPeriod = document.getElementById('filterPeriod');
    const filterPlatform = document.getElementById('filterPlatform');
    const filterProductType = document.getElementById('filterProductType');
    const filterProfit = document.getElementById('filterProfit');
    const customDateRange = document.getElementById('customDateRange');

    if (filterSearch) filterSearch.value = '';
    if (headerSearch) headerSearch.value = '';
    if (filterSort) filterSort.value = 'date_desc';
    if (filterPeriod) filterPeriod.value = 'all';
    if (filterPlatform) filterPlatform.value = '';
    if (filterProductType) filterProductType.value = '';
    if (filterProfit) filterProfit.value = '';
    if (customDateRange) customDateRange.style.display = 'none';

    // Re-apply filters
    filterSales();
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
    const resultDiv = document.getElementById('productSearchResult');
    const cardDiv = document.getElementById('productResultCard');
    const selectedProductId = document.getElementById('selectedProductId');
    const barcodeInput = document.getElementById('securityBarcode');

    // Hide previous result card
    if (resultDiv) resultDiv.style.display = 'none';
    pendingProduct = null;

    try {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#f3f4f6';
        statusDiv.style.color = '#666';
        statusDiv.style.border = '1px solid #d1d5db';
        statusDiv.style.borderLeft = '4px solid #9ca3af';
        statusDiv.textContent = 'Searching...';

        const response = await authenticatedFetch(`${API_BASE}/api/admin/products/lookup-barcode?barcode=${encodeURIComponent(barcode)}`);
        const data = await response.json();

        if (response.ok && data.product) {
            const product = data.product;
            statusDiv.style.display = 'none';

            // Check if product is available for sale
            if (product.sales_order_number || product.status === 'sold' || product.status === 'faulty') {
                statusDiv.style.display = 'block';
                statusDiv.style.backgroundColor = '#fef2f2';
                statusDiv.style.color = '#dc2626';
                statusDiv.style.border = '1px solid #fecaca';
                statusDiv.style.borderLeft = '4px solid #ef4444';
                statusDiv.innerHTML = `<strong>❌ Not Available</strong> - This product has already been sold or is marked as faulty.`;
                selectedProductId.value = '';
                return;
            }

            // Check if product is already in selectedProducts
            const alreadySelected = selectedProducts.find(p => p.product_id === product._id);
            if (alreadySelected) {
                statusDiv.style.display = 'block';
                statusDiv.style.backgroundColor = '#fffbeb';
                statusDiv.style.color = '#d97706';
                statusDiv.style.border = '1px solid #fde68a';
                statusDiv.style.borderLeft = '4px solid #f59e0b';
                statusDiv.innerHTML = `<strong>⚠️ Already Added</strong> - This product is already in your sale.`;
                barcodeInput.value = '';
                return;
            }

            const displayName = product.product_name || product.product_type || getDisplayName(product.part_type, product.generation);
            const cost = product.purchase_price || 0;
            const serial = product.serial_number || 'N/A';
            const condition = product.visual_condition || 'Unknown';
            const partType = product.part_type || 'Unknown';

            // Store pending product for add button
            pendingProduct = {
                product_id: product._id,
                product_name: displayName,
                product_serial: serial,
                product_cost: cost
            };

            // Show product card with Add button
            cardDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-size: 16px; font-weight: 700; color: #065f46; margin-bottom: 6px;">${displayName}</div>
                        <div style="display: grid; grid-template-columns: auto auto; gap: 4px 16px; font-size: 13px; color: #374151;">
                            <span style="color: #6b7280;">Serial:</span>
                            <span style="font-weight: 500;">${serial}</span>
                            <span style="color: #6b7280;">Type:</span>
                            <span style="font-weight: 500; text-transform: capitalize;">${partType}</span>
                            <span style="color: #6b7280;">Condition:</span>
                            <span style="font-weight: 500; text-transform: capitalize;">${condition}</span>
                            <span style="color: #6b7280;">Cost:</span>
                            <span style="font-weight: 600; color: #059669;">£${cost.toFixed(2)}</span>
                        </div>
                    </div>
                    <button type="button" onclick="addPendingProduct()" style="background: #059669; color: white; border: none; border-radius: 8px; padding: 12px 20px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;" onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                            <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        </svg>
                        Add
                    </button>
                </div>
            `;
            resultDiv.style.display = 'block';

            // Clear the search input for the next search
            barcodeInput.value = '';
            barcodeInput.focus();

        } else {
            statusDiv.style.display = 'block';
            statusDiv.style.backgroundColor = '#fef2f2';
            statusDiv.style.color = '#dc2626';
            statusDiv.style.border = '1px solid #fecaca';
            statusDiv.style.borderLeft = '4px solid #ef4444';
            statusDiv.innerHTML = '<strong>❌ Not Found</strong> - No product with this serial number or security barcode.';
            selectedProductId.value = '';
        }
    } catch (error) {
        console.error('Error looking up barcode:', error);
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = '#fef2f2';
        statusDiv.style.color = '#dc2626';
        statusDiv.style.border = '1px solid #fecaca';
        statusDiv.style.borderLeft = '4px solid #ef4444';
        statusDiv.textContent = '❌ Error looking up product. Please try again.';
        selectedProductId.value = '';
    }
}

// Add the pending product to selected products
function addPendingProduct() {
    if (!pendingProduct) return;

    // Add to selected products array
    selectedProducts.push({...pendingProduct});

    // Hide the result card
    const resultDiv = document.getElementById('productSearchResult');
    if (resultDiv) resultDiv.style.display = 'none';

    // Clear pending product
    pendingProduct = null;

    // Update display
    displaySelectedProducts();
    updatePreview();

    // Focus back on search input
    const barcodeInput = document.getElementById('securityBarcode');
    if (barcodeInput) barcodeInput.focus();
}

// Make addPendingProduct available globally
window.addPendingProduct = addPendingProduct;

// Display the list of selected products
function displaySelectedProducts() {
    const container = document.getElementById('selectedProductsList');
    const countEl = document.getElementById('selectedProductsCount');
    const costEl = document.getElementById('totalProductsCost');

    if (selectedProducts.length === 0) {
        if (container) container.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: #9ca3af;">
                <svg style="margin-bottom: 8px; color: #d1d5db;" width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p style="margin: 0;">No products added yet. Search above to add products.</p>
            </div>
        `;
        if (countEl) countEl.textContent = '(0)';
        if (costEl) costEl.textContent = '0.00';
        productCost = 0;
        return;
    }

    if (countEl) countEl.textContent = `(${selectedProducts.length})`;

    // Calculate total cost
    const totalCost = selectedProducts.reduce((sum, p) => sum + (p.product_cost || 0), 0);
    productCost = totalCost;
    if (costEl) costEl.textContent = totalCost.toFixed(2);

    // Render the list as product cards
    container.innerHTML = selectedProducts.map((p, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #f3f4f6; ${index === selectedProducts.length - 1 ? 'border-bottom: none;' : ''} background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #111; font-size: 14px;">${p.product_name}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                    <span>Serial: ${p.product_serial}</span>
                    <span style="margin-left: 12px; color: #059669; font-weight: 500;">£${(p.product_cost || 0).toFixed(2)}</span>
                </div>
            </div>
            <button type="button" onclick="removeSelectedProduct(${index})" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 4px;" title="Remove product">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Remove
            </button>
        </div>
    `).join('');
}

// Remove a product from the selected list
function removeSelectedProduct(index) {
    if (index >= 0 && index < selectedProducts.length) {
        selectedProducts.splice(index, 1);
        displaySelectedProducts();
        updatePreview();
    }
}

// Make removeSelectedProduct available globally
window.removeSelectedProduct = removeSelectedProduct;

// Handle "Add Another Product" button click
function handleAddAnotherProduct() {
    const barcodeInput = document.getElementById('securityBarcode');
    const accessorySearch = document.getElementById('accessorySearch');
    const selectionMethod = document.querySelector('input[name="selectionMethod"]:checked')?.value;

    if (selectionMethod === 'barcode' && barcodeInput) {
        barcodeInput.focus();
        barcodeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (accessorySearch) {
        accessorySearch.focus();
        accessorySearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const searchInput = document.getElementById('accessorySearch');
    const resultsDiv = document.getElementById('accessorySearchResults');
    const statusDiv = document.getElementById('accessoryStatus');

    // Check if product is already in selectedProducts
    const alreadySelected = selectedProducts.find(p => p.product_id === productId);
    if (alreadySelected) {
        statusDiv.style.display = 'block';
        statusDiv.style.backgroundColor = 'transparent';
        statusDiv.style.color = '#f59e0b';
        statusDiv.style.border = '1px solid #f59e0b';
        statusDiv.style.borderLeft = '4px solid #f59e0b';
        statusDiv.innerHTML = `<strong>⚠️ Already Selected</strong><br><span style="color: #666; font-size: 0.9rem;">This product is already in your sale.</span>`;
        return;
    }

    // Add product to selectedProducts array
    selectedProducts.push({
        product_id: productId,
        product_name: name,
        product_serial: serial || 'N/A',
        product_cost: cost || 0
    });

    // Clear search input for next product
    searchInput.value = '';

    // Hide results, show selection confirmation
    resultsDiv.style.display = 'none';
    statusDiv.style.display = 'block';
    statusDiv.style.backgroundColor = 'transparent';
    statusDiv.style.color = '#059669';
    statusDiv.style.border = '1px solid #10b981';
    statusDiv.style.borderLeft = '4px solid #10b981';
    statusDiv.innerHTML = `<strong>✅ Product Added:</strong> ${name}`;

    // Update the selected products display
    displaySelectedProducts();
    updatePreview();

    // Hide status after a short delay
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 2000);
}

// Make selectAccessory available globally
window.selectAccessory = selectAccessory;

async function openAddSaleModal() {
    currentSaleId = null;
    selectedConsumables = [];
    selectedProducts = []; // Reset selected products array
    productCost = 0;
    pendingProduct = null;
    currentStep = 1;
    setSaleEditingState(false);

    document.getElementById('saleModalTitle').textContent = 'Add Sale';
    document.getElementById('saleForm').reset();
    setupDateDefault();

    // Reset to step 1
    document.getElementById('saleStep1').style.display = 'block';
    document.getElementById('saleStep2').style.display = 'none';

    // Reset step indicators
    const step1Indicator = document.getElementById('step1Indicator');
    const step2Indicator = document.getElementById('step2Indicator');
    if (step1Indicator) {
        step1Indicator.style.opacity = '1';
        step1Indicator.querySelector('div').style.background = '#3b82f6';
    }
    if (step2Indicator) {
        step2Indicator.style.opacity = '0.5';
        step2Indicator.querySelector('div').style.background = '#dee2e6';
        step2Indicator.querySelector('div').style.color = '#6b7280';
        step2Indicator.querySelector('span').style.fontWeight = '500';
        step2Indicator.querySelector('span').style.color = '#6b7280';
    }

    // Reset navigation buttons
    document.getElementById('nextStepBtn').style.display = 'inline-flex';
    document.getElementById('prevStepBtn').style.display = 'none';
    document.getElementById('submitSaleBtn').style.display = 'none';

    // Hide product search result card
    const resultDiv = document.getElementById('productSearchResult');
    if (resultDiv) resultDiv.style.display = 'none';

    // Clear barcode input and status
    document.getElementById('securityBarcode').value = '';
    document.getElementById('barcodeStatus').style.display = 'none';
    document.getElementById('selectedProductId').value = '';

    // Reset fee fields
    document.getElementById('transactionFees').value = '0';
    document.getElementById('adFeeGeneral').value = '0';
    document.getElementById('postageLabelCost').value = '0';
    document.getElementById('outwardTrackingNumber').value = '';

    // Reset selected products display
    displaySelectedProducts();

    // Clear consumables
    document.getElementById('consumablesList').innerHTML = '<p style="text-align: center; color: #9ca3af;">No consumables added yet</p>';
    document.getElementById('consumablesCost').textContent = '0.00';

    updatePreview();

    document.getElementById('saleModal').style.display = 'flex';

    // Focus on search input
    setTimeout(() => {
        document.getElementById('securityBarcode')?.focus();
    }, 100);
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
    selectedProducts = []; // Reset selected products array
    productCost = 0;
    pendingProduct = null;
    currentStep = 2; // Edit mode starts at step 2

    document.getElementById('saleModalTitle').textContent = 'Edit Sale';
    document.getElementById('saleForm').reset();
    setupDateDefault();
    setSaleEditingState(true);

    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/sales/${id}`);
        const data = await response.json();

        if (!response.ok || !data.sale) {
            alert(data.error || 'Failed to load sale details');
            setSaleEditingState(false);
            return;
        }

        const sale = data.sale;

        // Load products into selectedProducts array
        if (sale.products && Array.isArray(sale.products) && sale.products.length > 0) {
            // Multi-product sale - load all products
            selectedProducts = sale.products.map(p => ({
                product_id: p.product_id?.$oid || p.product_id?.toString() || p.product_id,
                product_name: p.product_name || 'Unknown',
                product_serial: p.product_serial || 'N/A',
                product_cost: parseFloat(p.product_cost) || 0
            }));
        } else if (sale.product_id) {
            // Legacy single product sale - convert to array
            selectedProducts = [{
                product_id: sale.product_id?.$oid || sale.product_id?.toString() || sale.product_id,
                product_name: sale.product_name || 'Unknown',
                product_serial: sale.product_serial || 'N/A',
                product_cost: parseFloat(sale.product_cost) || 0
            }];
        }

        document.getElementById('selectedProductId').value = sale.product_id;
        document.getElementById('saleOrderNumber').value = sale.order_number || '';
        document.getElementById('salePlatform').value = sale.platform || 'Other';
        document.getElementById('salePrice').value = sale.sale_price ?? '';
        document.getElementById('saleDate').value = sale.sale_date ? new Date(sale.sale_date).toISOString().split('T')[0] : '';
        document.getElementById('transactionFees').value = sale.transaction_fees ?? 0;
        document.getElementById('adFeeGeneral').value = sale.ad_fee_general ?? 0;
        document.getElementById('postageLabelCost').value = sale.postage_label_cost ?? 0;
        document.getElementById('outwardTrackingNumber').value = sale.outward_tracking_number || '';
        document.getElementById('saleNotes').value = sale.notes || '';

        // Display selected products and update step 2 summary
        displaySelectedProducts();
        updateStep2Summary();

        // Go directly to step 2 for editing
        document.getElementById('saleStep1').style.display = 'none';
        document.getElementById('saleStep2').style.display = 'block';

        // Update step indicators for edit mode (step 2 active)
        const step1Indicator = document.getElementById('step1Indicator');
        const step2Indicator = document.getElementById('step2Indicator');
        if (step1Indicator) {
            step1Indicator.style.opacity = '0.5';
            step1Indicator.querySelector('div').style.background = '#10b981';
        }
        if (step2Indicator) {
            step2Indicator.style.opacity = '1';
            step2Indicator.querySelector('div').style.background = '#3b82f6';
            step2Indicator.querySelector('div').style.color = 'white';
            step2Indicator.querySelector('span').style.fontWeight = '600';
            step2Indicator.querySelector('span').style.color = '#111';
        }

        // Update navigation buttons for edit mode
        document.getElementById('nextStepBtn').style.display = 'none';
        document.getElementById('prevStepBtn').style.display = 'inline-flex';
        document.getElementById('submitSaleBtn').style.display = 'inline-flex';

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
    const transactionFeesEl = document.getElementById('transactionFees');
    const adFeeGeneralEl = document.getElementById('adFeeGeneral');
    const postageCostEl = document.getElementById('postageLabelCost');

    const transactionFees = transactionFeesEl ? (parseFloat(transactionFeesEl.value) || 0) : 0;
    const adFeeGeneral = adFeeGeneralEl ? (parseFloat(adFeeGeneralEl.value) || 0) : 0;
    const postageCost = postageCostEl ? (parseFloat(postageCostEl.value) || 0) : 0;
    const consumablesCost = selectedConsumables.reduce((sum, c) => sum + (c.cost * c.quantity), 0);

    const totalFees = transactionFees + adFeeGeneral;
    const totalCost = productCost + totalFees + postageCost + consumablesCost;
    const profit = salePrice - totalCost;

    const previewSalePrice = document.getElementById('previewSalePrice');
    const previewProductCost = document.getElementById('previewProductCost');
    const previewFees = document.getElementById('previewFees');
    const previewPostage = document.getElementById('previewPostage');
    const previewConsumablesCost = document.getElementById('previewConsumablesCost');
    const profitEl = document.getElementById('previewProfit');

    if (previewSalePrice) previewSalePrice.textContent = salePrice.toFixed(2);
    if (previewProductCost) previewProductCost.textContent = productCost.toFixed(2);
    if (previewFees) previewFees.textContent = totalFees.toFixed(2);
    if (previewPostage) previewPostage.textContent = postageCost.toFixed(2);
    if (previewConsumablesCost) previewConsumablesCost.textContent = consumablesCost.toFixed(2);

    if (profitEl) {
        profitEl.textContent = `£${profit.toFixed(2)}`;
        profitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
    }
}

function closeSaleModal() {
    document.getElementById('saleModal').style.display = 'none';
    setSaleEditingState(false);
}

async function handleSaleSubmit(e) {
    e.preventDefault();

    // Check if we have products selected (new multi-product method)
    if (selectedProducts.length === 0) {
        alert('Please select or scan at least one product');
        return;
    }

    // Calculate total product cost from selectedProducts
    const totalProductCost = selectedProducts.reduce((sum, p) => sum + (p.product_cost || 0), 0);
    const consumablesCost = selectedConsumables.reduce((sum, c) => sum + (c.cost * c.quantity), 0);
    const transactionFees = parseFloat(document.getElementById('transactionFees').value) || 0;
    const adFeeGeneral = parseFloat(document.getElementById('adFeeGeneral').value) || 0;
    const postageLabelCost = parseFloat(document.getElementById('postageLabelCost').value) || 0;
    const outwardTrackingNumber = document.getElementById('outwardTrackingNumber').value.trim();

    const saleData = {
        products: selectedProducts, // Send array of products
        platform: document.getElementById('salePlatform').value,
        order_number: document.getElementById('saleOrderNumber').value.trim(),
        sale_price: parseFloat(document.getElementById('salePrice').value),
        sale_date: document.getElementById('saleDate').value,
        transaction_fees: transactionFees,
        ad_fee_general: adFeeGeneral,
        postage_label_cost: postageLabelCost,
        outward_tracking_number: outwardTrackingNumber,
        consumables: selectedConsumables,
        consumables_cost: consumablesCost,
        total_cost: totalProductCost + transactionFees + adFeeGeneral + postageLabelCost + consumablesCost,
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

// ===== VIEW/EDIT/DELETE SALE =====

async function viewSale(id) {
    openEditSaleModal(id);
}

async function editSale(id) {
    openEditSaleModal(id);
}

async function deleteSale(id) {
    if (!confirm('Delete this sale? This will mark the product as unsold again.')) return;

    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/sales/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Sale deleted successfully!');
            loadSales();
            loadSummary();
        } else {
            const error = await response.json();
            alert(`Failed to delete sale: ${error.error || error.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting sale:', error);
        alert(`Error deleting sale: ${error.message || 'Unknown error'}`);
    }
}

// ===== UTILITY =====

function showError(message) {
    console.error(message);
    // Could show a toast notification here
}

// Make functions available globally for onclick handlers
window.viewSale = viewSale;
window.editSale = editSale;
window.deleteSale = deleteSale;
window.removeConsumable = removeConsumable;
window.closeSaleModal = closeSaleModal;
window.closeTemplatesModal = closeTemplatesModal;
window.deleteTemplate = deleteTemplate;
window.closeCreateTemplateModal = closeCreateTemplateModal;
window.removeTemplateConsumable = removeTemplateConsumable;
window.closeConsumablePickerModal = closeConsumablePickerModal;

})(); // End of IIFE
