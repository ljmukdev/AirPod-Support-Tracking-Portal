// Receipts Management JavaScript
// Handles shipping receipt upload, OCR processing, and order association

// Use existing API_BASE from admin.js or default to empty string
const RECEIPTS_API_BASE = window.API_BASE || '';
let allReceipts = [];
let currentReceiptId = null;
let currentUploadData = null;

// Wait for authentication token to be available before making API calls
function waitForAuth(callback, maxWait = 3000) {
    const startTime = Date.now();

    function checkToken() {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (token) {
            console.log('[RECEIPTS] Token found, initializing...');
            callback();
        } else if (Date.now() - startTime < maxWait) {
            // Token not yet available, wait and check again
            setTimeout(checkToken, 100);
        } else {
            // Timeout - try anyway (will fail with 401 but won't break the page)
            console.warn('[RECEIPTS] Auth token not found after waiting, attempting to load anyway');
            callback();
        }
    }

    checkToken();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupDragDrop();

    // Wait for token to be available before loading data
    waitForAuth(function() {
        loadReceipts();
        loadSummary();
    });
});

// Setup event listeners
function setupEventListeners() {
    // Upload button
    const uploadBtn = document.getElementById('uploadReceiptBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', openUploadModal);
    }

    // File input change
    const fileInput = document.getElementById('receiptFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Filter controls
    const filterSearch = document.getElementById('filterSearch');
    const filterStatus = document.getElementById('filterStatus');
    const filterPeriod = document.getElementById('filterPeriod');
    const headerSearch = document.getElementById('headerSearch');

    if (filterSearch) filterSearch.addEventListener('input', debounce(applyFilters, 300));
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterPeriod) filterPeriod.addEventListener('change', applyFilters);
    if (headerSearch) headerSearch.addEventListener('input', debounce(applyFilters, 300));

    // Clear filters button
    const clearBtn = document.getElementById('clearFilters');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearFilters);
    }

    // Manual tracking input - search on enter
    const manualInput = document.getElementById('manualTrackingInput');
    if (manualInput) {
        manualInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchManualTracking();
            }
        });
    }
}

// Setup drag and drop for file upload
function setupDragDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
    });

    uploadArea.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// Process uploaded file
async function processFile(file) {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Invalid file type. Please upload a JPEG, PNG, or WebP image.', 'error');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File too large. Maximum size is 10MB.', 'error');
        return;
    }

    // Show preview
    const previewContainer = document.getElementById('uploadPreview');
    const previewImage = document.getElementById('previewImage');
    if (previewContainer && previewImage) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // Show processing indicator
    const processingIndicator = document.getElementById('processingIndicator');
    const uploadArea = document.getElementById('uploadArea');
    if (processingIndicator) processingIndicator.style.display = 'block';
    if (uploadArea) uploadArea.classList.add('processing');

    // Upload and process with OCR
    try {
        const formData = new FormData();
        formData.append('receipt', file);

        console.log('[RECEIPTS] Uploading receipt...');
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        console.log('[RECEIPTS] Upload response status:', response.status);

        if (processingIndicator) processingIndicator.style.display = 'none';
        if (uploadArea) uploadArea.classList.remove('processing');

        // Handle 401 without redirecting
        if (response.status === 401) {
            showNotification('Session expired. Please refresh the page and try again.', 'error');
            return;
        }

        const data = await response.json();

        if (data.success) {
            currentUploadData = data;
            displayOCRResults(data);
            showNotification(data.message, data.matched_orders.length > 0 ? 'success' : 'info');
        } else {
            showNotification(data.error || 'Failed to process receipt', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        if (processingIndicator) processingIndicator.style.display = 'none';
        if (uploadArea) uploadArea.classList.remove('processing');
        showNotification('Failed to upload receipt. Please try again.', 'error');
    }
}

// Display OCR results
function displayOCRResults(data) {
    const ocrResults = document.getElementById('ocrResults');
    const ocrTextDisplay = document.getElementById('ocrTextDisplay');
    const trackingMatchesList = document.getElementById('trackingMatchesList');
    const modalFooter = document.getElementById('uploadModalFooter');

    if (ocrResults) ocrResults.style.display = 'block';
    if (modalFooter) modalFooter.style.display = 'flex';

    // Display OCR text
    if (ocrTextDisplay) {
        ocrTextDisplay.textContent = data.ocr_text || 'No text extracted';
    }

    // Display extracted receipt info (delivery office and drop-off time)
    const extractedInfoContainer = document.getElementById('extractedReceiptInfo');
    if (extractedInfoContainer) {
        let infoHtml = '';

        if (data.delivery_office) {
            infoHtml += `
                <div class="extracted-info-item">
                    <span class="extracted-info-label">📍 Delivery Office:</span>
                    <span class="extracted-info-value">${data.delivery_office}</span>
                </div>
            `;
        }

        if (data.drop_off_formatted || data.drop_off_date || data.drop_off_time) {
            const dateTimeStr = data.drop_off_formatted ||
                               (data.drop_off_date && data.drop_off_time ? `${data.drop_off_date} at ${data.drop_off_time}` :
                               data.drop_off_date || data.drop_off_time);
            infoHtml += `
                <div class="extracted-info-item">
                    <span class="extracted-info-label">🕐 Drop-off Time:</span>
                    <span class="extracted-info-value">${dateTimeStr}</span>
                </div>
            `;
        }

        if (infoHtml) {
            extractedInfoContainer.innerHTML = infoHtml;
            extractedInfoContainer.style.display = 'block';
        } else {
            extractedInfoContainer.innerHTML = '<p style="color: #9ca3af; font-size: 13px;">No delivery office or drop-off time detected</p>';
            extractedInfoContainer.style.display = 'block';
        }
    }

    // Display tracking matches
    if (trackingMatchesList) {
        if (data.extracted_tracking && data.extracted_tracking.length > 0) {
            trackingMatchesList.innerHTML = data.extracted_tracking.map(tracking => {
                const matched = data.matched_orders.find(m => m.tracking_number === tracking.tracking_number);
                return `
                    <div class="tracking-match ${matched ? 'matched' : ''}">
                        <div class="tracking-match-info">
                            <div class="tracking-match-number">${tracking.tracking_number}</div>
                            <div class="tracking-match-provider">${tracking.provider} (${tracking.confidence} confidence)</div>
                            ${matched ? `<div class="tracking-match-order">Matched: Order #${matched.order_number} (${matched.platform})</div>` : ''}
                        </div>
                        ${!matched ? `
                            <div class="tracking-match-actions">
                                <button class="btn-small" onclick="searchOrderByTracking('${tracking.tracking_number}')">Search Order</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        } else {
            trackingMatchesList.innerHTML = '<p style="color: #6b7280; font-size: 13px;">No tracking numbers detected. Please enter manually below.</p>';
        }
    }
}

// Search for order by tracking number
async function searchOrderByTracking(trackingNumber) {
    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/search-order/${encodeURIComponent(trackingNumber)}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.results.length > 0) {
            showOrderSelectionModal(data.results, trackingNumber);
        } else {
            showNotification('No matching orders found for this tracking number.', 'info');
        }
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Failed to search for orders.', 'error');
    }
}

// Search manual tracking number
async function searchManualTracking() {
    const input = document.getElementById('manualTrackingInput');
    const resultsContainer = document.getElementById('manualSearchResults');
    if (!input || !resultsContainer) return;

    const trackingNumber = input.value.trim().toUpperCase();
    if (!trackingNumber) {
        showNotification('Please enter a tracking number', 'warning');
        return;
    }

    resultsContainer.innerHTML = '<p style="color: #6b7280; font-size: 13px;">Searching...</p>';

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/search-order/${encodeURIComponent(trackingNumber)}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.results.length > 0) {
            resultsContainer.innerHTML = data.results.map(order => `
                <div class="order-result-item" onclick="associateWithOrder('${order.sale_id}', '${trackingNumber}')">
                    <div class="order-result-info">
                        <div class="order-result-number">Order #${order.order_number}</div>
                        <div class="order-result-details">
                            ${order.platform} | ${order.buyer_name || 'Unknown buyer'} |
                            Tracking: ${order.outward_tracking_number || 'None'}
                        </div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7 4L13 10L7 16" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<p style="color: #ef4444; font-size: 13px;">No matching orders found.</p>';
        }
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<p style="color: #ef4444; font-size: 13px;">Search failed. Please try again.</p>';
    }
}

// Associate receipt with order
async function associateWithOrder(saleId, trackingNumber) {
    if (!currentUploadData || !currentUploadData.receipt_id) {
        showNotification('No receipt data available', 'error');
        return;
    }

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/${currentUploadData.receipt_id}/associate`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sale_id: saleId,
                tracking_number: trackingNumber
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`Receipt associated with Order #${data.order_number}`, 'success');
            closeUploadModal();
            loadReceipts();
            loadSummary();
        } else {
            showNotification(data.error || 'Failed to associate receipt', 'error');
        }
    } catch (error) {
        console.error('Association error:', error);
        showNotification('Failed to associate receipt with order.', 'error');
    }
}

// Show order selection modal (inline in tracking match)
function showOrderSelectionModal(orders, trackingNumber) {
    const html = orders.map(order => `
        <div class="order-result-item" onclick="associateWithOrder('${order.sale_id}', '${trackingNumber}')">
            <div class="order-result-info">
                <div class="order-result-number">Order #${order.order_number}</div>
                <div class="order-result-details">
                    ${order.platform} | ${order.buyer_name || 'Unknown'} |
                    ${order.product_name || ''}
                </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4L13 10L7 16" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `).join('');

    // Create a simple popup
    const popup = document.createElement('div');
    popup.className = 'modal';
    popup.style.display = 'flex';
    popup.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>Select Order</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px; color: #6b7280; font-size: 14px;">
                    Select the order to associate with tracking <strong>${trackingNumber}</strong>:
                </p>
                <div class="order-search-results" style="max-height: 300px;">
                    ${html}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
}

// Save receipt (close modal after upload)
function saveReceipt() {
    if (currentUploadData && currentUploadData.matched_orders && currentUploadData.matched_orders.length > 0) {
        showNotification('Receipt saved and matched to order(s)!', 'success');
    } else {
        showNotification('Receipt saved. You can associate it with an order later.', 'info');
    }
    closeUploadModal();
    loadReceipts();
    loadSummary();
}

// Load receipts list
async function loadReceipts() {
    try {
        console.log('[RECEIPTS] Loading receipts...');
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts?limit=100`, {
            credentials: 'include'
        });

        console.log('[RECEIPTS] Response status:', response.status);

        // Handle 401 without redirecting
        if (response.status === 401) {
            console.warn('[RECEIPTS] Unauthorized - please refresh the page or log in again');
            showNotification('Session expired. Please refresh the page.', 'warning');
            return;
        }

        const data = await response.json();

        if (data.success) {
            allReceipts = data.receipts;
            renderReceipts(allReceipts);
        } else {
            showNotification(data.error || 'Failed to load receipts', 'error');
        }
    } catch (error) {
        console.error('[RECEIPTS] Load error:', error);
        showNotification('Failed to load receipts.', 'error');
    }
}

// Load summary stats
async function loadSummary() {
    try {
        console.log('[RECEIPTS] Loading summary...');
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/summary`, {
            credentials: 'include'
        });

        console.log('[RECEIPTS] Summary response status:', response.status);

        // Handle 401 without redirecting
        if (response.status === 401) {
            console.warn('[RECEIPTS] Summary unauthorized');
            return;
        }

        const data = await response.json();

        if (data.success) {
            document.getElementById('matchedCount').textContent = data.summary.matched || 0;
            document.getElementById('pendingReviewCount').textContent = data.summary.pending_review || 0;
            document.getElementById('manualCount').textContent = data.summary.manually_associated || 0;
            document.getElementById('noTrackingCount').textContent = data.summary.no_tracking_found || 0;
            document.getElementById('totalReceipts').textContent = data.summary.total || 0;
        }
    } catch (error) {
        console.error('[RECEIPTS] Summary load error:', error);
    }
}

// Render receipts table
function renderReceipts(receipts) {
    const tableBody = document.getElementById('receiptsTableBody');
    const mobileCards = document.getElementById('receiptsCardsMobile');
    const countDisplay = document.getElementById('receiptsCount');

    if (countDisplay) {
        countDisplay.textContent = `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''}`;
    }

    if (receipts.length === 0) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="table-empty">No receipts found</td></tr>';
        }
        if (mobileCards) {
            mobileCards.innerHTML = '<div class="sale-card"><div class="sale-card-body" style="text-align: center; padding: 40px;"><p style="color: #9ca3af;">No receipts found</p></div></div>';
        }
        return;
    }

    // Desktop table
    if (tableBody) {
        tableBody.innerHTML = receipts.map(receipt => {
            const trackingNumbers = receipt.extracted_tracking?.map(t => t.tracking_number).join(', ') ||
                                   receipt.manually_entered_tracking || '-';
            const matchedOrder = receipt.matched_orders?.[0]?.order_number ||
                                (receipt.associated_sale_id ? 'Associated' : '-');

            return `
                <tr onclick="viewReceiptDetail('${receipt._id}')" style="cursor: pointer;">
                    <td>
                        <img src="${receipt.image_path}" class="receipt-thumbnail"
                             onclick="event.stopPropagation(); openLightbox('${receipt.image_path}')"
                             alt="Receipt">
                    </td>
                    <td>
                        <span class="receipt-status-badge ${receipt.status}">${formatStatus(receipt.status)}</span>
                    </td>
                    <td>${formatDate(receipt.uploaded_at)}</td>
                    <td style="font-family: monospace; font-size: 12px;">${truncateText(trackingNumbers, 30)}</td>
                    <td>${matchedOrder}</td>
                    <td>
                        <button class="btn-small" onclick="event.stopPropagation(); viewReceiptDetail('${receipt._id}')">View</button>
                        <button class="btn-small btn-danger" onclick="event.stopPropagation(); deleteReceipt('${receipt._id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Mobile cards
    if (mobileCards) {
        mobileCards.innerHTML = receipts.map(receipt => {
            const trackingNumbers = receipt.extracted_tracking?.map(t => t.tracking_number).join(', ') ||
                                   receipt.manually_entered_tracking || 'None';
            const matchedOrder = receipt.matched_orders?.[0]?.order_number ||
                                (receipt.associated_sale_id ? 'Associated' : 'Not matched');

            return `
                <div class="sale-card" onclick="viewReceiptDetail('${receipt._id}')">
                    <div class="sale-card-header">
                        <span class="receipt-status-badge ${receipt.status}">${formatStatus(receipt.status)}</span>
                        <span style="font-size: 12px; color: #6b7280;">${formatDate(receipt.uploaded_at)}</span>
                    </div>
                    <div class="sale-card-body">
                        <div style="display: flex; gap: 12px;">
                            <img src="${receipt.image_path}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;">
                            <div>
                                <div style="font-size: 12px; color: #6b7280;">Tracking</div>
                                <div style="font-family: monospace; font-size: 13px;">${truncateText(trackingNumbers, 20)}</div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Order</div>
                                <div style="font-weight: 500;">${matchedOrder}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// View receipt detail
async function viewReceiptDetail(receiptId) {
    currentReceiptId = receiptId;

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/${receiptId}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            displayReceiptDetail(data.receipt);
            document.getElementById('receiptDetailModal').style.display = 'flex';
        } else {
            showNotification(data.error || 'Failed to load receipt', 'error');
        }
    } catch (error) {
        console.error('Load detail error:', error);
        showNotification('Failed to load receipt details.', 'error');
    }
}

// Display receipt detail in modal
function displayReceiptDetail(receipt) {
    const content = document.getElementById('receiptDetailContent');
    if (!content) return;

    const trackingList = receipt.extracted_tracking?.map(t => `
        <div style="display: flex; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 4px; margin-bottom: 4px;">
            <span style="font-family: monospace;">${t.tracking_number}</span>
            <span style="color: #6b7280; font-size: 12px;">${t.provider}</span>
        </div>
    `).join('') || '<p style="color: #6b7280;">No tracking numbers extracted</p>';

    const matchedOrdersList = receipt.matched_orders?.map(m => `
        <div style="display: flex; justify-content: space-between; padding: 8px; background: #ecfdf5; border-radius: 4px; margin-bottom: 4px; border: 1px solid #10b981;">
            <span><strong>Order #${m.order_number}</strong> (${m.platform})</span>
            <span style="color: #059669;">Matched</span>
        </div>
    `).join('') || '';

    // Build delivery info section if available
    const hasDeliveryInfo = receipt.delivery_office || receipt.drop_off_date || receipt.drop_off_time;
    const dropOffStr = receipt.drop_off_date && receipt.drop_off_time
        ? `${receipt.drop_off_date} at ${receipt.drop_off_time}`
        : (receipt.drop_off_date || receipt.drop_off_time || null);

    content.innerHTML = `
        <div class="receipt-detail-section">
            <h4>Receipt Image</h4>
            <img src="${receipt.image_path}" class="receipt-preview" style="cursor: pointer; max-height: 250px;"
                 onclick="openLightbox('${receipt.image_path}')">
        </div>

        <div class="receipt-detail-section">
            <h4>Status</h4>
            <span class="receipt-status-badge ${receipt.status}">${formatStatus(receipt.status)}</span>
            <span style="margin-left: 12px; color: #6b7280; font-size: 13px;">
                Uploaded ${formatDate(receipt.uploaded_at)} by ${receipt.uploaded_by || 'Unknown'}
            </span>
        </div>

        ${hasDeliveryInfo ? `
        <div class="receipt-detail-section">
            <h4>📍 Drop-off Information</h4>
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #86efac; border-radius: 8px; padding: 12px;">
                ${receipt.delivery_office ? `
                    <div style="margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #166534; font-weight: 600;">Delivery Office:</span>
                        <div style="font-size: 14px; color: #15803d; margin-top: 2px;">${receipt.delivery_office}</div>
                    </div>
                ` : ''}
                ${dropOffStr ? `
                    <div>
                        <span style="font-size: 12px; color: #166534; font-weight: 600;">Date & Time:</span>
                        <div style="font-size: 14px; color: #15803d; margin-top: 2px;">${dropOffStr}</div>
                    </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        <div class="receipt-detail-section">
            <h4>Extracted Tracking Numbers</h4>
            ${trackingList}
            ${receipt.manually_entered_tracking ? `
                <div style="margin-top: 8px; padding: 8px; background: #dbeafe; border-radius: 4px;">
                    <span style="font-size: 12px; color: #1e40af;">Manual entry:</span>
                    <span style="font-family: monospace; margin-left: 8px;">${receipt.manually_entered_tracking}</span>
                </div>
            ` : ''}
        </div>

        ${matchedOrdersList ? `
            <div class="receipt-detail-section">
                <h4>Matched Orders</h4>
                ${matchedOrdersList}
            </div>
        ` : ''}

        ${receipt.associated_sale ? `
            <div class="receipt-detail-section">
                <h4>Associated Order</h4>
                <div style="padding: 12px; background: #f0f9ff; border-radius: 6px; border: 1px solid #3b82f6;">
                    <div><strong>Order #${receipt.associated_sale.order_number}</strong></div>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                        ${receipt.associated_sale.platform} | ${receipt.associated_sale.buyer_name || 'Unknown buyer'}
                    </div>
                </div>
            </div>
        ` : `
            <div class="receipt-detail-section">
                <h4>Associate with Order</h4>
                <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
                    Search for an order to associate this receipt with:
                </p>
                <div class="manual-tracking-form">
                    <input type="text" id="detailTrackingInput" placeholder="Enter tracking or order number...">
                    <button type="button" class="btn-primary" onclick="searchFromDetail()">Search</button>
                </div>
                <div id="detailSearchResults" class="order-search-results"></div>
            </div>
        `}

        <div class="receipt-detail-section">
            <h4>OCR Text</h4>
            <div class="ocr-text" style="max-height: 150px;">${receipt.ocr_text || 'No text extracted'}</div>
        </div>

        <div class="receipt-detail-section">
            <h4>Notes</h4>
            <textarea id="receiptNotes" style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
                      placeholder="Add notes about this receipt...">${receipt.notes || ''}</textarea>
            <button type="button" class="btn-small" style="margin-top: 8px;" onclick="saveReceiptNotes()">Save Notes</button>
        </div>
    `;
}

// Search from detail modal
async function searchFromDetail() {
    const input = document.getElementById('detailTrackingInput');
    const resultsContainer = document.getElementById('detailSearchResults');
    if (!input || !resultsContainer) return;

    const query = input.value.trim().toUpperCase();
    if (!query) return;

    resultsContainer.innerHTML = '<p style="color: #6b7280;">Searching...</p>';

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/search-order/${encodeURIComponent(query)}`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.results.length > 0) {
            resultsContainer.innerHTML = data.results.map(order => `
                <div class="order-result-item" onclick="associateFromDetail('${order.sale_id}', '${query}')">
                    <div class="order-result-info">
                        <div class="order-result-number">Order #${order.order_number}</div>
                        <div class="order-result-details">
                            ${order.platform} | ${order.buyer_name || 'Unknown'} |
                            Tracking: ${order.outward_tracking_number || 'None'}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<p style="color: #ef4444;">No matching orders found.</p>';
        }
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<p style="color: #ef4444;">Search failed.</p>';
    }
}

// Associate from detail modal
async function associateFromDetail(saleId, trackingNumber) {
    if (!currentReceiptId) return;

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/${currentReceiptId}/associate`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sale_id: saleId,
                tracking_number: trackingNumber
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`Receipt associated with Order #${data.order_number}`, 'success');
            closeDetailModal();
            loadReceipts();
            loadSummary();
        } else {
            showNotification(data.error || 'Failed to associate', 'error');
        }
    } catch (error) {
        console.error('Association error:', error);
        showNotification('Failed to associate receipt.', 'error');
    }
}

// Save receipt notes
async function saveReceiptNotes() {
    if (!currentReceiptId) return;

    const notesInput = document.getElementById('receiptNotes');
    if (!notesInput) return;

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/${currentReceiptId}/notes`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notes: notesInput.value
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Notes saved', 'success');
        } else {
            showNotification(data.error || 'Failed to save notes', 'error');
        }
    } catch (error) {
        console.error('Save notes error:', error);
        showNotification('Failed to save notes.', 'error');
    }
}

// Reprocess current receipt OCR
async function reprocessCurrentReceipt() {
    if (!currentReceiptId) return;

    try {
        showNotification('Re-processing OCR...', 'info');

        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/${currentReceiptId}/reprocess`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            showNotification(data.message, 'success');
            viewReceiptDetail(currentReceiptId);
            loadReceipts();
            loadSummary();
        } else {
            showNotification(data.error || 'Failed to reprocess', 'error');
        }
    } catch (error) {
        console.error('Reprocess error:', error);
        showNotification('Failed to reprocess receipt.', 'error');
    }
}

// Delete receipt
async function deleteReceipt(receiptId) {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    try {
        const response = await authenticatedFetch(`${RECEIPTS_API_BASE}/api/admin/receipts/${receiptId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Receipt deleted', 'success');
            loadReceipts();
            loadSummary();
        } else {
            showNotification(data.error || 'Failed to delete', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete receipt.', 'error');
    }
}

// Delete current receipt (from detail modal)
function deleteCurrentReceipt() {
    if (currentReceiptId) {
        deleteReceipt(currentReceiptId);
        closeDetailModal();
    }
}

// Apply filters
function applyFilters() {
    const searchTerm = (document.getElementById('filterSearch')?.value ||
                       document.getElementById('headerSearch')?.value || '').toLowerCase();
    const status = document.getElementById('filterStatus')?.value || '';
    const period = document.getElementById('filterPeriod')?.value || 'all';

    let filtered = allReceipts;

    // Status filter
    if (status) {
        filtered = filtered.filter(r => r.status === status);
    }

    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(r => {
            const trackingStr = r.extracted_tracking?.map(t => t.tracking_number).join(' ') || '';
            const orderStr = r.matched_orders?.map(m => m.order_number).join(' ') || '';
            const manualTracking = r.manually_entered_tracking || '';
            return trackingStr.toLowerCase().includes(searchTerm) ||
                   orderStr.toLowerCase().includes(searchTerm) ||
                   manualTracking.toLowerCase().includes(searchTerm);
        });
    }

    // Date filter
    if (period !== 'all') {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

        if (startDate) {
            filtered = filtered.filter(r => new Date(r.uploaded_at) >= startDate);
        }
    }

    renderReceipts(filtered);
}

// Clear filters
function clearFilters() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPeriod').value = 'all';
    document.getElementById('headerSearch').value = '';
    renderReceipts(allReceipts);
}

// Modal functions
function openUploadModal() {
    // Reset modal state
    currentUploadData = null;
    document.getElementById('receiptFileInput').value = '';
    document.getElementById('uploadArea').classList.remove('processing');
    document.getElementById('processingIndicator').style.display = 'none';
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('ocrResults').style.display = 'none';
    document.getElementById('uploadModalFooter').style.display = 'none';
    document.getElementById('manualTrackingInput').value = '';
    document.getElementById('manualSearchResults').innerHTML = '';

    document.getElementById('uploadReceiptModal').style.display = 'flex';
}

function closeUploadModal() {
    document.getElementById('uploadReceiptModal').style.display = 'none';
}

function closeDetailModal() {
    document.getElementById('receiptDetailModal').style.display = 'none';
    currentReceiptId = null;
}

function openLightbox(imageSrc) {
    document.getElementById('lightboxImage').src = imageSrc;
    document.getElementById('imageLightbox').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('imageLightbox').style.display = 'none';
}

// Utility functions
function formatStatus(status) {
    const statusMap = {
        'matched': 'Matched',
        'pending_review': 'Review',
        'no_tracking_found': 'No Tracking',
        'manually_associated': 'Manual'
    };
    return statusMap[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncateText(text, maxLength) {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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

// Notification helper (use existing if available)
function showNotification(message, type = 'info') {
    // Try to use existing notification system
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    // Fallback simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    notification.style.background = colors[type] || colors.info;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
