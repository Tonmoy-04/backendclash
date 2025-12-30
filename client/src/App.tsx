import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TranslationProvider } from './context/TranslationContext';
import { DarkModeProvider } from './context/DarkModeContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import AddInventory from './pages/AddInventory';
import EditInventory from './pages/EditInventory';
import Transactions from './pages/Transactions';
import Customers from './pages/Customers';
import AddCustomer from './pages/AddCustomer';
import EditCustomer from './pages/EditCustomer';
import Suppliers from './pages/Suppliers';
import AddSuppliers from './pages/AddSuppliers';
import EditSupplier from './pages/EditSupplier';
import Settings from './pages/Settings';
import BillGenerator from './pages/BillGenerator';
import Login from './pages/Login';
import './App.css';
import logo from './assets/edited-photo.png';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const RoutesWrapper: React.FC = () => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/add" element={<AddInventory />} />
        <Route path="/inventory/edit/:id" element={<EditInventory />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/bill-generator" element={<BillGenerator />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/add" element={<AddCustomer />} />
        <Route path="/customers/edit/:id" element={<EditCustomer />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/add" element={<AddSuppliers />} />
        <Route path="/suppliers/edit/:id" element={<EditSupplier />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Prevent scroll from changing number input values
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        e.preventDefault();
      }
    };

    // Prevent scroll on focused number inputs
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.type === 'number' && document.activeElement === target) {
        target.blur();
        setTimeout(() => target.focus(), 0);
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <Router>
      {showSplash && (
        <div className="splash-overlay fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-cyan-900 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-900 text-emerald-50">
          {/* animated background grid and glows */}
          <div className="absolute inset-0 opacity-30">
            <div className="splash-grid absolute inset-0"></div>
            <div className="absolute -left-24 -top-24 w-80 h-80 rounded-full bg-emerald-400/25 blur-3xl splash-aurora"></div>
            <div className="absolute right-0 top-10 w-72 h-72 rounded-full bg-cyan-400/25 blur-3xl splash-aurora" style={{ animationDelay: '0.6s' }}></div>
            <div className="absolute -right-10 bottom-10 w-64 h-64 rounded-full bg-amber-200/20 blur-3xl splash-aurora" style={{ animationDelay: '1.2s' }}></div>
          </div>

          <div className="relative flex flex-col items-center gap-6 px-6">
            <div className="absolute -inset-24 bg-white/5 blur-3xl rounded-full"></div>
            <div className="relative flex items-center gap-4 px-7 py-6 bg-white/85 dark:bg-emerald-950/85 rounded-3xl shadow-2xl shadow-emerald-900/50 backdrop-blur-2xl splash-float">
              <div className="relative">
                <div className="splash-ring absolute inset-[-6px] rounded-2xl"></div>
                <img
                  src={logo}
                  alt="M/S Didar Trading logo"
                  className="relative h-16 w-16 rounded-2xl border border-emerald-100/60 bg-white shadow-xl object-contain splash-logo"
                />
              </div>
              <div className="space-y-1 text-center md:text-left">
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-200 font-semibold splash-rise">Welcome</p>
                <h1 className="text-2xl font-extrabold text-emerald-950 dark:text-emerald-50 drop-shadow-sm splash-rise" style={{ animationDelay: '0.08s' }}>
                  M/S Didar Trading
                </h1>
                <p className="text-sm text-emerald-700/80 dark:text-emerald-200/80 splash-rise" style={{ animationDelay: '0.16s' }}>
                  Inventory & Billing Suite
                </p>
              </div>
            </div>

            <div className="relative w-64 h-2 rounded-full overflow-hidden bg-white/15 border border-white/10 shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 splash-progress"></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-50/85 tracking-wide">
              <span className="h-2 w-2 rounded-full bg-emerald-200 animate-ping"></span>
              <span className="splash-shimmer">Preparing your workspace...</span>
            </div>
          </div>

          {/* floating particles */}
          <div className="splash-dots pointer-events-none">
            {Array.from({ length: 14 }).map((_, idx) => (
              <span key={idx} className="splash-dot"></span>
            ))}
          </div>
        </div>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <div className="flex h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
                <Sidebar isOpen={sidebarOpen} />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                  <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-emerald-50/30 to-cyan-50/30 dark:from-emerald-900 dark:via-teal-950/50 dark:to-emerald-900">
                    <RoutesWrapper />
                  </main>
                </div>
              </div>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <DarkModeProvider>
      <TranslationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </TranslationProvider>
    </DarkModeProvider>
  );
}

export default App;
