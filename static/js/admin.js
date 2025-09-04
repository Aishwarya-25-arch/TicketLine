// admin.js - Admin Interface JavaScript

let socket;

// Initialize admin application
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    loadQueueStatus();
});

// Socket.IO connection for admin
function initializeSocket() {
    socket = io({
        transports: ['polling','websocket'] // allow polling fallback
    });

    socket.on('connect', function() {
        console.log('✅ Admin connected to server, socket id:', socket.id);
        socket.emit('join_admin');           // ask server to add this socket to admin room
        updateConnectionStatus('connected');
        addActivityLog('🔗 Admin panel connected to queue system', 'info');
        loadQueueStatus(); // force initial load
    });

    socket.on('disconnect', function(reason) {
        console.warn('⚠️ Socket disconnected:', reason);
        updateConnectionStatus('disconnected');
        addActivityLog('❌ Connection lost - attempting to reconnect...', 'error');
    });

    socket.on('queue_updated', function(data) {
        console.log('📊 queue_updated received:', data);
        updateAdminDashboard(data); // your existing UI handler
    });

    socket.on('ticket_served', function(ticket) {
        addActivityLog(`✅ Served ticket #${ticket.number} - ${ticket.name}`, 'success');
        showNotification(`Successfully served ticket #${ticket.number}`, 'success');
    });

    socket.on('connect_error', function(error) {
        console.error('Connection error:', error);
        addActivityLog('❌ Socket connection error', 'error');
    });

    socket.io.on('reconnect_attempt', () => console.log('Reconnecting...'));
}

// Polling fallback (only when socket is disconnected)
setInterval(function() {
    if (!socket || !socket.connected) {
        loadQueueStatus();
    }
}, 5000);

// Serve next customer
async function serveNext() {
    const serveBtn = document.getElementById('serve-next-btn');
    if (!serveBtn) return;
    const originalText = serveBtn.innerHTML;
    
    serveBtn.innerHTML = '<span class="spinner"></span>Serving...';
    serveBtn.disabled = true;
    
    try {
        const response = await fetch('/api/serve-next', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
            addActivityLog(`🎯 Served customer: ${result.ticket.name} (Ticket #${result.ticket.number})`, 'success');
        } else {
            showNotification(result.error || 'No customers in queue', 'error');
            addActivityLog('⚠️ No customers to serve', 'info');
        }
    } catch (error) {
        console.error('Error serving next customer:', error);
        showNotification('Network error - please try again', 'error');
    } finally {
        serveBtn.innerHTML = originalText;
        serveBtn.disabled = false;
    }
}

// Update admin dashboard with queue data
function updateAdminDashboard(data) {
    // Update statistics
    const safeText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    safeText('admin-waiting-count', data.waiting_count || 0);
    safeText('admin-served-count', data.served_count || 0);
    
    // Update priority counts
    const priorityStats = data.priority_stats || {};
    safeText('staff-count', priorityStats.staff || 0);
    safeText('elderly-count', priorityStats.elderly || 0);
    
    // Update next customer info
    updateNextCustomer(data.next_ticket);
    
    // Update queue list
    updateQueueList(data.waiting_tickets || []);
    
    // Update serve button state
    const serveBtn = document.getElementById('serve-next-btn');
    if (serveBtn) {
        if (data.waiting_count === 0) {
            serveBtn.disabled = true;
            serveBtn.innerHTML = '<span class="btn-icon">😴</span>No Customers';
        } else {
            serveBtn.disabled = false;
            serveBtn.innerHTML = '<span class="btn-icon">👤</span>Serve Next Customer';
        }
    }
}

// Update next customer display
function updateNextCustomer(nextTicket) {
    const nextCustomerDiv = document.getElementById('next-customer');
    if (!nextCustomerDiv) return;
    
    if (nextTicket) {
        nextCustomerDiv.style.display = 'block';
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('next-ticket-number', nextTicket.number);
        setText('next-customer-name', nextTicket.name);
        setText('next-customer-service', formatService(nextTicket.category));
        setText('next-customer-priority', formatPriority(nextTicket.priority_type));
    } else {
        nextCustomerDiv.style.display = 'none';
    }
}

// Update queue list display
function updateQueueList(tickets) {
    const queueList = document.getElementById('queue-list');
    if (!queueList) return;
    
    if (!tickets.length) {
        queueList.innerHTML = '<p>No customers in queue</p>';
        return;
    }
    
    let html = '';
    tickets.forEach((ticket) => {
        const waitTime = calculateWaitTime(ticket.timestamp);
        html += `
            <div class="queue-item">
                <div class="queue-item-info">
                    <div class="queue-item-number">#${ticket.number}</div>
                    <div class="queue-item-details">
                        ${ticket.name} • ${formatService(ticket.category)} • Waiting ${waitTime}
                    </div>
                </div>
                <div class="queue-item-priority priority-${ticket.priority_type}">
                    ${ticket.priority_type}
                </div>
            </div>
        `;
    });
    
    queueList.innerHTML = html;
}

// Load initial queue status
async function loadQueueStatus() {
    try {
        const response = await fetch('/api/queue-status');
        const data = await response.json();
        updateAdminDashboard(data);
    } catch (error) {
        console.error('Error loading queue status:', error);
        addActivityLog('❌ Failed to load queue status', 'error');
    }
}

// Refresh queue manually
function refreshQueue() {
    loadQueueStatus();
    showNotification('Queue refreshed', 'info');
    addActivityLog('🔄 Queue manually refreshed', 'info');
}

// Export queue data
function exportData() {
    fetch('/api/queue-status')
        .then(response => response.json())
        .then(data => {
            const csvData = generateCSV(data);
            downloadCSV(csvData, 'queue_data.csv');
            showNotification('Data exported successfully', 'success');
            addActivityLog('📊 Queue data exported', 'info');
        })
        .catch(error => {
            console.error('Export error:', error);
            showNotification('Export failed', 'error');
        });
}

// Generate CSV data
function generateCSV(data) {
    const headers = ['Ticket Number', 'Name', 'Service', 'Priority', 'Position', 'Wait Time'];
    let csv = headers.join(',') + '\n';
    
    (data.waiting_tickets || []).forEach(ticket => {
        const row = [
            ticket.number,
            `"${ticket.name}"`,
            formatService(ticket.category),
            ticket.priority_type,
            ticket.position,
            calculateWaitTime(ticket.timestamp)
        ];
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Download CSV file
function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Utility functions (same as user)
function formatService(category) {
    const serviceMap = {
        'railway': 'Railway Booking',
        'airline': 'Airline Booking',
        'exam': 'Exam Registration', 
        'government': 'Government Service',
        'healthcare': 'Healthcare Service',
        'other': 'Other Service'
    };
    return serviceMap[category] || category;
}

function formatPriority(priority) {
    const priorityMap = {
        'staff': 'Staff Member',
        'elderly': 'Senior Citizen',
        'disabled': 'Disabled Person',
        'regular': 'Regular User'
    };
    return priorityMap[priority] || priority;
}

function calculateWaitTime(timestamp) {
    const now = new Date();
    const ticketTime = new Date(timestamp);
    const diffMs = now - ticketTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return '< 1 min';
    if (diffMins < 60) return `${diffMins} min`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
}

// UI helper functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function addActivityLog(message, type = 'info') {
    const container = document.getElementById('activity-log');
    if (!container) return;
    const activity = document.createElement('div');
    activity.className = `activity-item activity-${type}`;
    
    const now = new Date().toLocaleTimeString();
    activity.innerHTML = `
        <div class="activity-text">${message}</div>
        <div class="activity-time">${now}</div>
    `;
    
    container.insertBefore(activity, container.firstChild);
    
    // Keep only last 15 activities
    const activities = container.querySelectorAll('.activity-item');
    if (activities.length > 15) {
        activities[activities.length - 1].remove();
    }
}

function updateConnectionStatus(status) {
    let existingStatus = document.querySelector('.connection-status');
    
    if (!existingStatus) {
        existingStatus = document.createElement('div');
        existingStatus.className = 'connection-status';
        document.body.appendChild(existingStatus);
    }
    
    existingStatus.className = `connection-status ${status}`;
    
    const statusText = {
        'connected': '🟢 Admin Connected',
        'disconnected': '🔴 Admin Disconnected',
        'connecting': '🟡 Connecting...'
    };
    
    existingStatus.textContent = statusText[status] || status;
}
