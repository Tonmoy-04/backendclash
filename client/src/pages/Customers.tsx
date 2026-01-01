import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { parseNumericInput, formatDate, formatDateTime, toInputDateFormat } from '../utils/numberConverter';
import { useNotification } from '../context/NotificationContext';
import DateInput from '../components/DateInput';
import TransactionDetailsModal from '../components/TransactionDetailsModal';
import '../styles/Customers.css';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance?: number;
}

interface Transaction {
  id: number;
  customer_id: number;
  type: 'payment' | 'charge';
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  created_at: string;
}

const Customers: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showConfirm, showSuccess, showError, showWarning, showInfo } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'payment' | 'charge'>('payment');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState(toInputDateFormat(new Date()));
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsAll, setTransactionsAll] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debt' | 'owe' | 'clear'>('all');
  // Transaction Details Modal state
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [selectedTransactionDate, setSelectedTransactionDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError('');
        const params = balanceFilter !== 'all' ? { filter: balanceFilter } : {};
        const response = await api.get('/customers', { params });
        setCustomers(response.data || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();

    // Refetch when page becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCustomers();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [balanceFilter]);

  const handleDelete = (id: number) => {
    showConfirm({
      title: t('customers.deleteCustomer') || 'Delete Customer',
      message: t('common.deleteConfirm') || 'This action cannot be undone.',
      onConfirm: async () => {
        try {
          await api.delete(`/customers/${id}`);
          setCustomers(prev => prev.filter(customer => customer.id !== id));
          showSuccess({ title: t('common.deleted') || 'Deleted', message: t('customers.deletedSuccess') || 'Customer deleted successfully.' });
        } catch (err: any) {
          const message = err.response?.data?.error || t('customers.deleteFailed') || 'Failed to delete customer';
          setError(message);
          showError({ title: t('common.error') || 'Error', message });
        }
      },
    });
  };

  const handleEdit = (customer: Customer) => {
    navigate(`/customers/edit/${customer.id}`);
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map(c => c.id));
    }
  };

  const handleSelectCustomer = (id: number) => {
    setSelectedCustomers(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) {
      showWarning({ title: t('common.warning') || 'Warning', message: t('customers.selectToDeleteWarning') || 'Please select customers to delete.' });
      return;
    }
    showConfirm({
      title: t('common.delete') || 'Delete',
      message: `${t('customers.bulkDeleteConfirmPrefix')}${selectedCustomers.length}${t('customers.bulkDeleteConfirmSuffix')}`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedCustomers.map(id => api.delete(`/customers/${id}`)));
          setCustomers(prev => prev.filter(c => !selectedCustomers.includes(c.id)));
          setSelectedCustomers([]);
          showSuccess({ title: t('common.deleted') || 'Deleted', message: t('customers.bulkDeletedSuccess') || 'Customers deleted successfully.' });
        } catch (err: any) {
          const message = err.response?.data?.error || t('customers.bulkDeleteFailed') || 'Failed to delete customers';
          setError(message);
          showError({ title: t('common.error') || 'Error', message });
        }
      },
    });
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCustomer || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      showWarning({ title: t('common.warning') || 'Warning', message: t('common.invalidAmount') || 'Please enter a valid amount.' });
      return;
    }

    try {
      const response = await api.post(`/customers/${selectedCustomer.id}/balance`, {
        amount: parseFloat(paymentAmount),
        type: paymentType,
        description: paymentDescription,
        transaction_date: paymentDate
      });

      // Update the customer in the list
      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomer.id ? { ...c, balance: response.data.balance } : c
      ));

      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update balance');
    }
  };

  const handleViewHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      const params = new URLSearchParams();
      
      // If only startDate is provided, use it for both start and end (specific date)
      if (startDate && !endDate) {
        params.append('startDate', startDate);
        params.append('endDate', startDate);
      } 
      // If only endDate is provided, use it for both start and end (specific date)
      else if (!startDate && endDate) {
        params.append('startDate', endDate);
        params.append('endDate', endDate);
      }
      // If both are provided, use as range
      else if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      
      const queryString = params.toString();
      const url = `/customers/${customer.id}/transactions${queryString ? '?' + queryString : ''}`;
      const response = await api.get(url);
      const serverTransactions = response.data.transactions || [];
      // Cache full list for instant Clear
      if (!startDate && !endDate) {
        setTransactionsAll(serverTransactions);
      }

      // Client-side date filtering to ensure UI matches filter
      let filtered = serverTransactions;
      if (startDate || endDate) {
        const effectiveStart = startDate || endDate;
        const effectiveEnd = endDate || startDate;
        const normalizeDateOnly = (value: string) => {
          try {
            return new Date(value).toISOString().split('T')[0];
          } catch {
            return '';
          }
        };
        const startKey = effectiveStart || '';
        const endKey = effectiveEnd || '';
        filtered = serverTransactions.filter((t: any) => {
          const dateKey = normalizeDateOnly(t.created_at);
          if (!dateKey) return false;
          return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
        });
      }

      setTransactions(filtered);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load transaction history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const applyHistoryFilter = () => {
    if (!startDate && !endDate) {
      setTransactions(transactionsAll);
      return;
    }
    
    const parseDisplayDate = (dateStr: string): string => {
      if (!dateStr) return '';
      // Convert dd/mm/yyyy to yyyy-mm-dd
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return dateStr;
    };
    
    const effectiveStart = startDate || endDate;
    const effectiveEnd = endDate || startDate;
    const normalizeDateOnly = (value: string) => {
      try {
        return new Date(value).toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    const startKey = parseDisplayDate(effectiveStart) || '';
    const endKey = parseDisplayDate(effectiveEnd) || '';
    const filtered = transactionsAll.filter((t: any) => {
      const dateKey = normalizeDateOnly(t.created_at);
      if (!dateKey) return false;
      return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
    });
    setTransactions(filtered);
  };

  const getDailySummary = () => {
    const dailyMap = new Map<string, { timestamp: number; owed: number; paid: number; balance: number }>();
    
    // Group transactions by date
    transactions.forEach((t) => {
      const dateObj = new Date(t.created_at);
      const dateKey = formatDate(dateObj);

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { timestamp: dateObj.getTime(), owed: 0, paid: 0, balance: 0 });
      }

      const day = dailyMap.get(dateKey)!;
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
      if (t.type === 'charge') {
        day.owed += amount;
      } else {
        day.paid += amount;
      }
      // Customer history balance rule: balance = spend - deposit
      day.balance = day.owed - day.paid;
    });

    // Convert to sorted array (newest first)
    return Array.from(dailyMap.entries())
      .map(([, data]) => ({ date: new Date(data.timestamp), ...data }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const handlePrintStatement = () => {
    if (!selectedCustomer) return;

    let printWindow: Window | null = window.open('', '_blank', 'height=900,width=1100');
    // Fallback to hidden iframe if popup blocked
    let iframe: HTMLIFrameElement | null = null;
    if (!printWindow) {
      iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      printWindow = iframe.contentWindow;
    }

    const totalPayments = transactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalCharges = transactions
      .filter(t => t.type === 'charge')
      .reduce((sum, t) => sum + t.amount, 0);

    const statementHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transaction Statement - ${selectedCustomer.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #fff;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #059669;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #059669;
            font-size: 28px;
          }
          .header p {
            margin: 5px 0;
            font-size: 14px;
          }
          .customer-info {
            background-color: #f0fdf4;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #059669;
          }
          .customer-info h3 {
            margin: 0 0 10px 0;
            color: #059669;
          }
          .customer-info p {
            margin: 5px 0;
            font-size: 13px;
          }
          .balance-summary {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          .balance-box {
            flex: 1;
            min-width: 200px;
            padding: 15px;
            border-radius: 8px;
            border: 2px solid #e5e7eb;
          }
          .balance-box.current {
            background-color: #f9fafb;
            border-color: #059669;
          }
          .balance-box h4 {
            margin: 0 0 10px 0;
            font-size: 12px;
            text-transform: uppercase;
            color: #6b7280;
          }
          .balance-amount {
            font-size: 20px;
            font-weight: bold;
            color: ${(selectedCustomer.balance || 0) > 0 ? '#dc2626' : (selectedCustomer.balance || 0) < 0 ? '#16a34a' : '#6b7280'};
          }
          .balance-label {
            font-size: 11px;
            color: #9ca3af;
            margin-top: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          table thead {
            background-color: #f3f4f6;
            border-bottom: 2px solid #059669;
          }
          table th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            color: #059669;
            font-size: 12px;
          }
          table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
          }
          table tbody tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .payment-badge {
            background-color: #dcfce7;
            color: #166534;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .charge-badge {
            background-color: #fee2e2;
            color: #991b1b;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .summary {
            background-color: #f0fdf4;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #059669;
            margin-top: 20px;
          }
          .summary h4 {
            margin: 0 0 10px 0;
            color: #059669;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 13px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #9ca3af;
          }
          @media print {
            body {
              margin: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="border: 3px solid #34C759; border-radius: 8px; padding: 20px 15px; margin-bottom: 20px; text-align: center;">
            <h2 style="margin: 0; color: #34C759; font-size: 18px; font-weight: bold;">মেসার্স দিদার ট্রেডিং</h2>
            <p style="margin: 5px 0; font-size: 11px; color: #333;">এলাচি,দারচিনি, জিরা, লবঙ্গ, কিসমিস,জাফরান,সোডা,বার্লি,বেনেতী পসারী</p>
            <p style="margin: 5px 0; font-size: 11px; color: #333;">পাইকারী ও খুচরা বিক্রেতা</p>
            <p style="margin: 5px 0; font-size: 10px; color: #333;">মোবাইল: ০১৭৮৩-৩৫৬৭৮৫, ০১৯২১-৯৯৩১৫৬</p>
            <p style="margin: 5px 0; font-size: 10px; color: #333;">ঠিকানা: ৭৮ মৌলভীবাজার, ট্রেড সেন্টার, ঢাকা-১২১১</p>
          </div>
          <h1 style="margin: 15px 0 5px 0; color: #059669; font-size: 24px;">📊 Customer Statement</h1>
          <p>Generated on: ${formatDateTime(new Date())}</p>
        </div>

        <div class="customer-info">
          <h3>Customer Information</h3>
          <p><strong>Name:</strong> ${selectedCustomer.name}</p>
          ${selectedCustomer.phone ? `<p><strong>Phone:</strong> ${selectedCustomer.phone}</p>` : ''}
          ${selectedCustomer.email ? `<p><strong>Email:</strong> ${selectedCustomer.email}</p>` : ''}
          ${selectedCustomer.address ? `<p><strong>Address:</strong> ${selectedCustomer.address}</p>` : ''}
        </div>


        <table>
          <thead>
            <tr>
              <th>তারিখ</th>
              <th>জমা</th>
              <th>খরচ</th>
              <th>ব্যালেন্স</th>
              <th>অবস্থা</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const dailySummary: Record<string, { taken: number; given: number; balance: number; status: string }> = {};
              transactions.forEach(t => {
                const dateKey = formatDate(new Date(t.created_at));
                if (!dailySummary[dateKey]) {
                  dailySummary[dateKey] = { taken: 0, given: 0, balance: 0, status: '' };
                }
                if (t.type === 'payment') {
                  dailySummary[dateKey].taken += t.amount;
                } else {
                  dailySummary[dateKey].given += t.amount;
                }
                dailySummary[dateKey].balance = t.balance_after;
              });
              
              return Object.entries(dailySummary).map(([date, data]: [string, { taken: number; given: number; balance: number; status: string }]) => {
                const statusColor = data.balance > 0 ? '#16a34a' : data.balance < 0 ? '#dc2626' : '#6b7280';
                const statusText = data.balance > 0 ? 'পাওনা' : data.balance < 0 ? 'দেনা' : 'পরিষ্কার';
                return `
                  <tr>
                    <td>${date}</td>
                    <td style="color: #16a34a;">৳${data.taken.toFixed(2)}</td>
                    <td style="color: #dc2626;">৳${data.given.toFixed(2)}</td>
                    <td style="font-weight: bold; color: ${statusColor};">৳${Math.abs(data.balance).toFixed(2)}</td>
                    <td><span style="background-color: ${statusColor}15; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${statusText}</span></td>
                  </tr>
                `;
              }).reverse().join('');
            })()}
          </tbody>
        </table>

        <div class="summary">
          <h4>Summary</h4>
          <div class="summary-row">
            <span>Total Transactions:</span>
            <strong>${transactions.length}</strong>
          </div>
          <div class="summary-row">
            <span>Total Payments Received:</span>
            <strong style="color: #16a34a;">৳${totalPayments.toFixed(2)}</strong>
          </div>
          <div class="summary-row">
            <span>Total Charges:</span>
            <strong style="color: #dc2626;">৳${totalCharges.toFixed(2)}</strong>
          </div>
          <div class="summary-row" style="border-top: 1px solid #dcfce7; padding-top: 10px; margin-top: 10px;">
            <span style="font-weight: bold;">Current Balance:</span>
            <strong style="font-size: 14px; color: ${(selectedCustomer.balance || 0) > 0 ? '#16a34a' : (selectedCustomer.balance || 0) < 0 ? '#dc2626' : '#6b7280'};">৳${Math.abs(selectedCustomer.balance || 0).toFixed(2)}</strong>
          </div>
        </div>

        <div class="footer">
          <p>This is an auto-generated statement. For inquiries, please contact support.</p>
        </div>
      </body>
      </html>
    `;

    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(statementHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      if (!printWindow) return;
      printWindow.print();
      if (iframe) {
        document.body.removeChild(iframe);
      } else {
        printWindow.close();
      }
    }, 300);
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 animate-fadeInDown" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
            {t('nav.customers')}
          </h1>
          <div className="flex gap-3">
            {selectedCustomers.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                <TrashIcon className="h-5 w-5" />
                {t('common.delete')} ({selectedCustomers.length})
              </button>
            )}
            <button 
              onClick={() => navigate('/customers/add')} 
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 animate-fadeInRight" 
              style={{ animationDelay: '0.2s' }}
            >
              <PlusIcon className="h-5 w-5" />
              {t('customers.addCustomer')}
            </button>
          </div>
        </div>

        {/* Balance Filter */}
        <div className="mb-6 animate-fadeInUp" style={{ animationDelay: '0.25s' }}>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setBalanceFilter('all')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                balanceFilter === 'all'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {t('customers.all') || 'All'}
            </button>

            <button
              onClick={() => setBalanceFilter('debt')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                balanceFilter === 'debt'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-600 dark:to-cyan-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 text-blue-700 dark:text-blue-300'
              }`}
            >
              {t('customers.receivable') || 'Receivable'}
            </button>

            <button
              onClick={() => setBalanceFilter('owe')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                balanceFilter === 'owe'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-600 dark:to-pink-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300'
              }`}
            >
              {t('customers.credit') || 'Credit'}
            </button>

            <button
              onClick={() => setBalanceFilter('clear')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                balanceFilter === 'clear'
                  ? 'bg-gradient-to-r from-slate-600 to-gray-600 dark:from-slate-600 dark:to-gray-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-900/50 dark:to-gray-900/50 text-slate-700 dark:text-slate-300'
              }`}
            >
              {t('customers.clear') || 'Clear'}
            </button>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/30 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
        {loading && (
          <div className="p-16 text-center">
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{t('common.loading')}</p>
          </div>
        )}

        {error && (
          <div className="p-16 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && customers.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-6xl mb-4 opacity-50">👥</div>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('customers.noCustomersYet')}</p>
            <p className="text-emerald-600 dark:text-emerald-300">{t('customers.addFirstCustomer')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-emerald-200 dark:divide-emerald-800">
            <thead className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.length === customers.length && customers.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('customers.name')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('customers.phone')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('customers.email')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('customers.address')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">{t('customers.balance') || t('customers.currentBalance')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white/50 dark:bg-emerald-950/30 divide-y divide-emerald-100 dark:divide-emerald-800/50">
              {customers.map((customer, index) => (
                <tr key={customer.id} className="cursor-pointer hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-300 animate-fadeIn" style={{ animationDelay: `${0.4 + index * 0.05}s` }} onClick={() => {
                  setSelectedCustomer(customer);
                  setShowPaymentModal(true);
                  setPaymentAmount('');
                  setPaymentType('payment');
                  setPaymentDescription('');
                }}>
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={() => handleSelectCustomer(customer.id)}
                      className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-emerald-900 dark:text-emerald-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewHistory(customer);
                      }}
                      className="hover:text-emerald-600 dark:hover:text-emerald-300 transition-all"
                      title={t('customers.viewHistory')}
                    >
                      {customer.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700 dark:text-emerald-300">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700 dark:text-emerald-300">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700 dark:text-emerald-300">
                    {customer.address}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    <span className={`px-3 py-1 rounded-full ${
                      (customer.balance || 0) > 0 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                        : (customer.balance || 0) < 0 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                    }`}>
                      ৳{Math.floor(Math.abs(customer.balance || 0))} {(customer.balance || 0) > 0 ? t('customers.receivable') : (customer.balance || 0) < 0 ? t('customers.credit') : t('customers.clear')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button 
                        className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600 text-white rounded-lg hover:shadow-lg hover:scale-110 transition-all duration-300" 
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowPaymentModal(true);
                          setPaymentAmount('');
                          setPaymentType('payment');
                          setPaymentDescription('');
                        }} 
                        title={t('customers.manageBalanceAction')}
                      >
                        💰
                      </button>
                      <button 
                        className="p-2 bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-600 dark:to-green-600 text-white rounded-lg hover:shadow-lg hover:scale-110 transition-all duration-300" 
                        onClick={() => handleEdit(customer)} 
                        title={t('customers.editCustomer')}
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button 
                        className="p-2 bg-gradient-to-r from-red-500 to-pink-500 dark:from-red-600 dark:to-pink-600 text-white rounded-lg hover:shadow-lg hover:scale-110 transition-all duration-300" 
                        onClick={() => handleDelete(customer.id)} 
                        title={t('customers.deleteCustomer')}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
            setShowPaymentModal(false);
            setSelectedCustomer(null);
            setPaymentAmount('');
            setPaymentDescription('');
            setPaymentDate(toInputDateFormat(new Date()));
          }}>
            <div className="bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeInUp" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePaymentSubmit();
              }
            }}>
              <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-4">
                {t('customers.manageBalance')} - {selectedCustomer.name}
              </h2>
              
              <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">{t('customers.currentBalance')}</p>
                <p className={`text-2xl font-bold ${
                  (selectedCustomer.balance || 0) > 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : (selectedCustomer.balance || 0) < 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-gray-600 dark:text-gray-400'
                }`}>
                  ৳{Math.floor(Math.abs(selectedCustomer.balance || 0))} {(selectedCustomer.balance || 0) > 0 ? t('customers.receivable') : (selectedCustomer.balance || 0) < 0 ? t('customers.credit') : ''}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    {t('customers.transactionType')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('payment')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        paymentType === 'payment'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      জমা
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('charge')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        paymentType === 'charge'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      খরচ
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    {t('customers.amount')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseNumericInput(e.target.value).toString())}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    {t('common.date')} <span className="text-red-500">*</span>
                  </label>
                  <DateInput
                    value={paymentDate}
                    onChange={setPaymentDate}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    {t('customers.descriptionOptional')}
                  </label>
                  <textarea
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                    placeholder={t('customers.description')}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedCustomer(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all font-semibold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all"
                >
                  {t('customers.submit')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction History Modal */}
        {showHistoryModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
            setShowHistoryModal(false);
            setSelectedCustomer(null);
            setTransactions([]);
            setStartDate('');
            setEndDate('');
            setShowDateFilter(false);
          }}>
            <div className="bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  📊 {t('customers.transactionHistory')} - {selectedCustomer.name}
                </h2>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedCustomer(null);
                    setTransactions([]);
                    setStartDate('');
                    setEndDate('');
                    setShowDateFilter(false);
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {/* Filter Action Bar inside history modal */}
                <div className="flex items-center justify-end mb-4">
                  <button
                    onClick={() => setShowDateFilter(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    <span className="text-xl">📅</span>
                    {t('common.filter') || 'Filter'}
                  </button>
                </div>

                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">{t('customers.currentBalance')}</p>
                  <p className={`text-3xl font-bold ${
                    (selectedCustomer.balance || 0) > 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : (selectedCustomer.balance || 0) < 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    ৳{Math.floor(Math.abs(selectedCustomer.balance || 0))} {(selectedCustomer.balance || 0) > 0 ? t('customers.receivable') : (selectedCustomer.balance || 0) < 0 ? t('customers.credit') : t('customers.clear')}
                  </p>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mx-auto"></div>
                    <p className="mt-4 text-emerald-600 dark:text-emerald-400">{t('customers.loadingHistory')}</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4 opacity-50">📝</div>
                    <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{t('customers.noTransactionsYet')}</p>
                    <p className="text-emerald-600 dark:text-emerald-400">{t('customers.transactionHistoryWillAppear')}</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-96">
                    <table className="min-w-full divide-y divide-emerald-200 dark:divide-emerald-800">
                      <thead className="bg-emerald-100 dark:bg-emerald-900/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase">{t('customers.date')}</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase">{t('customers.takenCredit')}</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase">{t('customers.givenDebit')}</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase">{t('customers.remaining')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/50 dark:bg-emerald-950/30 divide-y divide-emerald-100 dark:divide-emerald-800/50">
                        {getDailySummary().map((day, index) => (
                          <tr 
                            key={index} 
                            className="hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all cursor-pointer"
                            onClick={() => {
                              setSelectedTransactionDate(formatDate(day.date));
                              setShowTransactionDetails(true);
                            }}
                          >
                            <td className="px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                              {formatDate(day.date)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400">
                              ৳{day.paid.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">
                              ৳{day.owed.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold" style={{
                              color: day.balance > 0 ? '#16a34a' : day.balance < 0 ? '#dc2626' : '#6b7280'
                            }}>
                              ৳{Math.floor(Math.abs(day.balance))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-950 border-t border-emerald-200 dark:border-emerald-800">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowHistoryModal(false);
                      setSelectedCustomer(null);
                      setTransactions([]);
                    }}
                    className="flex-1 px-6 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all font-semibold"
                  >
                    {t('customers.close')}
                  </button>
                  <button
                    onClick={handlePrintStatement}
                    className="flex-1 px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    🖨️ {t('customers.printStatement')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      {/* Date Filter Modal */}
      {showDateFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDateFilter(false)}>
          <div className="w-full max-w-md bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl border border-emerald-200 dark:border-emerald-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-200 dark:border-emerald-800">
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{t('common.filter')} {t('common.date')}</h3>
              <button onClick={() => setShowDateFilter(false)} className="text-emerald-700 dark:text-emerald-300 hover:opacity-80">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('common.startDate')}</label>
                <DateInput
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('common.endDate')}</label>
                <DateInput
                  value={endDate}
                  onChange={setEndDate}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); setTransactions(transactionsAll); setShowDateFilter(false); }}
                    className="px-6 py-2 bg-gray-500 dark:bg-gray-600 text-white font-semibold rounded-xl shadow hover:shadow-md"
                  >
                    {t('common.clear')}
                  </button>
                )}
                <button
                  onClick={() => { applyHistoryFilter(); setShowDateFilter(false); }}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow hover:shadow-md"
                >
                  {t('common.apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal - Displays detailed transaction information when amount is clicked */}
      {showHistoryModal && selectedCustomer && (
        <TransactionDetailsModal
          isOpen={showTransactionDetails}
          onClose={() => setShowTransactionDetails(false)}
          selectedDate={selectedTransactionDate}
          transactions={transactions}
          mode="customer"
        />
      )}
    </div>
  </div>
  );
};

export default Customers;
