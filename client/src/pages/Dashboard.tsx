import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { formatDate } from '../utils/numberConverter';
import StatCard from '../components/StatCard';
import LowStockCard from '../components/LowStockCard';
import CashboxModal from '../components/CashboxModal';
import CashboxTransactions from '../components/CashboxTransactions';
import {
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  BanknotesIcon,
  UserGroupIcon,
  TruckIcon,
  CubeIcon,
  EyeSlashIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';
import '../styles/Dashboard.css';
import { formatNumberIndian } from '../utils/currency';

interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  todaySales: { count: number; total: number };
  monthSales: { count: number; total: number };
  totalRevenue: number;
  inventoryValue: number;
  totalProductPrice: number;
  totalCustomersDebt?: number;
  totalSuppliersDebt?: number;
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // Cashbox state
  const [cashboxData, setCashboxData] = useState<any>(null);
  const [cashboxTransactions, setCashboxTransactions] = useState<any[]>([]);
  const [showCashboxModal, setShowCashboxModal] = useState(false);
  const [cashboxLoading, setCashboxLoading] = useState(false);
  const [showCashboxAmounts, setShowCashboxAmounts] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchCashboxData();
  }, [location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      fetchDashboardData();
      fetchCashboxData();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
        fetchCashboxData();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const onDataChanged = () => {
      fetchDashboardData();
      fetchCashboxData();
    };
    window.addEventListener('inventory-data-changed', onDataChanged);
    return () => window.removeEventListener('inventory-data-changed', onDataChanged);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, lowStockRes, customersDebtRes, suppliersDebtRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/low-stock-alerts'),
        api.get('/dashboard/customers-debt'),
        api.get('/dashboard/suppliers-debt')
      ]);

      const statsData = statsRes.data;
      // Add debt data to stats
      statsData.totalCustomersDebt = customersDebtRes.data.totalCustomersDebt || 0;
      statsData.totalSuppliersDebt = suppliersDebtRes.data.totalSuppliersDebt || 0;
      
      setStats(statsData);
      const cleaned = (lowStockRes.data || []).filter((p: any) => {
        const sku = (p?.sku || '').toString();
        const isTxnAuto = /^AUTO-\d{10,}-[a-z0-9]+$/i.test(sku);
        return !isTxnAuto;
      });
      setLowStockProducts(cleaned);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashboxData = async () => {
    setCashboxLoading(true);
    try {
      const [cashboxRes, transactionsRes] = await Promise.all([
        api.get('/cashbox'),
        api.get('/cashbox/transactions?limit=10000')
      ]);

      setCashboxData(cashboxRes.data);
      setCashboxTransactions(transactionsRes.data.transactions || []);
    } catch (error) {
      console.error('Error fetching cashbox data:', error);
    } finally {
      setCashboxLoading(false);
    }
  };

  const handleCashboxSuccess = () => {
    fetchCashboxData();
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950 flex items-center justify-center">
        <div className="text-lg text-emerald-700 dark:text-emerald-300 font-semibold">{t('common.loading')}</div>
      </div>
    );
  }

  const fmtMoney = (n?: number) => formatNumberIndian(Number(n || 0), 0);
  const fmtCashbox = (n?: number) => (showCashboxAmounts ? `৳${fmtMoney(n)}` : '****');

  const todayKey = formatDate(new Date());
  const todayDeposited = cashboxTransactions
    .filter(tx => {
      const txDate = formatDate(new Date(tx.created_at));
      return tx.type === 'deposit' && txDate === todayKey;
    })
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const todayWithdrawn = cashboxTransactions
    .filter(tx => {
      const txDate = formatDate(new Date(tx.created_at));
      return tx.type === 'withdrawal' && txDate === todayKey;
    })
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg mb-8">{t('nav.dashboard')}</h1>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title={t('dashboard.totalProductPrice') || 'Total Product Price'}
          value={`৳${fmtMoney(stats?.totalProductPrice || 0)}`}
          icon={<CurrencyDollarIcon className="h-8 w-8" />}
          bgColor="bg-emerald-500"
          clickable={true}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title={t('dashboard.totalProducts') || 'Total Products'}
          value={fmtMoney(stats?.totalProducts || 0)}
          icon={<CubeIcon className="h-8 w-8" />}
          bgColor="bg-blue-500"
          clickable={true}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title={t('dashboard.customersDebt') || 'Total Customers Debt'}
          value={`৳${fmtMoney(Math.abs(stats?.totalCustomersDebt ?? 0))}`}
          icon={<UserGroupIcon className="h-8 w-8" />}
          bgColor="bg-orange-500"
          clickable={true}
          onClick={() => navigate('/customers')}
          subtitle={(stats?.totalCustomersDebt ?? 0) < 0 ? 'Advance' : ''}
        />
        <StatCard
          title={t('dashboard.suppliersDebt') || 'Total Suppliers Debt'}
          value={`৳${fmtMoney(Math.abs(stats?.totalSuppliersDebt ?? 0))}`}
          icon={<TruckIcon className="h-8 w-8" />}
          bgColor="bg-red-500"
          clickable={true}
          onClick={() => navigate('/suppliers')}
          subtitle={(stats?.totalSuppliersDebt ?? 0) < 0 ? 'Advance' : ''}
        />
        <StatCard
          title={t('dashboard.lowStockItems')}
          value={stats?.lowStockCount || 0}
          icon={<ExclamationTriangleIcon className="h-8 w-8" />}
          changeType="decrease"
          bgColor="bg-orange-500"
          clickable={true}
          onClick={() => navigate('/inventory', { state: { filterLowStock: true } })}
        />
      </div>

      {/* Recent Activity */}
      <div className="content-grid">
        {/* Cashbox Section */}
        <div 
          onClick={() => cashboxData?.initialized && setShowCashboxModal(true)}
          className={`bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl p-6 border border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm ${cashboxData?.initialized ? 'cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 transform' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
              <BanknotesIcon className="h-6 w-6" />
              {t('dashboard.cashbox')}
            </h2>
            {cashboxData?.initialized && (
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCashboxAmounts(prev => !prev);
                  }}
                  className="p-2 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-white/70 dark:bg-emerald-800/60 text-emerald-700 dark:text-emerald-100 hover:bg-emerald-50 dark:hover:bg-emerald-700/60 transition-all"
                  aria-label={showCashboxAmounts ? t('dashboard.enablePrivacy') : t('dashboard.disablePrivacy')}
                >
                  {showCashboxAmounts ? (
                    <EyeIcon className="h-5 w-5" />
                  ) : (
                    <EyeSlashIcon className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCashboxModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                  {t('cashbox.editCashbox')}
                </button>
              </div>
            )}
          </div>

          {cashboxLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-emerald-600 dark:text-emerald-300">{t('common.loading')}</p>
            </div>
          ) : !cashboxData?.initialized ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <BanknotesIcon className="h-16 w-16 mx-auto text-emerald-400 dark:text-emerald-600 mb-4" />
                <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                  {t('cashbox.notInitialized')}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-300 mb-4">
                  {t('cashbox.initializeMessage')}
                </p>
                <button
                  onClick={() => setShowCashboxModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                  {t('cashbox.initializeNow')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-800 dark:to-teal-800 rounded-xl">
                <div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-200 font-medium">
                    {t('cashbox.currentBalance')}
                  </p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-50">
                    {fmtCashbox(cashboxData.cashbox.current_balance)}
                  </p>
                </div>
                <CurrencyDollarIcon className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-700">
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                    {t('dashboard.depositedToday')}
                  </p>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">
                    {fmtCashbox(todayDeposited)}
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-700">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                    {t('dashboard.withdrawnToday')}
                  </p>
                  <p className="text-xl font-bold text-red-900 dark:text-red-100">
                    {fmtCashbox(todayWithdrawn)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <LowStockCard products={lowStockProducts} />
        </div>
      </div>

      {/* Transaction History */}
      {cashboxData?.initialized && (
        <div className="mt-8">
          {showCashboxAmounts ? (
            <CashboxTransactions transactions={cashboxTransactions} loading={cashboxLoading} />
          ) : (
            <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-700 bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 text-emerald-800 dark:text-emerald-100 text-center">
              <p className="text-lg font-semibold mb-1">{t('cashbox.historyHidden') || 'Cashbox history is hidden'}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-300">{t('cashbox.historyHiddenHint') || 'Tap the eye icon to reveal balances and history.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Cashbox Modal */}
      <CashboxModal
        isOpen={showCashboxModal}
        onClose={() => setShowCashboxModal(false)}
        onSuccess={handleCashboxSuccess}
        currentBalance={cashboxData?.cashbox?.current_balance || 0}
        isInitialized={cashboxData?.initialized || false}
      />
    </div>
  );
};

export default Dashboard;
