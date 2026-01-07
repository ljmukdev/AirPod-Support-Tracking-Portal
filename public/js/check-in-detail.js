// Get check-in ID from URL
const urlParams = new URLSearchParams(window.location.search);
const checkInId = urlParams.get('id');

let checkInData = null;
let purchaseData = null;
let emailTemplate = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CHECK-IN-DETAIL] Loading check-in:', checkInId);
    
    if (!checkInId) {
        showError('No check-in ID provided');
        return;
    }
    
    loadCheckInDetails();
    
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

async function loadCheckInDetails() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}`);
        
        if (!response.ok) {
            throw new Error('Failed to load check-in details');
        }
        
        const data = await response.json();
        
        if (data.success) {
            checkInData = data.check_in;
            purchaseData = data.purchase;
            emailTemplate = data.email_template || null;
            displayCheckInDetails();
        } else {
            showError(data.error || 'Failed to load check-in');
        }
    } catch (error) {
        console.error('[CHECK-IN-DETAIL] Error:', error);
        showError('Error loading check-in details: ' + error.message);
    }
}

function displayCheckInDetails() {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('detailsContainer').style.display = 'block';
    
    // Purchase info
    document.getElementById('trackingNumber').textContent = checkInData.tracking_number || 'N/A';
    document.getElementById('platform').textContent = purchaseData.platform || 'N/A';
    document.getElementById('seller').textContent = purchaseData.seller_name || 'N/A';
    document.getElementById('generation').textContent = purchaseData.generation || 'N/A';
    document.getElementById('price').textContent = purchaseData.purchase_price ? `£${purchaseData.purchase_price.toFixed(2)}` : 'N/A';
    
    const checkedInDate = new Date(checkInData.checked_in_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('checkedInDate').textContent = checkedInDate;
    document.getElementById('checkedBy').textContent = checkInData.checked_in_by || 'N/A';
    
    // Overall status
    const hasIssues = checkInData.has_issues || (checkInData.issues_detected && checkInData.issues_detected.length > 0);
    const statusHtml = hasIssues 
        ? `<span class="issue-badge issue-critical">⚠ Issues Found</span>`
        : `<span class="issue-badge no-issues-badge">✓ No Issues</span>`;
    document.getElementById('overallStatus').innerHTML = statusHtml;
    
    // Display items
    displayItems();
    
    // Display split section
    displaySplitSection();
}

function displayItems() {
    const container = document.getElementById('itemsContainer');
    const items = checkInData.items || [];
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No items found</p>';
        return;
    }
    
    container.innerHTML = items.map(item => {
        const itemName = getItemDisplayName(item.item_type);
        const hasIssues = checkInData.issues_detected && checkInData.issues_detected.some(i => i.item_type === item.item_type);
        const itemIssues = hasIssues ? checkInData.issues_detected.find(i => i.item_type === item.item_type).issues : [];
        
        let issuesBadges = '';
        if (itemIssues.length > 0) {
            issuesBadges = itemIssues.map(issue => {
                const badgeClass = issue.severity === 'critical' ? 'issue-critical' : 
                                  issue.severity === 'high' ? 'issue-high' : 'issue-medium';
                return `<span class="issue-badge ${badgeClass}">${escapeHtml(issue.description)}</span>`;
            }).join('');
        } else {
            issuesBadges = '<span class="issue-badge no-issues-badge">✓ No Issues</span>';
        }
        
        return `
            <div class="item-card">
                <div class="item-header">
                    <span class="item-name">${itemName}</span>
                    <div>${issuesBadges}</div>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Genuine</span>
                        <span class="info-value">${item.is_genuine ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Visual Condition</span>
                        <span class="info-value">${formatCondition(item.condition)}</span>
                    </div>
                    ${item.serial_number ? `
                    <div class="info-item">
                        <span class="info-label">Serial Number</span>
                        <span class="info-value">${escapeHtml(item.serial_number)}</span>
                    </div>
                    ` : ''}
                    ${item.audible_condition ? `
                    <div class="info-item">
                        <span class="info-label">Audible Condition</span>
                        <span class="info-value">${formatCondition(item.audible_condition)}</span>
                    </div>
                    ` : ''}
                    ${item.connects_correctly !== null && item.connects_correctly !== undefined ? `
                    <div class="info-item">
                        <span class="info-label">Connects Correctly</span>
                        <span class="info-value">${item.connects_correctly ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function displaySplitSection() {
    const container = document.getElementById('splitSection');
    const hasIssues = checkInData.has_issues || (checkInData.issues_detected && checkInData.issues_detected.length > 0);
    const alreadySplit = checkInData.split_into_products === true;
    
    if (alreadySplit) {
        // Show workflow section if there are issues and an email was sent
        let workflowHtml = '';
        if (hasIssues && checkInData.email_sent_at) {
            workflowHtml = generateWorkflowHtml();
        }

        container.innerHTML = `
            <div class="detail-card">
                <div class="already-split">
                    <h3 style="margin-top: 0;">✓ Already Split into Products</h3>
                    <p>This check-in has already been split into individual products on ${new Date(checkInData.split_date).toLocaleString('en-GB')}.</p>
                    ${checkInData.products_created ? `<p><strong>${checkInData.products_created}</strong> products were created.</p>` : ''}
                    <button
                        onclick="undoSplit('${checkInData._id}')"
                        class="button"
                        style="margin-top: 16px; background: #ef4444; color: white;">
                        ↶ Undo Split
                    </button>
                    <p style="font-size: 0.875rem; color: #6b7280; margin-top: 8px;">
                        Warning: This will delete the created products and allow you to re-split with correct data.
                    </p>
                </div>
            </div>
            ${workflowHtml}
        `;
        return;
    }
    
    // Get items that can be split (AirPods with serial numbers, or Box/Ear Tips)
    const splittableItems = checkInData.items.filter(item => {
        // AirPods parts need serial numbers
        if (['case', 'left', 'right'].includes(item.item_type)) {
            return item.serial_number;
        }
        // Box and Ear Tips don't need serial numbers
        if (['box', 'ear_tips'].includes(item.item_type)) {
            return true;
        }
        return false;
    });
    
    if (splittableItems.length === 0) {
        container.innerHTML = `
            <div class="detail-card">
                <div class="split-warning">
                    <strong>⚠ No Items to Split</strong>
                    <p>No items found to add to inventory.</p>
                </div>
            </div>
        `;
        return;
    }
    
    let warningHtml = '';
    let emailButtonHtml = '';
    let workflowHtml = '';
    
    if (hasIssues) {
        // Show email sent badge or generate email button
        if (checkInData.email_sent_at) {
            const sentDate = new Date(checkInData.email_sent_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            emailButtonHtml = `
                <div style="margin-bottom: 16px;">
                    <span class="email-sent-badge">
                        ✓ Email Sent to Seller
                        <span style="opacity: 0.7;">• ${sentDate}</span>
                    </span>
                    <button onclick="openEmailModal()" class="button button-secondary" style="margin-left: 10px; padding: 6px 12px; font-size: 0.85rem;">
                        View Email
                    </button>
                </div>
            `;
            
            // Show workflow tracking
            workflowHtml = generateWorkflowHtml();
        } else {
            emailButtonHtml = `
                <div style="margin-bottom: 16px;">
                    <button onclick="openEmailModal()" class="button" style="background: #f59e0b; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 0.95rem; font-weight: 500; cursor: pointer;">
                        📧 Generate Email to Seller
                    </button>
                    <p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #6b7280;">
                        Generate a professional email explaining the issues found during inspection
                    </p>
                </div>
            `;
        }
        
        warningHtml = `
            <div class="split-warning">
                <strong>⚠ Issues Detected</strong>
                <p style="margin: 5px 0 0 0;">Some items have issues. You can choose which items to add to inventory and which to keep for spares/repairs.</p>
            </div>
        `;
    }
    
    // Build item selection list
    const itemsListHtml = splittableItems.map((item, index) => {
        const itemName = getItemDisplayName(item.item_type);
        const hasItemIssues = checkInData.issues_detected && checkInData.issues_detected.some(i => i.item_type === item.item_type);
        const itemIssues = hasItemIssues ? checkInData.issues_detected.find(i => i.item_type === item.item_type).issues : [];
        
        let issuesBadges = '';
        let defaultChecked = true; // Check by default
        
        if (itemIssues.length > 0) {
            issuesBadges = '<div style="margin-top: 5px;">';
            itemIssues.forEach(issue => {
                const badgeClass = issue.severity === 'critical' ? 'issue-critical' : 
                                  issue.severity === 'high' ? 'issue-high' : 'issue-medium';
                issuesBadges += `<span class="issue-badge ${badgeClass}">${escapeHtml(issue.description)}</span>`;
            });
            issuesBadges += '</div>';
            
            // Don't check items with critical issues by default
            if (itemIssues.some(i => i.severity === 'critical')) {
                defaultChecked = false;
            }
        }
        
        const serialInfo = item.serial_number 
            ? `<span style="color: #666; font-size: 0.9rem;">SN: ${escapeHtml(item.serial_number)}</span>`
            : `<span style="color: #9ca3af; font-size: 0.85rem; font-style: italic;">No serial number</span>`;
        
        return `
            <div class="item-select-card">
                <label class="item-select-label">
                    <input type="checkbox" class="item-select-checkbox" data-item-type="${item.item_type}" ${defaultChecked ? 'checked' : ''}>
                    <div class="item-select-info">
                        <div class="item-select-header">
                            <strong>${itemName}</strong>
                            ${serialInfo}
                        </div>
                        <div style="font-size: 0.85rem; color: #666; margin-top: 3px;">
                            Condition: ${formatCondition(item.condition, false)}
                            ${item.audible_condition ? ` | Audible: ${formatCondition(item.audible_condition, false)}` : ''}
                        </div>
                        ${issuesBadges}
                    </div>
                </label>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="detail-card split-section">
            <h3>Split into Products</h3>
            <p>Select which items to add to your inventory. Unchecked items can be kept for spares/repairs or handled separately.</p>
            
            ${warningHtml}
            
            ${emailButtonHtml}
            
            ${workflowHtml}
            
            <div class="items-select-list">
                ${itemsListHtml}
            </div>
            
            <div class="split-actions" style="margin-top: 20px;">
                <label class="checkbox-label">
                    <input type="checkbox" id="confirmSplit">
                    <span>I confirm that I have reviewed the selected items and am ready to add them to inventory</span>
                </label>
            </div>
            
            <div class="split-actions">
                <button class="split-button" id="splitButton" disabled onclick="splitIntoProducts()">
                    <span id="splitButtonText">Add Selected Items to Products</span>
                </button>
            </div>
        </div>
    `;
    
    // Update button text based on selection
    updateSplitButtonText();
    
    // Enable/disable split button based on checkbox
    document.getElementById('confirmSplit').addEventListener('change', function() {
        updateSplitButton();
    });
    
    // Update button when checkboxes change
    document.querySelectorAll('.item-select-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSplitButtonText();
            updateSplitButton();
        });
    });
}

function updateSplitButtonText() {
    const selectedCount = document.querySelectorAll('.item-select-checkbox:checked').length;
    const buttonText = document.getElementById('splitButtonText');
    if (buttonText) {
        if (selectedCount === 0) {
            buttonText.textContent = 'No Items Selected';
        } else if (selectedCount === 1) {
            buttonText.textContent = 'Add 1 Item to Products';
        } else {
            buttonText.textContent = `Add ${selectedCount} Items to Products`;
        }
    }
}

function updateSplitButton() {
    const confirmed = document.getElementById('confirmSplit').checked;
    const selectedCount = document.querySelectorAll('.item-select-checkbox:checked').length;
    const button = document.getElementById('splitButton');
    if (button) {
        button.disabled = !confirmed || selectedCount === 0;
    }
}

async function splitIntoProducts() {
    // Get selected items
    const selectedItems = Array.from(document.querySelectorAll('.item-select-checkbox:checked'))
        .map(cb => cb.dataset.itemType);
    
    if (selectedItems.length === 0) {
        alert('Please select at least one item to add to products.');
        return;
    }
    
    const confirmMsg = selectedItems.length === 1 
        ? `Are you sure you want to add 1 item to products?\n\nThis cannot be undone.`
        : `Are you sure you want to add ${selectedItems.length} items to products?\n\nThis cannot be undone.`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    const button = document.getElementById('splitButton');
    const buttonText = document.getElementById('splitButtonText');
    const originalText = buttonText.textContent;
    button.disabled = true;
    buttonText.textContent = 'Adding to Products...';
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/split`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                selected_items: selectedItems
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add items to products');
        }
        
        const data = await response.json();
        
        if (data.success) {
            const allSplittableCount = checkInData.items.filter(i => {
                if (['case', 'left', 'right'].includes(i.item_type)) {
                    return i.serial_number;
                }
                if (['box', 'ear_tips'].includes(i.item_type)) {
                    return true;
                }
                return false;
            }).length;
            const unselectedCount = allSplittableCount - selectedItems.length;
            
            let message = `Success! Added ${data.products_created} item${data.products_created !== 1 ? 's' : ''} to products.`;
            if (unselectedCount > 0) {
                message += `\n\n${unselectedCount} item${unselectedCount !== 1 ? 's' : ''} not added (kept for spares/repairs).`;
            }
            message += '\n\nYou will now be redirected to the products page.';
            
            alert(message);
            window.location.href = 'products.html';
        } else {
            throw new Error(data.error || 'Failed to add items to products');
        }
    } catch (error) {
        console.error('[CHECK-IN-DETAIL] Error splitting:', error);
        alert('Error: ' + error.message);
        button.disabled = false;
        buttonText.textContent = originalText;
    }
}

function editCheckIn() {
    window.location.href = `edit-check-in.html?id=${checkInId}`;
}

function getItemDisplayName(itemType) {
    const names = {
        'case': 'Case',
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'box': 'Box',
        'ear_tips': 'Ear Tips',
        'cable': 'Cable',
        'protective_case': 'Protective Case'
    };
    return names[itemType] || itemType;
}

function formatCondition(condition, includeHtml = true) {
    if (!condition) return 'N/A';
    
    const formatted = condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (!includeHtml) {
        return formatted;
    }
    
    // Color code based on condition
    const colors = {
        'Like New': '#28a745',
        'Excellent': '#28a745',
        'Good': '#28a745',
        'Fair': '#ffc107',
        'Poor': '#dc3545',
        'Not Working': '#dc3545'
    };
    
    const color = colors[formatted] || '#333';
    return `<span style="color: ${color}; font-weight: 600;">${formatted}</span>`;
}

function showError(message) {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

function generateWorkflowHtml() {
    if (!checkInData.email_sent_at) {
        return '';
    }
    
    const now = new Date();
    const emailSentDate = new Date(checkInData.email_sent_at);
    const hoursSinceEmail = (now - emailSentDate) / (1000 * 60 * 60);
    const daysSinceEmail = Math.floor(hoursSinceEmail / 24);
    
    // Calculate due dates
    const followUpDue = new Date(emailSentDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 days
    const caseOpenDue = new Date(emailSentDate.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days
    
    const workflow = checkInData.resolution_workflow || {};
    
    // Step 1: Initial email sent (always completed if we're here)
    const step1Status = 'completed';
    
    // Step 2: Follow-up (due after 2 days if no response)
    let step2Status = 'pending';
    if (workflow.follow_up_sent_at) {
        step2Status = 'completed';
    } else if (now > followUpDue) {
        step2Status = 'overdue';
    }
    
    // Step 3: Open case (due after 3 days if no resolution)
    let step3Status = 'pending';
    if (workflow.case_opened_at) {
        step3Status = 'completed';
    } else if (now > caseOpenDue && !workflow.resolved_at) {
        step3Status = 'overdue';
    }
    
    // Step 4: Resolution
    const step4Status = workflow.resolved_at ? 'completed' : 'pending';
    
    const formatDueDate = (date) => {
        return date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    const isOverdue = (dueDate) => now > dueDate;
    
    return `
        <div class="workflow-section">
            <h3>📋 Resolution Workflow</h3>
            <p style="margin: 8px 0 16px 0; font-size: 0.9rem; color: #6b7280;">
                Follow this timeline for professional seller communication
            </p>
            
            <div class="workflow-steps">
                <!-- Step 1: Initial Email -->
                <div class="workflow-step ${step1Status}">
                    <div class="workflow-step-header">
                        <span class="workflow-step-title">✓ Step 1: Initial Email Sent</span>
                        <span class="workflow-step-status status-${step1Status}">Completed</span>
                    </div>
                    <div class="workflow-step-description">
                        Professional email sent explaining issues and proposing resolutions
                    </div>
                    <div class="workflow-due-date">
                        Sent: ${formatDueDate(emailSentDate)}
                    </div>
                </div>
                
                <!-- Step 2: Follow-up -->
                <div class="workflow-step ${step2Status}">
                    <div class="workflow-step-header">
                        <span class="workflow-step-title">Step 2: Send Follow-Up (if no response)</span>
                        <span class="workflow-step-status status-${step2Status}">
                            ${workflow.follow_up_sent_at ? 'Completed' : (step2Status === 'overdue' ? 'Action Needed' : 'Due Soon')}
                        </span>
                    </div>
                    <div class="workflow-step-description">
                        Brief, polite follow-up message to check if seller saw your initial email
                    </div>
                    ${workflow.follow_up_sent_at ? `
                        <div class="workflow-due-date">
                            Sent: ${formatDueDate(new Date(workflow.follow_up_sent_at))}
                        </div>
                    ` : `
                        <div class="workflow-due-date ${isOverdue(followUpDue) ? 'overdue' : ''}">
                            ${isOverdue(followUpDue) ? '⚠️ Overdue since' : 'Due after'}: ${formatDueDate(followUpDue)}
                        </div>
                        ${!workflow.follow_up_sent_at ? `
                            <div class="workflow-step-action">
                                <button onclick="viewFollowUpEmail()" class="button button-secondary" style="padding: 6px 12px; font-size: 0.85rem;">
                                    View Follow-Up Message
                                </button>
                                <button onclick="markFollowUpSent()" class="button" style="background: #10b981; color: white; padding: 6px 12px; font-size: 0.85rem;">
                                    Mark as Sent
                                </button>
                            </div>
                        ` : ''}
                    `}
                </div>
                
                <!-- Step 3: Open eBay Case -->
                <div class="workflow-step ${step3Status}">
                    <div class="workflow-step-header">
                        <span class="workflow-step-title">Step 3: Open eBay Case (if no agreement)</span>
                        <span class="workflow-step-status status-${step3Status}">
                            ${workflow.case_opened_at ? 'Completed' : (step3Status === 'overdue' ? 'Action Needed' : 'Waiting')}
                        </span>
                    </div>
                    <div class="workflow-step-description">
                        Open "Item not as described" case after 3 days with no response/resolution
                    </div>
                    ${workflow.case_opened_at ? `
                        <div class="workflow-due-date">
                            Case opened: ${formatDueDate(new Date(workflow.case_opened_at))}
                            ${workflow.case_number ? `<br>Case #: ${workflow.case_number}` : ''}
                        </div>
                    ` : `
                        <div class="workflow-due-date ${isOverdue(caseOpenDue) ? 'overdue' : ''}">
                            ${isOverdue(caseOpenDue) ? '⚠️ Can open case now' : 'Can open after'}: ${formatDueDate(caseOpenDue)}
                        </div>
                        ${isOverdue(caseOpenDue) && !workflow.case_opened_at ? `
                            <div class="workflow-step-action">
                                <button onclick="markCaseOpened()" class="button" style="background: #ef4444; color: white; padding: 6px 12px; font-size: 0.85rem;">
                                    I've Opened eBay Case
                                </button>
                            </div>
                        ` : ''}
                    `}
                </div>
                
                <!-- Step 4: Resolution -->
                <div class="workflow-step ${step4Status}">
                    <div class="workflow-step-header">
                        <span class="workflow-step-title">Step 4: Resolution</span>
                        <span class="workflow-step-status status-${step4Status}">
                            ${workflow.resolved_at ? 'Completed' : 'Pending'}
                        </span>
                    </div>
                    <div class="workflow-step-description">
                        Issue resolved (refund received, replacement sent, or case closed)
                    </div>
                    ${workflow.resolved_at ? `
                        <div class="workflow-due-date">
                            Resolved: ${formatDueDate(new Date(workflow.resolved_at))}
                            ${workflow.resolution_type ? `<br>Resolution: ${workflow.resolution_type}` : ''}
                        </div>
                    ` : `
                        <div class="workflow-step-action">
                            <button onclick="markResolved()" class="button" style="background: #6b7280; color: white; padding: 6px 12px; font-size: 0.85rem;">
                                Mark as Resolved
                            </button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

function openEmailModal() {
    if (!emailTemplate) {
        alert('Email template not available');
        return;
    }
    
    document.getElementById('emailContent').value = emailTemplate;
    document.getElementById('emailModal').classList.add('active');
}

function closeEmailModal() {
    document.getElementById('emailModal').classList.remove('active');
}

async function copyEmail() {
    const emailContent = document.getElementById('emailContent').value;
    const button = document.getElementById('copyEmailButton');
    
    try {
        await navigator.clipboard.writeText(emailContent);
        button.textContent = '✓ Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = 'Copy Email';
            button.classList.remove('copied');
        }, 2000);
    } catch (error) {
        console.error('[EMAIL] Error copying:', error);
        alert('Failed to copy email. Please select and copy manually.');
    }
}

async function confirmEmailSent() {
    if (!confirm('Have you sent this email to the seller?\n\nThis will mark the email as sent and record the timestamp.')) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/mark-email-sent`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark email as sent');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('Email marked as sent!');
            closeEmailModal();
            // Reload the page to show the updated status
            window.location.reload();
        } else {
            throw new Error(data.error || 'Failed to mark email as sent');
        }
    } catch (error) {
        console.error('[EMAIL] Error marking as sent:', error);
        alert('Error: ' + error.message);
    }
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

function viewFollowUpEmail() {
    const followUpMessage = `Hi,\n\nJust checking you've seen the message below regarding the issue with the item.\n\nHappy to resolve this amicably.\n\nKind regards,\nLJMUK`;
    
    document.getElementById('emailContent').value = followUpMessage;
    document.getElementById('emailModal').classList.add('active');
}

async function markFollowUpSent() {
    if (!confirm('Have you sent the follow-up message to the seller?')) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/mark-follow-up-sent`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to update workflow');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('Follow-up marked as sent!');
            window.location.reload();
        } else {
            throw new Error(data.error || 'Failed to update workflow');
        }
    } catch (error) {
        console.error('[WORKFLOW] Error:', error);
        alert('Error: ' + error.message);
    }
}

async function markCaseOpened() {
    const caseNumber = prompt('Enter the eBay case number (optional):');
    
    if (caseNumber === null) {
        return; // User cancelled
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/mark-case-opened`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                case_number: caseNumber || null
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update workflow');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert('eBay case marked as opened!');
            window.location.reload();
        } else {
            throw new Error(data.error || 'Failed to update workflow');
        }
    } catch (error) {
        console.error('[WORKFLOW] Error:', error);
        alert('Error: ' + error.message);
    }
}

function markResolved() {
    // Open the resolution modal
    const modal = document.getElementById('resolutionModal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset form
        document.getElementById('resolutionForm').reset();
        document.getElementById('sellerResponseSection').style.display = 'none';
        document.getElementById('refundSection').style.display = 'none';
        document.querySelectorAll('.radio-option').forEach(opt => {
            opt.style.borderColor = '#d1d5db';
            opt.style.background = 'white';
        });
    }
}

function closeResolutionModal() {
    const modal = document.getElementById('resolutionModal');
    if (modal) {
        modal.style.display = 'none';
    }
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

    // Collect form data
    const formData = {
        resolution_type: resolutionType,
        seller_responded: document.getElementById('sellerResponded').checked,
        seller_response_notes: document.getElementById('sellerResponseNotes').value,
        refund_amount: document.getElementById('refundAmount').value || null,
        seller_cooperative: sellerCooperative.value === 'true',
        resolution_notes: document.getElementById('resolutionNotes').value
    };

    console.log('[RESOLUTION] Submitting:', formData);

    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/mark-resolved`, {
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
            window.location.reload();
        } else {
            throw new Error(data.error || 'Failed to save resolution');
        }
    } catch (error) {
        console.error('[RESOLUTION] Error:', error);
        alert('Error: ' + error.message);
    }
}

async function undoSplit(checkInId) {
    const confirmed = confirm(
        '⚠️ UNDO SPLIT OPERATION\n\n' +
        'This will:\n' +
        '• Delete ALL products created from this check-in\n' +
        '• Reset the check-in to allow re-splitting\n' +
        '• Allow you to correct any data issues\n\n' +
        'Are you sure you want to undo the split?'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/undo-split`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert(`✅ Split undone successfully!\n\n${data.products_deleted} product(s) deleted.`);
            // Reload the page to show updated state
            window.location.reload();
        } else {
            alert('Error: ' + (data.error || 'Failed to undo split'));
        }
    } catch (error) {
        console.error('[UNDO SPLIT] Error:', error);
        alert('Error undoing split: ' + error.message);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
