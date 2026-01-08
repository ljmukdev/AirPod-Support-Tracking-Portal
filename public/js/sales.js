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
    
    // Accessory Selection Change
    document.getElementById('accessoryProduct')?.addEventListener('change', handleAccessoryChange);
    
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
        const profit = (sale.sale_price - sale.total_cost).toFixed(2);
        const margin = sale.sale_price > 0 ? ((profit / sale.sale_price) * 100).toFixed(1) : '0.0';
        const profitColor = profit >= 0 ? '#10b981' : '#ef4444';
        
        return `
            <tr>
                <td>${saleDate}</td>
                <td>
                    <div style="font-weight: 600;">${sale.product_name || 'Unknown Product'}</div>
                    <div style="font-size: 0.85rem; color: #666;">${sale.product_serial || 'N/A'}</div>
                </td>
                <td>${sale.platform || 'N/A'}</td>
                <td>${sale.order_number || 'N/A'}</td>
                <td style="font-weight: 600;">£${sale.sale_price.toFixed(2)}</td>
                <td>£${sale.total_cost.toFixed(2)}</td>
                <td style="font-weight: 700; color: ${profitColor};">£${profit}</td>
                <td style="font-weight: 600; color: ${profitColor};">${margin}%</td>
                <td>
                    <button class="button-icon" onclick="viewSale('${sale._id}')" title="View Details">
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
    const accessorySelect = document.getElementById('accessoryProduct');
    const selectedProductId = document.getElementById('selectedProductId');
    const barcodeStatus = document.getElementById('barcodeStatus');
    
    if (method === 'barcode') {
        // Show barcode input, hide accessory dropdown
        barcodeGroup.style.display = 'block';
        accessoryGroup.style.display = 'none';
        barcodeInput.value = '';
        accessorySelect.value = '';
        selectedProductId.value = '';
        barcodeStatus.style.display = 'none';
        productCost = 0;
    } else {
        // Show accessory dropdown, hide barcode input
        barcodeGroup.style.display = 'none';
        accessoryGroup.style.display = 'block';
        barcodeInput.value = '';
        accessorySelect.value = '';
        selectedProductId.value = '';
        barcodeStatus.style.display = 'none';
        productCost = 0;
        
        // Load accessories if not already loaded
        if (accessorySelect.options.length === 1) {
            loadAvailableAccessories();
        }
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
        statusDiv.style.backgroundColor = '#f3f4f6';
        statusDiv.style.color = '#666';
        statusDiv.textContent = 'Looking up product...';
        
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products/lookup-barcode?barcode=${encodeURIComponent(barcode)}`);
        const data = await response.json();
        
        if (response.ok && data.product) {
            const product = data.product;
            
            // Check if product is available for sale
            if (product.sales_order_number || product.status === 'sold' || product.status === 'faulty') {
                statusDiv.style.backgroundColor = '#fee2e2';
                statusDiv.style.color = '#dc2626';
                statusDiv.innerHTML = `<strong>❌ Product Not Available</strong><br>This product has already been sold or is marked as faulty.`;
                selectedProductId.value = '';
                productCost = 0;
            } else {
                statusDiv.style.backgroundColor = '#d1fae5';
                statusDiv.style.color = '#065f46';
                statusDiv.innerHTML = `
                    <strong>✅ Product Found:</strong> ${product.product_type || product.part_type}<br>
                    Serial: ${product.serial_number || 'N/A'} | Cost: £${(product.purchase_price || 0).toFixed(2)}
                `;
                selectedProductId.value = product._id;
                productCost = product.purchase_price || 0;
                updatePreview();
            }
        } else {
            statusDiv.style.backgroundColor = '#fee2e2';
            statusDiv.style.color = '#dc2626';
            statusDiv.innerHTML = '<strong>❌ Product Not Found</strong><br>No product with this security barcode exists.';
            selectedProductId.value = '';
            productCost = 0;
            updatePreview();
        }
    } catch (error) {
        console.error('Error looking up barcode:', error);
        statusDiv.style.backgroundColor = '#fee2e2';
        statusDiv.style.color = '#dc2626';
        statusDiv.textContent = '❌ Error looking up product. Please try again.';
        selectedProductId.value = '';
        productCost = 0;
        updatePreview();
    }
}

function handleAccessoryChange() {
    const select = document.getElementById('accessoryProduct');
    const selectedOption = select.options[select.selectedIndex];
    const selectedProductId = document.getElementById('selectedProductId');
    
    if (selectedOption && selectedOption.value) {
        selectedProductId.value = selectedOption.value;
        productCost = parseFloat(selectedOption.dataset.cost) || 0;
    } else {
        selectedProductId.value = '';
        productCost = 0;
    }
    
    updatePreview();
}

async function openAddSaleModal() {
    currentSaleId = null;
    selectedConsumables = [];
    productCost = 0;
    
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

async function loadAvailableAccessories() {
    try {
        console.log('Loading available accessories...');
        const response = await authenticatedFetch(`${API_BASE}/api/admin/products?accessories=true`);
        const data = await response.json();
        
        console.log('Accessories response:', data);
        
        const select = document.getElementById('accessoryProduct');
        select.innerHTML = '<option value="">Select an accessory...</option>';
        
        if (data.products && data.products.length > 0) {
            console.log(`Found ${data.products.length} available accessories`);
            data.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product._id;
                const partName = product.part_name || product.product_type || product.part_type;
                option.textContent = `${partName} - ${product.serial_number || 'N/A'} (£${product.purchase_price?.toFixed(2) || '0.00'})`;
                option.dataset.cost = product.purchase_price || 0;
                option.dataset.name = partName;
                select.appendChild(option);
            });
        } else {
            console.log('No accessories found');
            select.innerHTML = '<option value="">No unsold accessories available</option>';
        }
    } catch (error) {
        console.error('Error loading accessories:', error);
    }
}


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
        const select = document.getElementById('accessoryProduct');
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption) {
            productName = selectedOption.dataset.name || 'Unknown';
            productSerial = 'N/A';
        }
    } else {
        // For barcode, we need to get the details from the status display
        // or fetch from the backend
        const statusDiv = document.getElementById('barcodeStatus');
        if (statusDiv && statusDiv.textContent.includes('Product Found')) {
            // Extract from status display
            const serialMatch = statusDiv.textContent.match(/Serial: ([^\|]+)/);
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

async function addConsumableRow() {
    // Load available consumables
    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/consumables`);
        const data = await response.json();
        
        if (!data.consumables || data.consumables.length === 0) {
            alert('No consumables available. Please add consumables first.');
            return;
        }
        
        // Show numbered list of consumables
        const options = data.consumables.map((c, i) => 
            `${i + 1}. ${c.name} - £${c.price_per_unit?.toFixed(2) || '0.00'} each (${c.quantity_in_stock || 0} in stock)`
        ).join('\n');
        
        const selection = prompt(`Select a consumable:\n\n${options}\n\nEnter number:`);
        
        if (!selection) return;
        
        const index = parseInt(selection) - 1;
        const consumable = data.consumables[index];
        
        if (consumable) {
            const quantity = parseInt(prompt(`How many ${consumable.name}?`, '1')) || 1;
            
            // Check if enough stock
            if (quantity > (consumable.quantity_in_stock || 0)) {
                const proceed = confirm(`Warning: Only ${consumable.quantity_in_stock || 0} in stock. Add ${quantity} anyway?`);
                if (!proceed) return;
            }
            
            selectedConsumables.push({
                consumable_id: consumable._id,
                name: consumable.name,
                cost: consumable.price_per_unit || 0,
                quantity: quantity
            });
            
            displayConsumables();
            updatePreview();
        } else {
            alert('Invalid selection. Please try again.');
        }
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
                            name: currentConsumable.name,
                            cost: currentConsumable.price_per_unit || 0,
                            quantity: templateItem.quantity
                        });
                    } else {
                        // Consumable no longer exists - show warning but include with stored data
                        console.warn(`Consumable ${templateItem.name} (ID: ${templateItem.consumable_id}) no longer exists`);
                        alert(`Warning: Consumable "${templateItem.name}" no longer exists in inventory. It will be skipped.`);
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
            // Calculate current costs based on live consumable data
            let totalCost = 0;
            let hasInvalidItems = false;
            
            const consumablesList = template.consumables.map(c => {
                const currentConsumable = currentConsumables.find(curr => curr._id === c.consumable_id);
                
                if (currentConsumable) {
                    const currentCost = (currentConsumable.price_per_unit || 0) * c.quantity;
                    totalCost += currentCost;
                    return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                            <span>${currentConsumable.name} × ${c.quantity}</span>
                            <span>£${currentCost.toFixed(2)}</span>
                        </div>
                    `;
                } else {
                    hasInvalidItems = true;
                    return `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #ef4444;">
                            <span>${c.name} × ${c.quantity} <em>(not found)</em></span>
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
    
    // Show numbered list with prices and stock
    const options = allConsumables.map((c, i) => 
        `${i + 1}. ${c.name} - £${c.price_per_unit?.toFixed(2) || '0.00'} each (${c.quantity_in_stock || 0} in stock)`
    ).join('\n');
    
    const selection = prompt(`Select a consumable:\n\n${options}\n\nEnter number:`);
    
    if (!selection) return;
    
    const index = parseInt(selection) - 1;
    const consumable = allConsumables[index];
    
    if (consumable) {
        const quantity = parseInt(prompt(`How many ${consumable.name}?`, '1')) || 1;
        
        if (quantity < 1) {
            alert('Quantity must be at least 1');
            return;
        }
        
        templateConsumables.push({
            consumable_id: consumable._id,
            name: consumable.name,
            cost: consumable.price_per_unit || 0,
            quantity: quantity
        });
        
        displayTemplateConsumables();
    } else {
        alert('Invalid selection. Please try again.');
    }
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
    
    if (!name) {
        alert('Please enter a template name');
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
    // TODO: Implement view sale details
    alert(`View sale details for ${id} (coming soon)`);
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

})(); // End of IIFE
})(); // End of IIFE