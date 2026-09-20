# PulseChat — Real-Time Chat & Collaboration Platform

PulseChat is a production-grade, full-stack real-time messaging application (Slack / Discord inspired) built with **React 18/19 (TypeScript) + Bootstrap 5** on the frontend and **ASP.NET Core 9 Web API + SignalR** on the backend.

---

## 🌟 Key Features

- **Real-Time Messaging**: Instant bi-directional messaging across channels and direct messages powered by ASP.NET Core SignalR.
- **Channels & Direct Messages**:
  - Public Channels (e.g. `#general`, `#random`, `#dev`) with instant broadcast.
  - 1-on-1 Direct Messages with dedicated conversations and auto-naming.
  - Channel creation and membership synchronization.
- **Live User Presence**:
  - Real-time online/offline status tracking with multi-tab connection resilience (`PresenceTracker`).
  - Visual status dots (green for online, grey for offline) across channel member lists and direct message dialogs.
- **Typing Indicators**: Real-time "Alice is typing..." indicators with debounced broadcasts.
- **Emoji Reactions**: Quick emoji reactions on messages (👍, ❤️, 🔥, 😂, 🚀, 🎉).
- **Persistent Unread Tracking & Visual Divider**:
  - Database-persisted per-user read markers (`LastReadMessageId`, `LastReadAt`).
  - Discord/Slack-style red divider line (`─── NEW MESSAGES ───`) showing exactly where you left off.
  - Dynamic unread count badges on inactive channels.
- **Private Channels & Member Invitations**:
  - Create private channels accessible only to invited members.
  - Interactive member invitation modal with live membership broadcast.
- **Session & Refresh Persistence**:
  - Active channel and session state preserved across page refreshes (F5).
- **Modern Slack/Discord UI**:
  - Dark-tinted ergonomic layout with high contrast and smooth scrollbars.
  - Responsive 3-column architecture (Sidebar, Chat Canvas, Collapsible Members List).
  - Auto-scroll to latest messages.
- **Self-Hosted Relational Storage**:
  - Entity Framework Core with SQLite (`pulsechat.db`) — zero cloud cost ($0).
  - Automatically migrates and seeds default channels on first launch.
- **JWT Authentication & BCrypt**:
  - Secure password hashing with BCrypt.
  - JSON Web Tokens passed via HTTP Headers for REST and query strings for WebSockets/SignalR.
  - 1-click Quick Demo logins ("Sign in as Alice", "Sign in as Bob") for instant testing.
- **Strictly 100% English**: All UI labels, placeholders, errors, code comments, and endpoints.

---

## 🛠️ Technology Stack

### Backend
- **Framework**: ASP.NET Core 9.0 Web API
- **Real-Time**: Microsoft ASP.NET Core SignalR (`ChatHub`)
- **ORM / Database**: Entity Framework Core 9 with SQLite
- **Security**: JWT Bearer Authentication (`Microsoft.AspNetCore.Authentication.JwtBearer`), BCrypt password hashing (`BCrypt.Net-Next`)

### Frontend
- **Framework**: React 18/19 with TypeScript
- **Bundler**: Vite
- **UI / Styling**: Bootstrap 5.3 + Lucide Icons + Custom Slack/Discord Dark Theme
- **State Management**: Zustand
- **Real-Time Client**: `@microsoft/signalr`
- **HTTP Client**: Axios with JWT interceptors

---

## 📁 Project Structure

```
pulse-chat/
├── backend/
│   ├── Controllers/
│   │   ├── AuthController.cs          # Register, Login, Current user, Users directory
│   │   ├── ChannelsController.cs      # Channels CRUD, Direct messaging
│   │   └── MessagesController.cs      # Message history per channel
│   ├── Data/
│   │   └── AppDbContext.cs            # EF Core DbContext with SQLite & seed data
│   ├── DTOs/                          # Request & Response data transfer objects
│   ├── Hubs/
│   │   └── ChatHub.cs                 # SignalR hub (Broadcasts, Typing, Presence)
│   ├── Models/                        # User, Channel, ChannelMember, Message
│   ├── Services/
│   │   ├── TokenService.cs            # JWT token generation
│   │   └── PresenceTracker.cs         # Thread-safe connection & presence mapping
│   ├── Program.cs                     # Startup, CORS, JWT, SignalR routing
│   └── appsettings.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/AuthPage.tsx      # Login, Register & 1-Click Demo login
│   │   │   ├── chat/                  # MessageList, MessageItem, MessageInput, TypingIndicator
│   │   │   ├── layout/                # AppLayout, Sidebar, ChatHeader, MembersSidebar
│   │   │   └── modals/                # CreateChannelModal, NewDmModal
│   │   ├── services/
│   │   │   ├── api.ts                 # Axios instance with auth interceptor
│   │   │   └── signalr.ts             # SignalR client with auto-reconnect
│   │   ├── store/                     # Zustand stores (authStore, chatStore)
│   │   ├── types/                     # TypeScript interfaces
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                  # Custom theme tokens & styles
│   └── vite.config.ts
│
├── start.bat                          # 1-Click Windows Batch Launcher
├── start.ps1                          # 1-Click PowerShell Launcher
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [.NET SDK 9.0+](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)

### 1. Launch with One Click (Windows)
Double-click `start.bat` or run:
```powershell
.\start.ps1
```
This boots both the backend (`http://localhost:5000`) and frontend (`http://localhost:5173`) in separate terminal windows.

---

### 2. Manual Startup

#### Terminal 1 — Backend:
```bash
cd backend
dotnet run --urls "http://localhost:5000"
```
The backend initializes SQLite (`pulsechat.db`) and seeds `#general`, `#random`, and `#dev`.

#### Terminal 2 — Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🧪 Testing Real-Time Sync (Dual-Browser)

1. Open `http://localhost:5173` in **Chrome Regular Window**:
   - Click **"Sign in as Alice"** (or create a new account).
2. Open `http://localhost:5173` in **Chrome Incognito** or **Firefox/Edge**:
   - Click **"Sign in as Bob"**.
3. **Verify Real-Time Synchronization**:
   - Type a message in `#general` from Alice $\rightarrow$ Bob sees it instantly.
   - Start typing from Bob $\rightarrow$ Alice sees `"Bob is typing..."`.
   - Bob shows a **green online dot** in Alice's member list.
   - Click **"+"** next to Direct Messages to start a private conversation between Alice and Bob.
   - Send emoji reactions on messages.

---

## 📚 Architecture & Deep-Dive Documentation

For detailed engineering rationales, architectural design decisions, and deep-dive technical explanations, see:
- 📖 [Architecture Notes & Engineering Deep Dive (docs/ARCHITECTURE_NOTES.md)](docs/ARCHITECTURE_NOTES.md)
- 📊 [Interactive Frontend Dependency Graph (docs/frontend-dependency-graph.html)](docs/frontend-dependency-graph.html)

---

## 📄 License
This project is open-source and free under the MIT License.
