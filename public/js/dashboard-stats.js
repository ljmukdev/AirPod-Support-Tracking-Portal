// Dashboard Stats Loader - Fetches and displays statistics

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Reference the global API_BASE
const API_BASE = window.API_BASE;

// Load and display dashboard statistics
async function loadDashboardStats() {
    try {
        // Check if we're authenticated first
        const authCheck = await fetch(`${API_BASE}/api/admin/check-auth`);
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            console.error('Not authenticated');
            showError('Please log in to view statistics');
            return;
        }
        
        // Fetch products to calculate stats
        const response = await fetch(`${API_BASE}/api/admin/products?limit=10000`, {
            credentials: 'include' // Include cookies for authentication
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
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

