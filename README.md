# PulseChat — Real-Time Chat & Collaboration Platform

PulseChat is a production-grade, full-stack real-time messaging and collaboration platform (Slack / Discord inspired) built with **React 18/19 (TypeScript) + Bootstrap 5** on the frontend, **ASP.NET Core 9 Web API + SignalR** on the backend, **WebRTC P2P Mesh Audio** for low-latency voice communications, and a cross-platform mobile client built with **React Native + Expo**.

---

## 🌟 Key Features

### 🏢 Multi-Workspace System (Discord / Slack Architecture)
- **Dedicated Workspaces**: Create, join, and manage multiple isolated workspaces for different teams or communities.
- **Workspace Navigation Dock**: Discord-inspired vertical navigation bar with workspace initials, brand colors, active indicator pills, and member tooltips.
- **Unique Invite Codes**: Generate and share invite codes to let other users join your workspace instantly. Regenerate codes anytime for security.
- **Workspace Management**: Workspace owners can edit descriptions or delete the workspace with safety confirmation dialogs.
- **Member Count & Presence Sync**: Live workspace member counters and real-time membership synchronization across devices.

### 🎙️ Real-Time Voice Chat (Discord-Style WebRTC Mesh)
- **Dedicated Voice Channels**: Seamlessly switch between text channels (`#`) and voice channels (`🔊`).
- **Private Voice Rooms**: Protected voice channels (`🔊🔒`) restricted to invited workspace members with distinct lock badges across the sidebar, header, and stage.
- **Zero-Server-Cost P2P Mesh Audio**: Peer-to-peer audio streaming via browser WebRTC (`RTCPeerConnection` with Google STUN), mediated by SignalR SDP offer/answer/ICE signaling.
- **Voice Activity Detection (VAD)**: Real-time audio spectrum analysis via Web Audio API (`AnalyserNode`) that lights up pulsating glowing green border rings (`#23a55a`) around talking participants.
- **Persistent Bottom Voice Bar**: Discord-style floating control panel docked at the bottom of the sidebar showing connection latency status, active channel name, and quick-toggle controls.
- **Microphone Mute & Audio Deafen**: Instant mute/unmute and deafen/undeafen toggles with cross-client synchronization and automatic clean state resets on channel leave.
- **Synthesized Sound Effects**: Built-in Discord-like audio chimes generated purely via the browser's Web Audio API oscillators (no external MP3 downloads required).
- **Audio Device & Mic Testing Modal**: Select input (microphone) and output (speaker) devices with a live dB volume meter for microphone testing.

### 🔔 Real-Time Workspace Unread Badges
- **Capsule Notification Badges**: Distinct red notification capsules (`#ed4245`) showing unread message counts on each workspace icon in the dock.
- **Smart Formatting**: Displays exact numbers or `99+` overflow with smooth entry animations (`pulseBadgeIn`).
- **Discord-Style Pill Indicator**: Subtle white indicator pills on the left edge show unread activity on inactive workspaces.
- **Zero-Lag SignalR Updates**: Workspace unread counts increment instantly as messages arrive in any channel, and decrement as channels are read.

### 💬 Channels & Direct Messages
- **Public & Private Channels**: Default public channels (e.g. `#general`, `🔊 general-voice`) and custom channels with instant broadcast, plus private channels restricted to invited members.
- **1-on-1 Direct Messages**: Direct conversations with dedicated user-to-user routing, auto-naming, and conversation history.
- **Browse Channels Modal**: Explore, discover, and join open text and voice channels within the active workspace.
- **Channel Descriptions**: Informative descriptions displayed directly in the channel header and workspace context.

### 🛡️ Moderation & Join Request Approval Workflow
- **Member Kick Action**: Channel leaders and creators can remove members from channels with instant real-time synchronization.
- **Audit History**: System tracks kick records (`ChannelKickRecord`) to prevent unauthorized re-entry.
- **Join Request System**: Kicked members attempting to rejoin via "Browse Channels" submit a join request (`ChannelJoinRequest`).
- **Owner Approval UI**: Channel leaders review pending requests with a warning tag (*"You previously removed this member"*) and can approve or reject with one click.

### ⚡ Live Presence & Real-Time Engagement
- **Live User Presence**: Multi-tab connection resilience (`PresenceTracker`) tracking online/offline states with green/grey status indicators.
- **Typing Indicators**: Real-time, debounced *"Alice is typing..."* status broadcasts.
- **Emoji Reactions**: Interactive message reactions (👍, ❤️, 🔥, 😂, 🚀, 🎉) with live user list tooltips and counters.
- **Persistent Unread Divider**: Per-user database-persisted read markers (`LastReadMessageId`, `LastReadAt`) with a red `─── NEW MESSAGES ───` line showing where you left off.

### 👤 User Profile Management & Account Security
- **Profile Customization Modal**: Modern, responsive modal accessible via the user status bar or the gear (`⚙️`) settings button in the sidebar footer.
- **Avatar Personalization**: Select from 8 curated DiceBear avatar presets, generate randomized avatars with one click, paste custom image URLs, or reset to default initials.
- **Live Username Updates**: Case-insensitive uniqueness validation on the backend with instant multi-user SignalR synchronization (`UserUpdated`) updating chat messages and member rosters live without page reloads.
- **Secure Password Changes**: BCrypt-verified password updating requiring current password confirmation, minimum length enforcement, and real-time inline validation feedback.
- **Smart Responsive Layout**: Tabbed layout (*Profile Details* / *Change Password*) with pinned headers, pinned action footers, and scrollable body designed for all screen sizes.

### 🔐 Security & Persistence
- **JWT Authentication & BCrypt**: Password hashing with BCrypt and JWT Bearer tokens passed via HTTP Authorization headers and WebSocket query strings.
- **1-Click Quick Demo Accounts**: Instant "Sign in as Alice" and "Sign in as Bob" buttons for rapid multi-user testing.
- **Self-Hosted Relational Storage**: Entity Framework Core 9 with SQLite (`pulsechat.db`) — zero cloud cost ($0), with automatic migration and seeding.
- **Graceful Error Boundaries**: React Error Boundary wrappers preventing blank screens and offering 1-click recovery.
- **Session & Refresh Resilience**: Active workspace, channel, and JWT token state preserved across page refreshes (F5).

---

## 🛠️ Technology Stack

### Backend
- **Framework**: ASP.NET Core 9.0 Web API
- **Real-Time Hub**: Microsoft ASP.NET Core SignalR (`ChatHub`)
- **Voice In-Memory Engine**: Thread-safe concurrent voice room tracker (`VoiceTracker`)
- **ORM / Database**: Entity Framework Core 9 with SQLite
- **Security**: JWT Bearer Authentication (`Microsoft.AspNetCore.Authentication.JwtBearer`), BCrypt (`BCrypt.Net-Next`)

### Frontend (Web)
- **Framework**: React 18/19 with TypeScript
- **Bundler**: Vite
- **Voice Engine**: WebRTC API (`RTCPeerConnection`, `getUserMedia`, Google STUN)
- **Audio Processing**: Web Audio API (`AudioContext`, `AnalyserNode` for VAD, sound synthesis)
- **UI & Styling**: Bootstrap 5.3 + Lucide Icons + Custom Slack/Discord Dark Theme
- **State Management**: Zustand (`workspaceStore`, `chatStore`, `voiceStore`, `authStore`)
- **Real-Time Client**: `@microsoft/signalr` with auto-reconnect
- **HTTP Client**: Axios with JWT request & response interceptors

### Mobile Client (React Native + Expo)
- **Framework**: React Native 0.86 with Expo SDK 57 (TypeScript)
- **Navigation**: React Navigation 7 (Drawer for Channels/DMs, Stack for Auth)
- **Styling**: Custom Discord dark theme tokens
- **Persistence**: `@react-native-async-storage/async-storage` for JWT & active session
- **Real-Time Hub**: `@microsoft/signalr` with auto-reconnection
- **Icons**: `lucide-react-native`

---

## 📁 Project Structure

```
pulse-chat/
├── backend/
│   ├── Controllers/
│   │   ├── AuthController.cs          # Register, Login, Current user, Users directory
│   │   ├── ChannelsController.cs      # Channels CRUD, Join requests, Kick members, DMs
│   │   ├── MessagesController.cs      # Channel message history and read receipts
│   │   └── WorkspacesController.cs    # Workspaces CRUD, Invites, Members, Unread counts
│   ├── Data/
│   │   └── AppDbContext.cs            # EF Core DbContext with SQLite & seed data
│   ├── DTOs/
│   │   ├── AuthDtos.cs                # Auth requests and user profiles
│   │   ├── ChannelDtos.cs             # Channel summaries, voice participants, read markers
│   │   ├── MessageDtos.cs             # Messages with workspace and reaction metadata
│   │   └── WorkspaceDtos.cs           # Workspace summaries, members, unread counts
│   ├── Hubs/
│   │   └── ChatHub.cs                 # SignalR hub (Broadcasts, Typing, Presence, WebRTC Signaling)
│   ├── Models/
│   │   ├── Channel.cs                 # Channel entity with Type (text/voice) & workspace key
│   │   ├── ChannelJoinRequest.cs      # Pending join requests for moderated channels
│   │   ├── ChannelKickRecord.cs       # Kick audit logs
│   │   ├── ChannelMember.cs           # Channel memberships and read markers
│   │   ├── Message.cs                 # Messages with emoji reactions
│   │   ├── User.cs                    # User entity with credentials
│   │   ├── Workspace.cs               # Workspace entity with invite codes
│   │   └── WorkspaceMember.cs         # Workspace membership & role mapping
│   ├── Services/
│   │   ├── PresenceTracker.cs         # Thread-safe multi-connection presence mapping
│   │   ├── VoiceTracker.cs            # In-memory thread-safe room & participant manager
│   │   └── TokenService.cs            # JWT token generation
│   ├── Program.cs                     # Startup, CORS, JWT, SignalR routing, Migrations
│   └── appsettings.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/AuthPage.tsx      # Login, Register & 1-Click Demo login
│   │   │   ├── chat/                  # MessageList, MessageItem, MessageInput, TypingIndicator
│   │   │   ├── common/
│   │   │   │   └── ErrorBoundary.tsx  # React error boundary for unhandled UI exceptions
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx      # Main layout switching between Chat and VoiceStage
│   │   │   │   ├── ChatHeader.tsx     # Channel title, topic, voice badges, members toggle
│   │   │   │   ├── MembersSidebar.tsx # Online/Offline workspace member roster
│   │   │   │   ├── Sidebar.tsx        # Text & Voice channels list, DMs, persistent Voice bar
│   │   │   │   └── WorkspaceSidebar.tsx # Vertical workspace dock with unread badges
│   │   │   ├── modals/
│   │   │   │   ├── BrowseChannelsModal.tsx  # Text & Voice channel discovery
│   │   │   │   ├── CreateChannelModal.tsx  # Text / Voice, Public / Private channel creation
│   │   │   │   ├── DeleteWorkspaceModal.tsx # Workspace deletion confirmation
│   │   │   │   ├── InviteMembersModal.tsx   # Add members to private channels
│   │   │   │   ├── NewDmModal.tsx           # Start direct messages
│   │   │   │   ├── ProfileSettingsModal.tsx # Profile customization & password change
│   │   │   │   ├── WorkspaceActionModal.tsx # Create or join workspace
│   │   │   │   └── WorkspaceInviteModal.tsx # View & regenerate workspace invite code
│   │   │   └── voice/
│   │   │       ├── VoiceControlBar.tsx      # Persistent bottom voice connection status & controls
│   │   │       ├── VoiceSettingsModal.tsx   # Audio device picker & live mic test meter
│   │   │       └── VoiceStage.tsx           # Main stage grid with avatar cards & VAD glow rings
│   │   ├── services/
│   │   │   ├── api.ts                 # Axios instance with auth interceptor
│   │   │   ├── signalr.ts             # SignalR client with voice signaling listeners
│   │   │   ├── soundEffects.ts        # Synthesized Web Audio API sound effects
│   │   │   └── webrtcService.ts       # P2P WebRTC audio stream & VAD analyzer engine
│   │   ├── store/
│   │   │   ├── authStore.ts           # Authentication & active user state
│   │   │   ├── chatStore.ts           # Channels, messages, typing, unread state
│   │   │   ├── voiceStore.ts          # Active voice room, participants, mute/deafen states
│   │   │   └── workspaceStore.ts      # Workspaces, members, unread counts
│   │   ├── types/                     # TypeScript interfaces
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                  # Theme tokens, layout, unread badges, animations
│   └── vite.config.ts
│
├── mobile/                            # React Native + Expo Mobile Application
│   ├── src/
│   │   ├── components/                # MessageItem, MessageInput, ChannelDrawerContent, TypingBar
│   │   ├── config/env.ts              # LAN/Emulator backend host resolver
│   │   ├── navigation/                # AuthNavigator, DrawerNavigator, RootNavigator
│   │   ├── screens/                   # LoginScreen, RegisterScreen, ChatScreen
│   │   ├── services/                  # api.ts (Axios), signalr.ts (SignalR Hub)
│   │   ├── store/                     # Zustand stores (authStore, chatStore)
│   │   ├── theme/colors.ts            # Discord dark color tokens
│   │   └── types/index.ts             # Domain models & interfaces
│   ├── app.json                       # Expo configuration
│   ├── App.tsx                        # Root entry point with GestureHandler & Providers
│   └── package.json
│
├── start.bat                          # 1-Click Web + Backend Windows Batch Launcher
├── start.ps1                          # 1-Click Web + Backend PowerShell Launcher
├── start-mobile.bat                   # 1-Click Mobile Expo Windows Batch Launcher
├── start-mobile.ps1                   # 1-Click Mobile Expo PowerShell Launcher
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [.NET SDK 9.0+](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [Expo Go App](https://expo.dev/go) on your iOS/Android phone, or an Android/iOS emulator *(optional for mobile)*

### 1. Launch with One Click (Windows)
Double-click `start.bat` or run in PowerShell:
```powershell
.\start.ps1
```
This boots both the backend (`http://0.0.0.0:5000`) and the web frontend (`http://localhost:5173`) in separate terminal windows.

To launch the **Mobile Client**, double-click `start-mobile.bat` or run:
```powershell
.\start-mobile.ps1
```

---

### 2. Manual Startup

#### Terminal 1 — Backend:
```bash
cd backend
dotnet run --urls "http://0.0.0.0:5000"
```
The backend initializes SQLite (`pulsechat.db`), seeds the default workspace, `#general` text channel, and `🔊 general-voice` voice channel. Listening on `0.0.0.0` allows mobile devices and other computers on the LAN to connect.

#### Terminal 2 — Frontend (Web):
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

#### Terminal 3 — Mobile (React Native + Expo):
```bash
cd mobile
npm install
# Option A: Run on your phone (Expo Go) or emulator:
npx expo start
# Option B: Run directly in your Android Emulator:
npx expo start --android
```
Scan the QR code with **Expo Go** (Android) or the Camera app (iOS) while connected to the same Wi-Fi network.

---

## 🧪 Testing Multi-User Real-Time Sync

### A. Dual-Browser Test (Web to Web)
1. Open `http://localhost:5173` in a **Standard Window**:
   - Click **"Sign in as Alice"** (or create a new account).
2. Open `http://localhost:5173` in an **Incognito Window** (or another browser):
   - Click **"Sign in as Bob"**.
3. **Test Voice Channels (WebRTC Audio & VAD)**:
   - In both windows, click on **`🔊 general-voice`** (or create a new Voice Channel via the `+` button in the sidebar).
   - Allow microphone permissions in both browsers.
   - Speak into your microphone $\rightarrow$ observe the **glowing green border rings** lighting up around the active speaker's avatar card in real time!
   - Click **"Mute Microphone"** or **"Deafen Audio"** $\rightarrow$ see the red mute badge update instantly across both users' screens.
   - Click the gear icon (`⚙️`) in the voice bar $\rightarrow$ test your microphone live with the green decibel test meter.
   - Click the red disconnect button $\rightarrow$ hear the departure chime and notice your participant avatar disappear from the room.
4. **Test Workspaces & Unread Badges**:
   - Click the **"+"** button on the left dock to create a new workspace (e.g. *"Gaming Lounge"*).
   - Click the workspace name header $\rightarrow$ **"Invite People"** to copy the invite code.
   - In Bob's window, click **"+"** $\rightarrow$ **"Join with Invite Code"** to join the workspace.
   - In Alice's window, switch to a different channel or workspace.
   - Send messages from Bob $\rightarrow$ observe the **red capsule badge** and Discord pill indicator increment in real time on Alice's workspace dock.
5. **Test Channel Moderation & Join Approvals**:
   - In a channel owned by Alice, click a member in the right member roster and select **"Remove from Channel"**.
   - As Bob, open **"Browse Channels"** and click **"Join"** $\rightarrow$ note that a join request is submitted instead of direct joining.
   - As Alice, review the pending join request with the note *"You previously removed this member"* and approve/reject.

### B. Cross-Platform Test (Web to Mobile)
1. Ensure your PC and mobile device are on the **same Wi-Fi network**.
2. Run `start.bat` (or `.\start.ps1`) to run Backend & Web.
3. In `mobile/`, run `npx expo start` (or double-click `start-mobile.bat`).
4. On your PC browser, sign in as **Alice**.
5. On your mobile device (via Expo Go or Android Emulator), tap **"Sign in as Bob"**.
6. Send a message from mobile $\rightarrow$ see it pop up instantly on your PC browser! Send a reaction or start typing on either device to verify bi-directional SignalR streaming.

---

## 📚 Architecture & Deep-Dive Documentation

For detailed engineering rationales, architectural design decisions, and deep-dive technical explanations, see:
- 📖 [Architecture Notes & Engineering Deep Dive (English)](docs/ARCHITECTURE_NOTES.md) | [🇹🇷 Türkçe Versiyon](docs/ARCHITECTURE_NOTES.tr.md)
- 📊 [Interactive Frontend Dependency Graph (HTML)](docs/frontend-dependency-graph.html)

---

## 📄 License
This project is open-source and free under the [MIT License](LICENSE).
