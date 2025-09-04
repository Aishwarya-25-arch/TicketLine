# TicketLine
A web-based queuing system designed to manage and distribute high volumes of user traffic fairly and efficiently during peak demand events like ticket sales. It prevents server overloads and ensures an orderly, transparent user experience.
# 🚀 Digital Queue & Ticketing System

A **real-time digital queue management system** built with **Flask** and **Socket.IO**.  
Designed to handle **fair and resilient queuing** with priority support for staff, elderly, and disabled users.  
Useful for railway bookings, exam registrations, government portals, and more.

---

## ✨ Features
- 🎟️ Ticket creation with categories and priority
- ⚡ Real-time updates using WebSockets
- 📊 Admin panel with live queue monitoring
- 🧮 Priority-based ordering (Staff > Elderly/Disabled > Regular)
- 📱 Responsive UI (works on mobile & desktop)
- 📌 Activity logs & live updates
- ✅ In-memory storage (prototype-ready) — can be extended with DB

---

## 🛠️ Tech Stack
- **Backend**: Python (Flask, Flask-SocketIO)
- **Frontend**: HTML, CSS, JavaScript
- **Real-Time Communication**: WebSockets (Socket.IO)

---
## 📂 Project Structure

.
├── app.py # Main Flask application
├── requirements.txt # Python dependencies
├── /templates # HTML templates
│ ├── index.html # User interface
│ └── admin.html # Admin dashboard
├── /static/css # Stylesheets
│ └── styles.css
└── /static/js # JavaScript
└── app.js

## 📂 Project Structure
