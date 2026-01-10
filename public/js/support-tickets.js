// Support Tickets Management JavaScript

// State
let allTickets = [];
let currentFilter = 'all';
let currentTicket = null;
let ticketToDelete = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTickets();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderTickets();
        });
    });

    // Search
    const searchInput = document.getElementById('ticketSearchInput');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderTickets();
            }, 300);
        });
    }

    // Filter dropdowns
    ['priorityFilter', 'typeFilter', 'assigneeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', renderTickets);
        }
    });

    // Modal close on overlay click
    document.getElementById('ticketModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'ticketModal') closeTicketModal();
    });
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });
}

// Load tickets from API
async function loadTickets() {
    try {
        const response = await authenticatedFetch('/api/admin/support-tickets');
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load tickets');
        }

        allTickets = data.tickets || [];
        updateStats(data.counts);
        renderTickets();
    } catch (error) {
        console.error('Error loading tickets:', error);
        showError('Failed to load tickets: ' + error.message);
    }
}

// Update statistics
function updateStats(counts) {
    document.getElementById('statTotalTickets').textContent = counts?.total || 0;
    document.getElementById('statOpenTickets').textContent = counts?.open || 0;
    document.getElementById('statInProgressTickets').textContent = counts?.in_progress || 0;
    document.getElementById('statResolvedTickets').textContent = counts?.resolved || 0;

    // Count critical priority tickets
    const criticalCount = allTickets.filter(t => t.priority === 'critical' && t.status !== 'closed').length;
    document.getElementById('statCriticalTickets').textContent = criticalCount;

    // Update tab counts
    document.getElementById('countAll').textContent = counts?.total || 0;
    document.getElementById('countOpen').textContent = counts?.open || 0;
    document.getElementById('countInProgress').textContent = counts?.in_progress || 0;
    document.getElementById('countResolved').textContent = counts?.resolved || 0;
    document.getElementById('countClosed').textContent = counts?.closed || 0;
}

// Filter tickets
function getFilteredTickets() {
    let filtered = [...allTickets];

    // Status filter from tabs
    if (currentFilter !== 'all') {
        filtered = filtered.filter(t => t.status === currentFilter);
    }

    // Priority filter
    const priorityFilter = document.getElementById('priorityFilter')?.value;
    if (priorityFilter && priorityFilter !== 'all') {
        filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    // Type filter
    const typeFilter = document.getElementById('typeFilter')?.value;
    if (typeFilter && typeFilter !== 'all') {
        filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Assignee filter
    const assigneeFilter = document.getElementById('assigneeFilter')?.value;
    if (assigneeFilter && assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned') {
            filtered = filtered.filter(t => !t.assigned_to);
        } else {
            filtered = filtered.filter(t => t.assigned_to === assigneeFilter);
        }
    }

    // Search
    const searchQuery = document.getElementById('ticketSearchInput')?.value?.toLowerCase().trim();
    if (searchQuery) {
        filtered = filtered.filter(t =>
            t.ticket_id?.toLowerCase().includes(searchQuery) ||
            t.message?.toLowerCase().includes(searchQuery) ||
            t.user_email?.toLowerCase().includes(searchQuery)
        );
    }

    return filtered;
}

// Render tickets
function renderTickets() {
    const container = document.getElementById('ticketsContainer');
    const tickets = getFilteredTickets();

    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #374151;">No Tickets Found</h3>
                <p style="margin: 0; font-size: 0.95rem;">There are no support tickets matching your filters.</p>
            </div>
        `;
        return;
    }

    const html = `
        <div class="tickets-grid">
            ${tickets.map(ticket => renderTicketCard(ticket)).join('')}
        </div>
    `;
    container.innerHTML = html;
}

// Render single ticket card
function renderTicketCard(ticket) {
    const createdAt = new Date(ticket.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const typeLabels = {
        'fault': 'Fault / Issue',
        'suggestion': 'Suggestion',
        'feature_request': 'Feature Request'
    };

    const statusLabels = {
        'open': 'Open',
        'in_progress': 'In Progress',
        'resolved': 'Resolved',
        'closed': 'Closed'
    };

    const truncatedMessage = ticket.message?.length > 200
        ? ticket.message.substring(0, 200) + '...'
        : ticket.message;

    return `
        <div class="ticket-card priority-${ticket.priority}">
            <div class="ticket-header">
                <span class="ticket-id">${ticket.ticket_id}</span>
                <div class="ticket-badges">
                    <span class="type-badge ${ticket.type}">${typeLabels[ticket.type] || ticket.type}</span>
                    <span class="priority-badge ${ticket.priority}">${ticket.priority}</span>
                    <span class="status-badge ${ticket.status}">${statusLabels[ticket.status] || ticket.status}</span>
                </div>
            </div>
            <div class="ticket-message">${escapeHtml(truncatedMessage || 'No message')}</div>
            <div class="ticket-meta">
                <div class="ticket-meta-row">
                    <svg class="ticket-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"/>
                    </svg>
                    <span>Created: <strong>${createdAt}</strong></span>
                </div>
                ${ticket.user_email ? `
                <div class="ticket-meta-row">
                    <svg class="ticket-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z"/>
                    </svg>
                    <span>From: <strong>${escapeHtml(ticket.user_email)}</strong></span>
                </div>
                ` : ''}
                ${ticket.assigned_to ? `
                <div class="ticket-meta-row">
                    <svg class="ticket-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"/>
                    </svg>
                    <span>Assigned to: <strong>${escapeHtml(ticket.assigned_to)}</strong></span>
                </div>
                ` : `
                <div class="ticket-meta-row">
                    <svg class="ticket-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"/>
                    </svg>
                    <span style="color: #9ca3af;">Unassigned</span>
                </div>
                `}
                ${ticket.page ? `
                <div class="ticket-meta-row">
                    <svg class="ticket-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5"/>
                    </svg>
                    <span>Page: <strong>${escapeHtml(ticket.page)}</strong></span>
                </div>
                ` : ''}
                ${ticket.notes?.length > 0 ? `
                <div class="ticket-meta-row">
                    <svg class="ticket-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 8H17M7 12H11M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"/>
                    </svg>
                    <span>${ticket.notes.length} note${ticket.notes.length === 1 ? '' : 's'}</span>
                </div>
                ` : ''}
            </div>
            <div class="ticket-actions">
                <button class="button button-secondary" onclick="openTicketModal('${ticket.ticket_id}')">View / Edit</button>
                ${ticket.status !== 'closed' ? `
                <button class="button button-primary" onclick="quickUpdateStatus('${ticket.ticket_id}', '${getNextStatus(ticket.status)}')">${getNextStatusLabel(ticket.status)}</button>
                ` : ''}
                <button class="button" style="background: #fee2e2; color: #991b1b;" onclick="openDeleteModal('${ticket.ticket_id}')">Delete</button>
            </div>
        </div>
    `;
}

// Get next status in workflow
function getNextStatus(currentStatus) {
    const flow = {
        'open': 'in_progress',
        'in_progress': 'resolved',
        'resolved': 'closed'
    };
    return flow[currentStatus] || 'closed';
}

function getNextStatusLabel(currentStatus) {
    const labels = {
        'open': 'Start',
        'in_progress': 'Resolve',
        'resolved': 'Close'
    };
    return labels[currentStatus] || 'Close';
}

// Quick update status
async function quickUpdateStatus(ticketId, newStatus) {
    try {
        const response = await authenticatedFetch(`/api/admin/support-tickets/${ticketId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update ticket');
        }

        // Reload tickets
        await loadTickets();
    } catch (error) {
        console.error('Error updating ticket:', error);
        alert('Failed to update ticket: ' + error.message);
    }
}

// Open ticket modal
async function openTicketModal(ticketId) {
    try {
        const response = await authenticatedFetch(`/api/admin/support-tickets/${ticketId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to load ticket');
        }

        currentTicket = data.ticket;
        renderTicketModal(currentTicket);
        document.getElementById('ticketModal').classList.add('open');
    } catch (error) {
        console.error('Error loading ticket:', error);
        alert('Failed to load ticket: ' + error.message);
    }
}

// Render ticket modal content
function renderTicketModal(ticket) {
    document.getElementById('modalTicketId').textContent = ticket.ticket_id;

    const typeLabels = {
        'fault': 'Fault / Issue',
        'suggestion': 'Suggestion',
        'feature_request': 'Feature Request'
    };

    const createdAt = new Date(ticket.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const updatedAt = new Date(ticket.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const body = document.getElementById('ticketModalBody');
    body.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
                <span class="type-badge ${ticket.type}">${typeLabels[ticket.type] || ticket.type}</span>
            </div>
        </div>

        <!-- Message -->
        <div style="margin-bottom: 24px;">
            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Message</label>
            <div style="background: #f9fafb; padding: 16px; border-radius: 8px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${escapeHtml(ticket.message)}</div>
        </div>

        <!-- Details Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Status</label>
                <select id="modalStatus" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.95rem;">
                    <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Open</option>
                    <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Closed</option>
                </select>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Priority</label>
                <select id="modalPriority" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.95rem;">
                    <option value="low" ${ticket.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${ticket.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${ticket.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="critical" ${ticket.priority === 'critical' ? 'selected' : ''}>Critical</option>
                </select>
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Assigned To</label>
                <input type="text" id="modalAssignedTo" value="${ticket.assigned_to || ''}" placeholder="Enter name..." style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.95rem;">
            </div>
            <div>
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Submitted From</label>
                <div style="padding: 10px; background: #f9fafb; border-radius: 6px; font-size: 0.95rem; color: #6b7280;">${escapeHtml(ticket.page || 'Unknown')}</div>
            </div>
        </div>

        <!-- Contact Info -->
        ${ticket.user_email ? `
        <div style="margin-bottom: 24px; padding: 16px; background: #eff6ff; border-radius: 8px;">
            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #374151;">Contact Email</label>
            <a href="mailto:${escapeHtml(ticket.user_email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(ticket.user_email)}</a>
        </div>
        ` : ''}

        <!-- Timestamps -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
            <div>
                <label style="display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 4px;">Created</label>
                <div style="font-size: 0.95rem; color: #374151;">${createdAt}</div>
            </div>
            <div>
                <label style="display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 4px;">Last Updated</label>
                <div style="font-size: 0.95rem; color: #374151;">${updatedAt}</div>
            </div>
        </div>

        <!-- Notes Section -->
        <div class="notes-section">
            <h4 style="margin: 0 0 16px 0; font-size: 1.1rem; color: #111827;">Notes & Updates</h4>
            <div id="notesList">
                ${ticket.notes?.length > 0 ? ticket.notes.map(note => `
                    <div class="note-item">
                        <div class="note-meta">
                            <strong>${escapeHtml(note.author || 'Admin')}</strong> - ${new Date(note.created_at).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                        <div class="note-content">${escapeHtml(note.content)}</div>
                    </div>
                `).join('') : '<p style="color: #6b7280; font-style: italic;">No notes yet.</p>'}
            </div>
            <div class="add-note-form">
                <textarea id="newNoteContent" placeholder="Add a note..."></textarea>
                <button onclick="addNote()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-size: 0.95rem; font-weight: 500; cursor: pointer; white-space: nowrap;">Add Note</button>
            </div>
        </div>
    `;
}

// Close ticket modal
function closeTicketModal() {
    document.getElementById('ticketModal').classList.remove('open');
    currentTicket = null;
}

// Save ticket changes
async function saveTicketChanges() {
    if (!currentTicket) return;

    const status = document.getElementById('modalStatus').value;
    const priority = document.getElementById('modalPriority').value;
    const assigned_to = document.getElementById('modalAssignedTo').value.trim();

    try {
        const response = await authenticatedFetch(`/api/admin/support-tickets/${currentTicket.ticket_id}`, {
            method: 'PUT',
            body: JSON.stringify({ status, priority, assigned_to })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update ticket');
        }

        closeTicketModal();
        await loadTickets();
    } catch (error) {
        console.error('Error saving ticket:', error);
        alert('Failed to save changes: ' + error.message);
    }
}

// Add note
async function addNote() {
    if (!currentTicket) return;

    const content = document.getElementById('newNoteContent').value.trim();
    if (!content) {
        alert('Please enter a note.');
        return;
    }

    try {
        const response = await authenticatedFetch(`/api/admin/support-tickets/${currentTicket.ticket_id}/notes`, {
            method: 'POST',
            body: JSON.stringify({ content, author: 'Admin' })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to add note');
        }

        // Update current ticket and re-render
        currentTicket = data.ticket;
        renderTicketModal(currentTicket);
        document.getElementById('newNoteContent').value = '';

        // Reload tickets to update any counts
        await loadTickets();
    } catch (error) {
        console.error('Error adding note:', error);
        alert('Failed to add note: ' + error.message);
    }
}

// Open delete modal
function openDeleteModal(ticketId) {
    ticketToDelete = ticketId;
    document.getElementById('deleteTicketId').textContent = ticketId;
    document.getElementById('deleteModal').classList.add('open');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('open');
    ticketToDelete = null;
}

// Confirm delete
async function confirmDelete() {
    if (!ticketToDelete) return;

    try {
        const response = await authenticatedFetch(`/api/admin/support-tickets/${ticketToDelete}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to delete ticket');
        }

        closeDeleteModal();
        await loadTickets();
    } catch (error) {
        console.error('Error deleting ticket:', error);
        alert('Failed to delete ticket: ' + error.message);
    }
}

// Helper: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper: Show error
function showError(message) {
    const container = document.getElementById('ticketsContainer');
    container.innerHTML = `
        <div class="empty-state" style="background: #fef2f2; border: 1px solid #fecaca;">
            <div class="empty-state-icon">⚠️</div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #991b1b;">Error</h3>
            <p style="margin: 0; font-size: 0.95rem; color: #991b1b;">${escapeHtml(message)}</p>
            <button onclick="loadTickets()" style="margin-top: 16px; background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Retry</button>
        </div>
    `;
}
