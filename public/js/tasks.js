// Tasks page logic
let allTasks = [];
let currentFilter = 'all';

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
    const overdueCount = allTasks.filter(t => t.is_overdue).length;
    const dueSoonCount = allTasks.filter(t => t.due_soon && !t.is_overdue).length;
    const totalCount = allTasks.length;
    
    const summaryHtml = `
        <div class="summary-card urgent">
            <div class="summary-number">${overdueCount}</div>
            <div class="summary-label">Overdue Tasks</div>
        </div>
        <div class="summary-card warning">
            <div class="summary-number">${dueSoonCount}</div>
            <div class="summary-label">Due Soon</div>
        </div>
        <div class="summary-card info">
            <div class="summary-number">${totalCount}</div>
            <div class="summary-label">Total Tasks</div>
        </div>
    `;
    
    document.getElementById('tasksSummary').innerHTML = summaryHtml;
}

function filterAndDisplayTasks() {
    let filteredTasks = allTasks;
    
    if (currentFilter === 'overdue') {
        filteredTasks = allTasks.filter(t => t.is_overdue);
    } else if (currentFilter === 'workflow') {
        filteredTasks = allTasks.filter(t => t.type.includes('workflow'));
    } else if (currentFilter === 'delivery') {
        filteredTasks = allTasks.filter(t => t.type === 'delivery_overdue');
    }
    
    displayTasks(filteredTasks);
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
        `;
    } else if (task.type === 'delivery_overdue') {
        actionButtons = `
            <button onclick="viewTaskEmail('${task.id}', '${task.type}')" class="button button-secondary" style="padding: 10px 16px; font-size: 0.9rem;">
                View Email
            </button>
            <button onclick="viewPurchase('${task.purchase_id}')" class="button" style="background: #6b7280; color: white; padding: 10px 16px; font-size: 0.9rem;">
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
                        <strong>Tracking:</strong> <span>${escapeHtml(task.tracking_number)}</span>
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
    }
    
    document.getElementById('emailModalTitle').textContent = emailTitle;
    document.getElementById('emailContent').value = emailContent;
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

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
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
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeEmailModal();
    }
});
