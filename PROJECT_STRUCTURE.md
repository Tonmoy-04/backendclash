# Inventory Management Desktop App - Project Structure

## 📋 Project Overview
A full-featured desktop application for inventory management built with Electron (desktop), React (frontend), Node.js/Express (backend), and SQLite (database).

---

## 🗂️ Root Level Files

### `package.json`
- **Purpose**: Root workspace configuration
- **Contents**:
  - Project metadata and dependencies
  - Script definitions for running server, client, and Electron
  - Main entry point: `electron/main.js`
- **Key Scripts**:
  - `npm start` - Runs server and client concurrently
  - `npm run server` - Starts backend API
  - `npm run client` - Starts React dev server
  - `npm run electron` - Launches desktop app
  - `npm run electron:dev` - Dev mode with hot reload

### `SETUP.md`
- **Purpose**: Installation and setup instructions for developers

### `MIGRATION_NOTES.md`
- **Purpose**: Documentation of database schema changes and migrations

### `README.md`
- **Purpose**: Project overview, features, and user documentation

### `start.bat`
- **Purpose**: Windows batch script to quickly start the application

---

## 📱 Client Directory (`/client`)

### Frontend Application (React + TypeScript)

#### Root Config Files
- **`package.json`** - Client dependencies and build scripts
- **`tsconfig.json`** - TypeScript configuration
- **`tailwind.config.js`** - Tailwind CSS styling configuration
- **`postcss.config.js`** - PostCSS configuration for CSS processing

#### `/client/public`
- **`index.html`** - Main HTML entry point for React app
- **`manifest.json`** - PWA manifest file
- **`robots.txt`** - SEO robots configuration

#### `/client/src/App.tsx`
- **Purpose**: Root React component
- **Contents**: Main app layout and routing structure

#### `/client/src/index.tsx`
- **Purpose**: Application bootstrap entry point
- **Contents**: React DOM rendering setup

#### `/client/src/components`
Reusable UI components used across the application:
- **`Topbar.tsx`** - Navigation header bar with user info
- **`Sidebar.tsx`** - Left navigation menu
- **`StatCard.tsx`** - Dashboard statistics display card
- **`LowStockCard.tsx`** - Alert card for low stock items

#### `/client/src/pages`
Full-page components for each route:
- **`Dashboard.tsx`** - Main dashboard with analytics and overview
- **`Inventory.tsx`** - List and manage all products
- **`AddInventory.tsx`** - Form to add new products to inventory
- **`Customers.tsx`** - List of all customers
- **`AddCustomer.tsx`** - Form to add new customers
- **`EditCustomer.tsx`** - Form to edit customer information
- **`Suppliers.tsx`** - List of all suppliers
- **`AddSuppliers.tsx`** - Form to add new suppliers
- **`EditSupplier.tsx`** - Form to edit supplier information
- **`Sales.tsx`** - Sales transaction management (not visible in listing but referenced)
- **`Purchases.tsx`** - Purchase transaction management
- **`Transactions.tsx`** - View all sales and purchase transactions
- **`Reports.tsx`** - Business reports and analytics
- **`Settings.tsx`** - Application settings and preferences
- **`Login.tsx`** - User authentication page

#### `/client/src/services`
API communication layer:
- **`api.js`** - Axios instance with API base URL and interceptors
- **`auth.service.ts`** - Authentication-related API calls (login, logout, verify)

#### `/client/src/hooks`
Custom React hooks:
- **`useFetch.ts`** - Custom hook for data fetching with loading/error states

#### `/client/src/context`
React Context providers for global state:
- **`AuthContext.tsx`** - User authentication state (current user, token)
- **`TranslationContext.tsx`** - Multi-language support (Bengali, English)

#### `/client/src/locales`
Translation/Localization files:
- **`en.ts`** - English language strings
- **`bn.ts`** - Bengali language strings

#### `/client/src/styles`
CSS styling files (one per page):
- **`Dashboard.css`** - Dashboard styling
- **`Inventory.css`** - Inventory page styling
- **`AddInventory.css`** - Add inventory form styling
- **`Customers.css`** - Customers page styling
- **`AddCustomer.css`** - Add customer form styling
- **`Sales.css`** - Sales page styling (if present)
- **`Transactions.css`** - Transactions page styling
- **`Reports.css`** - Reports page styling
- **`Login.css`** - Login page styling
- **`Suppliers.css`** - Suppliers page styling
- **`AddSuppliers.css`** - Add suppliers form styling

#### Other Source Files
- **`App.css`** - Global app styling
- **`index.css`** - Global CSS reset and defaults
- **`App.test.tsx`** - App component tests
- **`setupTests.ts`** - Jest test configuration
- **`reportWebVitals.ts`** - Performance metrics reporting
- **`react-app-env.d.ts`** - TypeScript definitions for React
- **`logo.svg`** - Application logo

---

## ⚙️ Server Directory (`/server`)

### Backend API (Node.js/Express + TypeScript)

#### Config Files
- **`package.json`** - Backend dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration for backend
- **`app.ts`** - Express application setup and middleware configuration

#### `/server/routes`
API endpoint route definitions:
- **`auth.routes.js`** - Authentication endpoints (login, register, logout)
- **`product.routes.js`** - Product management endpoints
- **`category.routes.js`** - Product category endpoints
- **`customer.routes.js`** - Customer management endpoints
- **`supplier.routes.js`** - Supplier management endpoints
- **`sales.routes.js`** - Sales transaction endpoints
- **`purchase.routes.js`** - Purchase transaction endpoints
- **`dashboard.routes.js`** - Dashboard analytics endpoints

#### `/server/controllers`
Business logic handlers for each resource:
- **`auth.controller.js`** - User authentication logic
- **`product.controller.js`** - Product CRUD operations and stock management
- **`category.controller.js`** - Category CRUD operations
- **`customer.controller.js`** - Customer CRUD operations
- **`supplier.controller.js`** - Supplier CRUD operations
- **`sales.controller.js`** - Sales transaction creation and retrieval
- **`purchase.controller.js`** - Purchase transaction creation and retrieval
- **`dashboard.controller.js`** - Dashboard statistics and analytics calculations

#### `/server/database`
Database layer:
- **`db.js`** - SQLite database connection and helper functions (promisified db methods)
- **`schema.sql`** - Database schema definition with all tables and constraints:
  - `users` - User accounts with authentication
  - `categories` - Product categories
  - `products` - Product inventory (name, SKU, quantity, price, cost)
  - `customers` - Customer information
  - `suppliers` - Supplier information
  - `sales` - Sales transactions header
  - `sale_items` - Individual items in sales transactions
  - `purchases` - Purchase transactions (if applicable)
  - `purchase_items` - Individual items in purchase transactions (if applicable)

#### `/server/middlewares`
Express middleware:
- **`auth.middleware.js`** - JWT token verification and role-based access control
- **`error.middleware.js`** - Global error handler and 404 handler

#### `/server/utils`
Utility functions:
- **`logger.js`** - Logging system for console and file output (app.log, error.log)
- **`backup.js`** - Database backup automation (scheduled every 24 hours)

#### `/server/logs`
Logging output directory:
- **`app.log`** - Application activity logs
- **`error.log`** - Error logs

#### `/server/backups`
Database backup storage directory:
- Contains automatic SQLite database backups

---

## 🖥️ Electron Directory (`/electron`)

### Desktop Application Shell

- **`main.js`** - Electron main process entry point
  - Creates and manages application window
  - Handles application lifecycle
  - Manages IPC communication between frontend and backend

- **`preload.js`** - Secure IPC bridge
  - Exposes safe APIs to React frontend
  - Prevents direct access to Node.js APIs
  - Handles secure communication between renderer and main processes

- **`window.js`** - Window configuration
  - Window creation settings (size, position, features)
  - Window event handlers
  - Application menu definitions

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────┐
│           Electron Desktop Window                   │
│  ┌────────────────────────────────────────────────┐ │
│  │      React Frontend (TypeScript/JSX)           │ │
│  │  ├─ Components (UI building blocks)            │ │
│  │  ├─ Pages (Full-page views)                    │ │
│  │  ├─ Context (Global state)                     │ │
│  │  └─ Services (API calls)                       │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/API Calls
                   ↓
┌─────────────────────────────────────────────────────┐
│       Express.js Backend (Node.js)                  │
│  ├─ Routes (Endpoint definitions)                  │
│  ├─ Controllers (Business logic)                   │
│  ├─ Middlewares (Auth, error handling)             │
│  └─ Utils (Logger, backups)                        │
└──────────────────┬──────────────────────────────────┘
                   │ SQL Queries
                   ↓
         ┌─────────────────────┐
         │   SQLite Database   │
         │  ├─ Users           │
         │  ├─ Products        │
         │  ├─ Customers       │
         │  ├─ Suppliers       │
         │  ├─ Sales           │
         │  ├─ Purchases       │
         │  └─ Categories      │
         └─────────────────────┘
```

---

## 🔐 Key Features by Component

### Authentication (AuthContext + auth.service.ts + auth.controller.js)
- User login/logout
- JWT token management
- Role-based access control (RBAC)

### Inventory Management
- Add/Edit/Delete products
- Track product stock levels
- Low stock alerts (LowStockCard)
- Auto-generate SKU if not provided
- Merge products by name if duplicate

### Sales & Purchases
- Record sales transactions
- Record purchase transactions
- Detailed transaction history
- Item-level tracking

### Multi-language Support (TranslationContext)
- English and Bengali support
- Localized UI strings in `/locales`

### Reporting & Analytics (Dashboard)
- Sales statistics
- Low stock items
- Inventory valuation
- Purchase analytics

### Data Persistence
- SQLite local database
- Automatic backups every 24 hours
- Transaction support for data integrity

---

## 🚀 Development Workflow

1. **Start Backend**: `npm run server` (runs on port 5000)
2. **Start Frontend**: `npm run client` (runs on port 3000)
3. **Launch Desktop**: `npm run electron` or `npm run electron:dev`

OR use `npm start` to run both server and client concurrently.

---

## 📊 Database Schema Summary

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | username, email, password, role |
| `products` | Inventory items | name, sku, quantity, price, cost, category_id |
| `categories` | Product categories | name, description |
| `customers` | Customer database | name, email, phone, address |
| `suppliers` | Supplier database | name, email, phone, contact_person |
| `sales` | Sales transactions | customer_id, total, payment_method, sale_date |
| `sale_items` | Sales line items | sale_id, product_id, quantity, unit_price |
| `purchases` | Purchase transactions | supplier_id, total, payment_method, purchase_date |
| `purchase_items` | Purchase line items | purchase_id, product_id, quantity, cost |
| `stock_history` | Stock change tracking | product_id, change, reason, created_at |

---

## 📝 API Endpoints Summary

### Auth
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify token

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/low-stock` - Get low stock items
- `POST /api/products/:id/adjust-stock` - Adjust inventory
- `GET /api/products/:id/history` - Stock history

### Categories, Customers, Suppliers, Sales, Purchases
- Similar CRUD patterns (GET, POST, PUT, DELETE)

### Dashboard
- `GET /api/dashboard/stats` - Summary statistics
- `GET /api/dashboard/low-stock` - Low stock alerts
- `GET /api/dashboard/recent-sales` - Recent transactions

