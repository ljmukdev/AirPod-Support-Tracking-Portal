// Returns Management JavaScript
(function() {
    'use strict';

    const API_BASE = window.API_BASE || '';
    const authenticatedFetch = window.authenticatedFetch;

    let allReturnsData = [];
    let currentReturnId = null;
    let selectedSaleData = null;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        loadReturns();
        loadSummary();
        setupEventListeners();
        setupDateDefault();
        checkUrlParams();
    });

    function setupDateDefault() {
        const dateInput = document.getElementById('returnDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const saleId = urlParams.get('sale_id');
        const productId = urlParams.get('product_id');

        if (saleId) {
            // Auto-open return modal with sale pre-selected
            openReturnModalWithSale(saleId, productId);
        }
    }

    function setupEventListeners() {
        // Create Return Button
        document.getElementById('createReturnBtn')?.addEventListener('click', openReturnModal);

        // Return Form Submit
        document.getElementById('returnForm')?.addEventListener('submit', handleReturnSubmit);

        // Inspection Form Submit
        document.getElementById('inspectionForm')?.addEventListener('submit', handleInspectionSubmit);

        // Restock Form Submit
        document.getElementById('restockForm')?.addEventListener('submit', handleRestockSubmit);

        // Search Sale Input
        document.getElementById('searchSale')?.addEventListener('input', debounce(handleSaleSearch, 300));

        // Filter listeners
        document.getElementById('filterSearch')?.addEventListener('input', filterReturns);
        document.getElementById('headerSearch')?.addEventListener('input', filterReturns);
        document.getElementById('filterStatus')?.addEventListener('change', filterReturns);
        document.getElementById('filterReason')?.addEventListener('change', filterReturns);
        document.getElementById('filterPeriod')?.addEventListener('change', handlePeriodChange);
        document.getElementById('filterDateFrom')?.addEventListener('change', filterReturns);
        document.getElementById('filterDateTo')?.addEventListener('change', filterReturns);
        document.getElementById('filterCondition')?.addEventListener('change', filterReturns);
        document.getElementById('clearFilters')?.addEventListener('click', clearAllFilters);
    }

    // ===== RETURNS LIST =====

    async function loadReturns() {
        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns`);
            const data = await response.json();

            if (response.ok && data.returns) {
                allReturnsData = data.returns;
                displayReturns(data.returns);
            } else {
                showError('Failed to load returns');
            }
        } catch (error) {
            console.error('Error loading returns:', error);
            showError('Error loading returns');
        }
    }

    async function loadSummary() {
        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/summary`);
            const data = await response.json();

            if (response.ok) {
                document.getElementById('pendingCount').textContent = data.pending || 0;
                document.getElementById('inTransitCount').textContent = data.in_transit || 0;
                document.getElementById('receivedCount').textContent = data.received || 0;
                document.getElementById('totalReturns').textContent = data.total || 0;
                document.getElementById('totalLoss').textContent = `£${(data.total_loss || 0).toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    }

    function displayReturns(returns) {
        const tbody = document.getElementById('returnsTableBody');
        const mobileCards = document.getElementById('returnsCardsMobile');

        // Apply filters
        let filtered;
        try {
            filtered = applyFilters(returns);
        } catch (err) {
            console.error('Error applying filters:', err);
            filtered = returns;
        }

        // Update count
        const countEl = document.getElementById('returnsCount');
        if (countEl) {
            countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'return' : 'returns'}`;
        }

        if (!filtered || filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="table-loading">No returns found</td></tr>';
            if (mobileCards) {
                mobileCards.innerHTML = `
                    <div class="sale-card">
                        <div class="sale-card-body" style="text-align: center; padding: 40px;">
                            <p style="color: #9ca3af;">No returns found</p>
                        </div>
                    </div>
                `;
            }
            return;
        }

        let tableRows = '';
        let mobileCardsHtml = '';

        filtered.forEach((ret) => {
            const returnDate = new Date(ret.return_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
            const statusBadge = getStatusBadge(ret.status);
            const reasonDisplay = getReasonDisplay(ret.return_reason);
            const conditionDisplay = getConditionDisplay(ret.item_condition);
            const trackingDisplay = ret.return_tracking_number
                ? `<a href="#" onclick="trackReturn('${ret._id}'); return false;">${ret.return_tracking_number.substring(0, 12)}...</a>`
                : '<span style="color: #999;">Not tracked</span>';

            // Desktop row
            tableRows += `
                <tr>
                    <td>${statusBadge}</td>
                    <td>${returnDate}</td>
                    <td>
                        <a href="#" onclick="viewReturn('${ret._id}'); return false;" style="color: #0ea5e9; text-decoration: none; font-weight: 500;">
                            ${ret.order_number || 'N/A'}
                        </a>
                    </td>
                    <td>
                        <div style="font-weight: 600;">${ret.product_name || 'Unknown'}</div>
                        <div style="font-size: 0.8rem; color: #666;">${ret.product_serial || ''} ${ret.security_barcode ? `· ${ret.security_barcode}` : ''}</div>
                    </td>
                    <td>${reasonDisplay}</td>
                    <td>${trackingDisplay}</td>
                    <td>${conditionDisplay}</td>
                    <td style="font-weight: 600; color: #ef4444;">£${(ret.refund_amount || 0).toFixed(2)}</td>
                    <td>
                        <div class="sale-actions">
                            <button class="sale-action-btn" onclick="viewReturn('${ret._id}')" title="View/Manage">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z" stroke="currentColor" stroke-width="1.5"/>
                                    <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                            </button>
                            ${ret.status === 'received' || ret.status === 'inspected' ? `
                                <button class="sale-action-btn" onclick="openRestockModal('${ret._id}')" title="Restock" style="color: #10b981;">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M3 5L10 2L17 5M3 5L3 15L10 18M3 5L10 8M17 5L17 15L10 18M17 5L10 8M10 8L10 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" transform="scale(0.8) translate(1, 1)"/>
                                    </svg>
                                </button>
                            ` : ''}
                            <button class="sale-action-btn delete" onclick="deleteReturn('${ret._id}')" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M2 4h12M5 4V3h6v1M5 7v6M8 7v6M11 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;

            // Mobile card
            mobileCardsHtml += `
                <div class="sale-card">
                    <div class="sale-card-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${statusBadge}
                            <div class="sale-card-product">
                                <div class="sale-card-product-name">${ret.product_name || 'Unknown'}</div>
                                <div class="sale-card-product-serial">${ret.order_number || 'N/A'}</div>
                            </div>
                        </div>
                        <div style="font-weight: 700; color: #ef4444;">-£${(ret.refund_amount || 0).toFixed(2)}</div>
                    </div>
                    <div class="sale-card-body">
                        <div class="sale-card-details">
                            <div class="sale-card-detail">
                                <span class="sale-card-label">Return Date</span>
                                <span class="sale-card-value">${returnDate}</span>
                            </div>
                            <div class="sale-card-detail">
                                <span class="sale-card-label">Reason</span>
                                <span class="sale-card-value">${reasonDisplay}</span>
                            </div>
                            <div class="sale-card-detail">
                                <span class="sale-card-label">Condition</span>
                                <span class="sale-card-value">${conditionDisplay}</span>
                            </div>
                            <div class="sale-card-detail">
                                <span class="sale-card-label">Tracking</span>
                                <span class="sale-card-value">${ret.return_tracking_number || 'Not tracked'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="sale-card-footer">
                        <button class="sale-card-action" onclick="viewReturn('${ret._id}')" title="View">
                            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                                <path d="M8 3C4.5 3 2 8 2 8s2.5 5 6 5 6-5 6-5-2.5-5-6-5z" stroke="currentColor" stroke-width="1.5"/>
                                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        tbody.innerHTML = tableRows;
        if (mobileCards) {
            mobileCardsHtml = mobileCardsHtml;
        }
    }

    function getStatusBadge(status) {
        const statusMap = {
            'pending': { label: 'Pending', class: 'pending' },
            'in_transit': { label: 'In Transit', class: 'in-transit' },
            'received': { label: 'Received', class: 'received' },
            'inspected': { label: 'Inspected', class: 'inspected' },
            'restocked': { label: 'Restocked', class: 'restocked' },
            'rejected': { label: 'Rejected', class: 'rejected' },
            'refunded': { label: 'Refunded', class: 'refunded' }
        };
        const statusInfo = statusMap[status] || { label: status, class: 'pending' };
        return `<span class="return-status-badge ${statusInfo.class}">${statusInfo.label}</span>`;
    }

    function getReasonDisplay(reason) {
        const reasonMap = {
            'defective': 'Defective',
            'not_as_described': 'Not As Described',
            'wrong_item': 'Wrong Item',
            'changed_mind': 'Changed Mind',
            'damaged_shipping': 'Damaged',
            'other': 'Other'
        };
        return reasonMap[reason] || reason || 'Unknown';
    }

    function getConditionDisplay(condition) {
        const conditionMap = {
            'sealed': '<span style="color: #10b981;">Sealed</span>',
            'opened': '<span style="color: #f59e0b;">Opened</span>',
            'used': '<span style="color: #6b7280;">Used</span>',
            'damaged': '<span style="color: #ef4444;">Damaged</span>'
        };
        return conditionMap[condition] || '<span style="color: #999;">Pending</span>';
    }

    // ===== FILTERS =====

    function applyFilters(returns) {
        let filtered = [...returns];

        // Search filter
        const searchTerm = (document.getElementById('filterSearch')?.value ||
                          document.getElementById('headerSearch')?.value || '').toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(ret => {
                return (ret.order_number || '').toLowerCase().includes(searchTerm) ||
                       (ret.product_name || '').toLowerCase().includes(searchTerm) ||
                       (ret.product_serial || '').toLowerCase().includes(searchTerm) ||
                       (ret.security_barcode || '').toLowerCase().includes(searchTerm) ||
                       (ret.return_tracking_number || '').toLowerCase().includes(searchTerm);
            });
        }

        // Status filter
        const status = document.getElementById('filterStatus')?.value || '';
        if (status) {
            filtered = filtered.filter(ret => ret.status === status);
        }

        // Reason filter
        const reason = document.getElementById('filterReason')?.value || '';
        if (reason) {
            filtered = filtered.filter(ret => ret.return_reason === reason);
        }

        // Date range filter
        const period = document.getElementById('filterPeriod')?.value || 'all';
        if (period !== 'all') {
            const now = new Date();
            let startDate;

            switch (period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'custom':
                    const fromDate = document.getElementById('filterDateFrom')?.value;
                    const toDate = document.getElementById('filterDateTo')?.value;
                    if (fromDate) startDate = new Date(fromDate);
                    if (toDate) {
                        const endDate = new Date(toDate);
                        endDate.setHours(23, 59, 59, 999);
                        filtered = filtered.filter(ret => new Date(ret.return_date) <= endDate);
                    }
                    break;
            }

            if (startDate) {
                filtered = filtered.filter(ret => new Date(ret.return_date) >= startDate);
            }
        }

        // Condition filter
        const condition = document.getElementById('filterCondition')?.value || '';
        if (condition) {
            filtered = filtered.filter(ret => ret.item_condition === condition);
        }

        return filtered;
    }

    function filterReturns() {
        displayReturns(allReturnsData);
    }

    function handlePeriodChange() {
        const period = document.getElementById('filterPeriod')?.value;
        const customRange = document.getElementById('customDateRange');
        if (customRange) {
            customRange.style.display = period === 'custom' ? 'block' : 'none';
        }
        filterReturns();
    }

    function clearAllFilters() {
        document.getElementById('filterSearch').value = '';
        document.getElementById('headerSearch').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterReason').value = '';
        document.getElementById('filterPeriod').value = 'all';
        document.getElementById('filterCondition').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('customDateRange').style.display = 'none';
        filterReturns();
    }

    // ===== CREATE RETURN =====

    function openReturnModal() {
        currentReturnId = null;
        selectedSaleData = null;
        document.getElementById('returnModalTitle').textContent = 'Create Return';
        document.getElementById('returnForm').reset();
        document.getElementById('returnStep1').style.display = 'block';
        document.getElementById('returnStep2').style.display = 'none';
        document.getElementById('nextStepBtn').style.display = 'none';
        document.getElementById('submitReturnBtn').style.display = 'none';
        document.getElementById('saleSearchResults').innerHTML = '';
        document.getElementById('returnDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('returnModal').style.display = 'flex';
    }

    async function openReturnModalWithSale(saleId, productId) {
        openReturnModal();

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/sales/${saleId}`);
            const data = await response.json();

            if (response.ok && data.sale) {
                selectSaleForReturn(data.sale, productId);
            }
        } catch (error) {
            console.error('Error loading sale:', error);
        }
    }

    function closeReturnModal() {
        document.getElementById('returnModal').style.display = 'none';
    }

    async function handleSaleSearch(e) {
        const searchTerm = e.target.value.trim().toUpperCase();
        const resultsContainer = document.getElementById('saleSearchResults');

        if (searchTerm.length < 3) {
            resultsContainer.innerHTML = '';
            return;
        }

        resultsContainer.innerHTML = '<p style="color: #6b7280;">Searching...</p>';

        try {
            // Use universal search endpoint which we know works
            const response = await authenticatedFetch(`${API_BASE}/api/admin/universal-search?q=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();

            if (response.ok && data.sales && data.sales.length > 0) {
                let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
                data.sales.forEach(sale => {
                    const saleDate = sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'N/A';
                    const productName = sale.products && sale.products[0] ? sale.products[0].product_serial : 'Unknown';
                    const productSerial = sale.products && sale.products[0] ? sale.products[0].product_serial : '';
                    const salePrice = sale.sale_price || 0;

                    // Build sale object with necessary fields for return creation
                    const saleObj = {
                        _id: sale.id,
                        order_number: sale.order_number,
                        sale_date: sale.sale_date,
                        sale_price: salePrice,
                        order_total: salePrice,
                        platform: sale.platform,
                        products: sale.products || [],
                        outward_tracking_number: sale.outward_tracking_number
                    };

                    html += `
                        <div onclick='selectSaleForReturn(${JSON.stringify(saleObj).replace(/'/g, "&#39;")})'
                             style="padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; cursor: pointer; background: white; transition: all 0.2s;"
                             onmouseover="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff';"
                             onmouseout="this.style.borderColor='#dee2e6'; this.style.background='white';">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <div style="font-weight: 600;">${sale.order_number || 'No Order #'}</div>
                                    <div style="font-size: 0.9rem; color: #6b7280;">${sale.product_count || 1} product(s)</div>
                                    <div style="font-size: 0.8rem; color: #999;">${productSerial}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 600; color: #10b981;">£${salePrice.toFixed(2)}</div>
                                    <div style="font-size: 0.8rem; color: #999;">${saleDate}</div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                resultsContainer.innerHTML = html;
            } else {
                resultsContainer.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;">No sales found matching your search.</p>';
            }
        } catch (error) {
            console.error('Error searching sales:', error);
            resultsContainer.innerHTML = '<p style="color: #ef4444;">Error searching sales</p>';
        }
    }

    window.selectSaleForReturn = function(sale, productId) {
        selectedSaleData = sale;

        // Handle multi-product sales
        let product = null;
        if (sale.products && sale.products.length > 0) {
            product = productId
                ? sale.products.find(p => p.product_id === productId) || sale.products[0]
                : sale.products[0];
        }

        const productName = product?.product_name || sale.product_name || 'Unknown';
        const productSerial = product?.product_serial || sale.product_serial || 'N/A';
        const securityBarcode = product?.security_barcode || sale.security_barcode || 'N/A';
        const productId_final = product?.product_id || sale.product_id;

        selectedSaleData.selected_product_id = productId_final;
        selectedSaleData.selected_product_name = productName;
        selectedSaleData.selected_product_serial = productSerial;
        selectedSaleData.selected_security_barcode = securityBarcode;

        // Populate original sale info
        const saleDate = new Date(sale.sale_date).toLocaleDateString();
        const infoHtml = `
            <h4>Original Sale Information</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                <div>
                    <div style="font-size: 12px; color: #6b7280;">Order Number</div>
                    <div style="font-weight: 600;">${sale.order_number || 'N/A'}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #6b7280;">Sale Date</div>
                    <div style="font-weight: 600;">${saleDate}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #6b7280;">Platform</div>
                    <div style="font-weight: 600;">${sale.platform || 'N/A'}</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: #6b7280;">Sale Price</div>
                    <div style="font-weight: 600; color: #10b981;">£${(sale.order_total || sale.sale_price || 0).toFixed(2)}</div>
                </div>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
                <div style="font-size: 12px; color: #6b7280;">Product</div>
                <div style="font-weight: 600;">${productName}</div>
                <div style="font-size: 0.9rem; color: #666;">${productSerial} · ${securityBarcode}</div>
            </div>
        `;
        document.getElementById('originalSaleInfo').innerHTML = infoHtml;

        // Pre-fill refund amount with sale price
        document.getElementById('refundAmount').value = (sale.order_total || sale.sale_price || 0).toFixed(2);

        // Show step 2
        goToReturnStep(2);
    };

    window.goToReturnStep = function(step) {
        if (step === 2) {
            if (!selectedSaleData) {
                alert('Please select a sale first.');
                return;
            }
            document.getElementById('returnStep1').style.display = 'none';
            document.getElementById('returnStep2').style.display = 'block';
            document.getElementById('nextStepBtn').style.display = 'none';
            document.getElementById('submitReturnBtn').style.display = 'inline-flex';
        } else {
            document.getElementById('returnStep1').style.display = 'block';
            document.getElementById('returnStep2').style.display = 'none';
            document.getElementById('nextStepBtn').style.display = selectedSaleData ? 'inline-flex' : 'none';
            document.getElementById('submitReturnBtn').style.display = 'none';
        }
    };

    async function handleReturnSubmit(e) {
        e.preventDefault();

        if (!selectedSaleData) {
            alert('Please select a sale first.');
            return;
        }

        const returnData = {
            sale_id: selectedSaleData._id,
            product_id: selectedSaleData.selected_product_id,
            order_number: selectedSaleData.order_number,
            product_name: selectedSaleData.selected_product_name,
            product_serial: selectedSaleData.selected_product_serial,
            security_barcode: selectedSaleData.selected_security_barcode,
            platform: selectedSaleData.platform,
            original_sale_date: selectedSaleData.sale_date,
            original_sale_price: selectedSaleData.order_total || selectedSaleData.sale_price,
            return_reason: document.getElementById('returnReason').value,
            return_reason_details: document.getElementById('returnReasonDetails').value,
            return_date: document.getElementById('returnDate').value,
            return_tracking_number: document.getElementById('returnTrackingNumber').value.trim().toUpperCase() || null,
            return_tracking_provider: document.getElementById('returnTrackingProvider').value || null,
            expected_delivery_date: document.getElementById('expectedDeliveryDate').value || null,
            refund_amount: parseFloat(document.getElementById('refundAmount').value) || 0,
            original_postage_lost: parseFloat(document.getElementById('originalPostageLost').value) || 0,
            return_postage_cost: parseFloat(document.getElementById('returnPostageCost').value) || 0,
            notes: document.getElementById('returnNotes').value
        };

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(returnData)
            });

            const data = await response.json();

            if (response.ok) {
                closeReturnModal();
                loadReturns();
                loadSummary();
                showSuccess('Return created successfully');
            } else {
                showError(data.error || 'Failed to create return');
            }
        } catch (error) {
            console.error('Error creating return:', error);
            showError('Error creating return');
        }
    }

    // ===== VIEW/MANAGE RETURN =====

    window.viewReturn = async function(returnId) {
        currentReturnId = returnId;

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/${returnId}`);
            const data = await response.json();

            if (response.ok && data.return) {
                displayReturnDetails(data.return);
                document.getElementById('manageReturnModal').style.display = 'flex';
            } else {
                showError('Failed to load return details');
            }
        } catch (error) {
            console.error('Error loading return:', error);
            showError('Error loading return details');
        }
    };

    function displayReturnDetails(ret) {
        const body = document.getElementById('manageReturnBody');
        const footer = document.getElementById('manageReturnFooter');

        const returnDate = new Date(ret.return_date).toLocaleDateString();
        const saleDate = ret.original_sale_date ? new Date(ret.original_sale_date).toLocaleDateString() : 'N/A';
        const statusBadge = getStatusBadge(ret.status);
        const totalLoss = (ret.refund_amount || 0) + (ret.original_postage_lost || 0) + (ret.return_postage_cost || 0);

        // Build timeline
        let timelineHtml = '<div class="return-timeline">';

        // Return opened
        timelineHtml += `
            <div class="timeline-item completed">
                <div class="timeline-date">${returnDate}</div>
                <div class="timeline-title">Return Opened</div>
                <div class="timeline-desc">Reason: ${getReasonDisplay(ret.return_reason)}</div>
            </div>
        `;

        // In transit
        if (ret.return_tracking_number) {
            const isTransit = ['in_transit', 'received', 'inspected', 'restocked'].includes(ret.status);
            timelineHtml += `
                <div class="timeline-item ${isTransit ? 'completed' : ''}">
                    <div class="timeline-date">${ret.tracking_added_date ? new Date(ret.tracking_added_date).toLocaleDateString() : ''}</div>
                    <div class="timeline-title">In Transit</div>
                    <div class="timeline-desc">Tracking: ${ret.return_tracking_number}</div>
                </div>
            `;
        }

        // Received
        if (['received', 'inspected', 'restocked'].includes(ret.status)) {
            timelineHtml += `
                <div class="timeline-item completed">
                    <div class="timeline-date">${ret.received_date ? new Date(ret.received_date).toLocaleDateString() : ''}</div>
                    <div class="timeline-title">Item Received</div>
                </div>
            `;
        }

        // Inspected
        if (['inspected', 'restocked'].includes(ret.status)) {
            timelineHtml += `
                <div class="timeline-item completed">
                    <div class="timeline-date">${ret.inspection_date ? new Date(ret.inspection_date).toLocaleDateString() : ''}</div>
                    <div class="timeline-title">Inspected</div>
                    <div class="timeline-desc">Condition: ${getConditionDisplay(ret.item_condition)}</div>
                </div>
            `;
        }

        // Restocked
        if (ret.status === 'restocked') {
            timelineHtml += `
                <div class="timeline-item completed">
                    <div class="timeline-date">${ret.restocked_date ? new Date(ret.restocked_date).toLocaleDateString() : ''}</div>
                    <div class="timeline-title">Restocked</div>
                    <div class="timeline-desc">Item back in inventory</div>
                </div>
            `;
        }

        timelineHtml += '</div>';

        body.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0 0 4px 0;">${ret.order_number || 'No Order #'}</h3>
                    <div style="color: #6b7280;">${ret.product_name || 'Unknown Product'}</div>
                </div>
                ${statusBadge}
            </div>

            <div class="original-sale-info">
                <h4>Original Sale (Tax Record)</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                    <div>
                        <div style="font-size: 12px; color: #6b7280;">Sale Date</div>
                        <div style="font-weight: 600;">${saleDate}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #6b7280;">Platform</div>
                        <div style="font-weight: 600;">${ret.platform || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #6b7280;">Original Sale Price</div>
                        <div style="font-weight: 600; color: #10b981;">£${(ret.original_sale_price || 0).toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #6b7280;">Product Serial</div>
                        <div style="font-weight: 600;">${ret.product_serial || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #6b7280;">Security Barcode</div>
                        <div style="font-weight: 600;">${ret.security_barcode || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">Return Details</h4>
                    <div style="background: #f9fafb; border-radius: 8px; padding: 16px;">
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Return Date</div>
                            <div style="font-weight: 600;">${returnDate}</div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Reason</div>
                            <div style="font-weight: 600;">${getReasonDisplay(ret.return_reason)}</div>
                            ${ret.return_reason_details ? `<div style="font-size: 0.9rem; color: #666; margin-top: 4px;">${ret.return_reason_details}</div>` : ''}
                        </div>
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Return Tracking</div>
                            <div style="font-weight: 600;">${ret.return_tracking_number || 'Not provided'}</div>
                            ${ret.return_tracking_provider ? `<div style="font-size: 0.9rem; color: #666;">${ret.return_tracking_provider}</div>` : ''}
                        </div>
                        ${ret.item_condition ? `
                            <div>
                                <div style="font-size: 12px; color: #6b7280;">Item Condition</div>
                                <div style="font-weight: 600;">${getConditionDisplay(ret.item_condition)}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div>
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">Financial Impact</h4>
                    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; border: 1px solid #fecaca;">
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Refund Amount</div>
                            <div style="font-weight: 600; color: #ef4444;">£${(ret.refund_amount || 0).toFixed(2)}</div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Original Postage Lost</div>
                            <div style="font-weight: 600; color: #ef4444;">£${(ret.original_postage_lost || 0).toFixed(2)}</div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Return Postage Cost</div>
                            <div style="font-weight: 600; color: #ef4444;">£${(ret.return_postage_cost || 0).toFixed(2)}</div>
                        </div>
                        <div style="border-top: 1px solid #fecaca; padding-top: 12px;">
                            <div style="font-size: 12px; color: #6b7280;">Total Loss</div>
                            <div style="font-weight: 700; font-size: 1.2rem; color: #dc2626;">£${totalLoss.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">Return Timeline</h4>
            ${timelineHtml}

            ${ret.notes ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">Notes</h4>
                    <div style="background: #f9fafb; border-radius: 8px; padding: 12px; color: #374151;">${ret.notes}</div>
                </div>
            ` : ''}

            ${ret.inspection_notes ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase;">Inspection Notes</h4>
                    <div style="background: #f9fafb; border-radius: 8px; padding: 12px; color: #374151;">${ret.inspection_notes}</div>
                </div>
            ` : ''}
        `;

        // Build footer actions based on status
        let actionsHtml = '<button type="button" class="button button-secondary" onclick="closeManageReturnModal()">Close</button>';

        switch (ret.status) {
            case 'pending':
                actionsHtml += `
                    <button type="button" class="button button-primary" onclick="updateReturnTracking('${ret._id}')">Add Tracking</button>
                    <button type="button" class="button button-primary" onclick="markAsReceived('${ret._id}')">Mark Received</button>
                `;
                break;
            case 'in_transit':
                actionsHtml += `
                    <button type="button" class="button button-primary" onclick="markAsReceived('${ret._id}')">Mark Received</button>
                `;
                break;
            case 'received':
                actionsHtml += `
                    <button type="button" class="button button-primary" onclick="openInspectionModal('${ret._id}')">Inspect Item</button>
                `;
                break;
            case 'inspected':
                actionsHtml += `
                    <button type="button" class="button button-primary" onclick="openRestockModal('${ret._id}')" style="background: #10b981;">Restock Item</button>
                `;
                break;
        }

        footer.innerHTML = actionsHtml;
    }

    function closeManageReturnModal() {
        document.getElementById('manageReturnModal').style.display = 'none';
    }

    // ===== STATUS UPDATES =====

    window.updateReturnTracking = async function(returnId) {
        const trackingNumber = prompt('Enter return tracking number:');
        if (!trackingNumber) return;

        const provider = prompt('Enter carrier (royal_mail, evri, dpd, yodel, amazon, other):') || 'other';

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/${returnId}/tracking`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    return_tracking_number: trackingNumber.trim().toUpperCase(),
                    return_tracking_provider: provider
                })
            });

            if (response.ok) {
                closeManageReturnModal();
                loadReturns();
                loadSummary();
                showSuccess('Tracking updated');
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to update tracking');
            }
        } catch (error) {
            console.error('Error updating tracking:', error);
            showError('Error updating tracking');
        }
    };

    window.markAsReceived = async function(returnId) {
        if (!confirm('Mark this return as received?')) return;

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/${returnId}/received`, {
                method: 'PUT'
            });

            if (response.ok) {
                closeManageReturnModal();
                loadReturns();
                loadSummary();
                showSuccess('Return marked as received');
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to update status');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showError('Error updating status');
        }
    };

    // ===== INSPECTION =====

    window.openInspectionModal = function(returnId) {
        currentReturnId = returnId;
        document.getElementById('inspectionForm').reset();
        document.getElementById('inspectionModal').style.display = 'flex';
    };

    function closeInspectionModal() {
        document.getElementById('inspectionModal').style.display = 'none';
    }
    window.closeInspectionModal = closeInspectionModal;

    async function handleInspectionSubmit(e) {
        e.preventDefault();

        const inspectionData = {
            item_condition: document.querySelector('input[name="itemCondition"]:checked')?.value,
            serial_verified: document.getElementById('serialVerified').checked,
            security_barcode_verified: document.getElementById('securityBarcodeVerified').checked,
            physical_condition_ok: document.getElementById('physicalCondition').checked,
            functional_test_passed: document.getElementById('functionalTest').checked,
            inspection_notes: document.getElementById('inspectionNotes').value,
            recommended_action: document.querySelector('input[name="recommendAction"]:checked')?.value
        };

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/${currentReturnId}/inspect`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inspectionData)
            });

            if (response.ok) {
                closeInspectionModal();
                closeManageReturnModal();
                loadReturns();
                loadSummary();
                showSuccess('Inspection saved');
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to save inspection');
            }
        } catch (error) {
            console.error('Error saving inspection:', error);
            showError('Error saving inspection');
        }
    }

    // ===== RESTOCK =====

    window.openRestockModal = function(returnId) {
        currentReturnId = returnId;
        document.getElementById('restockForm').reset();
        document.getElementById('archiveReturnData').checked = true;
        document.getElementById('restockModal').style.display = 'flex';
    };

    function closeRestockModal() {
        document.getElementById('restockModal').style.display = 'none';
    }
    window.closeRestockModal = closeRestockModal;

    async function handleRestockSubmit(e) {
        e.preventDefault();

        const restockData = {
            new_security_barcode: document.getElementById('newSecurityBarcode').value.trim().toUpperCase() || null,
            restock_notes: document.getElementById('restockNotes').value,
            archive_return: document.getElementById('archiveReturnData').checked
        };

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/${currentReturnId}/restock`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(restockData)
            });

            if (response.ok) {
                closeRestockModal();
                closeManageReturnModal();
                loadReturns();
                loadSummary();
                showSuccess('Item restocked successfully');
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to restock item');
            }
        } catch (error) {
            console.error('Error restocking:', error);
            showError('Error restocking item');
        }
    }

    // ===== DELETE =====

    window.deleteReturn = async function(returnId) {
        if (!confirm('Are you sure you want to delete this return record? This cannot be undone.')) return;

        try {
            const response = await authenticatedFetch(`${API_BASE}/api/admin/returns/${returnId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadReturns();
                loadSummary();
                showSuccess('Return deleted');
            } else {
                const data = await response.json();
                showError(data.error || 'Failed to delete return');
            }
        } catch (error) {
            console.error('Error deleting return:', error);
            showError('Error deleting return');
        }
    };

    // ===== TRACKING =====

    window.trackReturn = async function(returnId) {
        // For now just view the return - in future could integrate with carrier APIs
        viewReturn(returnId);
    };

    // ===== UTILITIES =====

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

    function showError(message) {
        alert('Error: ' + message);
    }

    function showSuccess(message) {
        // Could be enhanced with toast notifications
        console.log('Success:', message);
    }

    // Export functions for global access
    window.closeReturnModal = closeReturnModal;
    window.closeManageReturnModal = closeManageReturnModal;

})();
