# Desktop App Architecture

## Application Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     ELECTRON DESKTOP APP                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    MAIN PROCESS                        │ │
│  │                  (electron/main.js)                    │ │
│  │                                                        │ │
│  │  • Starts application                                 │ │
│  │  • Launches backend server (port 5000)                │ │
│  │  • Creates window                                     │ │
│  │  • Manages lifecycle                                  │ │
│  │  • Handles cleanup                                    │ │
│  └─────────────────┬──────────────────────────────────────┘ │
│                    │                                        │
│                    │ Creates                                │
│                    ▼                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               BROWSER WINDOW                           │ │
│  │             (electron/window.js)                       │ │
│  │                                                        │ │
│  │  • Size: 1400x900                                     │ │
│  │  • Security: Context isolation                        │ │
│  │  • Preload: electron/preload.js                       │ │
│  │  • Auto-hide menu bar                                 │ │
│  └─────────────────┬──────────────────────────────────────┘ │
│                    │                                        │
│                    │ Loads                                  │
│                    ▼                                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            RENDERER PROCESS                            │ │
│  │         (React App - client/build)                     │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │           REACT FRONTEND                         │ │ │
│  │  │                                                  │ │ │
│  │  │  • All your UI components                       │ │ │
│  │  │  • Pages, forms, tables                         │ │ │
│  │  │  • Styling (Tailwind CSS)                       │ │ │
│  │  │  • Client-side logic                            │ │ │
│  │  │                                                  │ │ │
│  │  │  📊 Suppliers  💰 Sales  📦 Products           │ │ │
│  │  │  👥 Customers  📈 Dashboard  ⚙️ Settings      │ │ │
│  │  └──────────────────┬───────────────────────────────┘ │ │
│  │                     │                                  │ │
│  │                     │ HTTP Requests                    │ │
│  │                     │ (axios)                          │ │
│  │                     ▼                                  │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         EXPRESS SERVER                           │ │ │
│  │  │       (server/app.ts - port 5000)                │ │ │
│  │  │                                                  │ │ │
│  │  │  • API Routes (/api/*)                          │ │ │
│  │  │  • Controllers                                  │ │ │
│  │  │  • Business logic                               │ │ │
│  │  │  • Authentication                               │ │ │
│  │  │  • File operations                              │ │ │
│  │  └──────────────────┬───────────────────────────────┘ │ │
│  │                     │                                  │ │
│  │                     │ SQL Queries                      │ │
│  │                     ▼                                  │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │          SQLITE DATABASE                         │ │ │
│  │  │       (server/database/*.db)                     │ │ │
│  │  │                                                  │ │ │
│  │  │  • inventory.db - Main data                     │ │ │
│  │  │  • stock.db - Stock data                        │ │ │
│  │  │  • Local file storage                           │ │ │
│  │  │  • No network needed                            │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Development vs Production

### Development Mode (`npm run electron:dev`)

```
┌─────────────────────────────────────────────────────────┐
│  DEVELOPMENT                                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Backend Server                                          │
│  ↓ Started manually                                      │
│  ↓ Runs on http://localhost:5000                         │
│  ↓ TypeScript with ts-node                              │
│  ↓ Hot reload with nodemon                              │
│                                                          │
│  React Dev Server                                        │
│  ↓ Started manually                                      │
│  ↓ Runs on http://localhost:3000                         │
│  ↓ Hot module replacement                               │
│  ↓ Fast refresh                                         │
│                                                          │
│  Electron Window                                         │
│  ↓ Loads http://localhost:3000                          │
│  ↓ DevTools open                                        │
│  ↓ Live debugging                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Production Build (`npm run dist`)

```
┌─────────────────────────────────────────────────────────┐
│  PRODUCTION                                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Electron Main Process                                   │
│  ↓ Starts backend server automatically                   │
│  ↓ Server bundled in app                                │
│  ↓ Runs from resources folder                           │
│                                                          │
│  React Build                                             │
│  ↓ Static HTML/CSS/JS files                             │
│  ↓ Loaded via file:// protocol                          │
│  ↓ Optimized and minified                               │
│                                                          │
│  Electron Window                                         │
│  ↓ Loads from client/build/                             │
│  ↓ No DevTools                                          │
│  ↓ Standalone app                                       │
│                                                          │
│  Result: Single .exe installer                           │
│  ✅ Everything included                                  │
│  ✅ No external dependencies                             │
│  ✅ Works offline                                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## File Organization

```
Project Root
│
├─ ELECTRON LAYER (Desktop Wrapper)
│  │
│  ├─ electron/
│  │  ├─ main.js      ← App entry, starts server
│  │  ├─ window.js    ← Window config
│  │  └─ preload.js   ← IPC bridge
│  │
│  └─ package.json    ← Main config, build scripts
│
├─ FRONTEND LAYER (User Interface)
│  │
│  └─ client/
│     ├─ src/         ← React components (UNTOUCHED)
│     ├─ public/      ← Static assets
│     └─ build/       ← Production build (generated)
│
├─ BACKEND LAYER (Business Logic)
│  │
│  └─ server/
│     ├─ app.ts       ← Server entry
│     ├─ routes/      ← API endpoints
│     ├─ controllers/ ← Business logic
│     ├─ database/    ← SQLite files
│     └─ utils/       ← Helpers
│
└─ BUILD RESOURCES
   │
   ├─ build/          ← Icons
   ├─ dist/           ← Build output
   └─ *.bat           ← Utility scripts
```

---

## Security Architecture

```
┌────────────────────────────────────────────────────────┐
│  SECURITY LAYERS                                        │
├────────────────────────────────────────────────────────┤
│                                                         │
│  🔒 Context Isolation                                  │
│     ↓ Renderer can't access Node.js directly          │
│     ↓ Prevents malicious code execution               │
│                                                         │
│  🔒 Preload Script                                     │
│     ↓ Controlled IPC bridge                           │
│     ↓ Only exposes safe APIs                          │
│     ↓ Validated communication                         │
│                                                         │
│  🔒 Navigation Protection                              │
│     ↓ Blocks external URLs                            │
│     ↓ Prevents phishing                               │
│     ↓ Window open handler                             │
│                                                         │
│  🔒 No Remote Module                                   │
│     ↓ Can't access main process                       │
│     ↓ Reduces attack surface                          │
│                                                         │
│  🔒 Sandbox Mode                                       │
│     ↓ Isolated renderer process                       │
│     ↓ Limited system access                           │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Build Process

```
┌─────────────────────────────────────────────────────────┐
│  BUILD PIPELINE                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Step 1: Install Dependencies                            │
│  ├─ npm install (root)                                  │
│  ├─ npm install (client)                                │
│  └─ npm install (server)                                │
│                                                          │
│  Step 2: Build React Frontend                            │
│  ├─ npm run build:client                                │
│  ├─ Creates client/build/                               │
│  ├─ Optimized production build                          │
│  └─ Static HTML, CSS, JS                                │
│                                                          │
│  Step 3: electron-builder                                │
│  ├─ Packages Electron                                   │
│  ├─ Includes server files                               │
│  ├─ Includes client/build                               │
│  ├─ Adds icons                                          │
│  └─ Creates NSIS installer                              │
│                                                          │
│  Output:                                                 │
│  └─ dist/Inventory Manager-Setup-1.0.0.exe              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Communication Flow

```
User Action
    │
    ▼
React Component (Click button)
    │
    ▼
axios.post('/api/products', data)
    │
    ▼
HTTP Request to localhost:5000
    │
    ▼
Express Router (/api/products)
    │
    ▼
Controller (product.controller.js)
    │
    ▼
Database Query (SQLite)
    │
    ▼
Return Data
    │
    ▼
Controller Response
    │
    ▼
HTTP Response (JSON)
    │
    ▼
React Updates State
    │
    ▼
UI Re-renders
    │
    ▼
User Sees Result
```

---

## Packaging Structure

### What Gets Packaged

```
Installer (.exe)
│
├─ Electron Runtime
│  ├─ Chromium engine
│  ├─ Node.js runtime
│  └─ V8 JavaScript engine
│
├─ Your Application
│  ├─ electron/ (main process)
│  ├─ client/build/ (React app)
│  └─ server/ (Express API)
│
├─ Resources
│  ├─ Icons
│  ├─ Database schemas
│  └─ Configuration files
│
└─ Dependencies
   ├─ Node modules
   └─ Native bindings
```

### What Users Install

```
Installation
│
├─ Program Files/Inventory Manager/
│  ├─ Inventory Manager.exe    ← Main executable
│  ├─ resources/                ← App files
│  │  ├─ app.asar              ← Packaged app
│  │  └─ server/               ← Backend files
│  └─ [Electron runtime files]
│
├─ Desktop/
│  └─ Inventory Manager.lnk    ← Shortcut
│
└─ Start Menu/
   └─ Inventory Manager        ← Menu entry
```

---

## Data Flow

```
┌────────────────────────────────────────────────────┐
│  LOCAL DATA STORAGE                                 │
├────────────────────────────────────────────────────┤
│                                                     │
│  User Documents/                                    │
│  └─ InventoryApp/                                  │
│     ├─ Bills/          ← Generated PDFs            │
│     └─ Backups/        ← Database backups          │
│                                                     │
│  App Installation/                                  │
│  └─ server/                                        │
│     └─ database/       ← SQLite databases          │
│        ├─ inventory.db                             │
│        └─ stock.db                                 │
│                                                     │
│  ✅ All data stays local                           │
│  ✅ No cloud required                              │
│  ✅ Works completely offline                       │
│                                                     │
└────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

### ✅ Advantages

1. **Separation of Concerns**
   - Electron handles desktop
   - React handles UI
   - Express handles business logic
   - SQLite handles data

2. **No React Changes Needed**
   - Existing code works as-is
   - Just wrapped in Electron
   - All features preserved

3. **Easy Development**
   - Hot reload in dev mode
   - Debug with Chrome DevTools
   - Same code, different wrapper

4. **Professional Distribution**
   - Single installer file
   - Easy for users
   - Offline capable

5. **Maintainable**
   - Clear structure
   - Minimal coupling
   - Easy to update

---

## Summary

```
🖥️  Electron provides desktop window
🎨  React provides user interface
⚙️  Express provides business logic
💾  SQLite provides data storage

= Professional Desktop Application ✅
```

**Your React code: UNTOUCHED**
**Your logic: PRESERVED**  
**Result: Professional desktop app**
