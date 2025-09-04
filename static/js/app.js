// app.js - User Interface JavaScript (fixed)

// Global socket + current ticket
let socket;
let currentTicket = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    initializeSocket();
    setupFormHandlers();
    loadQueueStatus();
});

// -----------------------------
// Socket.IO connection
// -----------------------------
function initializeSocket() {
    // prefer websocket but allow polling fallback
    socket = io({
        transports: ['polling', 'websocket']
    });

    socket.on('connect', function () {
        console.log('✅ Connected to server, socket id:', socket.id);
        updateConnectionStatus('connected');
        addLiveUpdate('🔗 Connected to queue system', 'success');

        // After connect, ensure UI is immediately up-to-date
        loadQueueStatus();

        // If user currently has a ticket, refresh its status once connected
        if (currentTicket) {
            refreshTicketStatus();
        }
    });

    socket.on('disconnect', function (reason) {
        console.warn('⚠️ Disconnected from server:', reason);
        updateConnectionStatus('disconnected');
        addLiveUpdate('❌ Connection lost - attempting to reconnect...', 'error');
    });

    socket.on('connect_error', function (error) {
        console.error('❌ Connection error:', error);
        updateConnectionStatus('disconnected');
        addLiveUpdate('❌ Connection error', 'error');
    });

    socket.io.on('reconnect_attempt', () => {
        console.log('♻️ Reconnect attempt...');
        updateConnectionStatus('connecting');
    });

    socket.on('queue_updated', function (data) {
        console.log('📊 queue_updated received:', data);
        updateQueueStatus(data);

        // If user has ticket, refresh its details (position/status)
        if (currentTicket) {
            refreshTicketStatus();
        }
    });

    socket.on('ticket_served', function (ticket) {
        console.log('🎟 ticket_served:', ticket);
        addLiveUpdate(`🎯 Ticket #${ticket.number} is now being served`, 'success');

        // If this is our ticket, show notification + update display
        if (currentTicket && currentTicket.id === ticket.id) {
            showNotification('Your ticket is now being served!', 'success');
            updateTicketDisplay(ticket);
        }
    });
}

// -----------------------------
// Polling fallback (only when socket NOT connected)
// avoids double-refresh when socket is active
// -----------------------------
setInterval(function () {
    if (!socket || !socket.connected) {
        // Poll every 5s while disconnected
        loadQueueStatus();
    }
}, 5000);

// -----------------------------
// Form handling
// -----------------------------
function setupFormHandlers() {
    const form = document.getElementById('ticketForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        requestTicket();
    });
}

// -----------------------------
// Request a new ticket
// -----------------------------
async function requestTicket() {
    const form = document.getElementById('ticketForm');
    if (!form) return;

    const formData = new FormData(form);
    const ticketData = {
        name: formData.get('name'),
        email: formData.get('email'),
        category: formData.get('category'),
        priority_type: formData.get('priority')
    };

    // Validate form
    if (!ticketData.name || !ticketData.email || !ticketData.category || !ticketData.priority_type) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : null;
    if (submitBtn) {
        submitBtn.innerHTML = '<span class="spinner"></span> Requesting...';
        submitBtn.disabled = true;
    }

    try {
        const response = await fetch('/api/request-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticketData)
        });

        const result = await response.json();

        if (result.success) {
            currentTicket = result.ticket;
            showTicket(result.ticket);
            showNotification(result.message, 'success');
            form.reset();
            addLiveUpdate(`🎫 New ticket #${result.ticket.number} requested by ${result.ticket.name}`, 'info');
        } else {
            showNotification(result.error || 'Failed to request ticket', 'error');
        }
    } catch (error) {
        console.error('Error requesting ticket:', error);
        showNotification('Network error - please try again', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// -----------------------------
// Display ticket information
// -----------------------------
function showTicket(ticket) {
    const requestForm = document.getElementById('request-form');
    const ticketDisplay = document.getElementById('ticket-display');

    if (requestForm) requestForm.style.display = 'none';
    if (ticketDisplay) ticketDisplay.style.display = 'block';

    // Update ticket fields (defensive checks)
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('ticket-number', `#${ticket.number}`);
    setText('ticket-name', ticket.name);
    setText('ticket-service', formatService(ticket.category));
    setText('queue-position', ticket.position || '-');
    setText('ticket-status', (ticket.status || '').toUpperCase());
    setText('estimated-wait', calculateEstimatedWait(ticket.position));

    // Priority badge
    const priorityBadge = document.getElementById('priority-badge');
    if (priorityBadge) {
        priorityBadge.textContent = (ticket.priority_type || '').toUpperCase();
        priorityBadge.className = `badge priority-${ticket.priority_type}`;
    }

    const statusBadge = document.getElementById('ticket-status');
    if (statusBadge) {
        statusBadge.className = `status-badge ${ticket.status}`;
    }

    // Smooth scroll to ticket display
    if (ticketDisplay) ticketDisplay.scrollIntoView({ behavior: 'smooth' });
}

// -----------------------------
// Update ticket display with new information
// -----------------------------
function updateTicketDisplay(ticket) {
    if (!currentTicket || !ticket || currentTicket.id !== ticket.id) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('queue-position', ticket.position || 'Being Served');
    setText('ticket-status', (ticket.status || '').toUpperCase());
    setText('estimated-wait', ticket.status === 'served' ? 'Now' : calculateEstimatedWait(ticket.position));

    const statusBadge = document.getElementById('ticket-status');
    if (statusBadge) statusBadge.className = `status-badge ${ticket.status}`;
}

// -----------------------------
// Update queue status display
// -----------------------------
function updateQueueStatus(data) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setText('waiting-count', data.waiting_count || 0);
    setText('served-count', data.served_count || 0);
    setText('next-number', data.next_ticket ? `#${data.next_ticket.number}` : '-');

    // Update priority statistics
    updatePriorityStats(data.priority_stats || {});
}

// -----------------------------
// Update priority statistics display
// -----------------------------
function updatePriorityStats(stats) {
    const container = document.getElementById('priority-stats');
    if (!container) return;

    let html = '<h4 style="margin-bottom: 10px; color: #666;">Priority Breakdown:</h4>';
    const priorityLabels = {
        staff: 'Staff',
        elderly: 'Senior Citizens',
        disabled: 'Disabled',
        regular: 'Regular'
    };

    for (const [priority, count] of Object.entries(stats)) {
        html += `
            <div class="priority-stat">
                <span>${priorityLabels[priority] || priority}</span>
                <span><strong>${count}</strong></span>
            </div>
        `;
    }

    container.innerHTML = html;
}

// -----------------------------
// Load initial queue status
// -----------------------------
async function loadQueueStatus() {
    try {
        const response = await fetch('/api/queue-status');
        const data = await response.json();
        updateQueueStatus(data);
    } catch (error) {
        console.error('Error loading queue status:', error);
    }
}

// -----------------------------
// Refresh ticket status
// -----------------------------
async function refreshTicketStatus() {
    if (!currentTicket) return;

    try {
        const response = await fetch(`/api/my-ticket/${currentTicket.id}`);
        const ticket = await response.json();

        if (!ticket.error) {
            currentTicket = ticket;
            updateTicketDisplay(ticket);
        } else {
            // ticket may have been removed; clear UI if not found
            console.warn('Ticket refresh: ', ticket.error);
        }
    } catch (error) {
        console.error('Error refreshing ticket status:', error);
    }
}

// -----------------------------
// Utility UI functions
// -----------------------------
function requestAnother() {
    const requestForm = document.getElementById('request-form');
    const ticketDisplay = document.getElementById('ticket-display');

    if (requestForm) requestForm.style.display = 'block';
    if (ticketDisplay) ticketDisplay.style.display = 'none';

    currentTicket = null;
    if (requestForm) requestForm.scrollIntoView({ behavior: 'smooth' });
}

function refreshStatus() {
    if (currentTicket) {
        refreshTicketStatus();
    }
    loadQueueStatus();
    showNotification('Status refreshed', 'info');
}

function formatService(category) {
    const serviceMap = {
        railway: 'Railway Booking',
        airline: 'Airline Booking',
        exam: 'Exam Registration',
        government: 'Government Service',
        healthcare: 'Healthcare Service',
        other: 'Other Service'
    };
    return serviceMap[category] || category;
}

function calculateEstimatedWait(position) {
    if (!position || position <= 0) return 'Now';

    const avgServiceTime = 3; // minutes per customer (adjust as needed)
    const estimatedMinutes = position * avgServiceTime;

    if (estimatedMinutes < 60) return `~${estimatedMinutes} min`;

    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    return `~${hours}h ${minutes}m`;
}

// -----------------------------
// Notifications & Live updates
// -----------------------------
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function addLiveUpdate(message, type = 'info') {
    const container = document.getElementById('live-updates');
    if (!container) return;

    const update = document.createElement('div');
    update.className = `update-item activity-${type}`;

    const now = new Date().toLocaleTimeString();
    update.innerHTML = `
        <div class="activity-text">${message}</div>
        <div class="update-time">${now}</div>
    `;

    container.insertBefore(update, container.firstChild);

    // Keep only last 10 updates
    const updates = container.querySelectorAll('.update-item');
    if (updates.length > 10) updates[updates.length - 1].remove();
}

function updateConnectionStatus(status) {
    let existing = document.querySelector('.connection-status');
    if (!existing) {
        existing = document.createElement('div');
        existing.className = 'connection-status';
        document.body.appendChild(existing);
    }

    existing.className = `connection-status ${status}`;

    const map = {
        connected: '🟢 Connected',
        disconnected: '🔴 Disconnected',
        connecting: '🟡 Connecting...'
    };

    existing.textContent = map[status] || status;
}
