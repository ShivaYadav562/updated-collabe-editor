# 🚀 CollabEditor — Real-Time Collaborative Coding & Learning Platform

<p align="center">
  <strong>Code Together. Learn Faster. Build Better.</strong>
</p>

<p align="center">
  A collaborative coding workspace that combines real-time code editing, team communication, video meetings, and structured learning resources in one platform.
</p>

<p align="center">
  <a href="https://updated-collabe-editor.vercel.app/">Live Demo</a> •
  <a href="https://github.com/ShivaYadav562/updated-collabe-editor">GitHub Repository</a>
</p>

---

## 🌟 Overview

CollabEditor is a web-based collaborative development and learning platform designed to make programming more interactive and productive.

Instead of switching between multiple tools for coding, communication, meetings, and learning, users can access these capabilities in one workspace.

Whether developers are solving coding problems together or students are preparing for technical interviews, CollabEditor provides an integrated environment for collaboration and learning.

## ✨ Key Features

### 1. Real-Time Collaborative Coding
- Multiple developers can work in a shared coding environment.
- Real-time code synchronization.
- Room-based collaboration.
- Integrated Monaco code editor.
- Save and manage code.

### 2. Integrated Video Meetings
- Video communication for team collaboration.
- Connect with teammates while coding.
- Discuss solutions without switching platforms.

### 3. Real-Time Team Chat
- Instant messaging inside coding rooms.
- Share ideas and discuss code.
- Stay connected with collaborators.

### 4. Live Code Execution
- Write and execute code.
- View execution output.
- Test and debug solutions.

### 5. Student Dashboard
- Personalized learning dashboard.
- Daily learning goals.
- Learning streak tracking.
- Study-time statistics.
- Course progress tracking.
- Upcoming study schedule.

### 6. Study Prep & Learning Hub
- DSA Patterns and practice sheets.
- Topic-wise DSA resources.
- Java and Java Backend learning.
- AWS and DevOps learning resources.
- System Design and Machine Learning resources.
- Study notes and playlists.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, JavaScript, HTML, CSS |
| Styling | Tailwind CSS, Bootstrap |
| Code Editor | Monaco Editor |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Real-Time Communication | Socket.IO |
| Video Communication | WebRTC |
| Authentication | JWT, bcrypt |
| Code Execution | Judge0 API |
| Deployment | Vercel, Render |
| Cloud | AWS |

---

## 🏗️ Project Architecture

```text
                 ┌──────────────────────┐
                 │      React Client    │
                 │                      │
                 │ Dashboard            │
                 │ Code Editor          │
                 │ Study Prep           │
                 │ Chat & Video         │
                 └──────────┬───────────┘
                            │
                 HTTP / REST API
                  Socket.IO / WebRTC
                            │
                 ┌──────────▼───────────┐
                 │    Node.js Server    │
                 │                      │
                 │ Routes               │
                 │ Controllers          │
                 │ Middleware           │
                 │ Services             │
                 │ Models               │
                 └──────────┬───────────┘
                            │
                 ┌──────────▼───────────┐
                 │       MongoDB        │
                 │                      │
                 │ Users                │
                 │ Rooms                │
                 │ Daily Goals          │
                 │ Course Progress      │
                 │ Study Sessions       │
                 └──────────────────────┘
```

---

## 📁 Project Structure

```text
updated-collabe-editor/
│
├── client/
│   ├── public/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   ├── editor/
│   │   │   ├── landing/
│   │   │   ├── study-prep/
│   │   │   │   ├── common/
│   │   │   │   ├── courses/
│   │   │   │   ├── layout/
│   │   │   │   └── resources/
│   │   │   ├── ui/
│   │   │   ├── ChatBox.jsx
│   │   │   ├── CodeEditor.jsx
│   │   │   ├── JoinRoom.jsx
│   │   │   └── TopBar.jsx
│   │   │
│   │   ├── context/
│   │   ├── data/
│   │   │   └── study-prep/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   └── study-prep/
│   │   ├── services/
│   │   │   └── study-prep/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   │
│   ├── package.json
│   └── README.md
│
├── server/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │   ├── dashboardController.js
│   │   ├── goalController.js
│   │   ├── progressController.js
│   │   └── sessionController.js
│   │
│   ├── middleware/
│   │   └── authMiddleware.js
│   │
│   ├── models/
│   │   ├── CourseProgress.js
│   │   ├── DailyGoal.js
│   │   ├── Room.js
│   │   ├── StudentActivity.js
│   │   ├── StudySession.js
│   │   └── user.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   └── roomRoutes.js
│   │
│   ├── services/
│   │   ├── dashboardService.js
│   │   └── streakService.js
│   │
│   ├── tests/
│   │
│   ├── server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB database
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/ShivaYadav562/updated-collabe-editor.git

cd updated-collabe-editor
```

### 2. Setup Backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` directory:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Start the backend:

```bash
npm run dev
```

### 3. Setup Frontend

Open another terminal:

```bash
cd client
npm install
```

Create a `.env` file inside the `client` directory:

```env
REACT_APP_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm start
```

The application should now be available at:

```text
http://localhost:3000
```

---

## 🔐 Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Backend server port |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used for JWT authentication |
| `REACT_APP_API_URL` | Backend API base URL |

**Security:** Never commit `.env` files, database credentials, JWT secrets, or API keys to GitHub.

---

## 🌐 Deployment

| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |

**Live Application:** https://updated-collabe-editor.vercel.app/

---

## 📚 What This Project Demonstrates

- Full-stack application development.
- REST API development and integration.
- Real-time communication using Socket.IO.
- Collaborative coding workflows.
- Authentication and protected routes.
- Database design using MongoDB and Mongoose.
- Frontend component architecture.
- Cloud deployment and environment configuration.

---

## 🔮 Future Improvements

- AI-powered coding tutor.
- AI-based code review and suggestions.
- More collaborative development tools.
- Advanced learning analytics.
- Improved room and participant management.

---

## 👨‍💻 Author

**Shiva Yadav**

- GitHub: https://github.com/ShivaYadav562
- LeetCode: https://leetcode.com/u/Shiva_yadav_1717/

---

<p align="center">
  <strong>Built to make coding collaborative and learning productive. 💻</strong>
</p>
