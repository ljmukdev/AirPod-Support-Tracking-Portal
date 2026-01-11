// Tasks page logic
let allTasks = [];
let currentFilter = 'all';
let currentChaseTask = null; // Stores the current delivery chase task when viewing email

// Tracking URL templates for different carriers
const trackingUrls = {
    'royal_mail': 'https://www.royalmail.com/track-your-item#/tracking-results/',
    'dpd': 'https://www.dpd.co.uk/tracking/trackconsignment?reference=',
    'evri': 'https://www.evri.com/track/parcel/',
    'ups': 'https://www.ups.com/track?tracknum=',
    'fedex': 'https://www.fedex.com/fedextrack/?trknbr=',
    'dhl': 'https://www.dhl.com/gb-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=',
    'yodel': 'https://www.yodel.co.uk/track/',
    'amazon_logistics': 'https://track.amazon.co.uk/tracking/'
};

// Get tracking URL for a given provider and tracking number
function getTrackingUrl(trackingProvider, trackingNumber) {
    if (!trackingProvider || !trackingNumber) return null;
    const baseUrl = trackingUrls[trackingProvider];
    if (!baseUrl) return null;
    return baseUrl + encodeURIComponent(trackingNumber);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[TASKS] Initializing tasks page...');
    
    loadTasks();
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            filterAndDisplayTasks();
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('taskSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterAndDisplayTasks();
        });
    }
    
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.toggle('sidebar-open');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    });
    
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        document.querySelector('.admin-sidebar').classList.remove('sidebar-open');
        this.classList.remove('active');
    });
});

async function loadTasks() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/tasks`);
        
        if (!response.ok) {
            throw new Error('Failed to load tasks');
        }
        
        const data = await response.json();
        
        if (data.success) {
            allTasks = data.tasks || [];
            displaySummary();
            filterAndDisplayTasks();
        } else {
            throw new Error(data.error || 'Failed to load tasks');
        }
    } catch (error) {
        console.error('[TASKS] Error loading:', error);
        document.getElementById('tasksContainer').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <p>Failed to load tasks</p>
                <p style="font-size: 0.9rem;">${error.message}</p>
            </div>
        `;
    }
}

function displaySummary() {
    const overdueCount = allTasks.filter(t => t.is_overdue && !t.completed).length;
    const dueSoonCount = allTasks.filter(t => t.due_soon && !t.is_overdue && !t.completed).length;
    const totalCount = allTasks.filter(t => !t.completed).length;
    const completedCount = allTasks.filter(t => t.completed).length;
    
    // Update stat cards
    const statTotalTasks = document.getElementById('statTotalTasks');
    const statOverdueTasks = document.getElementById('statOverdueTasks');
    const statDueSoonTasks = document.getElementById('statDueSoonTasks');
    const statCompletedTasks = document.getElementById('statCompletedTasks');
    
    if (statTotalTasks) statTotalTasks.textContent = totalCount;
    if (statOverdueTasks) statOverdueTasks.textContent = overdueCount;
    if (statDueSoonTasks) statDueSoonTasks.textContent = dueSoonCount;
    if (statCompletedTasks) statCompletedTasks.textContent = completedCount;
}

function filterAndDisplayTasks() {
    let filteredTasks = allTasks.filter(t => !t.completed);

    // Apply filter tabs
    if (currentFilter === 'overdue') {
        filteredTasks = filteredTasks.filter(t => t.is_overdue);
    } else if (currentFilter === 'workflow') {
        filteredTasks = filteredTasks.filter(t => t.type.includes('workflow'));
    } else if (currentFilter === 'delivery') {
        filteredTasks = filteredTasks.filter(t => t.type === 'delivery_overdue' || t.type === 'delivery_chase_followup');
    }

    // Apply search filter
    const searchInput = document.getElementById('taskSearchInput');
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filteredTasks = filteredTasks.filter(task => {
            return (
                task.title.toLowerCase().includes(searchTerm) ||
                task.description.toLowerCase().includes(searchTerm) ||
                (task.tracking_number && task.tracking_number.toLowerCase().includes(searchTerm)) ||
                (task.seller && task.seller.toLowerCase().includes(searchTerm)) ||
                (task.order_number && task.order_number.toLowerCase().includes(searchTerm))
            );
        });
    }

    // Filter to show only one task per seller (most urgent first)
    // This ensures workflow progression - complete one task to reveal the next
    filteredTasks = filterOneTaskPerSeller(filteredTasks);

    displayTasks(filteredTasks);
}

// Filter tasks to show only one per seller, prioritizing the most urgent
function filterOneTaskPerSeller(tasks) {
    // Define task type priority (lower number = higher priority/should be done first)
    const taskTypePriority = {
        'delivery_overdue': 1,
        'delivery_chase_followup': 2,
        'workflow_follow_up': 3,
        'workflow_case_open': 4,
        'leave_feedback': 5,
        'check_in_ready_to_split': 6,
        'refund_verification': 7,
        'product_missing_info': 10,
        'consumable_reorder': 11,
        'consumable_delivery': 12,
        'consumable_stock_check': 13
    };

    // Group tasks by seller
    const tasksBySeller = {};
    const tasksWithoutSeller = [];

    for (const task of tasks) {
        const seller = task.seller ? task.seller.toLowerCase().trim() : null;

        if (!seller) {
            // Tasks without a seller (consumables, products) are shown independently
            tasksWithoutSeller.push(task);
            continue;
        }

        if (!tasksBySeller[seller]) {
            tasksBySeller[seller] = [];
        }
        tasksBySeller[seller].push(task);
    }

    // For each seller, pick only the most urgent task
    const result = [];

    for (const seller in tasksBySeller) {
        const sellerTasks = tasksBySeller[seller];

        // Sort by: 1) overdue first, 2) task type priority, 3) due date
        sellerTasks.sort((a, b) => {
            // Overdue tasks come first
            if (a.is_overdue && !b.is_overdue) return -1;
            if (!a.is_overdue && b.is_overdue) return 1;

            // Then by task type priority (workflow tasks before feedback, etc.)
            const priorityA = taskTypePriority[a.type] || 100;
            const priorityB = taskTypePriority[b.type] || 100;
            if (priorityA !== priorityB) return priorityA - priorityB;

            // Then by due date
            return new Date(a.due_date) - new Date(b.due_date);
        });

        // Take only the first (most urgent) task for this seller
        result.push(sellerTasks[0]);
    }

    // Add tasks without sellers (shown independently)
    result.push(...tasksWithoutSeller);

    return result;
}

function displayTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✓</div>
                <h3>No tasks to show</h3>
                <p>You're all caught up!</p>
            </div>
        `;
        return;
    }
    
    // Sort by priority and due date
    tasks.sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return new Date(a.due_date) - new Date(b.due_date);
    });
    
    container.innerHTML = `
        <div class="tasks-grid">
            ${tasks.map(task => renderTaskCard(task)).join('')}
        </div>
    `;
}

function renderTaskCard(task) {
    const cardClass = task.is_overdue ? 'overdue' : (task.due_soon ? 'due-soon' : '');
    const priorityClass = task.is_overdue ? 'overdue' : (task.due_soon ? 'due-soon' : 'normal');
    const priorityLabel = task.is_overdue ? 'Overdue' : (task.due_soon ? 'Due Soon' : 'Normal');
    
    const dueDate = new Date(task.due_date).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let actionButtons = '';
    
    if (task.type.includes('workflow')) {
        actionButtons = `
            <button onclick="viewTaskEmail('${task.id}', '${task.type}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Email
            </button>
            <button onclick="markTaskComplete('${task.id}', '${task.type}')" class="button button-primary" style="padding: 10px 16px; font-size: 0.9rem;">
                Mark Done
            </button>
            <button onclick="openResolutionModal('${task.check_in_id}')" class="button" style="background: #10b981; color: white; padding: 10px 16px; font-size: 0.9rem;">
                Mark Resolved
            </button>
        `;
    } else if (task.type === 'delivery_overdue') {
        actionButtons = `
            <button onclick="viewTaskEmail('${task.id}', '${task.type}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Email
            </button>
            <button onclick="openUpdateDeliveryModal('${task.purchase_id}', '${task.expected_delivery_formatted || ''}')" class="button" style="background: #f59e0b; color: white; padding: 10px 16px; font-size: 0.9rem;">
                Update Date
            </button>
            <button onclick="viewPurchase('${task.purchase_id}')" class="button" style="background: #6b7280; color: white; padding: 10px 16px; font-size: 0.9rem;">
                View Purchase
            </button>
        `;
    } else if (task.type === 'delivery_chase_followup') {
        actionButtons = `
            <button onclick="viewTaskEmail('${task.id}', '${task.type}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Email
            </button>
            <button onclick="openUpdateDeliveryModal('${task.purchase_id}', '${task.expected_delivery_formatted || ''}')" class="button" style="background: #f59e0b; color: white; padding: 10px 16px; font-size: 0.9rem;">
                Update Date
            </button>
            <button onclick="viewPurchase('${task.purchase_id}')" class="button" style="background: #6b7280; color: white; padding: 10px 16px; font-size: 0.9rem;">
                View Purchase
            </button>
        `;
    } else if (task.type === 'product_missing_info') {
        actionButtons = `
            <button onclick="editProduct('${task.product_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem;">
                Edit Product
            </button>
            <button onclick="markTaskDone('${task.id}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                Mark Done
            </button>
        `;
    } else if (task.type === 'check_in_ready_to_split') {
        actionButtons = `
            <button onclick="goToCheckIn('${task.check_in_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem; background: #3b82f6;">
                Split into Products
            </button>
        `;
    } else if (task.type === 'leave_feedback') {
        actionButtons = `
            <button onclick="leaveFeedback('${task.purchase_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem;">
                Leave Feedback
            </button>
        `;
    } else if (task.type === 'consumable_reorder') {
        actionButtons = `
            <button onclick="restockConsumable('${task.consumable_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem;">
                Restock
            </button>
            <button onclick="viewConsumable('${task.consumable_id}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Item
            </button>
        `;
    } else if (task.type === 'consumable_stock_check') {
        actionButtons = `
            <button onclick="checkInConsumable('${task.consumable_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem;">
                Check In
            </button>
            <button onclick="viewConsumable('${task.consumable_id}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Item
            </button>
        `;
    } else if (task.type === 'consumable_delivery') {
        actionButtons = `
            <button onclick="checkInDelivery('${task.consumable_id}', '${task.restock_history_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem; background: #10b981;">
                📦 Check In Delivery
            </button>
            <button onclick="markDeliveryReceived('${task.consumable_id}', '${task.restock_history_id}')" class="button" style="padding: 10px 16px; font-size: 0.9rem; background: #6b7280; color: white;">
                ✓ Already Received
            </button>
            <button onclick="viewConsumable('${task.consumable_id}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Item
            </button>
        `;
    } else if (task.type === 'refund_verification') {
        actionButtons = `
            <button onclick="confirmRefundReceived('${task.purchase_id}', ${task.expected_refund || 0})" class="button" style="padding: 10px 16px; font-size: 0.9rem; background: #10b981;">
                ✓ Refund Received
            </button>
            <button onclick="viewPurchase('${task.purchase_id}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Purchase
            </button>
        `;
    }
    
    return `
        <div class="task-card ${cardClass}">
            <div class="priority-dot ${priorityClass}" title="${priorityLabel}"></div>
            
            <div class="task-title">${escapeHtml(task.title)}</div>
            
            <div class="task-description">
                ${escapeHtml(task.description)}
            </div>
            
            <div class="task-meta" style="margin-top: 16px;">
                <div class="task-meta-row">
                    <svg class="task-meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <strong>Due:</strong> <span>${dueDate}</span>
                </div>
                ${task.tracking_number ? `
                    <div class="task-meta-row">
                        <svg class="task-meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                        </svg>
                        <strong>Tracking:</strong> ${(() => {
                            const trackingUrl = getTrackingUrl(task.tracking_provider, task.tracking_number);
                            if (trackingUrl) {
                                return `<a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;" title="Track with ${task.tracking_provider}">${escapeHtml(task.tracking_number)}</a>`;
                            }
                            return `<span>${escapeHtml(task.tracking_number)}</span>`;
                        })()}
                    </div>
                ` : ''}
                ${task.seller ? `
                    <div class="task-meta-row">
                        <svg class="task-meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        <strong>Seller:</strong> <span>${escapeHtml(task.seller)}</span>
                    </div>
                ` : ''}
                ${task.order_number ? `
                    <div class="task-meta-row">
                        <svg class="task-meta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <strong>Order:</strong> <a href="https://order.ebay.co.uk/ord/show?purchaseOrderId=${encodeURIComponent(task.order_number)}#/" target="_blank" class="order-link" title="View order on eBay">${escapeHtml(task.order_number)}</a>
                    </div>
                ` : ''}
            </div>
            
            <div class="task-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

async function viewTaskEmail(taskId, taskType) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    let emailContent = '';
    let emailTitle = '';
    let showMarkEmailSent = false;

    // Reset current chase task
    currentChaseTask = null;

    if (taskType === 'workflow_follow_up') {
        emailTitle = 'Follow-Up Email';
        emailContent = `Hi,\n\nJust checking you've seen the message below regarding the issue with the item.\n\nHappy to resolve this amicably.\n\nKind regards,\nLJMUK`;
    } else if (taskType === 'workflow_case_open') {
        emailTitle = 'Ready to Open eBay Case';
        emailContent = `eBay Case Information:\n\n`;
        emailContent += `Reason: Item not as described\n`;
        emailContent += `Issue: ${task.issue_summary || 'Functionality issues'}\n\n`;
        emailContent += `You have:\n`;
        emailContent += `1. Sent initial email explaining the issues\n`;
        emailContent += `2. Waited the recommended 48-72 hours\n`;
        emailContent += `3. ${task.follow_up_sent ? 'Sent follow-up message' : 'Attempted to resolve amicably'}\n\n`;
        emailContent += `You can now open an "Item Not As Described" case on eBay with confidence.\n\n`;
        emailContent += `This shows good faith and professionalism, which works in your favor if eBay needs to step in.`;
    } else if (taskType === 'delivery_overdue') {
        emailTitle = 'Chase Overdue Delivery';
        emailContent = `Hi,\n\nI hope you're well.\n\n`;
        emailContent += `I'm writing to follow up on my order (tracking: ${task.tracking_number || 'N/A'}). `;
        emailContent += `The expected delivery date was ${task.expected_delivery_formatted}, `;

        const daysOverdue = task.days_overdue || 0;
        if (daysOverdue === 1) {
            emailContent += `which was yesterday.`;
        } else {
            emailContent += `which was ${daysOverdue} days ago.`;
        }

        emailContent += `\n\nI understand delays can happen, but I wanted to check if you have any update on when I might expect to receive the item?\n\n`;
        emailContent += `If there's been an issue with dispatch or delivery, please let me know so we can work out the best way forward.\n\n`;
        emailContent += `Kind regards,\nLJMUK`;

        // Store task for marking as sent
        currentChaseTask = task;
        showMarkEmailSent = true;
    } else if (taskType === 'delivery_chase_followup') {
        emailTitle = 'Chase Delivery Follow-Up';
        const chaseNumber = (task.chase_count || 0) + 1;

        emailContent = `Hi,\n\nI hope you're well.\n\n`;
        emailContent += `I'm writing to follow up again on my order (tracking: ${task.tracking_number || 'N/A'}). `;
        emailContent += `The expected delivery date was ${task.expected_delivery_formatted}, and it's now ${task.days_overdue || 0} days overdue.\n\n`;
        emailContent += `I sent a message a few days ago but haven't heard back yet. I understand you may be busy, but I would really appreciate an update on the status of this delivery.\n\n`;
        emailContent += `Could you please let me know:\n`;
        emailContent += `- Has the item been dispatched?\n`;
        emailContent += `- Is there a tracking update available?\n`;
        emailContent += `- What is the expected delivery date now?\n\n`;
        emailContent += `If there are any issues, I'm happy to work with you to find a solution.\n\n`;
        emailContent += `Kind regards,\nLJMUK`;

        // Store task for marking as sent
        currentChaseTask = task;
        showMarkEmailSent = true;
    }

    document.getElementById('emailModalTitle').textContent = emailTitle;
    document.getElementById('emailContent').value = emailContent;

    // Show/hide Mark Email Sent button
    const markSentButton = document.getElementById('markEmailSentButton');
    if (markSentButton) {
        markSentButton.style.display = showMarkEmailSent ? 'block' : 'none';
    }

    document.getElementById('emailModal').style.display = 'flex';
}

async function markTaskComplete(taskId, taskType) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    let endpoint = '';
    let confirmMessage = '';
    
    if (taskType === 'workflow_follow_up') {
        endpoint = `/api/admin/check-in/${task.check_in_id}/mark-follow-up-sent`;
        confirmMessage = 'Have you sent the follow-up message?';
    } else if (taskType === 'workflow_case_open') {
        endpoint = `/api/admin/check-in/${task.check_in_id}/mark-case-opened`;
        confirmMessage = 'Have you opened the eBay case?';
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        let body = {};
        if (taskType === 'workflow_case_open') {
            const caseNumber = prompt('Enter eBay case number (optional):');
            body.case_number = caseNumber || null;
        }
        
        const response = await authenticatedFetch(`${window.API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update task');
        }
        
        alert('Task marked as complete!');
        loadTasks(); // Reload tasks
    } catch (error) {
        console.error('[TASKS] Error:', error);
        alert('Error: ' + error.message);
    }
}

function viewPurchase(purchaseId) {
    window.location.href = `edit-purchase.html?id=${purchaseId}`;
}

function editProduct(productId) {
    window.location.href = `add-product.html?edit=${productId}`;
}

function goToCheckIn(checkInId) {
    window.location.href = `check-in-detail.html?id=${checkInId}`;
}

async function markTaskDone(taskId) {
    if (!confirm('Mark this task as complete?')) {
        return;
    }
    
    // For now, just reload the page - the task will disappear once the product has the required info
    alert('Task marked as done. Please ensure you have added all required information to the product.');
    location.reload();
}

function leaveFeedback(purchaseId) {
    window.location.href = `edit-purchase.html?id=${purchaseId}#feedback`;
}

function viewConsumable(consumableId) {
    window.location.href = `edit-consumable.html?id=${consumableId}`;
}

async function restockConsumable(consumableId) {
    console.log('[TASKS] Opening restock modal for:', consumableId);
    
    try {
        // Fetch full consumable details
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables/${consumableId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load consumable details');
        }
        
        const data = await response.json();
        
        if (!data.success || !data.consumable) {
            throw new Error('Consumable not found');
        }
        
        const consumable = data.consumable;
        
        // Show restock modal
        showRestockModal(consumable);
    } catch (error) {
        console.error('[TASKS] Error loading consumable:', error);
        alert('Error: ' + error.message);
    }
}

function showRestockModal(consumable) {
    const modal = document.getElementById('restockModal');
    if (!modal) {
        console.error('[TASKS] Restock modal not found');
        return;
    }
    
    // Populate modal content
    document.getElementById('restockItemName').textContent = consumable.item_name || 'Unknown Item';
    document.getElementById('restockCurrentStock').textContent = `${consumable.quantity_in_stock || 0} ${consumable.unit_type || 'units'}`;
    document.getElementById('restockReorderLevel').textContent = `${consumable.reorder_level || 0} ${consumable.unit_type || 'units'}`;
    document.getElementById('restockSupplier').textContent = consumable.supplier || 'Not specified';
    
    // Lead time info
    const leadTimeDays = consumable.lead_time_days || 0;
    const leadTimeInfo = document.getElementById('restockLeadTime');
    if (leadTimeDays > 0) {
        leadTimeInfo.innerHTML = `<strong>${leadTimeDays} days</strong> - Expected arrival: ${getExpectedArrivalDate(leadTimeDays)}`;
    } else {
        leadTimeInfo.innerHTML = '<span style="color: #6b7280;">Not specified</span>';
    }
    
    // Purchase link
    const purchaseLinkContainer = document.getElementById('restockPurchaseLink');
    if (consumable.product_url) {
        purchaseLinkContainer.innerHTML = `
            <a href="${escapeHtml(consumable.product_url)}" target="_blank" class="purchase-link-button">
                🔗 Open Purchase Link
            </a>
            <p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #6b7280; word-break: break-all;">
                ${escapeHtml(consumable.product_url)}
            </p>
        `;
    } else {
        purchaseLinkContainer.innerHTML = '<p style="color: #6b7280;">No purchase link available</p>';
    }
    
    // Store consumable ID for confirmation
    document.getElementById('confirmRestockButton').onclick = () => confirmRestock(consumable);
    
    // Show modal
    modal.style.display = 'flex';
}

function getExpectedArrivalDate(leadTimeDays) {
    const today = new Date();
    const arrivalDate = new Date(today.getTime() + (leadTimeDays * 24 * 60 * 60 * 1000));
    return arrivalDate.toLocaleDateString('en-GB', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
}

function closeRestockModal() {
    document.getElementById('restockModal').style.display = 'none';
}

async function confirmRestock(consumable) {
    const button = document.getElementById('confirmRestockButton');
    const originalText = button.textContent;
    
    button.disabled = true;
    button.textContent = 'Recording...';
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables/${consumable._id}/restock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lead_time_days: consumable.lead_time_days || 0
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to record restock');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Restock recorded!\n\n${data.message}`);
            closeRestockModal();
            // Reload tasks to show the new follow-up task
            loadTasks();
        } else {
            throw new Error(data.error || 'Failed to record restock');
        }
    } catch (error) {
        console.error('[TASKS] Error confirming restock:', error);
        alert('Error: ' + error.message);
        button.disabled = false;
        button.textContent = originalText;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function checkInConsumable(consumableId) {
    window.location.href = `consumables.html?checkInId=${consumableId}`;
}

function checkInDelivery(consumableId, restockHistoryId) {
    // Redirect to consumables page with both IDs to trigger delivery check-in
    window.location.href = `consumables.html?deliveryCheckIn=${consumableId}&restockId=${restockHistoryId}`;
}

async function markDeliveryReceived(consumableId, restockHistoryId) {
    if (!confirm('Mark this delivery as already received?\n\nUse this if you\'ve already manually adjusted the stock.')) {
        return;
    }

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/consumables/${consumableId}/mark-delivery-received`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                restock_history_id: restockHistoryId,
                notes: 'Marked as received from tasks page'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to mark delivery as received');
        }

        alert('✓ Delivery marked as received!');
        loadTasks(); // Reload tasks to remove this one
    } catch (error) {
        console.error('[TASKS] Error marking delivery received:', error);
        alert('Error: ' + error.message);
    }
}

async function confirmRefundReceived(purchaseId, expectedAmount) {
    const actualAmount = prompt(
        `Expected refund: £${expectedAmount ? expectedAmount.toFixed(2) : '0.00'}\n\n` +
        'Enter the ACTUAL refund amount received (£):', 
        expectedAmount ? expectedAmount.toFixed(2) : ''
    );
    
    if (actualAmount === null) {
        return; // User cancelled
    }
    
    const amount = parseFloat(actualAmount);
    if (isNaN(amount) || amount < 0) {
        alert('Please enter a valid refund amount');
        return;
    }
    
    if (!confirm(`Confirm refund of £${amount.toFixed(2)} received?\n\nThis will update the purchase cost and balance sheet.`)) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases/${purchaseId}/confirm-refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refund_amount: amount
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to confirm refund');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Refund confirmed!\n\nPurchase cost has been updated and balance sheet adjusted.');
            loadTasks(); // Reload tasks to remove this one
        } else {
            throw new Error(data.error || 'Failed to confirm refund');
        }
    } catch (error) {
        console.error('[TASKS] Error confirming refund:', error);
        alert('Error: ' + error.message);
    }
}

function viewPurchase(purchaseId) {
    window.location.href = `purchases.html?highlight=${purchaseId}`;
}

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
    currentChaseTask = null;

    // Reset Mark Email Sent button
    const markSentButton = document.getElementById('markEmailSentButton');
    if (markSentButton) {
        markSentButton.style.display = 'none';
        markSentButton.disabled = false;
        markSentButton.textContent = 'Mark Email Sent';
    }
}

async function copyEmail() {
    const emailContent = document.getElementById('emailContent').value;
    const button = document.getElementById('copyEmailButton');

    try {
        await navigator.clipboard.writeText(emailContent);
        button.textContent = '✓ Copied!';

        setTimeout(() => {
            button.textContent = 'Copy Email';
        }, 2000);
    } catch (error) {
        console.error('[EMAIL] Error copying:', error);
        alert('Failed to copy email. Please select and copy manually.');
    }
}

async function markChaseEmailSent() {
    if (!currentChaseTask) {
        alert('No task selected');
        return;
    }

    if (!confirm('Have you sent the chase email to the seller?\n\nThis will mark this task as done and create a follow-up task in 3 days.')) {
        return;
    }

    const emailContent = document.getElementById('emailContent').value;
    const chaseNumber = (currentChaseTask.chase_count || 0) + 1;
    const button = document.getElementById('markEmailSentButton');
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases/${currentChaseTask.purchase_id}/mark-chase-sent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_content: emailContent,
                chase_number: chaseNumber
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to mark chase as sent');
        }

        const data = await response.json();

        if (data.success) {
            const followUpDate = new Date(data.follow_up_due).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
            });

            alert(`Chase email #${chaseNumber} marked as sent!\n\nA follow-up task will appear on ${followUpDate} if no delivery is received.`);
            closeEmailModal();
            loadTasks(); // Reload tasks to reflect changes
        } else {
            throw new Error(data.error || 'Failed to mark chase as sent');
        }
    } catch (error) {
        console.error('[CHASE] Error:', error);
        alert('Error: ' + error.message);
        button.disabled = false;
        button.textContent = originalText;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('emailModal');
    if (e.target === modal) {
        closeEmailModal();
    }
    const deliveryModal = document.getElementById('updateDeliveryModal');
    if (e.target === deliveryModal) {
        closeUpdateDeliveryModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEmailModal();
        closeResolutionModal();
        closeUpdateDeliveryModal();
    }
});

// Update Delivery Date Modal Functions
let currentDeliveryPurchaseId = null;

function openUpdateDeliveryModal(purchaseId, currentDate) {
    currentDeliveryPurchaseId = purchaseId;

    // Display current date
    document.getElementById('currentDeliveryDate').textContent = currentDate || 'Not set';

    // Set default new date to 3 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    document.getElementById('newDeliveryDate').value = defaultDate.toISOString().split('T')[0];

    // Clear the note field
    document.getElementById('deliveryUpdateNote').value = '';

    // Show modal
    document.getElementById('updateDeliveryModal').style.display = 'flex';
}

function closeUpdateDeliveryModal() {
    document.getElementById('updateDeliveryModal').style.display = 'none';
    currentDeliveryPurchaseId = null;
}

async function submitDeliveryUpdate() {
    const newDate = document.getElementById('newDeliveryDate').value;
    const note = document.getElementById('deliveryUpdateNote').value.trim();

    if (!newDate) {
        alert('Please select a new delivery date');
        return;
    }

    if (!note) {
        alert('Please add an update note');
        return;
    }

    const button = document.getElementById('confirmDeliveryUpdateButton');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Updating...';

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/purchases/${currentDeliveryPurchaseId}/update-delivery-date`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                new_expected_delivery: newDate,
                update_note: note
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update delivery date');
        }

        const data = await response.json();

        if (data.success) {
            alert('Delivery date updated successfully!');
            closeUpdateDeliveryModal();
            loadTasks(); // Reload tasks
        } else {
            throw new Error(data.error || 'Failed to update delivery date');
        }
    } catch (error) {
        console.error('[TASKS] Error updating delivery date:', error);
        alert('Error: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Resolution Modal Functions
let currentCheckInId = null;

function openResolutionModal(checkInId) {
    currentCheckInId = checkInId;
    const modal = document.getElementById('resolutionModal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset form
        document.getElementById('resolutionForm').reset();
        document.getElementById('sellerResponseSection').style.display = 'none';
        document.getElementById('refundSection').style.display = 'none';
        document.getElementById('returnTrackingSection').style.display = 'none';
        document.querySelectorAll('.radio-option').forEach(opt => {
            opt.style.borderColor = '#d1d5db';
            opt.style.background = 'white';
        });
        
        // Setup resolution type change handler
        const resolutionTypeSelect = document.getElementById('resolutionType');
        if (resolutionTypeSelect) {
            // Remove any existing listeners by cloning the element
            const newSelect = resolutionTypeSelect.cloneNode(true);
            resolutionTypeSelect.parentNode.replaceChild(newSelect, resolutionTypeSelect);
            
            newSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                const showRefund = ['Partial refund', 'Full refund', 'Seller agreed to full refund', 'Seller agreed to partial refund', 'Seller agreed to return (full refund)', 'Seller agreed to return (partial refund)'].includes(value);
                const showReturn = value.toLowerCase().includes('return');
                
                document.getElementById('refundSection').style.display = showRefund ? 'block' : 'none';
                document.getElementById('returnTrackingSection').style.display = showReturn ? 'block' : 'none';
                
                // Make return tracking required if return is selected
                const returnTrackingInput = document.getElementById('returnTrackingNumber');
                if (returnTrackingInput) {
                    returnTrackingInput.required = showReturn;
                }
                
                // Set default expected date (7 days from now) when return is selected
                if (showReturn) {
                    const expectedDateInput = document.getElementById('expectedReturnDate');
                    if (expectedDateInput && !expectedDateInput.value) {
                        const defaultDate = new Date();
                        defaultDate.setDate(defaultDate.getDate() + 7);
                        expectedDateInput.value = defaultDate.toISOString().split('T')[0];
                    }
                }
            });
        }
    }
}

function closeResolutionModal() {
    const modal = document.getElementById('resolutionModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentCheckInId = null;
}

async function submitResolution() {
    const form = document.getElementById('resolutionForm');

    // Validate required fields
    const resolutionType = document.getElementById('resolutionType').value;
    const sellerCooperative = document.querySelector('input[name="seller_cooperative"]:checked');

    if (!resolutionType) {
        alert('Please select how the issue was resolved');
        return;
    }

    if (!sellerCooperative) {
        alert('Please indicate if the seller was cooperative');
        return;
    }

    // Check if return tracking is required
    const isReturn = resolutionType.toLowerCase().includes('return');
    if (isReturn) {
        const returnTracking = document.getElementById('returnTrackingNumber').value;
        if (!returnTracking || !returnTracking.trim()) {
            alert('Please enter a return tracking number');
            return;
        }
    }

    // Collect form data
    const formData = {
        resolution_type: resolutionType,
        seller_responded: document.getElementById('sellerResponded').checked,
        seller_response_notes: document.getElementById('sellerResponseNotes').value,
        refund_amount: document.getElementById('refundAmount').value || null,
        seller_cooperative: sellerCooperative.value === 'true',
        resolution_notes: document.getElementById('resolutionNotes').value
    };

    // Add return tracking data if this is a return
    if (isReturn) {
        formData.return_tracking = {
            tracking_number: document.getElementById('returnTrackingNumber').value,
            carrier: document.getElementById('returnCarrier').value || null,
            expected_delivery: document.getElementById('expectedReturnDate').value || null,
            notes: document.getElementById('returnNotes').value || null
        };
    }

    console.log('[RESOLUTION] Submitting:', formData);

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${currentCheckInId}/mark-resolved`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save resolution');
        }

        const data = await response.json();

        if (data.success) {
            alert('✓ Resolution recorded successfully!');
            closeResolutionModal();
            loadTasks(); // Reload tasks
        } else {
            throw new Error(data.error || 'Failed to save resolution');
        }
    } catch (error) {
        console.error('[RESOLUTION] Error:', error);
        alert('Error: ' + error.message);
    }
}

// Resolution modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Show/hide seller response notes section
    const sellerRespondedCheckbox = document.getElementById('sellerResponded');
    if (sellerRespondedCheckbox) {
        sellerRespondedCheckbox.addEventListener('change', function() {
            const section = document.getElementById('sellerResponseSection');
            section.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Show/hide refund amount section based on resolution type
    const resolutionTypeSelect = document.getElementById('resolutionType');
    if (resolutionTypeSelect) {
        resolutionTypeSelect.addEventListener('change', function() {
            const refundSection = document.getElementById('refundSection');
            const value = this.value.toLowerCase();
            const showRefund = value.includes('refund') || value.includes('return');
            refundSection.style.display = showRefund ? 'block' : 'none';
        });
    }

    // Style radio buttons when selected
    const radioInputs = document.querySelectorAll('input[name="seller_cooperative"]');
    radioInputs.forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.radio-option').forEach(opt => {
                opt.style.borderColor = '#d1d5db';
                opt.style.background = 'white';
            });
            if (this.checked) {
                const label = this.closest('.radio-option');
                label.style.borderColor = '#10b981';
                label.style.background = '#f0fdf4';
            }
        });
    });

    // Close modal when clicking outside
    const resolutionModal = document.getElementById('resolutionModal');
    if (resolutionModal) {
        resolutionModal.addEventListener('click', function(e) {
            if (e.target === resolutionModal) {
                closeResolutionModal();
            }
        });
    }
});
