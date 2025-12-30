# Quick Setup Guide

## Step-by-Step Installation

### 1. Install Root Dependencies
```bash
npm install
```

### 2. Install Server Dependencies
```bash
cd server
npm install express cors bcrypt jsonwebtoken sqlite3 dotenv
npm install -D @types/express @types/node @types/cors @types/bcrypt @types/jsonwebtoken nodemon
cd ..
```

### 3. Install Client Dependencies
```bash
cd client
npm install @heroicons/react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
cd ..
```

### 4. Configure Tailwind CSS

Update `client/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Add to `client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 5. Create Environment File

Create `server/.env`:
```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

### 6. Run the Application

**Option A: Web Development Mode**
```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
cd client
npm start
```

**Option B: Electron Desktop Mode**
```bash
npm run electron:dev
```

## Testing the Application

1. Open browser at `http://localhost:3000`
2. Login with default credentials:
   - Email: `admin@inventory.com`
   - Password: `admin123`

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000 (Windows)
netstat -ano | findstr :5000
taskkill /PID <process_id> /F

# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

### Database Not Initializing
```bash
cd server
# Delete existing database
del database\inventory.db
# Restart server to recreate
npm start
```

### Module Not Found Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Do the same for server and client
cd server && rm -rf node_modules package-lock.json && npm install
cd ../client && rm -rf node_modules package-lock.json && npm install
```

## Building for Production

### Build React App
```bash
cd client
npm run build
```

### Build Electron Desktop App
```bash
npm run build:electron
```

The executable will be in the `dist` folder.

## Project Structure Verification

After setup, your project should have this structure:
```
inventory-desktop-app/
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── window.js
├── server/
│   ├── app.ts
│   ├── routes/ (6 files)
│   ├── controllers/ (6 files)
│   ├── database/ (db.js, schema.sql)
│   ├── middlewares/ (2 files)
│   ├── utils/ (logger.js, backup.js)
│   ├── package.json
│   └── tsconfig.json
├── client/
│   └── src/
│       ├── components/ (4 .tsx files)
│       ├── pages/ (7 .tsx files)
│       ├── services/ (2 files)
│       ├── hooks/ (useFetch.ts)
│       ├── context/ (AuthContext.tsx)
│       ├── assets/
│       ├── App.tsx
│       └── index.tsx
├── package.json
└── README.md
```

## Next Steps

1. Customize the branding and styling
2. Add more features as needed
3. Implement chart library for dashboard
4. Add print functionality for invoices
5. Implement data export features
6. Add more comprehensive reports

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
