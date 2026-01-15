/**
 * Price Recommender - Frontend JavaScript
 * Handles all UI interactions for the AirPods price recommendation system
 */

// API_BASE is already defined in admin.js, so we use it from there
let priceRecProducts = [];
let priceRecSettings = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Price Recommender: DOMContentLoaded fired');

    // Initialize tabs first (synchronous - should always work)
    initTabs();

    // Initialize weight calculation
    initWeightCalculation();

    // Set up event listeners (synchronous)
    setupEventListeners();

    // Set default date to today for forms
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.value = today;
    });

    // Load initial data (async - may fail but shouldn't break the page)
    try {
        await loadSummary();
    } catch (err) {
        console.error('Failed to load summary:', err);
    }

    try {
        await loadProducts();
    } catch (err) {
        console.error('Failed to load products:', err);
    }

    try {
        await loadRecommendations();
    } catch (err) {
        console.error('Failed to load recommendations:', err);
    }
});

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function initTabs() {
    console.log('Price Recommender: Initializing tabs...');
    const tabBtns = document.querySelectorAll('.tab-btn');
    console.log('Price Recommender: Found', tabBtns.length, 'tab buttons');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            console.log('Tab clicked:', tab);

            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            // Load data for the tab
            loadTabData(tab);
        });
    });
}

async function loadTabData(tab) {
    switch(tab) {
        case 'recommendations':
            await loadRecommendations();
            break;
        case 'products':
            await loadProductsTable();
            break;
        case 'sales':
            await loadSalesTable();
            break;
        case 'purchases':
            await loadPurchasesTable();
            break;
        case 'ebay':
            await loadEbayTable();
            break;
        case 'settings':
            await loadSettings();
            break;
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Helper to safely add event listener
    function addListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, handler);
        } else {
            console.warn(`Element #${id} not found`);
        }
    }

    // Price evaluation form
    addListener('priceEvalForm', 'submit', handlePriceEval);

    // Refresh all recommendations
    addListener('refreshAllRecs', 'click', refreshAllRecommendations);

    // Initialize products
    addListener('initProducts', 'click', initializeProducts);

    // Add buttons
    addListener('addProduct', 'click', () => openModal('productModal'));
    addListener('addSale', 'click', () => openModal('saleModal'));
    addListener('addPurchase', 'click', () => openModal('purchaseModal'));
    addListener('addEbayData', 'click', () => openModal('ebayModal'));

    // Forms
    addListener('productForm', 'submit', handleProductSubmit);
    addListener('saleForm', 'submit', handleSaleSubmit);
    addListener('purchaseForm', 'submit', handlePurchaseSubmit);
    addListener('ebayForm', 'submit', handleEbaySubmit);
    addListener('settingsForm', 'submit', handleSettingsSubmit);
    addListener('resetSettings', 'click', resetSettings);

    console.log('Price Recommender: Event listeners initialized');
}

// ============================================================================
// API HELPERS
// ============================================================================

async function apiCall(endpoint, options = {}) {
    // Check if authenticatedFetch is available (from admin.js)
    if (typeof authenticatedFetch !== 'function') {
        throw new Error('Authentication not ready. Please refresh the page.');
    }

    try {
        const response = await authenticatedFetch(`${API_BASE}/api/admin/price-recommender${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadSummary() {
    try {
        const data = await apiCall('/summary');
        const summary = data.summary;

        document.getElementById('statProducts').textContent = summary.products_count;
        document.getElementById('statSales').textContent = summary.sales_count;
        document.getElementById('statPurchases').textContent = summary.purchases_count;
        document.getElementById('statEbay').textContent = summary.ebay_data_count;

        priceRecSettings = summary.settings;
    } catch (err) {
        console.error('Error loading summary:', err);
    }
}

async function loadProducts() {
    try {
        const data = await apiCall('/products');
        priceRecProducts = data.products || [];

        // Populate product dropdowns
        const selects = ['evalSku', 'saleSku', 'purchaseSku', 'ebaySku'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">Select Product...</option>';
                priceRecProducts.forEach(p => {
                    select.innerHTML += `<option value="${p.sku}">${p.name} (${p.sku})</option>`;
                });
                select.value = currentValue;
            }
        });
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

async function loadRecommendations() {
    const grid = document.getElementById('recommendationsGrid');

    try {
        const data = await apiCall('/recommendations');
        const recommendations = data.recommendations || [];

        if (recommendations.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">&#128202;</div>
                    <p>No recommendations yet. Add some products and market data to get started!</p>
                    <button class="action-btn action-btn-primary" onclick="document.querySelector('[data-tab=products]').click()">
                        Go to Products
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = recommendations.map(rec => `
            <div class="rec-card">
                <div class="rec-card-header">
                    <div class="rec-card-name">${rec.product_name}</div>
                    <span class="rec-card-sku">${rec.sku}</span>
                </div>
                <div class="rec-card-price">$${rec.max_purchase_price.toFixed(2)}</div>
                <div style="font-size: 0.9rem; color: #666; margin-bottom: 12px;">Max Purchase Price</div>
                <div class="rec-card-ranges">
                    <div class="rec-range excellent">Excellent: &lt;$${rec.price_ranges.excellent.max.toFixed(2)}</div>
                    <div class="rec-range good">Good: $${rec.price_ranges.good.min.toFixed(2)}-${rec.price_ranges.good.max.toFixed(2)}</div>
                    <div class="rec-range acceptable">OK: $${rec.price_ranges.acceptable.min.toFixed(2)}-${rec.price_ranges.acceptable.max.toFixed(2)}</div>
                    <div class="rec-range avoid">Avoid: &gt;$${rec.price_ranges.avoid.min.toFixed(2)}</div>
                </div>
                <div class="rec-card-data">
                    <div class="data-sources">
                        <div class="data-source">Sales: <span class="data-count">${rec.data_sources.sales.count}</span></div>
                        <div class="data-source">eBay: <span class="data-count">${rec.data_sources.ebay.count}</span></div>
                        <div class="data-source">Purchases: <span class="data-count">${rec.data_sources.purchases.count}</span></div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">&#9888;</div>
                <p>Error loading recommendations: ${err.message}</p>
            </div>
        `;
    }
}

async function loadProductsTable() {
    const tbody = document.getElementById('productsBody');

    try {
        const data = await apiCall('/products');
        const products = data.products || [];

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No products. Click "Initialize Defaults" to add standard AirPods models.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td><strong>${p.sku}</strong></td>
                <td>${p.name}</td>
                <td>${p.generation}</td>
                <td>${p.variant || '-'}</td>
                <td>$${p.msrp.toFixed(2)}</td>
                <td>${p.active ? '<span style="color: #10b981;">Active</span>' : '<span style="color: #ef4444;">Inactive</span>'}</td>
                <td>
                    <button class="action-btn action-btn-secondary" onclick="editProduct('${p.sku}')">Edit</button>
                    <button class="action-btn action-btn-danger" onclick="deleteProduct('${p.sku}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
}

async function loadSalesTable() {
    const tbody = document.getElementById('salesBody');

    try {
        const data = await apiCall('/sales?limit=50');
        const sales = data.sales || [];

        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No sales records yet.</td></tr>';
            return;
        }

        tbody.innerHTML = sales.map(s => `
            <tr>
                <td>${new Date(s.sale_date).toLocaleDateString()}</td>
                <td><strong>${s.sku}</strong></td>
                <td>$${s.sold_price.toFixed(2)}</td>
                <td>${s.platform}</td>
                <td>${s.condition}</td>
                <td>${s.transaction_fees ? '$' + s.transaction_fees.toFixed(2) : '-'}</td>
                <td>
                    <button class="action-btn action-btn-danger" onclick="deleteSale('${s._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
}

async function loadPurchasesTable() {
    const tbody = document.getElementById('purchasesBody');

    try {
        const data = await apiCall('/purchases?limit=50');
        const purchases = data.purchases || [];

        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No purchase records yet.</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(p => `
            <tr>
                <td>${new Date(p.purchase_date).toLocaleDateString()}</td>
                <td><strong>${p.sku}</strong></td>
                <td>$${p.purchase_price.toFixed(2)}</td>
                <td>${p.supplier || '-'}</td>
                <td>${p.condition}</td>
                <td>${p.shipping_cost ? '$' + p.shipping_cost.toFixed(2) : '-'}</td>
                <td>
                    <button class="action-btn action-btn-danger" onclick="deletePurchase('${p._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
}

async function loadEbayTable() {
    const tbody = document.getElementById('ebayBody');

    try {
        const data = await apiCall('/ebay-market-data?limit=50');
        const entries = data.data || [];

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No eBay market data yet.</td></tr>';
            return;
        }

        tbody.innerHTML = entries.map(e => `
            <tr>
                <td>${new Date(e.sold_date).toLocaleDateString()}</td>
                <td><strong>${e.sku}</strong></td>
                <td>$${e.sold_price.toFixed(2)}</td>
                <td>${e.condition}</td>
                <td>${e.listing_title ? e.listing_title.substring(0, 40) + '...' : '-'}</td>
                <td>${e.source || 'manual'}</td>
                <td>
                    <button class="action-btn action-btn-danger" onclick="deleteEbayEntry('${e._id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
}

async function loadSettings() {
    try {
        const data = await apiCall('/settings');
        priceRecSettings = data.settings;

        document.getElementById('targetMargin').value = Math.round(priceRecSettings.target_profit_margin * 100);
        document.getElementById('daysLookback').value = priceRecSettings.days_lookback;
        document.getElementById('defaultShipping').value = priceRecSettings.default_shipping_cost;
        document.getElementById('salesWeight').value = Math.round(priceRecSettings.sales_weight * 100);
        document.getElementById('ebayWeight').value = Math.round(priceRecSettings.ebay_weight * 100);
        document.getElementById('purchaseWeight').value = Math.round(priceRecSettings.purchase_weight * 100);
        document.getElementById('excellentThreshold').value = Math.round(priceRecSettings.excellent_threshold * 100);
        document.getElementById('goodThreshold').value = Math.round(priceRecSettings.good_threshold * 100);
        document.getElementById('acceptableThreshold').value = Math.round(priceRecSettings.acceptable_threshold * 100);

        updateWeightTotal();
    } catch (err) {
        console.error('Error loading settings:', err);
        alert('Error loading settings: ' + err.message);
    }
}

// ============================================================================
// PRICE EVALUATION
// ============================================================================

async function handlePriceEval(e) {
    e.preventDefault();

    const sku = document.getElementById('evalSku').value;
    const price = document.getElementById('evalPrice').value;

    if (!sku || !price) {
        alert('Please select a product and enter a price');
        return;
    }

    const resultDiv = document.getElementById('evalResult');
    const ratingDiv = document.getElementById('evalRating');
    const detailsDiv = document.getElementById('evalDetails');

    try {
        const data = await apiCall('/evaluate', {
            method: 'POST',
            body: JSON.stringify({ sku, proposed_price: parseFloat(price) })
        });

        const eval_ = data.evaluation;

        // Update result styling
        resultDiv.className = `price-eval-result ${eval_.rating}`;
        resultDiv.style.display = 'block';

        // Update rating
        ratingDiv.innerHTML = `
            <span style="color: ${eval_.color}">${eval_.rating_label}</span>
            <span style="font-size: 1rem; font-weight: 400; margin-left: 12px;">
                ${eval_.percent_of_max.toFixed(1)}% of max price
            </span>
        `;

        // Update details
        detailsDiv.innerHTML = `
            <div class="price-eval-stat">
                <div class="price-eval-stat-value">$${eval_.proposed_price.toFixed(2)}</div>
                <div class="price-eval-stat-label">Your Price</div>
            </div>
            <div class="price-eval-stat">
                <div class="price-eval-stat-value">$${eval_.max_purchase_price.toFixed(2)}</div>
                <div class="price-eval-stat-label">Max Recommended</div>
            </div>
            <div class="price-eval-stat">
                <div class="price-eval-stat-value">$${eval_.financials.estimated_profit.toFixed(2)}</div>
                <div class="price-eval-stat-label">Est. Profit</div>
            </div>
            <div class="price-eval-stat">
                <div class="price-eval-stat-value">${eval_.financials.profit_margin_percent.toFixed(1)}%</div>
                <div class="price-eval-stat-label">Profit Margin</div>
            </div>
        `;
    } catch (err) {
        resultDiv.className = 'price-eval-result avoid';
        resultDiv.style.display = 'block';
        ratingDiv.innerHTML = '<span style="color: #ef4444;">Error</span>';
        detailsDiv.innerHTML = `<p>${err.message}</p>`;
    }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

async function initializeProducts() {
    try {
        const data = await apiCall('/init', { method: 'POST' });
        alert(data.message);
        await loadProducts();
        await loadProductsTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function refreshAllRecommendations() {
    const btn = document.getElementById('refreshAllRecs');
    btn.disabled = true;
    btn.textContent = 'Calculating...';

    try {
        const data = await apiCall('/recommendations/calculate-all', { method: 'POST' });
        alert(data.message);
        await loadRecommendations();
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Recalculate All';
    }
}

// Product CRUD
async function handleProductSubmit(e) {
    e.preventDefault();

    const editSku = document.getElementById('productEditSku').value;
    const productData = {
        sku: document.getElementById('productSku').value,
        name: document.getElementById('productName').value,
        generation: document.getElementById('productGeneration').value,
        variant: document.getElementById('productVariant').value,
        msrp: parseFloat(document.getElementById('productMsrp').value)
    };

    try {
        if (editSku) {
            await apiCall(`/products/${editSku}`, {
                method: 'PUT',
                body: JSON.stringify(productData)
            });
        } else {
            await apiCall('/products', {
                method: 'POST',
                body: JSON.stringify(productData)
            });
        }

        closeModal('productModal');
        await loadProducts();
        await loadProductsTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function editProduct(sku) {
    try {
        const data = await apiCall(`/products/${sku}`);
        const product = data.product;

        document.getElementById('productModalTitle').textContent = 'Edit Product';
        document.getElementById('productEditSku').value = sku;
        document.getElementById('productSku').value = product.sku;
        document.getElementById('productSku').disabled = true;
        document.getElementById('productName').value = product.name;
        document.getElementById('productGeneration').value = product.generation;
        document.getElementById('productVariant').value = product.variant || '';
        document.getElementById('productMsrp').value = product.msrp;

        openModal('productModal');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteProduct(sku) {
    if (!confirm(`Delete product ${sku}?`)) return;

    try {
        await apiCall(`/products/${sku}`, { method: 'DELETE' });
        await loadProducts();
        await loadProductsTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Sale CRUD
async function handleSaleSubmit(e) {
    e.preventDefault();

    const saleData = {
        sku: document.getElementById('saleSku').value,
        sold_price: parseFloat(document.getElementById('salePrice').value),
        sale_date: document.getElementById('saleDate').value,
        platform: document.getElementById('salePlatform').value,
        condition: document.getElementById('saleCondition').value,
        transaction_fees: document.getElementById('saleFees').value ? parseFloat(document.getElementById('saleFees').value) : null,
        shipping_cost: document.getElementById('saleShipping').value ? parseFloat(document.getElementById('saleShipping').value) : null,
        notes: document.getElementById('saleNotes').value
    };

    try {
        await apiCall('/sales', {
            method: 'POST',
            body: JSON.stringify(saleData)
        });

        closeModal('saleModal');
        document.getElementById('saleForm').reset();
        document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
        await loadSummary();
        await loadSalesTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteSale(id) {
    if (!confirm('Delete this sale record?')) return;

    try {
        await apiCall(`/sales/${id}`, { method: 'DELETE' });
        await loadSummary();
        await loadSalesTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Purchase CRUD
async function handlePurchaseSubmit(e) {
    e.preventDefault();

    const purchaseData = {
        sku: document.getElementById('purchaseSku').value,
        purchase_price: parseFloat(document.getElementById('purchasePrice').value),
        purchase_date: document.getElementById('purchaseDate').value,
        supplier: document.getElementById('purchaseSupplier').value,
        condition: document.getElementById('purchaseCondition').value,
        shipping_cost: document.getElementById('purchaseShipping').value ? parseFloat(document.getElementById('purchaseShipping').value) : 0,
        quantity: parseInt(document.getElementById('purchaseQty').value) || 1,
        notes: document.getElementById('purchaseNotes').value
    };

    try {
        await apiCall('/purchases', {
            method: 'POST',
            body: JSON.stringify(purchaseData)
        });

        closeModal('purchaseModal');
        document.getElementById('purchaseForm').reset();
        document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('purchaseQty').value = '1';
        await loadSummary();
        await loadPurchasesTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deletePurchase(id) {
    if (!confirm('Delete this purchase record?')) return;

    try {
        await apiCall(`/purchases/${id}`, { method: 'DELETE' });
        await loadSummary();
        await loadPurchasesTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// eBay Data CRUD
async function handleEbaySubmit(e) {
    e.preventDefault();

    const ebayData = {
        sku: document.getElementById('ebaySku').value,
        sold_price: parseFloat(document.getElementById('ebayPrice').value),
        sold_date: document.getElementById('ebayDate').value,
        condition: document.getElementById('ebayCondition').value,
        listing_title: document.getElementById('ebayTitle').value,
        item_id: document.getElementById('ebayItemId').value,
        shipping_cost: document.getElementById('ebayShipping').value ? parseFloat(document.getElementById('ebayShipping').value) : null
    };

    try {
        await apiCall('/ebay-market-data', {
            method: 'POST',
            body: JSON.stringify(ebayData)
        });

        closeModal('ebayModal');
        document.getElementById('ebayForm').reset();
        document.getElementById('ebayDate').value = new Date().toISOString().split('T')[0];
        await loadSummary();
        await loadEbayTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function deleteEbayEntry(id) {
    if (!confirm('Delete this eBay data entry?')) return;

    try {
        await apiCall(`/ebay-market-data/${id}`, { method: 'DELETE' });
        await loadSummary();
        await loadEbayTable();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Settings
async function handleSettingsSubmit(e) {
    e.preventDefault();

    const settingsData = {
        target_profit_margin: parseInt(document.getElementById('targetMargin').value) / 100,
        days_lookback: parseInt(document.getElementById('daysLookback').value),
        default_shipping_cost: parseFloat(document.getElementById('defaultShipping').value),
        sales_weight: parseInt(document.getElementById('salesWeight').value) / 100,
        ebay_weight: parseInt(document.getElementById('ebayWeight').value) / 100,
        purchase_weight: parseInt(document.getElementById('purchaseWeight').value) / 100,
        excellent_threshold: parseInt(document.getElementById('excellentThreshold').value) / 100,
        good_threshold: parseInt(document.getElementById('goodThreshold').value) / 100,
        acceptable_threshold: parseInt(document.getElementById('acceptableThreshold').value) / 100
    };

    try {
        await apiCall('/settings', {
            method: 'PUT',
            body: JSON.stringify(settingsData)
        });

        alert('Settings saved successfully!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;

    try {
        await apiCall('/settings/reset', { method: 'POST' });
        await loadSettings();
        alert('Settings reset to defaults!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ============================================================================
// MODAL HELPERS
// ============================================================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');

    // Reset form if opening product modal for new product
    if (modalId === 'productModal') {
        document.getElementById('productModalTitle').textContent = 'Add Product';
        document.getElementById('productEditSku').value = '';
        document.getElementById('productSku').disabled = false;
        document.getElementById('productForm').reset();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// ============================================================================
// WEIGHT CALCULATION HELPER
// ============================================================================

function initWeightCalculation() {
    document.querySelectorAll('.weight-input').forEach(input => {
        input.addEventListener('input', updateWeightTotal);
    });
}

function updateWeightTotal() {
    const sales = parseInt(document.getElementById('salesWeight').value) || 0;
    const ebay = parseInt(document.getElementById('ebayWeight').value) || 0;
    const purchase = parseInt(document.getElementById('purchaseWeight').value) || 0;
    const total = sales + ebay + purchase;

    document.getElementById('weightTotal').textContent = total + '%';
    document.getElementById('weightFill').style.width = Math.min(total, 100) + '%';

    if (total === 100) {
        document.getElementById('weightFill').style.background = 'var(--accent-teal, #0d9488)';
        document.getElementById('weightTotal').style.color = '#10b981';
    } else if (total > 100) {
        document.getElementById('weightFill').style.background = '#ef4444';
        document.getElementById('weightTotal').style.color = '#ef4444';
    } else {
        document.getElementById('weightFill').style.background = '#f59e0b';
        document.getElementById('weightTotal').style.color = '#f59e0b';
    }
}
