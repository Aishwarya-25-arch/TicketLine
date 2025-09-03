// Queue Management System - JavaScript Logic

// Global state variables
let queue = [];           // Array to store all users in queue
let currentlyServing = null;  // Currently being served user
let totalServed = 0;      // Total users served counter
let queueCounter = 1;     // Queue number counter

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateQueueDisplay();
    updateStatistics();
});

// Set up all event listeners
function initializeEventListeners() {
    // Form submission handler
    const queueForm = document.getElementById('queue-form');
    queueForm.addEventListener('submit', handleJoinQueue);
    
    // Serve next button handler
    const serveNextBtn = document.getElementById('serve-next');
    serveNextBtn.addEventListener('click', serveNextUser);
    
    // Complete service button handler
    const completeServiceBtn = document.getElementById('complete-service');
    completeServiceBtn.addEventListener('click', completeService);
}

// Handle user joining the queue
function handleJoinQueue(e) {
    e.preventDefault(); // Prevent form submission
    
    // Get form values
    const nameInput = document.getElementById('user-name');
    const serviceType = document.getElementById('service-type');
    
    const userName = nameInput.value.trim();
    
    // Validate input
    if (!userName) {
        alert('Please enter your name');
        return;
    }
    
    // Create user object with metadata
    const newUser = {
        id: generateId(),
        queueNumber: queueCounter++,
        name: userName,
        service: serviceType.value,
        joinTime: new Date(),
        formattedTime: formatTime(new Date())
    };
    
    // Add user to queue
    queue.push(newUser);
    
    // Clear form
    nameInput.value = '';
    serviceType.value = 'general';
    
    // Update UI
    updateQueueDisplay();
    updateStatistics();
    
    // Show success feedback
    showNotification(`${userName} added to queue (Position #${queue.length})`);
}

// Serve the next user in queue
function serveNextUser() {
    if (queue.length === 0) return;
    
    // If someone is already being served, alert
    if (currentlyServing) {
        alert('Please complete the current service first');
        return;
    }
    
    // Get next user (FIFO - First In First Out)
    currentlyServing = queue.shift();
    
    // Update serving display
    updateServingDisplay();
    
    // Update queue display
    updateQueueDisplay();
    updateStatistics();
}

// Complete serving the current user
function completeService() {
    if (!currentlyServing) return;
    
    // Increment served counter
    totalServed++;
    
    // Show completion message
    showNotification(`Service completed for ${currentlyServing.name}`);
    
    // Reset currently serving
    currentlyServing = null;
    
    // Hide serving section
    document.getElementById('serving-section').style.display = 'none';
    
    // Update statistics
    updateStatistics();
}

// Update the queue display UI
function updateQueueDisplay() {
    const queueList = document.getElementById('queue-list');
    const emptyState = document.getElementById('empty-state');
    const serveNextBtn = document.getElementById('serve-next');
    
    // Clear current display
    queueList.innerHTML = '';
    
    // Check if queue is empty
    if (queue.length === 0) {
        emptyState.style.display = 'block';
        queueList.style.display = 'none';
        queueList.classList.remove('has-items');
        serveNextBtn.disabled = true;
    } else {
        emptyState.style.display = 'none';
        queueList.style.display = 'grid';
        queueList.classList.add('has-items');
        serveNextBtn.disabled = currentlyServing !== null; // Disable if someone is being served
        
        // Create queue item cards
        queue.forEach((user, index) => {
            const queueItem = createQueueItemElement(user, index + 1);
            queueList.appendChild(queueItem);
        });
    }
}

// Create a queue item card element
function createQueueItemElement(user, position) {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.innerHTML = `
        <div class="queue-position">Position #${position}</div>
        <div class="queue-name">${user.name}</div>
        <div class="queue-service service-${user.service}">${getServiceLabel(user.service)}</div>
        <div class="queue-time">Joined at ${user.formattedTime}</div>
    `;
    return div;
}

// Update the currently serving display
function updateServingDisplay() {
    const servingSection = document.getElementById('serving-section');
    const servingNumber = document.getElementById('serving-number');
    const servingName = document.getElementById('serving-name');
    const servingTime = document.getElementById('serving-time');
    
    if (currentlyServing) {
        servingSection.style.display = 'block';
        servingNumber.textContent = `#${currentlyServing.queueNumber}`;
        servingName.textContent = currentlyServing.name;
        servingTime.textContent = `Service Type: ${getServiceLabel(currentlyServing.service)}`;
    } else {
        servingSection.style.display = 'none';
    }
}

// Update statistics dashboard
function updateStatistics() {
    // Update queue count
    document.getElementById('queue-count').textContent = queue.length;
    
    // Update served count
    document.getElementById('served-count').textContent = totalServed;
    
    // Calculate and update average wait time (simulated)
    const avgWait = queue.length > 0 ? Math.floor(queue.length * 3.5) : 0;
    document.getElementById('avg-wait').textContent = avgWait;
}

// Helper function to get service label
function getServiceLabel(service) {
    const labels = {
        'general': 'General Service',
        'priority': 'Priority Service',
        'emergency': 'Emergency'
    };
    return labels[service] || 'General Service';
}

// Helper function to format time
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Helper function to generate unique ID
function generateId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Show notification (simple implementation - can be enhanced)
function showNotification(message) {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add fade out animation dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: translateX(20px);
        }
    }
`;
document.head.appendChild(style);

// Demo data generator (optional - for testing)
function addDemoUsers() {
    const demoNames = [
        'John Smith', 'Emily Johnson', 'Michael Brown', 
        'Sarah Davis', 'Robert Wilson', 'Lisa Anderson'
    ];
    const services = ['general', 'priority', 'emergency'];
    
    demoNames.forEach((name, index) => {
        setTimeout(() => {
            const user = {
                id: generateId(),
                queueNumber: queueCounter++,
                name: name,
                service: services[Math.floor(Math.random() * services.length)],
                joinTime: new Date(),
                formattedTime: formatTime(new Date())
            };
            queue.push(user);
            updateQueueDisplay();
            updateStatistics();
        }, index * 500);
    });
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleJoinQueue,
        serveNextUser,
        completeService,
        queue
    };
}