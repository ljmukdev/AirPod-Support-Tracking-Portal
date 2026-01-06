// Purchases Management - Frontend Logic
console.log('[PURCHASES] Script loaded - v1.0.6');

// Use window.API_BASE directly to avoid conflicts
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
console.log('[PURCHASES] API_BASE:', window.API_BASE);

let allPurchases = [];

// Initialize function
function initializePurchases() {
    console.log('[PURCHASES] Initializing purchases page...');
    
    // Check if authenticatedFetch is available
    if (typeof authenticatedFetch !== 'function') {
        console.error('[PURCHASES] authenticatedFetch is not available yet, retrying...');
        // Retry after a short delay
        setTimeout(initializePurchases, 100);
        return;
    }
    
    console.log('[PURCHASES] authenticatedFetch is available, loading purchases...');
    loadPurchases();
    attachEventListeners();
}

// Load purchases on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('[PURCHASES] DOMContentLoaded fired');
    initializePurchases();
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    console.log('[PURCHASES] Document still loading, waiting for DOMContentLoaded...');
} else {
    console.log('[PURCHASES] Document already loaded, initializing immediately...');
    initializePurchases();
}

async function loadPurchases() {
    console.log('[PURCHASES] Loading purchases from API...');
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases`, {
            credentials: 'include'
        });
        
        console.log('[PURCHASES] Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('[PURCHASES] Unauthorized - redirecting to login');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Failed to load purchases - status: ' + response.status);
        }
        
        const data = await response.json();
        console.log('[PURCHASES] Received data:', data);
        allPurchases = data.purchases || [];
        console.log('[PURCHASES] Total purchases:', allPurchases.length);
        
        renderPurchases(allPurchases);
        updateStats();
    } catch (error) {
        console.error('[PURCHASES] Error loading purchases:', error);
        document.getElementById('purchasesTable').innerHTML = 
            '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #dc3545;">Failed to load purchases: ' + error.message + '</td></tr>';
    }
}

function renderPurchases(purchases) {
    const tableBody = document.getElementById('purchasesTable');
    
    if (purchases.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #666;">No purchases found. <a href="add-purchase.html">Add your first purchase</a></td></tr>';
        return;
    }
    
    tableBody.innerHTML = purchases.map(purchase => {
        const purchaseDate = new Date(purchase.purchase_date);
        const formattedDate = purchaseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Platform badge
        const platformColors = {
            'ebay': '#0064D2',
            'vinted': '#09B1BA',
            'facebook': '#1877F2',
            'other': '#666'
        };
        const platformColor = platformColors[purchase.platform] || platformColors.other;
        const platformBadge = `<span style="display: inline-block; padding: 4px 8px; background-color: ${platformColor}; color: white; border-radius: 4px; font-size: 0.85rem; font-weight: 500; text-transform: uppercase;">${escapeHtml(purchase.platform)}</span>`;
        
        // Condition badge
        const conditionColors = {
            'new': '#28a745',
            'like_new': '#17a2b8',
            'excellent': '#20c997',
            'good': '#ffc107',
            'fair': '#fd7e14',
            'for_parts': '#dc3545'
        };
        const conditionLabels = {
            'new': 'New',
            'like_new': 'Like New',
            'excellent': 'Excellent',
            'good': 'Good',
            'fair': 'Fair',
            'for_parts': 'For Parts'
        };
        const conditionColor = conditionColors[purchase.condition] || '#666';
        const conditionLabel = conditionLabels[purchase.condition] || purchase.condition;
        const conditionBadge = `<span style="display: inline-block; padding: 4px 8px; background-color: ${conditionColor}; color: white; border-radius: 4px; font-size: 0.85rem;">${escapeHtml(conditionLabel)}</span>`;
        
        // Items purchased badges
        const itemLabels = {
            'case': 'Case',
            'left': 'Left',
            'right': 'Right',
            'box': 'Box',
            'ear_tips': 'Ear Tips',
            'cable': 'Cable',
            'protective_case': 'Protective Case'
        };
        
        const itemsPurchased = purchase.items_purchased || [];
        const itemsBadges = itemsPurchased.map(item => {
            const label = itemLabels[item] || item;
            return `<span style="display: inline-block; padding: 3px 6px; background-color: #6c757d; color: white; border-radius: 3px; font-size: 0.75rem; margin: 2px;">${escapeHtml(label)}</span>`;
        }).join('');
        
        return `
            <tr data-purchase-id="${escapeHtml(String(purchase._id || purchase.id))}">
                <td>${platformBadge}</td>
                <td>${escapeHtml(purchase.order_number)}</td>
                <td>${escapeHtml(purchase.seller_name)}</td>
                <td>${escapeHtml(shortenProductName(purchase.generation))}</td>
                <td style="line-height: 1.6;">${itemsBadges || '<span style="color: #999;">—</span>'}</td>
                <td style="text-align: center;">${escapeHtml(String(purchase.quantity))}</td>
                <td style="font-weight: 600; color: var(--accent-teal);">£${parseFloat(purchase.purchase_price).toFixed(2)}</td>
                <td>${conditionBadge}</td>
                <td>${formattedDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="edit-button" onclick="editPurchase('${escapeHtml(String(purchase._id || purchase.id))}')">
                            Edit
                        </button>
                        <button class="delete-button" onclick="deletePurchase('${escapeHtml(String(purchase._id || purchase.id))}')">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    // Update count
    const count = allPurchases.length;
    document.getElementById('purchasesCount').textContent = `${count} purchase${count !== 1 ? 's' : ''}`;
    
    // Calculate total spent
    const totalSpent = allPurchases.reduce((sum, purchase) => {
        return sum + (parseFloat(purchase.purchase_price) * parseInt(purchase.quantity));
    }, 0);
    
    document.getElementById('totalSpent').textContent = `£${totalSpent.toFixed(2)}`;
}

function attachEventListeners() {
    // Search
    const searchInput = document.getElementById('searchPurchases');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            filterPurchases();
        }, 300));
    }
    
    // Filters
    const filterPlatform = document.getElementById('filterPlatform');
    const filterGeneration = document.getElementById('filterGeneration');
    
    if (filterPlatform) {
        filterPlatform.addEventListener('change', filterPurchases);
    }
    if (filterGeneration) {
        filterGeneration.addEventListener('change', filterPurchases);
    }
    
    // Clear filters
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            if (searchInput) searchInput.value = '';
            if (filterPlatform) filterPlatform.value = '';
            if (filterGeneration) filterGeneration.value = '';
            renderPurchases(allPurchases);
            updateStats();
        });
    }
}

function filterPurchases() {
    const searchTerm = document.getElementById('searchPurchases')?.value.toLowerCase() || '';
    const platformFilter = document.getElementById('filterPlatform')?.value || '';
    const generationFilter = document.getElementById('filterGeneration')?.value || '';
    
    const filtered = allPurchases.filter(purchase => {
        // Search filter
        if (searchTerm) {
            const searchText = (
                (purchase.order_number || '') + ' ' +
                (purchase.seller_name || '') + ' ' +
                (purchase.generation || '')
            ).toLowerCase();
            
            if (!searchText.includes(searchTerm)) {
                return false;
            }
        }
        
        // Platform filter
        if (platformFilter && purchase.platform !== platformFilter) {
            return false;
        }
        
        // Generation filter
        if (generationFilter && purchase.generation !== generationFilter) {
            return false;
        }
        
        return true;
    });
    
    renderPurchases(filtered);
    
    // Update count with filtered results
    const count = filtered.length;
    document.getElementById('purchasesCount').textContent = `${count} purchase${count !== 1 ? 's' : ''}`;
    
    // Calculate total for filtered results
    const totalSpent = filtered.reduce((sum, purchase) => {
        return sum + (parseFloat(purchase.purchase_price) * parseInt(purchase.quantity));
    }, 0);
    document.getElementById('totalSpent').textContent = `£${totalSpent.toFixed(2)}`;
}

async function editPurchase(id) {
    // Redirect to edit page with purchase ID
    window.location.href = `edit-purchase.html?id=${encodeURIComponent(id)}`;
}

async function deletePurchase(id) {
    if (!confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Reload purchases
            await loadPurchases();
        } else {
            alert(data.error || 'Failed to delete purchase');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Network error. Please try again.');
    }
}

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

// Helper function to shorten product names for table display
function shortenProductName(generation) {
    if (!generation) return '';
    
    let shortened = generation;
    
    // Remove "AirPods" and extra parentheses
    shortened = shortened.replace(/AirPods\s*/gi, '');
    shortened = shortened.replace(/^\(|\)$/g, '');
    
    // Handle Pro models
    if (shortened.includes('Pro')) {
        // "Pro (1st Gen)" → "Pro Gen1"
        shortened = shortened.replace(/Pro\s*\((\d+)(?:st|nd|rd|th)\s*Gen\)/i, 'Pro Gen$1');
    } else {
        // Regular AirPods - abbreviate generation
        // "(1st Gen)" → "Gen1"
        shortened = shortened.replace(/\((\d+)(?:st|nd|rd|th)\s*Gen\)/i, 'Gen$1');
        // "1st Gen" → "Gen1"
        shortened = shortened.replace(/(\d+)(?:st|nd|rd|th)\s*Gen/i, 'Gen$1');
    }
    
    // Handle 4th Gen special cases
    // "standard line (ANC version)" → "ANC"
    shortened = shortened.replace(/standard line\s*\(ANC version\)/i, 'ANC');
    // "standard line (non-Pro)" → remove it (no need to mention)
    shortened = shortened.replace(/standard line\s*\(non-Pro\)/i, '');
    
    // Clean up extra spaces and parentheses
    shortened = shortened.replace(/\s+/g, ' ').trim();
    shortened = shortened.replace(/^\(|\)$/g, '').trim();
    
    return shortened;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
