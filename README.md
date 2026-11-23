Collab Editor — Collaborative Learning & Coding Workspace
A full-stack learning workspace where students can create coding rooms, collaborate in real time, practice programming, and organize their placement preparation.

Project status: In active development. This README documents the functionality present in the supplied source ZIP and the additional features planned for implementation. Items marked Planned are not claimed to be implemented yet.

Table of Contents
1. Project Overview
2. Goals
3. Features
4. Technology Stack
5. Architecture
6. Project Structure
7. Getting Started
8. Environment Variables
9. API Reference
10. Real-Time Events
11. Database Models
12. Authentication and Security
13. Frontend Routes
14. Implementation Roadmap
15. Testing Checklist
16. Deployment
17. Contributing
Project Overview
Collab Editor is a browser-based collaborative coding and learning platform. It combines a shared code editor and real-time communication with a student dashboard and study-preparation area.

The goal is to give students one workspace for:
- Practising data structures and algorithms.
- Writing and sharing code with other learners.
- Creating and joining collaborative rooms.
- Discussing code through room chat.
- Organizing study resources and interview preparation.
- Tracking learning consistency and progress as the platform evolves.
Goals
- Make collaborative coding simple to start and use.
- Keep room code and selected language synchronized between participants.
- Provide a useful student-focused dashboard.
- Organize study material by course and resource type.
- Add reliable, user-specific learning analytics.
- Protect accounts, rooms, and private collaboration data.
Features
Present in the supplied source ZIP
The following items are visible in the supplied codebase. Their presence does not necessarily mean every edge case or production safeguard is complete.
Feature	Current implementation
Landing page	Landing page sections, product highlights, feature presentation, FAQ and CTA components are present.
Authentication UI	Login and signup interface is present.
Signup/login API	Express authentication routes use MongoDB user records, password hashing with bcryptjs, and JWT creation.
Student dashboard UI	Dashboard layout, learning cards, overview cards, goals, schedule and AI Tutor promotional section are present. Some dashboard values are static/demo values.
Admin dashboard UI	Admin dashboard page and dashboard components are present.
Collaborative editor UI	Editor page, Monaco/editor-related components, top bar, room joining UI and terminal components are present.
Room creation API	Authenticated room creation endpoint is present.
Room code synchronization	Socket.IO events synchronize code changes and persist the latest room code in MongoDB.
Language synchronization	Socket.IO language-change event updates the room language and broadcasts it.
Online room users	Connected users are tracked in server memory and updates are broadcast to the room.
Live room chat	Socket.IO chat broadcast is present. Chat messages are currently broadcast live and are not persisted as chat history in the supplied backend.
Study & Prepare UI	Study preparation pages and resource/course components are present.
Theme context	Theme context is present in the frontend.


Planned features to implement
These are product goals and implementation tasks, not completed features in the supplied ZIP.
1. Learning streak and activity tracking
- Record a learning day when a user completes a meaningful activity:
  - Solves a DSA problem.
  - Writes code in the collaborative editor.
  - Completes study material.
  - Makes meaningful progress in a course/resource.
- Count a calendar date only once per user, even if multiple activity types happen on that date.
- Calculate current streak and longest streak.
- Use the Asia/Kolkata timezone consistently for activity-day boundaries.
- Return recent weekly activity for a dashboard calendar/heatmap.
- Store activity records in MongoDB and associate each record with the authenticated user.
2. Real student dashboard analytics
Replace all illustrative/hardcoded values with authenticated API data:
- Current and longest learning streak.
- DSA problems completed.
- Study time, where reliable time tracking is implemented.
- Goals completed and total goals.
- Course/resource progress.
- Recent activity feed.
- Weekly learning activity.
- Rooms created/joined, if this metric is useful to the product.
Do not display fabricated values as real user statistics. Show a loading state, empty state, or unavailable label when data does not exist.
3. AI Assistant / AI Tutor (planned)
Add an AI learning assistant that helps students understand code and study concepts. The supplied ZIP contains an AI Tutor promotional section in the dashboard, but it does not contain a completed AI chat integration or AI backend. Implement the following as a new feature:

Student-facing capabilities
- AI Tutor chat from the dashboard and/or collaborative editor.
- Explain selected code or the full editor content in beginner-friendly steps.
- Debugging help: describe an error, identify likely causes, and suggest a corrected approach.
- Explain programming concepts, data structures, algorithms, and core CS topics.
- Generate small examples, practice questions, hints, and step-by-step dry runs.
- Interview preparation: ask technical questions and provide feedback on the student's answer.
- Keep the assistant in a learning-first mode: prefer hints and explanations over immediately giving away complete solutions when the student asks to learn.
Suggested implementation
- Build a reusable React AITutor component with message history, loading state, error state, and a clear-chat action.
- Add a frontend API helper that sends the user's message and optional editor context to the backend.
- Add an authenticated backend endpoint such as POST /api/ai/chat.
- Read the AI provider API key and model name from server environment variables; never put provider secrets in React code or expose them to the browser.
- Send only the context needed for the current request. Ask for user confirmation before sending private room content or long files to an external AI provider.
- Validate message length and request shape, authenticate the user, and apply per-user rate limits/usage limits.
- Return a clean assistant response and handle provider timeouts, quota errors, and unavailable models gracefully.
- Do not execute AI-generated code on the application server. If code execution is added later, use a separate sandbox with strict CPU, memory, time, and network restrictions.
- Optionally persist conversations in MongoDB using an AIConversation/`AIMessage` model, scoped to the authenticated user; add deletion controls if history is stored.
Suggested API contract

POST /api/ai/chat (JWT protected)

Request body example:
{
  "message": "Explain this Java code",
  "context": {
    "language": "java",
    "code": "// optional editor code"
  },
  "conversationId": null
}
Response example (shape only):
{
  "reply": "The code works by...",
  "conversationId": "optional-conversation-id"
}
The examples describe a suggested contract, not endpoints that already exist. Choose an AI provider/model during implementation and document its actual limits and pricing.
4. Secure room management
- Derive room owner identity from the verified JWT (req.user.userId), not from a client-supplied owner ID.
- Validate room IDs and required room fields.
- Prevent duplicate room IDs where uniqueness is required.
- Add room membership/authorization checks before joining or changing room data.
- Add endpoints to fetch a user's rooms, fetch room details, and leave/delete rooms with ownership checks.
- Ensure a user cannot read or modify a room they are not allowed to access.
4. Socket.IO authentication and authorization
- Verify JWT during the Socket.IO handshake.
- Attach the verified user identity to the socket.
- Validate room membership before accepting join_room, code updates, language changes, and chat messages.
- Validate payload types and lengths.
- Handle disconnects and room-user cleanup safely.
- Avoid trusting a username supplied by the browser as the authenticated identity.
5. Persistent chat history
- Create a ChatMessage model with room, sender, message, and timestamp fields.
- Save chat messages in MongoDB.
- Load recent chat history when an authorized user joins a room.
- Add pagination or a bounded history limit.
- Validate message length and prevent empty messages.
6. Editor improvements
- Persist the latest code and language reliably.
- Load saved code and language when a participant joins.
- Add clear save/error feedback.
- Consider debouncing code-save operations to reduce database writes.
- Handle simultaneous edits and reconnect scenarios predictably.
- Add execution support only through a properly secured code-execution service; never execute untrusted code directly on the application server.
7. Study & Prepare progress
- Track resource completion and course progress per user.
- Add bookmarks/favourites if required.
- Add notes and revision status.
- Track completed practice tasks.
- Connect the study UI to persistent backend data instead of local/demo values.
8. Goals and activity feed
- Create user-specific daily/weekly goals.
- Allow users to mark goals complete.
- Persist goal status and completion timestamps.
- Build a recent activity feed from actual user actions.
9. Admin capabilities
- Protect admin routes and APIs with role-based authorization.
- Show real user/room metrics.
- Add safe user and room management actions.
- Never rely only on hiding admin UI in the frontend; enforce permissions on the server.
10. Production readiness
- Centralize API base URL configuration.
- Validate environment variables at server startup.
- Add structured logging and consistent error responses.
- Add request rate limiting and authentication abuse protection.
- Add input validation and secure CORS configuration.
- Add automated tests for authentication, room access, streak calculation, and chat.
- Add loading, error, empty, and success states in the frontend.
- Add monitoring and backup strategy for MongoDB.
Technology Stack
Frontend
- React
- React Router
- Tailwind CSS / project CSS
- Socket.IO Client
- Monaco Editor components
- Lucide React icons
Backend
- Node.js
- Express 5
- MongoDB
- Mongoose
- Socket.IO
- JSON Web Tokens (JWT)
- bcryptjs
- CORS
- dotenv
Deployment (existing project context)
- Frontend: Vercel
- Backend: Node hosting platform such as Render
- Database: MongoDB Atlas
Update deployment providers/URLs if the project hosting changes.
Architecture
                 ┌──────────────────────────┐
                 │       React Client       │
                 │                          │
                 │ Landing / Auth / Student │
                 │ Dashboard / Study Prep   │
                 │ Collaborative Editor     │
                 └────────────┬─────────────┘
                              │
                  REST API    │    Socket.IO
                              │
                 ┌────────────▼─────────────┐
                 │      Node + Express      │
                 │                          │
                 │ Auth Routes              │
                 │ Room Routes              │
                 │ Streak/Activity (planned) │
                 │ Goal/Progress (planned)   │
                 └────────────┬─────────────┘
                              │
                 ┌────────────▼─────────────┐
                 │         MongoDB          │
                 │                          │
                 │ Users                    │
                 │ Rooms                    │
                 │ Activities (planned)     │
                 │ Chat Messages (planned)  │
                 │ Goals/Progress (planned)  │
                 └──────────────────────────┘
REST is intended for account, room, dashboard, and learning-data operations. Socket.IO is intended for low-latency room collaboration, presence, and chat.
Project Structure
The following structure is based on the supplied ZIP. Planned folders/files are marked with (planned) and can be added as implementation proceeds.
updated-collabe-editor/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   ├── editor/
│   │   │   ├── landing/
│   │   │   ├── study-prep/
│   │   │   └── ui/
│   │   ├── context/
│   │   ├── pages/
│   │   │   ├── study-prep/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   ├── EditorPage.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   └── LandingPage.jsx
│   │   ├── services/
│   │   │   └── study-prep/
│   │   └── App.js
│   └── package.json
│
├── server/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── Room.js
│   │   ├── user.js
│   │   ├── Activity.js              # planned
│   │   ├── ChatMessage.js           # planned
│   │   ├── Goal.js                  # planned
│   │   └── CourseProgress.js        # planned
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── roomRoutes.js
│   │   ├── streakRoutes.js          # planned
│   │   ├── dashboardRoutes.js       # planned
│   │   ├── goalRoutes.js            # planned
│   │   └── chatRoutes.js            # planned
│   ├── controllers/                 # planned
│   │   ├── streakController.js
│   │   ├── dashboardController.js
│   │   └── goalController.js
│   ├── server.js
│   └── package.json
│
└── README.md
Getting Started
Prerequisites
- Node.js (LTS recommended)
- npm
- MongoDB Atlas account or local MongoDB instance
- Git
1. Clone the repository
git clone https://github.com/ShivaYadav562/updated-collabe-editor.git
cd updated-collabe-editor
2. Install frontend dependencies
cd client
npm install
Start the frontend:
npm start
The React development server commonly runs at http://localhost:3000 for this project.
3. Install backend dependencies
Open another terminal:
cd server
npm install
Create a .env file in the server directory using the variables below, then start the backend:
npm start
The backend defaults to port 5000 unless PORT is configured.
4. Verify the backend
Open:
http://localhost:5000/test
Expected response:
Server Working
Also verify the database connection message in the backend terminal.
Environment Variables
Create server/.env:
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
For the frontend, use an environment variable for the backend base URL rather than hardcoding localhost throughout the code. For Create React App, a variable can use the REACT_APP_ prefix, for example:
REACT_APP_API_URL=http://localhost:5000
If the frontend build tool changes, use that tool's required environment-variable prefix. Never commit .env files or real secrets to Git.
API Reference
All paths below are relative to the backend origin, for example http://localhost:5000.
Existing endpoints in the supplied ZIP
Method	Endpoint	Auth	Purpose
POST	/api/auth/signup	No	Register a user.
POST	/api/auth/login	No	Authenticate a user and receive a JWT.
POST	/api/rooms/create	Yes	Create a room. Security improvement required: derive owner from the JWT rather than trusting owner in the request body.
GET	/api/rooms/test	No	Test room router.
GET	/api/rooms/create	No	Current diagnostic route; not a room-creation API.
GET	/test	No	Test backend availability.


For protected endpoints, send:
Authorization: Bearer YOUR_JWT_TOKEN
Planned endpoints
These routes are proposed API contracts. Implement and adjust request/response details consistently in frontend and backend.
Method	Endpoint	Purpose
POST	/api/streak/activity	Record a qualifying learning activity for the authenticated user.
GET	/api/streak	Return current streak, longest streak, and recent activity dates.
GET	/api/dashboard/summary	Return real dashboard overview metrics.
GET	/api/dashboard/activity	Return paginated/recent user activity.
GET	/api/rooms	List rooms the authenticated user can access.
GET	/api/rooms/:roomId	Fetch room details after authorization.
DELETE	/api/rooms/:roomId	Delete a room if the authenticated user is authorized (typically owner).
GET	/api/goals	List the user's goals.
POST	/api/goals	Create a goal.
PATCH	/api/goals/:goalId	Update or complete a goal.
GET	/api/chat/:roomId	Fetch authorized room chat history.


Suggested streak response
{
  "currentStreak": 4,
  "longestStreak": 9,
  "weeklyActivity": [
    { "activityDate": "2026-11-20", "activityTypes": ["dsa"] },
    { "activityDate": "2026-11-21", "activityTypes": ["coding", "study"] }
  ]
}
The values above are examples only. The API must calculate and return real data for the authenticated user.
Suggested activity request
{
  "activityType": "dsa"
}
Allowed activity types should be validated on the server, for example: dsa, coding, study, and course.
Real-Time Events
The following Socket.IO event names are present in the supplied server code.
Event	Direction	Purpose
join_room	Client → Server	Join a room and register the connected participant.
users_update	Server → Room	Broadcast the current in-memory participant list.
send_message	Client → Server	Submit the current editor content for saving and synchronization. Despite its name, this event is used for code synchronization in the supplied server.
receive_message	Server → Client	Deliver synchronized code or initial saved room code.
saved	Server → Sender	Acknowledge that the code-save handler completed.
language_change	Both	Update and broadcast the selected editor language.
send_chat	Client → Server	Submit a chat message.
receive_chat	Server → Room	Broadcast a chat message.


Planned real-time improvements
- Authenticate Socket.IO connections using JWT.
- Authorize room membership on every room-specific event.
- Persist chat messages and load history on room join.
- Add acknowledgements and structured error events.
- Add reconnect/resync handling.
- Consider separating code events from chat events with clearer names, such as code:update and chat:send, if a protocol migration is acceptable.
Database Models
Existing: User
The supplied user model stores:
- username
- email (unique and lowercase)
- password (hashed by the authentication flow)
- Mongoose timestamps
Existing: Room
The supplied room model stores:
- roomId
- roomName
- code
- language
- owner (reference to User)
- createdAt
Planned: Activity
Suggested fields:
- userId: reference to User.
- activityDate: date key in YYYY-MM-DD format based on Asia/Kolkata.
- activityTypes: unique array of qualifying activity types for that user/date.
- timestamps.
Suggested uniqueness rule: one document per { userId, activityDate }. Use an atomic $addToSet update to add activity types without creating duplicate streak days.
Planned: ChatMessage
Suggested fields:
- roomId or Room reference.
- senderId: User reference.
- senderName (optional display snapshot).
- message.
- createdAt.
Planned: Goal
Suggested fields:
- userId.
- title and optional description.
- targetDate or recurrence information.
- status / completedAt.
- timestamps.
Planned: CourseProgress
Suggested fields:
- userId.
- course/resource identifier.
- completion state or progress percentage.
- last activity timestamp.
- timestamps.
Authentication and Security
The supplied backend has JWT authentication middleware for protected Express routes. The following improvements should be completed before treating the application as production-ready:
1. Verify JWT signature and expiry on every protected REST request.
2. Use only the verified req.user.userId as the identity for ownership and user-specific records.
3. Never trust userId, owner, role, or permissions sent by the browser.
4. Add Socket.IO handshake authentication and per-room authorization.
5. Add role-based authorization for admin APIs.
6. Validate and sanitize request payloads.
7. Rate-limit login/signup and other abuse-prone endpoints.
8. Use HTTPS in production and keep secrets in hosting environment variables.
9. Configure CORS for only the actual frontend origins.
10. Avoid returning password hashes or sensitive internal errors in API responses.
Frontend Routes
Routes visible in the supplied App.js:
Route	Page
/	Landing page
/login	Login page
/signup	Signup page
/dashboard	Student dashboard
/admin	Admin dashboard
/study-prep	Study preparation home
/study-prep/resource/:course/:type	Resource listing
/study-prep/resource/:course/:type/:resourceId	Resource detail
/editor	Collaborative editor


Planned: add route guards so unauthenticated users cannot open protected student/editor pages and non-admin users cannot access admin functionality. Backend authorization remains mandatory even after frontend guards are added.
Implementation Roadmap
Use this as the feature checklist while implementing the remaining work. Mark an item complete only after it works and has been tested.
Phase 1 — Authentication and access control
- [ ] Confirm signup/login validation and password hashing.
- [ ] Verify JWT middleware on all protected REST routes.
- [ ] Add frontend protected-route handling.
- [ ] Derive room owner from req.user.userId.
- [ ] Add room membership and ownership checks.
- [ ] Add Socket.IO JWT authentication.
- [ ] Add role-based admin authorization.
Phase 2 — Learning streak
- [ ] Create Activity model.
- [ ] Store one activity-day record per user/date.
- [ ] Use $addToSet for multiple activity types on the same date.
- [ ] Implement India-timezone date calculation.
- [ ] Calculate current streak and longest streak.
- [ ] Return weekly activity.
- [ ] Add authenticated streak routes.
- [ ] Connect dashboard streak cards to the API.
- [ ] Trigger activity recording from real DSA/editor/study/course completion actions.
Phase 3 — Real dashboard data
- [ ] Create dashboard summary endpoint.
- [ ] Calculate actual DSA completion metrics.
- [ ] Track study duration only when a reliable start/stop or activity-session mechanism exists.
- [ ] Persist goals and completion status.
- [ ] Calculate course/resource progress.
- [ ] Add recent activity feed.
- [ ] Add loading, empty, and error states.
- [ ] Remove hardcoded demo values from production dashboard UI.
Phase 4 — AI Assistant / AI Tutor
- [ ] Decide the AI provider/model and configure server-side environment variables.
- [ ] Create authenticated POST /api/ai/chat endpoint.
- [ ] Validate user messages and optional editor context.
- [ ] Build reusable React AI Tutor chat component.
- [ ] Add code explanation, debugging guidance, concept explanations, and practice-question prompts.
- [ ] Add loading, timeout, quota, and provider-error handling.
- [ ] Add per-user rate/usage limits.
- [ ] Decide whether chat history should be persisted; if yes, add user-scoped MongoDB models and deletion support.
- [ ] Verify provider API keys never reach the frontend bundle.
- [ ] Do not execute generated code on the main application server.
Phase 5 — Collaborative rooms
- [ ] Validate room creation payload.
- [ ] Add unique room ID handling.
- [ ] Add list/get/delete room endpoints with authorization.
- [ ] Authenticate Socket.IO handshake.
- [ ] Check room membership for every room event.
- [ ] Improve editor save acknowledgements and reconnect recovery.
- [ ] Test two or more browser sessions editing the same room.
Phase 6 — Chat persistence
- [ ] Create ChatMessage model.
- [ ] Persist chat messages.
- [ ] Load chat history on room join.
- [ ] Add history pagination/limit.
- [ ] Validate message length and sender identity.
- [ ] Test unauthorized access to chat history.
Phase 7 — Study, goals, and admin
- [ ] Persist study resource progress.
- [ ] Add user-specific goals.
- [ ] Add goal completion API and UI.
- [ ] Connect study pages to backend data where required.
- [ ] Protect admin pages and endpoints.
- [ ] Replace admin demo metrics with database aggregates.
Phase 8 — Quality and release
- [ ] Add backend tests.
- [ ] Add frontend tests for critical flows.
- [ ] Test API validation and authorization failures.
- [ ] Test streak edge cases (today, yesterday, missed day, month/year boundary, multiple activities on one date).
- [ ] Test Socket.IO disconnect/reconnect and unauthorized room access.
- [ ] Run frontend production build.
- [ ] Configure production environment variables and CORS origins.
- [ ] Deploy and verify frontend/backend integration.
- [ ] Document known limitations.
Testing Checklist
Authentication
- [ ] Signup succeeds with valid details.
- [ ] Duplicate email is rejected.
- [ ] Login succeeds with correct credentials.
- [ ] Wrong password is rejected.
- [ ] Missing/invalid/expired JWT is rejected by protected routes.
- [ ] User A cannot access User B's private data.
Rooms and editor
- [ ] Authenticated user can create a room.
- [ ] Owner is taken from JWT, not request body.
- [ ] Unauthorized user cannot access a private room.
- [ ] Two authorized users can join the same room.
- [ ] Code updates synchronize between clients.
- [ ] Code and language reload after reconnect/rejoin.
- [ ] Invalid Socket.IO payloads are rejected safely.
Chat
- [ ] Room messages are delivered to authorized participants.
- [ ] Messages are saved in MongoDB.
- [ ] Recent chat history loads when rejoining.
- [ ] Unauthorized users cannot read or send room messages.
Learning streak
- [ ] First activity creates a streak of one.
- [ ] Multiple activity types on one date count as one streak day.
- [ ] Activity today extends a consecutive streak.
- [ ] If no activity today but activity yesterday, current streak follows the chosen product rule.
- [ ] A missed full day breaks the current streak.
- [ ] Longest streak remains historically correct.
- [ ] Date boundaries follow Asia/Kolkata.
- [ ] User A's activity never changes User B's streak.
Dashboard
- [ ] Dashboard displays the authenticated user's data only.
- [ ] Static sample metrics are not presented as real values.
- [ ] Loading and empty states are visible when appropriate.
- [ ] API failures show a useful fallback/error state.
Deployment
Backend
Configure these environment variables in the hosting provider:
- PORT (if required by the host)
- MONGO_URI
- JWT_SECRET
Set the production CORS allowlist to the exact frontend domains. Deploy the Node server and verify /test, authentication, database connectivity, and Socket.IO connectivity.
Frontend
Configure the frontend API base URL to point to the deployed backend. Build and deploy the React client. Verify login, dashboard APIs, room creation, Socket.IO events, and refresh behavior on nested routes.
Before release
- Do not commit .env or secrets.
- Use HTTPS/WSS.
- Confirm production CORS origins.
- Verify database indexes.
- Add backups and monitoring.
- Run the full testing checklist.
Contributing
1. Create a feature branch.
2. Keep changes focused and small.
3. Test both frontend and backend flows affected by the change.
4. Update this README when API contracts, events, environment variables, or setup steps change.
5. Open a pull request with a clear summary and test notes.
Author
Shiva Yadav
GitHub: ShivaYadav562
License
No license is specified in the supplied source ZIP. Add a LICENSE file before presenting the project as open source with a particular license.
