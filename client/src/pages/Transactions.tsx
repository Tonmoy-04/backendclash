import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { parseNumericInput, toInputDateFormat } from '../utils/numberConverter';
import { useNotification } from '../context/NotificationContext';
import DateInput from '../components/DateInput';
import '../styles/Transactions.css';

interface Transaction {
  id: number;
  type: 'sale' | 'purchase';
  customer_name?: string;
  supplier_name?: string;
  payment_method?: string;
  total?: number;
  created_at?: string;
  sale_date?: string;
  purchase_date?: string;
}

const Transactions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showConfirm, showSuccess, showError, showWarning, showInfo } = useNotification();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [formData, setFormData] = useState<{
    customer: string;
    type: 'Sale' | 'Purchase';
    itemsNote: string;
    lineItems: { product_name: string; quantity: number | ''; price: number | '' }[];
    paymentMethod: string;
    supplierId: number | '';
    transaction_date: string;
    discount: number | '';
  }>({
    customer: '',
    type: 'Sale',
    itemsNote: '',
    lineItems: [{ product_name: '', quantity: 1, price: 0 }],
    paymentMethod: 'due',
    supplierId: '',
    transaction_date: new Date().toISOString().split('T')[0],
    discount: '',
  });

  const normalizePaymentMethod = (method: string) => {
    const value = method.toLowerCase();
    if (value === 'due' || value === 'unpaid') return 'due';
    if (value === 'upi') return 'bank_transfer';
    if (value === 'credit') return 'card';
    if (value === 'bank transfer') return 'bank_transfer';
    if (value === 'cash' || value === 'card' || value === 'bank_transfer') return value;
    return 'due';
  };

  const fetchTransactions = useCallback(async () => {
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

      const [salesRes, purchasesRes] = await Promise.all([
        api.get(`/sales${queryString ? '?' + queryString : ''}`),
        api.get(`/purchases${queryString ? '?' + queryString : ''}`),
      ]);

      const sales = salesRes.data.map((s: any) => ({ ...s, type: 'sale' }));
      const purchases = purchasesRes.data.map((p: any) => ({ ...p, type: 'purchase' }));

      const combined = [...sales, ...purchases].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Cache the full unfiltered list when no date filter is active
      if (!startDate && !endDate) {
        setAllTransactions(combined);
      }

      // Client-side date filtering to ensure UI matches filter
      let filteredByDate = combined;
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
        filteredByDate = combined.filter((t: any) => {
          const rawDate = t.type === 'sale' ? t.sale_date : t.purchase_date;
          const dateKey = normalizeDateOnly(rawDate || t.created_at);
          if (!dateKey) return false;
          return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
        });
      }

      setTransactions(filteredByDate);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const applyTransactionDateFilter = () => {
    if (!startDate && !endDate) {
      setTransactions(allTransactions);
      return;
    }
    const combined = allTransactions;
    const effectiveStart = startDate || endDate;
    const effectiveEnd = endDate || startDate;
    
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
    
    const normalizeDateOnly = (value: string) => {
      try {
        return new Date(value).toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    const startKey = parseDisplayDate(effectiveStart) || '';
    const endKey = parseDisplayDate(effectiveEnd) || '';
    const filteredByDate = combined.filter((t: any) => {
      const rawDate = t.type === 'sale' ? t.sale_date : t.purchase_date;
      const dateKey = normalizeDateOnly(rawDate || t.created_at);
      if (!dateKey) return false;
      return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
    });
    setTransactions(filteredByDate);
  };

  const filteredTransactions = transactions.filter(
    (t) => filter === 'all' || t.type === filter
  );

  const resetForm = () => {
    setFormData({
      customer: '',
      type: 'Sale',
      itemsNote: '',
      lineItems: [{ product_name: '', quantity: 1, price: 0 }],
      paymentMethod: 'due',
      supplierId: '',
      transaction_date: new Date().toISOString().split('T')[0],
      discount: '',
    });
  };

  const handleAddTransaction = async () => {
    if (!formData.customer.trim()) {
      showWarning({ title: t('common.warning') || 'Warning', message: t('transactions.customerNameRequired') || 'Customer name is required.' });
      return;
    }

    let sanitizedItems = formData.lineItems
      .map(item => ({
        product_name: String(item.product_name ?? '').trim(),
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        price: typeof item.price === 'number' && item.price >= 0 ? item.price : 0,
      }))
      .filter(item => item.product_name || item.price > 0)
      .map(item => ({
        ...item,
        product_name: item.product_name || 'N/A',
      }));

    // Items are optional: if nothing provided, use a sensible default.
    if (sanitizedItems.length === 0) {
      sanitizedItems = [{ product_name: 'N/A', quantity: 1, price: 0 }];
    }

    const subtotal = sanitizedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discount = typeof formData.discount === 'number' ? formData.discount : 0;
    const totalAmount = subtotal - discount;

    try {
      const endpoint = formData.type === 'Sale' ? '/sales' : '/purchases';
      const paymentMethod = normalizePaymentMethod(formData.paymentMethod);

      if (editingTransaction) {
        const updateBody: any = {
          payment_method: paymentMethod,
          notes: formData.itemsNote || '',
          total: totalAmount,
          discount: discount > 0 ? discount : null,
          items: sanitizedItems.map(item =>
            formData.type === 'Sale'
              ? { product_name: item.product_name, quantity: item.quantity, price: item.price }
              : { product_name: item.product_name, quantity: item.quantity, cost: item.price }
          ),
        };
        
        // Add customer_name for sales or supplier_name for purchases
        if (formData.type === 'Sale') {
          updateBody.customer_name = formData.customer;
        } else {
          updateBody.supplier_name = formData.customer;
        }
        
        await api.put(`${endpoint}/${editingTransaction.id}`, updateBody);
      } else {
        const payload: any = {
          payment_method: paymentMethod,
          notes: formData.itemsNote || '',
          total: totalAmount,
        };

        if (discount > 0) {
          payload.discount = discount;
        }

        if (formData.transaction_date) {
          // Convert dd/mm/yyyy to proper ISO datetime with current time
          const dateStr = formData.transaction_date;
          const parts = dateStr.split('/');
          let isoDate = dateStr; // fallback to original
          
          if (parts.length === 3) {
            const [day, month, year] = parts;
            const now = new Date();
            const dateObj = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              now.getHours(),
              now.getMinutes(),
              now.getSeconds()
            );
            isoDate = dateObj.toISOString();
          }
          
          payload.sale_date = isoDate;
          payload.purchase_date = isoDate;
        }

        if (formData.type === 'Sale') {
          payload.customer_name = formData.customer;
          payload.items = sanitizedItems.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
          }));
        } else {
          payload.supplier_name = formData.customer;
          payload.items = sanitizedItems.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            cost: item.price,
          }));
        }

        console.log('Sending transaction payload:', payload);
        await api.post(endpoint, payload);
      }

      await fetchTransactions();
      setShowAddModal(false);
      setEditingTransaction(null);
      resetForm();
      showSuccess({ title: t('transactions.saved') || 'Saved', message: t('transactions.saveSuccess') || 'Transaction saved successfully.' });
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      console.error('Error response:', error.response?.data);
      console.error('Full error:', JSON.stringify(error, null, 2));
      const message = error.response?.data?.error || error.message || 'Failed to save transaction';
      showError({ title: t('common.error') || 'Error', message });
    }
  };

  const handleEditTransaction = async (transaction: Transaction) => {
    try {
      setEditingTransaction(transaction);
      
      // Fetch full transaction details with items
      const endpoint = transaction.type === 'sale' ? '/sales' : '/purchases';
      const response = await api.get(`${endpoint}/${transaction.id}`);
      const fullTransaction = response.data;
      
      // Parse items from the API response
      let lineItems = [{ product_name: '', quantity: 1, price: 0 }];
      
      if (fullTransaction.items && Array.isArray(fullTransaction.items) && fullTransaction.items.length > 0) {
        lineItems = fullTransaction.items.map((item: any) => ({
          product_name: item.product_name || '',
          quantity: item.quantity || 1,
          price: item.price || item.cost || 0,
        }));
      }
      
      setFormData({
        customer: transaction.customer_name || transaction.supplier_name || '',
        type: transaction.type === 'sale' ? 'Sale' : 'Purchase',
        itemsNote: fullTransaction.notes || '',
        lineItems: lineItems,
        paymentMethod: normalizePaymentMethod(transaction.payment_method || 'due'),
        supplierId: '',
        transaction_date: fullTransaction.sale_date || fullTransaction.purchase_date || new Date().toISOString().split('T')[0],
        discount: '',
      });
      setShowAddModal(true);
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      // Fallback to basic data if fetch fails
      setFormData({
        customer: transaction.customer_name || transaction.supplier_name || '',
        type: transaction.type === 'sale' ? 'Sale' : 'Purchase',
        itemsNote: '',
        lineItems: [{ product_name: '', quantity: 1, price: 0 }],
        paymentMethod: normalizePaymentMethod(transaction.payment_method || 'due'),
        supplierId: '',
        transaction_date: new Date().toISOString().split('T')[0],
        discount: '',
      });
      setShowAddModal(true);
    }
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    showConfirm({
      title: t('transactions.deleteConfirmTitle') || 'Delete Transaction',
      message: t('transactions.deleteConfirm') || 'Delete this transaction?',
      onConfirm: async () => {
        try {
          const endpoint = transaction.type === 'sale' ? '/sales' : '/purchases';
          await api.delete(`${endpoint}/${transaction.id}`);
          await fetchTransactions();
          showSuccess({ title: t('common.deleted') || 'Deleted', message: t('transactions.deletedSuccess') || 'Transaction deleted.' });
        } catch (error: any) {
          console.error('Error deleting transaction:', error);
          const message = error.response?.data?.error || t('transactions.deleteFailed') || 'Failed to delete transaction';
          showError({ title: t('common.error') || 'Error', message });
        }
      }
    });
  };

  const handleSelectAll = () => {
    const filtered = filteredTransactions;
    if (selectedTransactions.length === filtered.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filtered.map(t => t.id));
    }
  };

  const handleSelectTransaction = (id: number) => {
    setSelectedTransactions(prev =>
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.length === 0) {
      showWarning({ title: t('common.warning') || 'Warning', message: t('transactions.selectToDeleteWarning') || 'Please select transactions to delete.' });
      return;
    }
    showConfirm({
      title: t('common.delete') || 'Delete',
      message: `${t('transactions.bulkDeleteConfirmPrefix')}${selectedTransactions.length}${t('transactions.bulkDeleteConfirmSuffix')}`,
      onConfirm: async () => {
        try {
          const deletePromises = selectedTransactions.map(id => {
            const transaction = transactions.find(t => t.id === id);
            if (!transaction) return Promise.resolve();
            const endpoint = transaction.type === 'sale' ? '/sales' : '/purchases';
            return api.delete(`${endpoint}/${id}`);
          });
          await Promise.all(deletePromises);
          await fetchTransactions();
          setSelectedTransactions([]);
          showSuccess({ title: t('common.deleted') || 'Deleted', message: t('transactions.bulkDeletedSuccess') || 'Transactions deleted successfully.' });
        } catch (error: any) {
          console.error('Error deleting transactions:', error);
          const message = error.response?.data?.error || t('transactions.bulkDeleteFailed') || 'Failed to delete transactions';
          showError({ title: t('common.error') || 'Error', message });
        }
      }
    });
  };

  const handleCancel = () => {
    setShowAddModal(false);
    setEditingTransaction(null);
    setShowAdditionalDetails(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 dark:border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-lg text-emerald-700 dark:text-emerald-300 font-semibold">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 animate-fadeInDown" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 rounded-xl hover:shadow-md transition-all duration-200 group"
            >
              <ArrowLeftIcon className="h-6 w-6 text-emerald-700 dark:text-emerald-400 group-hover:-translate-x-1 transition-transform duration-200" />
            </button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
              {t('transactions.title')}
            </h1>
          </div>
          <div className="flex gap-3">
            {selectedTransactions.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <span className="text-xl">🗑️</span>
                {t('common.delete')} ({selectedTransactions.length})
              </button>
            )}
            <button 
              onClick={() => setShowAddModal(true)} 
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              <span className="text-xl">+</span>
              {t('transactions.addTransaction')}
            </button>
          </div>
        </div>

        

        {/* Filter + Type Buttons Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-3">
            <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg'
                : 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {t('transactions.all')}
          </button>
          <button
            onClick={() => setFilter('sale')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              filter === 'sale'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-600 dark:to-cyan-600 text-white shadow-lg'
                : 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 text-blue-700 dark:text-blue-300'
            }`}
          >
            {t('transactions.sales')}
          </button>
          <button
            onClick={() => setFilter('purchase')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
              filter === 'purchase'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-600 dark:to-pink-600 text-white shadow-lg'
                : 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300'
            }`}
          >
            {t('transactions.purchases')}
          </button>
          </div>
          <div>
            <button
              onClick={() => setShowDateFilter(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              <span className="text-xl">📅</span>
              {t('common.filter') || 'Filter'}
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/30 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-emerald-200 dark:divide-emerald-800">
            <thead className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    onChange={() => handleSelectAll()}
                    checked={
                      filteredTransactions.length > 0 &&
                      selectedTransactions.length === filteredTransactions.length
                    }
                    className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('transactions.id')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('common.date')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('transactions.type')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('transactions.party')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('transactions.amount')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('transactions.payment')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/50 dark:bg-emerald-950/30 divide-y divide-emerald-100 dark:divide-emerald-800/50">
              {filteredTransactions.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  className="cursor-pointer hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-200 animate-fadeIn"
                  style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                  onClick={() => handleEditTransaction(transaction)}
                >
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTransactions.includes(transaction.id)}
                      onChange={() => handleSelectTransaction(transaction.id)}
                      className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    #{transaction.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 dark:text-emerald-300">
                    {(() => {
                      const date = new Date(transaction.type === 'sale' ? (transaction as any).sale_date || transaction.created_at : (transaction as any).purchase_date || transaction.created_at);
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      return `${day}-${month}-${year}`;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold shadow-md ${
                      transaction.type === 'sale'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 text-white'
                    }`}>
                      {transaction.type === 'sale' ? t('transactions.sales') : t('transactions.purchases')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-emerald-900 dark:text-emerald-100">
                    {transaction.customer_name || transaction.supplier_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-900 dark:text-emerald-100">
                      ৳{Math.floor(Number(transaction.total ?? 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 dark:text-emerald-300 capitalize">
                      {transaction.payment_method || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTransaction(transaction)}
                          className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold text-xs hover:shadow-md"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction)}
                          className="px-3 py-1 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg font-semibold text-xs hover:shadow-md"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('common.endDate')}</label>
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(''); setEndDate(''); setTransactions(allTransactions); setShowDateFilter(false); }}
                      className="px-6 py-2 bg-gray-500 dark:bg-gray-600 text-white font-semibold rounded-xl shadow hover:shadow-md"
                    >
                      {t('common.clear')}
                    </button>
                  )}
                  <button
                    onClick={() => { applyTransactionDateFilter(); setShowDateFilter(false); }}
                    className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl shadow hover:shadow-md"
                  >
                    {t('common.apply')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={handleCancel}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700 animate-modalEnter" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddTransaction();
            }
          }}>
            {/* VISUAL ONLY: Header refactoring - improved visual hierarchy */}
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-emerald-700 dark:via-teal-700 dark:to-emerald-800 px-8 py-6 rounded-t-2xl border-b border-emerald-500/30">
              <h2 className="text-2xl font-bold text-white drop-shadow-md">
                {editingTransaction ? t('transactions.editTransaction') : t('transactions.addTransaction')}
              </h2>
              <p className="text-emerald-100/70 text-sm mt-1">{editingTransaction ? t('transactions.updateTransaction') : t('transactions.createTransaction')}</p>
            </div>
            
            <div className="p-8 space-y-6">
              {/* VISUAL ONLY: Required Fields - improved spacing and clarity */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('transactions.customerName')} <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 focus:outline-none transition-all duration-150 shadow-sm"
                  placeholder={formData.type === 'Sale' ? t('transactions.customerPlaceholder') : t('transactions.supplierPlaceholder')}
                  required
                />
              </div>

              {/* VISUAL ONLY: Transaction Type Section - improved card styling */}
              <div className="p-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm">
                <div className="flex flex-col gap-3 mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest font-semibold text-slate-600 dark:text-slate-400">Optional</div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('transactions.transactionType')}</h3>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'Sale' }))}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                      formData.type === 'Sale'
                        ? 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-600 dark:border-emerald-700 shadow-md'
                        : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500'
                    }`}
                  >
                    {t('transactions.sales')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'Purchase' }))}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                      formData.type === 'Purchase'
                        ? 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700 shadow-md'
                        : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    {t('transactions.purchases')}
                  </button>
                </div>
              </div>

              {/* VISUAL ONLY: Payment Method - improved styling */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('transactions.paymentMethod')}
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 focus:outline-none transition-all shadow-sm"
                >
                  <option value="due">{t('transactions.dueUnpaid')}</option>
                  <option value="cash">{t('transactions.cash')}</option>
                  <option value="card">{t('transactions.card')}</option>
                  <option value="bank_transfer">{t('transactions.bankTransfer')}</option>
                </select>
              </div>

              {/* VISUAL ONLY: Line Items Section - improved card hierarchy and spacing */}
              <div className="space-y-4 p-6 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-widest font-semibold text-slate-600 dark:text-slate-400">{t('transactions.items')}</div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('transactions.itemsOptional')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({
                        ...prev,
                        lineItems: [...prev.lineItems, { product_name: '', quantity: 1, price: 0 }],
                      }))
                    }
                    className="px-4 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm"
                  >
                    + {t('transactions.addItem')}
                  </button>
                </div>

                {formData.lineItems.map((item, index) => (
                  <div key={index} className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4 space-y-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t('transactions.itemLabel')}</label>
                        <input
                          type="text"
                          value={item.product_name || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => {
                              const lineItems = [...prev.lineItems];
                              lineItems[index] = { ...lineItems[index], product_name: value };
                              return { ...prev, lineItems };
                            });
                          }}
                          className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                          placeholder="Item name"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t('transactions.qtyLabel')}</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseNumericInput(e.target.value);
                            setFormData(prev => {
                              const lineItems = [...prev.lineItems];
                              lineItems[index] = { ...lineItems[index], quantity: value };
                              return { ...prev, lineItems };
                            });
                          }}
                          className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                          placeholder="1"
                        />
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{formData.type === 'Sale' ? t('transactions.unitPriceLabel') : t('transactions.unitCostLabel')}</label>
                        <input
                          type="number"
                          min="0"
                          value={item.price === 0 ? '' : item.price}
                          onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseNumericInput(e.target.value);
                            setFormData(prev => {
                              const lineItems = [...prev.lineItems];
                              lineItems[index] = { ...lineItems[index], price: value };
                              return { ...prev, lineItems };
                            });
                          }}
                          className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{t('transactions.lineTotalLabel')}</label>
                        <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-right font-semibold text-sm">
                          {Math.floor((typeof item.quantity === 'number' ? item.quantity : 0) * (typeof item.price === 'number' ? item.price : 0))}
                        </div>
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData(prev => {
                              if (prev.lineItems.length === 1) return prev;
                              const lineItems = prev.lineItems.filter((_, i) => i !== index);
                              return { ...prev, lineItems };
                            })
                          }
                          className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 font-bold"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* VISUAL ONLY: Subtotal and Total - enhanced distinction */}
                <div className="space-y-3 pt-4 border-t-2 border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('transactions.subtotal')}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      ৳{
                        formData.lineItems.reduce((sum, item) => {
                          const qty = typeof item.quantity === 'number' ? item.quantity : 0;
                          const price = typeof item.price === 'number' ? item.price : 0;
                          return sum + qty * price;
                        }, 0).toFixed(2)
                      }
                    </span>
                  </div>
                  
                  {formData.discount !== '' && formData.discount !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">{t('transactions.discount')}</span>
                      <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">-৳{Number(formData.discount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800">
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('transactions.total')}</span>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      ৳{
                        (formData.lineItems.reduce((sum, item) => {
                          const qty = typeof item.quantity === 'number' ? item.quantity : 0;
                          const price = typeof item.price === 'number' ? item.price : 0;
                          return sum + qty * price;
                        }, 0) - (formData.discount ? Number(formData.discount) : 0)).toFixed(2)
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* VISUAL ONLY: Additional Details Toggle - enhanced styling */}
              <button
                type="button"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                className="w-full flex items-center justify-between px-5 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 border-2 border-slate-200 dark:border-slate-700"
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100">{t('transactions.additionalDetails')}</span>
                <span className={`text-slate-700 dark:text-slate-300 transition-transform duration-200 ${
                  showAdditionalDetails ? 'rotate-180' : ''
                }`}>▼</span>
              </button>

              {/* VISUAL ONLY: Optional Fields - refined spacing and styling */}
              {showAdditionalDetails && (
                <div className="space-y-4 mt-4 p-6 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 animate-slideDown">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                      {t('common.date')}
                    </label>
                    <DateInput
                      value={formData.transaction_date}
                      onChange={(value) => setFormData({ ...formData, transaction_date: value })}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                      {t('Discount')} ({t('transactions.optional')})
                    </label>
                    <input
                      type="number"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value === '' ? '' : parseNumericInput(e.target.value) })}
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                      {t('transactions.notes')}
                    </label>
                    <textarea
                      value={formData.itemsNote}
                      onChange={(e) => setFormData({ ...formData, itemsNote: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 focus:outline-none transition-all"
                      placeholder={t('transactions.notesPlaceholder')}
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* VISUAL ONLY: Footer Action Buttons - improved styling and spacing */}
            <div className="flex gap-3 px-8 pb-8 pt-4">
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600 focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 focus:outline-none transition-all duration-200 shadow-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddTransaction}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 text-white font-semibold rounded-lg hover:shadow-lg hover:from-emerald-700 hover:to-emerald-800 dark:hover:from-emerald-800 dark:hover:to-emerald-900 focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-600 focus:outline-none transition-all duration-200"
              >
                {editingTransaction ? t('common.save') : t('transactions.addTransaction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
