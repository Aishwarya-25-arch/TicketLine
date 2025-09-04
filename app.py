# app.py (Flask-SocketIO Digital Queue System)
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
import uuid
from datetime import datetime
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'hackathon-queue-system-2025'
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage (prototype use only)
queue = []
served_tickets = []
current_number = 1
queue_lock = threading.Lock()

# Priority weights
PRIORITY_WEIGHTS = {
    'staff': 1,      # Highest priority
    'elderly': 2,    # High priority
    'disabled': 2,   # High priority
    'regular': 3     # Normal priority
}

# ------------------ Ticket Model ------------------ #
class Ticket:
    def __init__(self, name, email, category, priority_type):
        global current_number
        self.id = str(uuid.uuid4())
        self.number = current_number
        current_number += 1
        self.name = name
        self.email = email
        self.category = category
        self.priority_type = priority_type
        self.priority_weight = PRIORITY_WEIGHTS.get(priority_type, 3)
        self.timestamp = datetime.now()
        self.status = 'waiting'
        
    def to_dict(self):
        return {
            'id': self.id,
            'number': self.number,
            'name': self.name,
            'email': self.email,
            'category': self.category,
            'priority_type': self.priority_type,
            'priority_weight': self.priority_weight,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status,
            'position': self.get_position()
        }
        
    def get_position(self):
        if self.status != 'waiting':
            return 0
        position = 1
        for ticket in queue:
            if ticket.id == self.id:
                break
            if (ticket.priority_weight < self.priority_weight or 
                (ticket.priority_weight == self.priority_weight and ticket.timestamp < self.timestamp)):
                position += 1
        return position

# ------------------ Routes ------------------ #
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/api/request-ticket', methods=['POST'])
def request_ticket():
    try:
        data = request.get_json()
        required_fields = ['name', 'email', 'category', 'priority_type']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        with queue_lock:
            ticket = Ticket(
                name=data['name'],
                email=data['email'], 
                category=data['category'],
                priority_type=data['priority_type']
            )
            
            # Insert ticket by priority
            inserted = False
            for i, existing_ticket in enumerate(queue):
                if (ticket.priority_weight < existing_ticket.priority_weight or
                    (ticket.priority_weight == existing_ticket.priority_weight and 
                     ticket.timestamp < existing_ticket.timestamp)):
                    queue.insert(i, ticket)
                    inserted = True
                    break
            if not inserted:
                queue.append(ticket)
        
        queue_status = get_queue_status()
        # Broadcast updates
        socketio.emit('queue_updated', queue_status, broadcast=True)   # all clients
        socketio.emit('queue_updated', queue_status, room='admin')     # admin dashboards

        print(f"📡 Broadcasting - queue length: {len(queue)}")

        return jsonify({
            'success': True,
            'ticket': ticket.to_dict(),
            'message': f'Ticket #{ticket.number} created successfully!'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/serve-next', methods=['POST'])
def serve_next():
    try:
        with queue_lock:
            if not queue:
                return jsonify({'error': 'No tickets in queue'}), 400
            next_ticket = queue.pop(0)
            next_ticket.status = 'served'
            served_tickets.append(next_ticket)
        
        queue_status = get_queue_status()
        # Broadcast updates
        socketio.emit('queue_updated', queue_status, broadcast=True)
        socketio.emit('queue_updated', queue_status, room='admin')
        socketio.emit('ticket_served', next_ticket.to_dict(), broadcast=True)

        print(f"📡 Broadcasting - queue length: {len(queue)}")

        return jsonify({
            'success': True,
            'ticket': next_ticket.to_dict(),
            'message': f'Ticket #{next_ticket.number} served successfully!'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/queue-status')
def queue_status():
    return jsonify(get_queue_status())

@app.route('/api/my-ticket/<ticket_id>')
def get_ticket(ticket_id):
    try:
        for ticket in queue:
            if ticket.id == ticket_id:
                return jsonify(ticket.to_dict())
        for ticket in served_tickets:
            if ticket.id == ticket_id:
                return jsonify(ticket.to_dict())
        return jsonify({'error': 'Ticket not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ------------------ Helpers ------------------ #
def get_queue_status():
    with queue_lock:
        waiting_tickets = [ticket.to_dict() for ticket in queue]
        priority_stats = {p: len([t for t in queue if t.priority_type == p]) for p in PRIORITY_WEIGHTS}
        return {
            'waiting_count': len(queue),
            'served_count': len(served_tickets),
            'waiting_tickets': waiting_tickets,
            'next_ticket': waiting_tickets[0] if waiting_tickets else None,
            'priority_stats': priority_stats,
            'timestamp': datetime.now().isoformat()
        }

# ------------------ WebSocket Events ------------------ #
@socketio.on('connect')
def on_connect():
    emit('queue_updated', get_queue_status())
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def on_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('join_admin')
def handle_join_admin():
    join_room('admin')
    print(f"📥 Admin joined room - sid: {request.sid}")
    emit('queue_updated', get_queue_status(), room=request.sid)

# ------------------ Main ------------------ #
if __name__ == '__main__':
    print("🚀 Digital Queue System Starting...")
    print("📋 User Interface: http://localhost:5000")
    print("⚡ Admin Panel: http://localhost:5000/admin")
    print("🔧 API Status: http://localhost:5000/api/queue-status")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
