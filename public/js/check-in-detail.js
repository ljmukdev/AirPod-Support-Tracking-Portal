// Get check-in ID from URL
const urlParams = new URLSearchParams(window.location.search);
const checkInId = urlParams.get('id');

let checkInData = null;
let purchaseData = null;
let emailTemplate = null;
let availableGenerations = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[CHECK-IN-DETAIL] Loading check-in:', checkInId);

    if (!checkInId) {
        showError('No check-in ID provided');
        return;
    }

    loadCheckInDetails();
    loadAvailableGenerations();
    
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

async function loadAvailableGenerations() {
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/generations`);
        if (response.ok) {
            const data = await response.json();
            availableGenerations = data.generations || [];
            console.log('[CHECK-IN-DETAIL] Loaded generations:', availableGenerations);
        }
    } catch (error) {
        console.error('[CHECK-IN-DETAIL] Error loading generations:', error);
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
    
    const buildItemIssues = (item) => {
        const itemIssues = [];

        if (item.is_genuine === false) {
            itemIssues.push({
                severity: 'critical',
                description: 'Item appears to be counterfeit or not genuine'
            });
        }

        if (['fair', 'poor'].includes(item.condition)) {
            itemIssues.push({
                severity: item.condition === 'poor' ? 'high' : 'medium',
                description: `Visual condition is ${item.condition}`
            });
        }

        if (['left', 'right'].includes(item.item_type) && item.audible_condition) {
            if (['poor', 'not_working'].includes(item.audible_condition)) {
                itemIssues.push({
                    severity: item.audible_condition === 'not_working' ? 'critical' : 'high',
                    description: item.audible_condition === 'not_working'
                        ? 'No audible sound - item not working'
                        : `Poor sound quality - audible condition is ${item.audible_condition}`
                });
            } else if (item.audible_condition === 'fair') {
                itemIssues.push({
                    severity: 'medium',
                    description: 'Fair sound quality - audible condition is fair'
                });
            }
        }

        if (item.connects_correctly === false) {
            itemIssues.push({
                severity: 'high',
                description: 'Item has connectivity/pairing issues'
            });
        }

        return itemIssues;
    };

    container.innerHTML = items.map(item => {
        const itemName = getItemDisplayName(item.item_type);
        const itemIssues = buildItemIssues(item);
        
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
        // Show workflow section or simple resolution section
        let workflowHtml = '';
        const workflow = checkInData.resolution_workflow || {};
        const isResolved = workflow.resolved_at;

        if (hasIssues && checkInData.email_sent_at) {
            // Full workflow for items with issues
            workflowHtml = generateWorkflowHtml();
        } else if (!isResolved) {
            // Simple resolution section for items without issues
            workflowHtml = `
                <div class="workflow-section" style="margin-top: 24px;">
                    <h3>💰 Mark as Resolved</h3>
                    <p style="margin: 8px 0 16px 0; font-size: 0.9rem; color: #6b7280;">
                        Record resolution details and update product costs if a refund was received
                    </p>
                    <button onclick="markResolved()" class="button" style="background: #10b981; color: white; padding: 10px 20px; font-size: 0.95rem;">
                        Mark as Resolved
                    </button>
                </div>
            `;
        } else {
            // Show resolved status
            workflowHtml = `
                <div class="workflow-section" style="margin-top: 24px;">
                    <div class="workflow-step completed">
                        <div class="workflow-step-header">
                            <span class="workflow-step-title">✓ Resolved</span>
                        </div>
                        <div class="workflow-step-description">
                            ${workflow.resolution_type || 'Marked as resolved'}
                            ${workflow.refund_amount ? `<br>Refund: £${workflow.refund_amount}` : ''}
                        </div>
                        <div class="workflow-due-date">
                            Resolved: ${new Date(workflow.resolved_at).toLocaleString('en-GB')}
                        </div>
                    </div>
                </div>
            `;
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

        // Match issues by BOTH item_type AND set_number (for multi-set check-ins)
        const hasItemIssues = checkInData.issues_detected && checkInData.issues_detected.some(i =>
            i.item_type === item.item_type &&
            (i.set_number || null) === (item.set_number || null)
        );
        const itemIssues = hasItemIssues
            ? checkInData.issues_detected.find(i =>
                i.item_type === item.item_type &&
                (i.set_number || null) === (item.set_number || null)
              ).issues
            : [];

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

        // Default values from purchase or existing item overrides
        const defaultGeneration = item.generation || purchaseData.generation || '';
        const defaultConnector = item.connector_type || purchaseData.connector_type || '';

        // Build generation options
        const generationOptions = availableGenerations.map(gen =>
            `<option value="${escapeHtml(gen)}" ${gen === defaultGeneration ? 'selected' : ''}>${escapeHtml(gen)}</option>`
        ).join('');

        // Only show generation/connector selectors for AirPod parts (case, left, right)
        const isAirPodPart = ['case', 'left', 'right'].includes(item.item_type);

        const generationSelectorHtml = isAirPodPart ? `
            <div class="item-generation-selector" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb;">
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                    <div style="flex: 1; min-width: 180px;">
                        <label style="font-size: 0.75rem; color: #6b7280; font-weight: 600; display: block; margin-bottom: 4px;">Generation</label>
                        <select class="item-generation-select" data-item-type="${item.item_type}" style="width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; background: white;">
                            <option value="">-- Select Generation --</option>
                            ${generationOptions}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 140px;">
                        <label style="font-size: 0.75rem; color: #6b7280; font-weight: 600; display: block; margin-bottom: 4px;">Connector Type</label>
                        <select class="item-connector-select" data-item-type="${item.item_type}" style="width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; background: white;">
                            <option value="">-- Auto --</option>
                            <option value="Lightning" ${defaultConnector === 'Lightning' ? 'selected' : ''}>Lightning</option>
                            <option value="USB-C" ${defaultConnector === 'USB-C' ? 'selected' : ''}>USB-C</option>
                        </select>
                    </div>
                </div>
                <p style="font-size: 0.75rem; color: #9ca3af; margin: 6px 0 0 0; font-style: italic;">
                    Override if this item is from a different generation than the purchase
                </p>
            </div>
        ` : '';

        return `
            <div class="item-select-card">
                <label class="item-select-label" style="align-items: flex-start;">
                    <input type="checkbox" class="item-select-checkbox" data-item-type="${item.item_type}" ${defaultChecked ? 'checked' : ''} style="margin-top: 4px;">
                    <div class="item-select-info" style="flex: 1;">
                        <div class="item-select-header">
                            <strong>${itemName}</strong>
                            ${serialInfo}
                        </div>
                        <div style="font-size: 0.85rem; color: #666; margin-top: 3px;">
                            Condition: ${formatCondition(item.condition, false)}
                            ${item.audible_condition ? ` | Audible: ${formatCondition(item.audible_condition, false)}` : ''}
                        </div>
                        ${issuesBadges}
                        ${generationSelectorHtml}
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

    // Collect generation/connector overrides for each selected item
    const itemOverrides = {};
    selectedItems.forEach(itemType => {
        const generationSelect = document.querySelector(`.item-generation-select[data-item-type="${itemType}"]`);
        const connectorSelect = document.querySelector(`.item-connector-select[data-item-type="${itemType}"]`);

        if (generationSelect || connectorSelect) {
            itemOverrides[itemType] = {
                generation: generationSelect ? generationSelect.value : null,
                connector_type: connectorSelect ? connectorSelect.value : null
            };
        }
    });

    console.log('[SPLIT] Item overrides:', itemOverrides);

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
                selected_items: selectedItems,
                item_overrides: itemOverrides
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="margin: 0;">📋 Resolution Workflow</h3>
                <button onclick="viewAllCorrespondence()" style="background: none; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; color: #6b7280; cursor: pointer; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.borderColor='#9ca3af'; this.style.color='#374151';" onmouseout="this.style.borderColor='#d1d5db'; this.style.color='#6b7280';">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 4L8 8L14 4M2 4V12H14V4M2 4H14"/>
                    </svg>
                    View All Correspondence
                </button>
            </div>
            <p style="margin: 0 0 16px 0; font-size: 0.9rem; color: #6b7280;">
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
                    <div class="workflow-step-action">
                        <button onclick="openEmailModal()" class="button button-secondary" style="padding: 6px 12px; font-size: 0.85rem;">
                            View Email
                        </button>
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

async function regenerateEmail() {
    const button = document.getElementById('regenerateEmailButton');
    const originalText = button.innerHTML;
    
    button.disabled = true;
    button.innerHTML = '⏳ Generating...';
    button.style.opacity = '0.6';
    
    try {
        const response = await authenticatedFetch(`${window.API_BASE}/api/admin/check-in/${checkInId}/regenerate-email`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to regenerate email');
        }
        
        const data = await response.json();
        
        if (data.success && data.email_template) {
            emailTemplate = data.email_template;
            document.getElementById('emailContent').value = emailTemplate;
            
            // Show success feedback
            button.innerHTML = '✓ Regenerated!';
            button.style.background = '#10b981';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '#f59e0b';
                button.disabled = false;
                button.style.opacity = '1';
            }, 2000);
        } else {
            throw new Error(data.error || 'Failed to regenerate email');
        }
    } catch (error) {
        console.error('[EMAIL] Error regenerating:', error);
        alert('Error: ' + error.message);
        button.innerHTML = originalText;
        button.disabled = false;
        button.style.opacity = '1';
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

    // Check if return tracking is required
    const isReturn = resolutionType.includes('return');
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

function viewAllCorrespondence() {
    if (!checkInData) {
        alert('Check-in data not loaded');
        return;
    }

    const workflow = checkInData.workflow || {};
    let correspondenceHtml = '';

    // Initial Email
    if (checkInData.email_sent_at) {
        const sentDate = new Date(checkInData.email_sent_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        correspondenceHtml += `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <strong style="color: #111827;">Initial Email</strong>
                        <span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">Sent</span>
                    </div>
                    <span style="color: #6b7280; font-size: 0.85rem;">${sentDate}</span>
                </div>
                <p style="color: #6b7280; font-size: 0.9rem; margin: 0 0 12px 0;">Professional email explaining issues and proposing resolutions</p>
                <button onclick="openEmailModal()" class="button button-secondary" style="padding: 6px 12px; font-size: 0.85rem;">View Email</button>
            </div>
        `;
    }

    // Follow-up Message
    if (workflow.follow_up_sent_at) {
        const sentDate = new Date(workflow.follow_up_sent_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        correspondenceHtml += `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <strong style="color: #111827;">Follow-Up Message</strong>
                        <span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">Sent</span>
                    </div>
                    <span style="color: #6b7280; font-size: 0.85rem;">${sentDate}</span>
                </div>
                <p style="color: #6b7280; font-size: 0.9rem; margin: 0 0 12px 0;">Brief follow-up to check if seller saw initial email</p>
                <button onclick="viewFollowUpEmail()" class="button button-secondary" style="padding: 6px 12px; font-size: 0.85rem;">View Message</button>
            </div>
        `;
    }

    // eBay Case
    if (workflow.case_opened_at) {
        const openedDate = new Date(workflow.case_opened_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        correspondenceHtml += `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <strong style="color: #111827;">eBay Case Opened</strong>
                        <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">Case</span>
                    </div>
                    <span style="color: #6b7280; font-size: 0.85rem;">${openedDate}</span>
                </div>
                <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">Item not as described case${workflow.case_number ? ` - Case #${workflow.case_number}` : ''}</p>
            </div>
        `;
    }

    // Resolution
    if (workflow.resolved_at) {
        const resolvedDate = new Date(workflow.resolved_at).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        correspondenceHtml += `
            <div style="border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #f0fdf4;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <strong style="color: #111827;">Resolution</strong>
                        <span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">Resolved</span>
                    </div>
                    <span style="color: #6b7280; font-size: 0.85rem;">${resolvedDate}</span>
                </div>
                <p style="color: #065f46; font-size: 0.9rem; margin: 0;">${workflow.resolution_type || 'Issue resolved'}</p>
                ${workflow.refund_amount ? `<p style="color: #065f46; font-size: 0.9rem; margin: 8px 0 0 0;"><strong>Refund:</strong> £${parseFloat(workflow.refund_amount).toFixed(2)}</p>` : ''}
            </div>
        `;
    }

    if (!correspondenceHtml) {
        correspondenceHtml = '<p style="text-align: center; color: #6b7280; padding: 20px;">No correspondence recorded yet.</p>';
    }

    // Create and show modal
    const modalHtml = `
        <div id="correspondenceModal" class="email-modal active" onclick="if(event.target===this)closeCorrespondenceModal()">
            <div class="email-modal-content" style="max-width: 600px;">
                <div class="email-modal-header">
                    <h2>📧 All Correspondence</h2>
                    <button class="email-modal-close" onclick="closeCorrespondenceModal()">&times;</button>
                </div>
                <div class="email-modal-body" style="max-height: 70vh; overflow-y: auto;">
                    ${correspondenceHtml}
                </div>
                <div class="email-modal-footer">
                    <button onclick="closeCorrespondenceModal()" class="button button-secondary">Close</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existing = document.getElementById('correspondenceModal');
    if (existing) existing.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeCorrespondenceModal() {
    const modal = document.getElementById('correspondenceModal');
    if (modal) modal.remove();
}
