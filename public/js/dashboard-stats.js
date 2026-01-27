// Dashboard Stats Loader - Fetches and displays statistics

// Ensure API_BASE exists on window object
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}

// Load and display dashboard statistics
async function loadDashboardStats() {
    try {
        // Check if authenticatedFetch is available (loaded from admin.js)
        if (typeof authenticatedFetch !== 'function') {
            console.error('authenticatedFetch not available - admin.js may not be loaded');
            showError('Error: Authentication system not loaded');
            return;
        }

        // Get token using the same storage method as admin.js
        // Check both localStorage (new) and sessionStorage (legacy) for compatibility
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        console.log('[Dashboard] Token exists:', !!token);
        console.log('[Dashboard] Token source:', token ? (localStorage.getItem('accessToken') ? 'localStorage' : 'sessionStorage') : 'none');

        if (!token) {
            console.error('[Dashboard] No access token found in localStorage or sessionStorage');
            showError('Please log in to view statistics');
            return;
        }

        // Fetch products to calculate stats
        console.log('[Dashboard] Fetching products...');
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/products?limit=10000`);
        
        // Also fetch purchases
        console.log('[Dashboard] Fetching purchases...');
        const purchasesResponse = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases`);

        // Also fetch sales for profit stats
        console.log('[Dashboard] Fetching sales...');
        const salesResponse = await authenticatedFetch(`${window.API_BASE}/api/admin/sales`);

        console.log('[Dashboard] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Dashboard] Request failed:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Dashboard] Received data:', data ? 'yes' : 'no', 'products:', data?.products?.length);

        if (data.products) {
            const products = data.products;
            const total = data.total || products.length;
            
            // Calculate statistics
            const stats = {
                totalProducts: total,
                byStatus: {},
                byPartType: {},
                byGeneration: {},
                withWarranty: 0,
                recentProducts: 0, // Products added in last 7 days
                withTracking: 0
            };
            
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            products.forEach(product => {
                // Count by status
                const status = product.status || 'unknown';
                stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
                
                // Count by part type
                const partType = product.part_type || 'unknown';
                stats.byPartType[partType] = (stats.byPartType[partType] || 0) + 1;
                
                // Count by generation
                const generation = product.generation || 'unknown';
                stats.byGeneration[generation] = (stats.byGeneration[generation] || 0) + 1;
                
                // Count with warranty
                if (product.warranty && product.warranty.status === 'active') {
                    stats.withWarranty++;
                }
                
                // Count recent products
                if (product.date_added) {
                    const dateAdded = new Date(product.date_added);
                    if (dateAdded >= sevenDaysAgo) {
                        stats.recentProducts++;
                    }
                }
                
                // Count with tracking
                if (product.tracking_number && product.tracking_number.trim()) {
                    stats.withTracking++;
                }
            });
            
            // Display stats
            displayStats(stats);
        } else {
            console.error('Failed to load products:', data);
            showError('Failed to load statistics: ' + (data.error || 'Unknown error'));
        }
        
        // Process purchase data
        console.log('[Dashboard] Processing purchases data...');
        if (purchasesResponse.ok) {
            const purchasesData = await purchasesResponse.json();
            console.log('[Dashboard] Received purchases:', purchasesData?.purchases?.length);
            
            if (purchasesData.purchases) {
                const purchases = purchasesData.purchases;
                const purchaseStats = {
                    totalPurchases: purchases.length,
                    totalSpent: 0,
                    byStatus: {},
                    byPlatform: {},
                    awaitingDelivery: 0,
                    checkedIn: 0,
                    recentPurchases: []
                };
                
                const now = new Date();
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                
                purchases.forEach(purchase => {
                    // Calculate total spent
                    purchaseStats.totalSpent += (parseFloat(purchase.purchase_price) || 0) * (parseInt(purchase.quantity) || 1);
                    
                    // Count by status
                    const status = purchase.status || 'unknown';
                    purchaseStats.byStatus[status] = (purchaseStats.byStatus[status] || 0) + 1;
                    
                    // Count by platform
                    const platform = purchase.platform || 'unknown';
                    purchaseStats.byPlatform[platform] = (purchaseStats.byPlatform[platform] || 0) + 1;
                    
                    // Count awaiting delivery
                    if (status === 'awaiting_delivery' || status === 'awaiting_despatch') {
                        purchaseStats.awaitingDelivery++;
                    }
                    
                    // Count checked in
                    if (purchase.checked_in === true) {
                        purchaseStats.checkedIn++;
                    }
                    
                    // Collect recent purchases
                    if (purchase.purchase_date) {
                        const purchaseDate = new Date(purchase.purchase_date);
                        if (purchaseDate >= sevenDaysAgo) {
                            purchaseStats.recentPurchases.push(purchase);
                        }
                    }
                });
                
                // Display purchase stats
                displayPurchaseStats(purchaseStats);
            }
        } else {
            console.warn('[Dashboard] Failed to load purchases:', purchasesResponse.status);
        }

        // Process sales data for profit stats
        console.log('[Dashboard] Processing sales data...');
        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            const sales = salesData.sales || [];
            console.log('[Dashboard] Received sales:', sales.length);

            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            let monthlyProfit = 0;
            let monthlyRevenue = 0;
            let monthlySalesCount = 0;
            let totalProfit = 0;

            sales.forEach(sale => {
                const profit = parseFloat(sale.profit) || 0;
                const revenue = parseFloat(sale.sale_price) || 0;
                totalProfit += profit;

                if (sale.sale_date) {
                    const saleDate = new Date(sale.sale_date);
                    if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
                        monthlyProfit += profit;
                        monthlyRevenue += revenue;
                        monthlySalesCount++;
                    }
                }
            });

            displaySalesStats({ monthlyProfit, monthlyRevenue, monthlySalesCount, totalProfit });
        } else {
            console.warn('[Dashboard] Failed to load sales:', salesResponse.status);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showError('Error loading statistics: ' + error.message);
    }
}

function displayStats(stats) {
    // Update total products
    const totalEl = document.getElementById('statTotalProducts');
    if (totalEl) {
        totalEl.textContent = stats.totalProducts.toLocaleString();
    }
    
    // Update recent products
    const recentEl = document.getElementById('statRecentProducts');
    if (recentEl) {
        recentEl.textContent = stats.recentProducts.toLocaleString();
    }
    
    // Update with warranty
    const warrantyEl = document.getElementById('statWithWarranty');
    if (warrantyEl) {
        warrantyEl.textContent = stats.withWarranty.toLocaleString();
    }
    
    // Update with tracking
    const trackingEl = document.getElementById('statWithTracking');
    if (trackingEl) {
        trackingEl.textContent = stats.withTracking.toLocaleString();
    }
    
    // Display status breakdown
    const statusContainer = document.getElementById('statusBreakdown');
    if (statusContainer) {
        statusContainer.innerHTML = '';
        const statuses = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
        if (statuses.length === 0) {
            statusContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">No data available</div>';
        } else {
            statuses.forEach(([status, count]) => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `
                    <span class="stat-label">${formatStatus(status)}</span>
                    <span class="stat-value">${count.toLocaleString()}</span>
                `;
                statusContainer.appendChild(item);
            });
        }
    }
    
    // Display part type breakdown
    const partTypeContainer = document.getElementById('partTypeBreakdown');
    if (partTypeContainer) {
        partTypeContainer.innerHTML = '';
        const partTypes = Object.entries(stats.byPartType).sort((a, b) => b[1] - a[1]);
        if (partTypes.length === 0) {
            partTypeContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">No data available</div>';
        } else {
            partTypes.forEach(([type, count]) => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `
                    <span class="stat-label">${formatPartType(type)}</span>
                    <span class="stat-value">${count.toLocaleString()}</span>
                `;
                partTypeContainer.appendChild(item);
            });
        }
    }
    
    // Display generation breakdown
    const generationContainer = document.getElementById('generationBreakdown');
    if (generationContainer) {
        generationContainer.innerHTML = '';
        const generations = Object.entries(stats.byGeneration).sort((a, b) => b[1] - a[1]);
        if (generations.length === 0) {
            generationContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">No data available</div>';
        } else {
            generations.forEach(([gen, count]) => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `
                    <span class="stat-label">${gen}</span>
                    <span class="stat-value">${count.toLocaleString()}</span>
                `;
                generationContainer.appendChild(item);
            });
        }
    }
}

function displayPurchaseStats(stats) {
    // Update total purchases
    const totalPurchasesEl = document.getElementById('statTotalPurchases');
    if (totalPurchasesEl) {
        totalPurchasesEl.textContent = stats.totalPurchases.toLocaleString();
    }
    
    // Update total spent
    const totalSpentEl = document.getElementById('statTotalSpent');
    if (totalSpentEl) {
        totalSpentEl.textContent = '£' + stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // Update awaiting delivery
    const awaitingDeliveryEl = document.getElementById('statAwaitingDelivery');
    if (awaitingDeliveryEl) {
        awaitingDeliveryEl.textContent = stats.awaitingDelivery.toLocaleString();
    }
    
    // Update checked in
    const checkedInEl = document.getElementById('statCheckedIn');
    if (checkedInEl) {
        checkedInEl.textContent = stats.checkedIn.toLocaleString();
    }
    
    // Display purchase status breakdown
    const statusContainer = document.getElementById('purchaseStatusBreakdown');
    if (statusContainer) {
        statusContainer.innerHTML = '';
        const statuses = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
        if (statuses.length === 0) {
            statusContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">No data available</div>';
        } else {
            statuses.forEach(([status, count]) => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `
                    <span class="stat-label">${formatPurchaseStatus(status)}</span>
                    <span class="stat-value">${count.toLocaleString()}</span>
                `;
                statusContainer.appendChild(item);
            });
        }
    }
    
    // Display platform breakdown
    const platformContainer = document.getElementById('purchasePlatformBreakdown');
    if (platformContainer) {
        platformContainer.innerHTML = '';
        const platforms = Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]);
        if (platforms.length === 0) {
            platformContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">No data available</div>';
        } else {
            platforms.forEach(([platform, count]) => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `
                    <span class="stat-label">${formatPlatform(platform)}</span>
                    <span class="stat-value">${count.toLocaleString()}</span>
                `;
                platformContainer.appendChild(item);
            });
        }
    }
    
    // Display recent purchases
    const recentPurchasesContainer = document.getElementById('recentPurchasesList');
    if (recentPurchasesContainer) {
        recentPurchasesContainer.innerHTML = '';
        if (stats.recentPurchases.length === 0) {
            recentPurchasesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280;">No recent purchases</div>';
        } else {
            stats.recentPurchases.slice(0, 5).forEach(purchase => {
                const purchaseDate = new Date(purchase.purchase_date).toLocaleDateString('en-GB', { 
                    day: 'numeric', month: 'short' 
                });
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `
                    <span class="stat-label">${escapeHtml(purchase.generation)} - £${parseFloat(purchase.purchase_price).toFixed(2)}</span>
                    <span class="stat-value" style="font-size: 0.85rem; color: #6b7280;">${purchaseDate}</span>
                `;
                recentPurchasesContainer.appendChild(item);
            });
        }
    }
}

function displaySalesStats(stats) {
    const formatCurrency = (value) => {
        const prefix = value < 0 ? '-£' : '£';
        return prefix + Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const monthlyProfitEl = document.getElementById('statMonthlyProfit');
    if (monthlyProfitEl) {
        monthlyProfitEl.textContent = formatCurrency(stats.monthlyProfit);
        monthlyProfitEl.style.color = stats.monthlyProfit >= 0 ? '#10b981' : '#ef4444';
    }

    const monthlyRevenueEl = document.getElementById('statMonthlyRevenue');
    if (monthlyRevenueEl) {
        monthlyRevenueEl.textContent = formatCurrency(stats.monthlyRevenue);
    }

    const monthlySalesCountEl = document.getElementById('statMonthlySalesCount');
    if (monthlySalesCountEl) {
        monthlySalesCountEl.textContent = stats.monthlySalesCount.toLocaleString();
    }

    const totalProfitEl = document.getElementById('statTotalProfit');
    if (totalProfitEl) {
        totalProfitEl.textContent = formatCurrency(stats.totalProfit);
        totalProfitEl.style.color = stats.totalProfit >= 0 ? '#10b981' : '#ef4444';
    }
}

function formatPurchaseStatus(status) {
    const statusMap = {
        'paid': 'Paid',
        'awaiting_despatch': 'Awaiting Despatch',
        'awaiting_delivery': 'Awaiting Delivery',
        'delivered': 'Delivered',
        'awaiting_return': 'Awaiting Return',
        'returned': 'Returned',
        'refunded': 'Refunded',
        'unknown': 'Unknown'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function formatPlatform(platform) {
    const platformMap = {
        'ebay': 'eBay',
        'vinted': 'Vinted',
        'facebook': 'Facebook Marketplace',
        'other': 'Other',
        'unknown': 'Unknown'
    };
    return platformMap[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'in_stock': 'In Stock',
        'sold': 'Sold',
        'shipped': 'Shipped',
        'delivered': 'Delivered',
        'returned': 'Returned',
        'delivered_no_warranty': 'Delivered (No Warranty)',
        'unknown': 'Unknown'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function formatPartType(type) {
    const typeMap = {
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'case': 'Case',
        'unknown': 'Unknown'
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function showError(message) {
    const errorEl = document.getElementById('statsError');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        errorEl.classList.add('show');
    }
    console.error('Dashboard Stats Error:', message);
}

// Initialize when page loads - wait a bit for auth to be checked
function initDashboardStats() {
    // Wait for admin.js to initialize and check auth
    setTimeout(() => {
        loadDashboardStats();
    }, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardStats);
} else {
    initDashboardStats();
}

