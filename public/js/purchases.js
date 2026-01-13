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
            '<tr><td colspan="15" style="text-align: center; padding: 20px; color: #dc3545;">Failed to load purchases: ' + error.message + '</td></tr>';
    }
}

function renderPurchases(purchases) {
    const tableBody = document.getElementById('purchasesTable');

    if (purchases.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center; padding: 40px; color: #666;">No purchases found. <a href="add-purchase.html">Add your first purchase</a></td></tr>';
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
        
        // Status badge
        const statusColors = {
            'paid': '#17a2b8',
            'awaiting_despatch': '#ffc107',
            'awaiting_delivery': '#fd7e14',
            'delivered': '#28a745',
            'awaiting_return': '#6c757d',
            'returned': '#dc3545',
            'refunded': '#343a40'
        };
        const statusLabels = {
            'paid': 'Paid',
            'awaiting_despatch': 'Awaiting Despatch',
            'awaiting_delivery': 'Awaiting Delivery',
            'delivered': 'Delivered',
            'awaiting_return': 'Awaiting Return',
            'returned': 'Returned',
            'refunded': 'Refunded'
        };
        const statusColor = statusColors[purchase.status] || '#6c757d';
        const statusLabel = statusLabels[purchase.status] || purchase.status || 'Unknown';
        const statusBadge = `<span style="display: inline-block; padding: 4px 8px; background-color: ${statusColor}; color: white; border-radius: 4px; font-size: 0.85rem;">${escapeHtml(statusLabel)}</span>`;
        
        // Feedback left indicator
        const feedbackIcon = purchase.feedback_left 
            ? '<span style="color: #28a745; font-size: 1.2rem; display: inline-block;" title="Feedback left">✓</span>'
            : '<span style="color: #ccc; font-size: 1rem; display: inline-block;" title="No feedback">—</span>';
        
        // Tracking information
        const trackingProviderLabels = {
            'royal_mail': 'Royal Mail',
            'dpd': 'DPD',
            'evri': 'Evri',
            'ups': 'UPS',
            'fedex': 'FedEx',
            'dhl': 'DHL',
            'yodel': 'Yodel',
            'amazon_logistics': 'Amazon',
            'other': 'Other'
        };
        
        let trackingDisplay = '<span style="color: #999;">—</span>';
        if (purchase.tracking_number && purchase.tracking_provider) {
            const providerLabel = trackingProviderLabels[purchase.tracking_provider] || purchase.tracking_provider;
            trackingDisplay = `<div style="font-size: 0.85rem;"><strong>${escapeHtml(providerLabel)}</strong><br><span style="color: #666;">${escapeHtml(purchase.tracking_number)}</span></div>`;
        } else if (purchase.tracking_number) {
            trackingDisplay = `<div style="font-size: 0.85rem;"><span style="color: #666;">${escapeHtml(purchase.tracking_number)}</span></div>`;
        }
        
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

        // Normalize items_purchased to handle both string array and object array formats
        const rawItems = purchase.items_purchased || [];
        const itemsPurchased = rawItems.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && item.item_type) return item.item_type;
            return null;
        }).filter(Boolean);

        const itemsBadges = itemsPurchased.map(item => {
            const label = itemLabels[item] || item;
            return `<span style="display: inline-block; padding: 3px 6px; background-color: #6c757d; color: white; border-radius: 3px; font-size: 0.75rem; margin: 2px;">${escapeHtml(label)}</span>`;
        }).join('');

        // Edit parts button
        const editPartsBtn = `<button class="edit-parts-btn" onclick="openEditPartsModal('${escapeHtml(String(purchase._id || purchase.id))}', event)" title="Edit parts">Edit</button>`;
        
        // Generation display with connector type for Pro 2nd Gen or ANC type for 4th Gen
        let generationDisplay = escapeHtml(shortenProductName(purchase.generation));
        if (purchase.generation === 'AirPods Pro (2nd Gen)' && purchase.connector_type) {
            const connectorLabel = purchase.connector_type === 'usb-c' ? 'USB-C' : 'Lightning';
            generationDisplay += `<br><span style="font-size: 0.8rem; color: #666;">(${connectorLabel})</span>`;
        } else if (purchase.generation === 'AirPods (4th Gen)' && purchase.anc_type) {
            const ancLabel = purchase.anc_type === 'anc' ? 'ANC' : 'Non-ANC';
            generationDisplay += `<br><span style="font-size: 0.8rem; color: #666;">(${ancLabel})</span>`;
        }

        // Calculate Part Value: price / number of working parts (excluding accessories)
        const workingParts = ['left', 'right', 'case'];
        const workingPartsPerSet = itemsPurchased.filter(item => workingParts.includes(item)).length;
        const quantity = purchase.quantity || 1;
        const totalWorkingParts = workingPartsPerSet * quantity;

        // Calculate effective price (subtract any refunds)
        const refundAmount = purchase.refund_amount || 0;
        const effectivePrice = parseFloat(purchase.purchase_price) - refundAmount;

        let partValueDisplay = '<span style="color: #999;">—</span>';
        if (totalWorkingParts > 0) {
            const partValue = effectivePrice / totalWorkingParts;
            partValueDisplay = `<span style="font-weight: 600; color: #6c757d;">£${partValue.toFixed(2)}</span>`;
        }
        
        // Row styling - grey for refunded, green for verified
        let rowStyle = '';
        if (purchase.refunded) {
            rowStyle = 'background-color: #e9ecef;';
        } else if (purchase.verified) {
            rowStyle = 'background-color: #d4edda;';
        }
        const verifiedIcon = purchase.verified
            ? '<span style="color: #28a745; font-size: 1.2rem; display: inline-block;" title="Verified">✓</span>'
            : '<span style="color: #ccc; font-size: 1rem; display: inline-block;" title="Not verified">—</span>';

        return `
            <tr data-purchase-id="${escapeHtml(String(purchase._id || purchase.id))}" style="${rowStyle}">
                <td>${platformBadge}</td>
                <td>${escapeHtml(purchase.order_number)}</td>
                <td>${escapeHtml(purchase.seller_name)}</td>
                <td>${generationDisplay}</td>
                <td style="line-height: 1.6;">${itemsBadges || '<span style="color: #999;">—</span>'}${editPartsBtn}</td>
                <td style="text-align: center;">${escapeHtml(String(purchase.quantity))}</td>
                <td style="font-weight: 600; color: var(--accent-teal);">£${parseFloat(purchase.purchase_price).toFixed(2)}</td>
                <td>${partValueDisplay}</td>
                <td>${conditionBadge}</td>
                <td>${statusBadge}</td>
                <td>${trackingDisplay}</td>
                <td>${formattedDate}</td>
                <td style="text-align: center;">${feedbackIcon}</td>
                <td style="text-align: center;">${verifiedIcon}</td>
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
            // Build searchable text from purchase fields
            let searchText = (
                (purchase.order_number || '') + ' ' +
                (purchase.seller_name || '') + ' ' +
                (purchase.generation || '')
            ).toLowerCase();

            // Add serial numbers to search if available
            if (purchase.serial_numbers && Array.isArray(purchase.serial_numbers)) {
                searchText += ' ' + purchase.serial_numbers.join(' ').toLowerCase();
            }

            // Also check individual serial number fields if they exist
            if (purchase.serial_number) {
                searchText += ' ' + purchase.serial_number.toLowerCase();
            }

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

// Edit Parts Modal Functions
function openEditPartsModal(purchaseId, event) {
    event.stopPropagation();

    // Find the purchase data
    const purchase = allPurchases.find(p => (p._id || p.id) === purchaseId);
    if (!purchase) {
        console.error('[PURCHASES] Purchase not found:', purchaseId);
        return;
    }

    // Store the purchase ID
    document.getElementById('editPartsPurchaseId').value = purchaseId;

    // Get current items purchased - normalize to handle both string and object formats
    const rawItems = purchase.items_purchased || [];
    const itemsPurchased = rawItems.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.item_type) return item.item_type;
        return null;
    }).filter(Boolean);

    // Reset all checkboxes and set based on current items
    const checkboxMap = {
        'case': 'partCase',
        'left': 'partLeft',
        'right': 'partRight',
        'box': 'partBox',
        'ear_tips': 'partEarTips',
        'cable': 'partCable',
        'protective_case': 'partProtectiveCase'
    };

    Object.entries(checkboxMap).forEach(([item, checkboxId]) => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.checked = itemsPurchased.includes(item);
        }
    });

    // Show the modal
    document.getElementById('editPartsModal').style.display = 'flex';
}

function closeEditPartsModal() {
    document.getElementById('editPartsModal').style.display = 'none';
}

async function savePartsChanges() {
    const purchaseId = document.getElementById('editPartsPurchaseId').value;
    if (!purchaseId) {
        alert('Error: No purchase selected');
        return;
    }

    // Collect selected parts
    const selectedParts = [];
    const checkboxIds = ['partCase', 'partLeft', 'partRight', 'partBox', 'partEarTips', 'partCable', 'partProtectiveCase'];
    const partValues = ['case', 'left', 'right', 'box', 'ear_tips', 'cable', 'protective_case'];

    checkboxIds.forEach((checkboxId, index) => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox && checkbox.checked) {
            selectedParts.push(partValues[index]);
        }
    });

    if (selectedParts.length === 0) {
        alert('Please select at least one part');
        return;
    }

    try {
        // Send update request to API
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases/${encodeURIComponent(purchaseId)}/parts`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ items_purchased: selectedParts })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Close the modal
            closeEditPartsModal();

            // Reload purchases to show updated data
            await loadPurchases();
        } else {
            alert(data.error || 'Failed to update parts');
        }
    } catch (error) {
        console.error('[PURCHASES] Error updating parts:', error);
        alert('Network error. Please try again.');
    }
}
