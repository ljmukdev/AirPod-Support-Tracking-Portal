/**
 * Stock Take Management
 * Handles scanning items and generating discrepancy reports
 */

(function() {
    'use strict';

    // State
    let currentStockTake = null;
    let scannedItems = [];
    let discrepancyResolutions = {};
    let currentDiscrepancy = null;

    // DOM Elements
    const startSection = document.getElementById('startSection');
    const scannerSection = document.getElementById('scannerSection');
    const reportSection = document.getElementById('reportSection');
    const historySection = document.getElementById('historySection');

    const stockTakeNameInput = document.getElementById('stockTakeName');
    const stockTakeNotesInput = document.getElementById('stockTakeNotes');
    const startStockTakeBtn = document.getElementById('startStockTakeBtn');

    const activeStockTakeName = document.getElementById('activeStockTakeName');
    const barcodeInput = document.getElementById('barcodeInput');
    const scanBtn = document.getElementById('scanBtn');
    const scannedList = document.getElementById('scannedList');
    const completeStockTakeBtn = document.getElementById('completeStockTakeBtn');
    const cancelStockTakeBtn = document.getElementById('cancelStockTakeBtn');

    const reportSummary = document.getElementById('reportSummary');
    const discrepancies = document.getElementById('discrepancies');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const newStockTakeBtn = document.getElementById('newStockTakeBtn');

    const historyList = document.getElementById('historyList');
    const messageContainer = document.getElementById('messageContainer');
    const scanFeedback = document.getElementById('scanFeedback');

    // Stats elements
    const statScanned = document.getElementById('statScanned');
    const statFound = document.getElementById('statFound');
    const statNotFound = document.getElementById('statNotFound');
    const statWrongStatus = document.getElementById('statWrongStatus');

    // Modal elements
    const discrepancyModal = document.getElementById('discrepancyModal');
    const modalProductInfo = document.getElementById('modalProductInfo');
    const modalQuickLinks = document.getElementById('modalQuickLinks');
    const resolutionStatus = document.getElementById('resolutionStatus');
    const resolutionNotes = document.getElementById('resolutionNotes');
    const statusUpdateSection = document.getElementById('statusUpdateSection');
    const newProductStatus = document.getElementById('newProductStatus');
    const statusHistorySection = document.getElementById('statusHistorySection');
    const statusHistoryList = document.getElementById('statusHistoryList');
    const saveResolutionBtn = document.getElementById('saveResolutionBtn');

    // Audio feedback
    const successSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1jbYCVlZRyYV9ugJOUk3RgXm+AlZWUcmFdb4CUlJR0YF1vgJWVlHJhXW+AlJSUdGBdb4CVlZRyYV1vgJSUlHRgXW+AlZWUcmFdb4CUlJR0YF1vgJWVlHJhXW+AlJSUdGBdb4CVlZRyYV1vgJSUlHRgXW+AlZWUcmFdb4CUlJR0YF1vgJWVlHJhXW+AlJSUdGBdbw==');
    const errorSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAABhcX+PlZF7aF9pgJSWkHVgXXCAk5aQdV9ecICTlpB1X15wgJOWkHVfXnCAk5aQdV9ecICTlpB1X15wgJOWkHVfXnCAk5aQdV9ecICTlpB1X15wgJOWkHVfXnCAk5aQdV9ecICTlpB1X15wgJOWkHVfXnCAk5aQdV9ecICTlpB1X15wgJOWkHVfXnCAk5aQdV9ecA==');

    // Initialize
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        // Check for existing in-progress stock take
        await checkForActiveStockTake();

        // Load history
        await loadStockTakeHistory();

        // Event listeners
        startStockTakeBtn.addEventListener('click', startStockTake);
        scanBtn.addEventListener('click', scanItem);
        barcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                scanItem();
            }
        });
        completeStockTakeBtn.addEventListener('click', completeStockTake);
        cancelStockTakeBtn.addEventListener('click', cancelStockTake);
        downloadReportBtn.addEventListener('click', downloadReport);
        newStockTakeBtn.addEventListener('click', () => {
            showSection('start');
            loadStockTakeHistory();
        });

        // Modal event listeners
        if (saveResolutionBtn) {
            saveResolutionBtn.addEventListener('click', saveDiscrepancyResolution);
        }

        // Close modal on background click
        if (discrepancyModal) {
            discrepancyModal.addEventListener('click', (e) => {
                if (e.target === discrepancyModal) {
                    closeDiscrepancyModal();
                }
            });
        }
    }

    function showSection(section) {
        startSection.style.display = 'none';
        scannerSection.classList.remove('active');
        reportSection.classList.remove('active');

        switch (section) {
            case 'start':
                startSection.style.display = 'block';
                historySection.style.display = 'block';
                break;
            case 'scanner':
                scannerSection.classList.add('active');
                historySection.style.display = 'none';
                barcodeInput.focus();
                break;
            case 'report':
                reportSection.classList.add('active');
                historySection.style.display = 'none';
                break;
        }
    }

    async function checkForActiveStockTake() {
        try {
            const response = await authenticatedFetch('/api/admin/stock-takes');
            if (!response.ok) throw new Error('Failed to fetch stock takes');

            const data = await response.json();
            const activeStockTake = data.stock_takes?.find(st => st.status === 'in_progress');

            if (activeStockTake) {
                currentStockTake = activeStockTake;
                scannedItems = activeStockTake.scanned_items || [];
                activeStockTakeName.textContent = activeStockTake.name;
                updateStats();
                renderScannedList();
                showSection('scanner');
            } else {
                showSection('start');
            }
        } catch (err) {
            console.error('Error checking for active stock take:', err);
            showMessage('error', 'Failed to load stock takes. Please refresh the page.');
            showSection('start');
        }
    }

    async function startStockTake() {
        const name = stockTakeNameInput.value.trim();
        const notes = stockTakeNotesInput.value.trim();

        startStockTakeBtn.disabled = true;
        startStockTakeBtn.textContent = 'Starting...';

        try {
            const response = await authenticatedFetch('/api/admin/stock-take/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, notes })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start stock take');
            }

            currentStockTake = data.stock_take;
            scannedItems = [];
            activeStockTakeName.textContent = currentStockTake.name;
            updateStats();
            renderScannedList();
            showSection('scanner');

            // Clear form
            stockTakeNameInput.value = '';
            stockTakeNotesInput.value = '';

            showMessage('success', 'Stock take started. Begin scanning items.');
        } catch (err) {
            console.error('Error starting stock take:', err);
            showMessage('error', err.message);
        } finally {
            startStockTakeBtn.disabled = false;
            startStockTakeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                Start Stock Take
            `;
        }
    }

    async function scanItem() {
        const barcode = barcodeInput.value.trim().toUpperCase();

        if (!barcode) {
            barcodeInput.focus();
            return;
        }

        if (!currentStockTake) {
            showMessage('error', 'No active stock take. Please start a new one.');
            return;
        }

        scanBtn.disabled = true;
        barcodeInput.disabled = true;

        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${currentStockTake._id}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ security_barcode: barcode })
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if already scanned
                if (response.status === 400 && data.error?.includes('already been scanned')) {
                    showFeedback('warning', 'Already Scanned!');
                    playSound('error');
                } else {
                    throw new Error(data.error || 'Failed to scan item');
                }
            } else {
                // Add to local list
                scannedItems.unshift(data.scanned_item);
                updateStats();
                renderScannedList();

                // Show feedback
                if (data.scanned_item.found_in_database) {
                    if (['in_stock', 'active'].includes(data.scanned_item.status)) {
                        showFeedback('success', 'Found!');
                        playSound('success');
                    } else {
                        showFeedback('warning', `Wrong Status: ${data.scanned_item.status}`);
                        playSound('error');
                    }
                } else {
                    showFeedback('error', 'Not Found!');
                    playSound('error');
                }
            }

            // Clear input and refocus
            barcodeInput.value = '';
        } catch (err) {
            console.error('Error scanning item:', err);
            showFeedback('error', 'Scan Failed!');
            playSound('error');
        } finally {
            scanBtn.disabled = false;
            barcodeInput.disabled = false;
            barcodeInput.focus();
        }
    }

    async function removeScannedItem(barcode) {
        if (!currentStockTake) return;

        if (!confirm(`Remove ${barcode} from the scanned list?`)) return;

        try {
            const response = await authenticatedFetch(
                `/api/admin/stock-take/${currentStockTake._id}/scan/${encodeURIComponent(barcode)}`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to remove item');
            }

            // Remove from local list
            scannedItems = scannedItems.filter(item => item.security_barcode !== barcode);
            updateStats();
            renderScannedList();

            showMessage('success', `Removed ${barcode} from the list.`);
        } catch (err) {
            console.error('Error removing item:', err);
            showMessage('error', err.message);
        }
    }

    async function completeStockTake() {
        if (!currentStockTake) return;

        if (scannedItems.length === 0) {
            showMessage('warning', 'Please scan at least one item before completing the stock take.');
            return;
        }

        if (!confirm('Complete this stock take and generate the report? This cannot be undone.')) {
            return;
        }

        completeStockTakeBtn.disabled = true;
        completeStockTakeBtn.textContent = 'Generating Report...';

        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${currentStockTake._id}/complete`, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to complete stock take');
            }

            // Load discrepancy resolutions
            await loadDiscrepancyResolutions();

            // Show report
            renderReport(data.report);
            showSection('report');

            showMessage('success', 'Stock take completed. Report generated.');
        } catch (err) {
            console.error('Error completing stock take:', err);
            showMessage('error', err.message);
        } finally {
            completeStockTakeBtn.disabled = false;
            completeStockTakeBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Complete & Generate Report
            `;
        }
    }

    async function cancelStockTake() {
        if (!currentStockTake) return;

        if (!confirm('Are you sure you want to cancel this stock take? All scanned items will be lost.')) {
            return;
        }

        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${currentStockTake._id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to cancel stock take');
            }

            currentStockTake = null;
            scannedItems = [];
            showSection('start');
            loadStockTakeHistory();

            showMessage('success', 'Stock take cancelled.');
        } catch (err) {
            console.error('Error cancelling stock take:', err);
            showMessage('error', err.message);
        }
    }

    async function downloadReport() {
        if (!currentStockTake) return;

        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${currentStockTake._id}/report/download`);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to download report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stock-take-report-${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading report:', err);
            showMessage('error', err.message);
        }
    }

    async function loadStockTakeHistory() {
        try {
            const response = await authenticatedFetch('/api/admin/stock-takes');
            if (!response.ok) throw new Error('Failed to fetch stock takes');

            const data = await response.json();
            const completedStockTakes = data.stock_takes?.filter(st => st.status === 'completed') || [];

            if (completedStockTakes.length === 0) {
                historyList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <p>No previous stock takes found.</p>
                    </div>
                `;
                return;
            }

            historyList.innerHTML = completedStockTakes.map(st => {
                const accuracy = st.report?.summary?.accuracy_percentage || 0;
                const accuracyClass = accuracy >= 95 ? 'success' : accuracy >= 80 ? 'warning' : 'danger';

                return `
                    <div class="history-item">
                        <div class="history-item-info">
                            <div class="history-item-name">${escapeHtml(st.name)}</div>
                            <div class="history-item-meta">
                                ${new Date(st.completed_at).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                                &bull; ${st.scanned_items?.length || 0} items scanned
                            </div>
                        </div>
                        <div class="history-item-stats">
                            <div class="history-item-accuracy" style="color: var(--${accuracyClass === 'success' ? 'success' : accuracyClass === 'warning' ? 'warning' : 'danger'}-color, ${accuracyClass === 'success' ? '#28a745' : accuracyClass === 'warning' ? '#ffc107' : '#dc3545'})">
                                ${accuracy}% Accuracy
                            </div>
                            <div style="font-size: 0.85rem; color: #666;">
                                ${st.report?.summary?.missing_items_count || 0} missing
                            </div>
                        </div>
                        <div class="history-item-actions">
                            <button class="btn btn-secondary" onclick="viewReport('${st._id}')" style="padding: 8px 16px; font-size: 0.85rem;">
                                View Report
                            </button>
                            <button class="btn btn-secondary" onclick="downloadHistoryReport('${st._id}')" style="padding: 8px 16px; font-size: 0.85rem;">
                                Download
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Error loading history:', err);
            historyList.innerHTML = `
                <div class="empty-state">
                    <p style="color: #dc3545;">Failed to load stock take history.</p>
                </div>
            `;
        }
    }

    // Load discrepancy resolutions for current stock take
    async function loadDiscrepancyResolutions() {
        if (!currentStockTake) return;

        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${currentStockTake._id}/discrepancies`);
            if (response.ok) {
                const data = await response.json();
                discrepancyResolutions = data.discrepancy_resolutions || {};
            }
        } catch (err) {
            console.error('Error loading discrepancy resolutions:', err);
        }
    }

    // Global functions for history actions
    window.viewReport = async function(stockTakeId) {
        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${stockTakeId}`);
            if (!response.ok) throw new Error('Failed to fetch stock take');

            const data = await response.json();
            currentStockTake = data.stock_take;
            discrepancyResolutions = data.stock_take.discrepancy_resolutions || {};

            if (data.stock_take.report) {
                renderReport(data.stock_take.report);
                showSection('report');
            } else {
                showMessage('error', 'This stock take has no report.');
            }
        } catch (err) {
            console.error('Error viewing report:', err);
            showMessage('error', err.message);
        }
    };

    window.downloadHistoryReport = async function(stockTakeId) {
        try {
            const response = await authenticatedFetch(`/api/admin/stock-take/${stockTakeId}/report/download`);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to download report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stock-take-report-${stockTakeId}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading report:', err);
            showMessage('error', err.message);
        }
    };

    // Open discrepancy modal for investigation
    window.openDiscrepancyModal = async function(barcode, type, productId) {
        currentDiscrepancy = { barcode, type, productId };

        // Show modal
        discrepancyModal.classList.add('active');

        // Reset form
        resolutionStatus.value = 'pending';
        resolutionNotes.value = '';
        newProductStatus.value = '';
        statusUpdateSection.style.display = type === 'missing' || type === 'wrong_status' ? 'block' : 'none';

        // Load existing resolution if any
        const existingResolution = discrepancyResolutions[barcode];
        if (existingResolution) {
            resolutionStatus.value = existingResolution.resolution_status || 'pending';
            resolutionNotes.value = existingResolution.notes || '';
        }

        // Load product info
        modalProductInfo.innerHTML = '<p style="text-align: center; color: #666;">Loading...</p>';
        modalQuickLinks.innerHTML = '';
        statusHistorySection.style.display = 'none';

        if (type !== 'unknown') {
            try {
                const response = await authenticatedFetch(`/api/admin/stock-take/product-lookup/${encodeURIComponent(barcode)}`);
                if (response.ok) {
                    const data = await response.json();
                    renderProductInfo(data);
                } else {
                    modalProductInfo.innerHTML = '<p style="color: #dc3545;">Could not load product info</p>';
                }
            } catch (err) {
                console.error('Error loading product info:', err);
                modalProductInfo.innerHTML = '<p style="color: #dc3545;">Error loading product info</p>';
            }
        } else {
            modalProductInfo.innerHTML = `
                <div class="product-info-row">
                    <span class="product-info-label">Security Barcode</span>
                    <span class="product-info-value" style="font-family: 'Courier New', monospace;">${escapeHtml(barcode)}</span>
                </div>
                <div class="product-info-row">
                    <span class="product-info-label">Status</span>
                    <span class="product-info-value" style="color: #dc3545;">Not found in system</span>
                </div>
            `;
            modalQuickLinks.innerHTML = `
                <a href="add-product.html" class="quick-link" target="_blank">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Add as New Product
                </a>
            `;
        }
    };

    function renderProductInfo(data) {
        const product = data.product;
        const sale = data.sale_info;

        modalProductInfo.innerHTML = `
            <div class="product-info-row">
                <span class="product-info-label">Security Barcode</span>
                <span class="product-info-value" style="font-family: 'Courier New', monospace;">${escapeHtml(product.security_barcode)}</span>
            </div>
            <div class="product-info-row">
                <span class="product-info-label">Product Name</span>
                <span class="product-info-value">${escapeHtml(product.product_name || 'N/A')}</span>
            </div>
            <div class="product-info-row">
                <span class="product-info-label">Generation</span>
                <span class="product-info-value">${escapeHtml(product.generation || 'N/A')}</span>
            </div>
            <div class="product-info-row">
                <span class="product-info-label">Part Type</span>
                <span class="product-info-value">${escapeHtml(product.part_type || 'N/A')}</span>
            </div>
            <div class="product-info-row">
                <span class="product-info-label">Current Status</span>
                <span class="product-info-value" style="color: ${product.status === 'in_stock' ? '#28a745' : '#dc3545'};">${escapeHtml(product.status || 'N/A')}</span>
            </div>
            ${product.tracking_number ? `
            <div class="product-info-row">
                <span class="product-info-label">Tracking Number</span>
                <span class="product-info-value">${escapeHtml(product.tracking_number)}</span>
            </div>
            ` : ''}
            ${sale ? `
            <div class="product-info-row" style="background: #fff3cd; margin: 8px -16px -16px; padding: 12px 16px; border-radius: 0 0 8px 8px;">
                <span class="product-info-label">Linked Sale</span>
                <span class="product-info-value">Order #${escapeHtml(sale.order_number || sale._id)} (${sale.platform || 'Unknown'})</span>
            </div>
            ` : ''}
        `;

        // Quick links
        modalQuickLinks.innerHTML = `
            <a href="search-product.html?security_barcode=${encodeURIComponent(product.security_barcode)}" class="quick-link" target="_blank">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                View Product
            </a>
            ${sale ? `
            <a href="sales.html?order=${encodeURIComponent(sale.order_number || sale._id)}" class="quick-link" target="_blank">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0"/>
                </svg>
                View Sale
            </a>
            ` : ''}
            ${product.tracking_number ? `
            <a href="https://track24.net/?code=${encodeURIComponent(product.tracking_number)}" class="quick-link" target="_blank">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                </svg>
                Track Package
            </a>
            ` : ''}
        `;

        // Status history
        if (product.status_history && product.status_history.length > 0) {
            statusHistorySection.style.display = 'block';
            statusHistoryList.innerHTML = product.status_history.slice(-5).reverse().map(h => `
                <div class="status-history-item">
                    <span class="status-change">${escapeHtml(h.from_status || 'N/A')} → ${escapeHtml(h.to_status)}</span>
                    <br>
                    <span style="color: #666; font-size: 0.8rem;">
                        ${new Date(h.changed_at).toLocaleString('en-GB')}
                        ${h.reason ? ` - ${escapeHtml(h.reason)}` : ''}
                    </span>
                </div>
            `).join('');
        } else {
            statusHistorySection.style.display = 'none';
        }
    }

    // Close discrepancy modal
    window.closeDiscrepancyModal = function() {
        discrepancyModal.classList.remove('active');
        currentDiscrepancy = null;
    };

    // Save discrepancy resolution
    async function saveDiscrepancyResolution() {
        if (!currentDiscrepancy || !currentStockTake) return;

        const status = resolutionStatus.value;
        const notes = resolutionNotes.value.trim();
        const newStatus = newProductStatus.value;

        saveResolutionBtn.disabled = true;
        saveResolutionBtn.textContent = 'Saving...';

        try {
            // Save resolution
            const response = await authenticatedFetch(`/api/admin/stock-take/${currentStockTake._id}/discrepancy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    security_barcode: currentDiscrepancy.barcode,
                    resolution_status: status,
                    notes: notes,
                    discrepancy_type: currentDiscrepancy.type
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save resolution');
            }

            // Update local state
            discrepancyResolutions[currentDiscrepancy.barcode] = {
                resolution_status: status,
                notes: notes,
                discrepancy_type: currentDiscrepancy.type
            };

            // Update product status if requested
            if (newStatus && currentDiscrepancy.type !== 'unknown') {
                const statusResponse = await authenticatedFetch('/api/admin/stock-take/update-product-status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        security_barcode: currentDiscrepancy.barcode,
                        new_status: newStatus,
                        reason: `Stock take investigation: ${notes || status}`
                    })
                });

                if (!statusResponse.ok) {
                    const data = await statusResponse.json();
                    showMessage('warning', `Resolution saved but status update failed: ${data.error}`);
                } else {
                    showMessage('success', 'Resolution and status updated successfully.');
                }
            } else {
                showMessage('success', 'Resolution saved successfully.');
            }

            // Re-render the report with updated resolution badges
            if (currentStockTake.report) {
                renderReport(currentStockTake.report);
            }

            closeDiscrepancyModal();
        } catch (err) {
            console.error('Error saving resolution:', err);
            showMessage('error', err.message);
        } finally {
            saveResolutionBtn.disabled = false;
            saveResolutionBtn.textContent = 'Save Changes';
        }
    }

    function updateStats() {
        const total = scannedItems.length;
        const found = scannedItems.filter(item => item.found_in_database && ['in_stock', 'active'].includes(item.status)).length;
        const notFound = scannedItems.filter(item => !item.found_in_database).length;
        const wrongStatus = scannedItems.filter(item => item.found_in_database && !['in_stock', 'active'].includes(item.status)).length;

        statScanned.textContent = total;
        statFound.textContent = found;
        statNotFound.textContent = notFound;
        statWrongStatus.textContent = wrongStatus;
    }

    function renderScannedList() {
        if (scannedItems.length === 0) {
            scannedList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <p>No items scanned yet. Start scanning to build your inventory list.</p>
                </div>
            `;
            return;
        }

        scannedList.innerHTML = scannedItems.map((item, index) => {
            let statusClass = 'found';
            let statusText = 'Found';

            if (!item.found_in_database) {
                statusClass = 'not-found';
                statusText = 'Not Found';
            } else if (!['in_stock', 'active'].includes(item.status)) {
                statusClass = 'wrong-status';
                statusText = item.status || 'Unknown Status';
            }

            return `
                <div class="scanned-item ${statusClass}">
                    <span class="scanned-item-number">${scannedItems.length - index}</span>
                    <span class="scanned-item-barcode">${escapeHtml(item.security_barcode)}</span>
                    <span class="scanned-item-info">
                        ${item.product_name ? escapeHtml(item.product_name) : 'Unknown Product'}
                        ${item.generation ? ` - ${escapeHtml(item.generation)}` : ''}
                    </span>
                    <span class="scanned-item-status ${statusClass}">${statusText}</span>
                    <button class="scanned-item-remove" onclick="window.removeScannedItem('${item.security_barcode}')" title="Remove">×</button>
                </div>
            `;
        }).join('');
    }

    // Global remove function
    window.removeScannedItem = removeScannedItem;

    function getResolutionBadge(barcode) {
        const resolution = discrepancyResolutions[barcode];
        if (!resolution) return '';

        const statusClass = resolution.resolution_status || 'pending';
        const statusLabels = {
            'pending': 'Pending',
            'investigated': 'Investigated',
            'resolved': 'Resolved',
            'written-off': 'Written Off'
        };

        return `<span class="resolution-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span>`;
    }

    function renderReport(report) {
        const summary = report.summary;
        const accuracyClass = summary.accuracy_percentage >= 95 ? '' : 'low';

        reportSummary.innerHTML = `
            <div class="report-card accuracy ${accuracyClass}">
                <div class="report-card-value">${summary.accuracy_percentage}%</div>
                <div class="report-card-label">Accuracy</div>
            </div>
            <div class="report-card">
                <div class="report-card-value">${summary.total_scanned}</div>
                <div class="report-card-label">Items Scanned</div>
            </div>
            <div class="report-card">
                <div class="report-card-value">${summary.expected_in_stock}</div>
                <div class="report-card-label">Expected In Stock</div>
            </div>
            <div class="report-card">
                <div class="report-card-value">${summary.found_items}</div>
                <div class="report-card-label">Items Verified</div>
            </div>
        `;

        let discrepancyHtml = '';

        if (summary.missing_items_count > 0) {
            discrepancyHtml += `
                <div class="discrepancy-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        Missing Items
                        <span class="discrepancy-count">${summary.missing_items_count}</span>
                    </h3>
                    <p style="color: #666; margin-bottom: 12px;">These items are marked as "in stock" in the system but were not scanned during the stock take.</p>
                    <div class="discrepancy-list">
                        ${report.missing_items.map(item => {
                            const resolution = discrepancyResolutions[item.security_barcode];
                            const itemClass = resolution ? resolution.resolution_status : '';
                            return `
                            <div class="discrepancy-item ${itemClass}">
                                <div class="discrepancy-main">
                                    <div class="discrepancy-barcode">${escapeHtml(item.security_barcode)}</div>
                                    <div class="discrepancy-details">
                                        ${item.product_name || 'Unknown Product'}
                                        ${item.generation ? ` | ${item.generation}` : ''}
                                        ${item.part_type ? ` | ${item.part_type}` : ''}
                                    </div>
                                </div>
                                <div class="discrepancy-actions">
                                    ${getResolutionBadge(item.security_barcode)}
                                    <button class="btn btn-small btn-primary" onclick="openDiscrepancyModal('${item.security_barcode}', 'missing', '${item._id}')">
                                        Investigate
                                    </button>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        }

        if (summary.unknown_items_count > 0) {
            discrepancyHtml += `
                <div class="discrepancy-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffc107" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.08 4h.01"/>
                        </svg>
                        Unknown Barcodes
                        <span class="discrepancy-count" style="background: #ffc107; color: #333;">${summary.unknown_items_count}</span>
                    </h3>
                    <p style="color: #666; margin-bottom: 12px;">These barcodes were scanned but do not exist in the system.</p>
                    <div class="discrepancy-list">
                        ${report.unknown_items.map(item => {
                            const resolution = discrepancyResolutions[item.security_barcode];
                            const itemClass = resolution ? resolution.resolution_status : '';
                            return `
                            <div class="discrepancy-item ${itemClass}">
                                <div class="discrepancy-main">
                                    <div class="discrepancy-barcode">${escapeHtml(item.security_barcode)}</div>
                                    <div class="discrepancy-details">
                                        Scanned: ${new Date(item.scanned_at).toLocaleString('en-GB')}
                                    </div>
                                </div>
                                <div class="discrepancy-actions">
                                    ${getResolutionBadge(item.security_barcode)}
                                    <button class="btn btn-small btn-primary" onclick="openDiscrepancyModal('${item.security_barcode}', 'unknown', null)">
                                        Investigate
                                    </button>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        }

        if (summary.wrong_status_count > 0) {
            discrepancyHtml += `
                <div class="discrepancy-section">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fd7e14" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/>
                        </svg>
                        Wrong Status Items
                        <span class="discrepancy-count" style="background: #fd7e14;">${summary.wrong_status_count}</span>
                    </h3>
                    <p style="color: #666; margin-bottom: 12px;">These items were scanned but their status is not "in_stock" (may need investigation).</p>
                    <div class="discrepancy-list">
                        ${report.wrong_status_items.map(item => {
                            const resolution = discrepancyResolutions[item.security_barcode];
                            const itemClass = resolution ? resolution.resolution_status : '';
                            return `
                            <div class="discrepancy-item ${itemClass}">
                                <div class="discrepancy-main">
                                    <div class="discrepancy-barcode">${escapeHtml(item.security_barcode)}</div>
                                    <div class="discrepancy-details">
                                        ${item.product_name || 'Unknown Product'} | Status: <strong>${item.status}</strong>
                                    </div>
                                </div>
                                <div class="discrepancy-actions">
                                    ${getResolutionBadge(item.security_barcode)}
                                    <button class="btn btn-small btn-primary" onclick="openDiscrepancyModal('${item.security_barcode}', 'wrong_status', '${item.product_id}')">
                                        Investigate
                                    </button>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        }

        if (!discrepancyHtml) {
            discrepancyHtml = `
                <div class="discrepancy-section" style="text-align: center; padding: 40px;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2" style="margin-bottom: 16px;">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <path d="M22 4L12 14.01l-3-3"/>
                    </svg>
                    <h3 style="color: #28a745; margin-bottom: 8px;">Perfect Stock Take!</h3>
                    <p style="color: #666;">No discrepancies found. All items are accounted for.</p>
                </div>
            `;
        }

        discrepancies.innerHTML = discrepancyHtml;
    }

    function showMessage(type, message) {
        messageContainer.innerHTML = `<div class="message ${type}">${escapeHtml(message)}</div>`;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            const msg = messageContainer.querySelector('.message');
            if (msg) msg.style.display = 'none';
        }, 5000);
    }

    function showFeedback(type, message) {
        scanFeedback.textContent = message;
        scanFeedback.className = `scan-feedback ${type} show`;

        setTimeout(() => {
            scanFeedback.classList.remove('show');
        }, 1000);
    }

    function playSound(type) {
        try {
            if (type === 'success') {
                successSound.currentTime = 0;
                successSound.play().catch(() => {});
            } else {
                errorSound.currentTime = 0;
                errorSound.play().catch(() => {});
            }
        } catch (e) {
            // Ignore audio errors
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Helper function for authenticated fetch
    async function authenticatedFetch(url, options = {}) {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            window.location.href = '/admin/login.html';
            throw new Error('Not authenticated');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        return fetch(url, { ...options, headers });
    }
})();
