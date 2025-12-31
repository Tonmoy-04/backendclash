import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { parseNumericInput } from '../utils/numberConverter';
import { useNotification } from '../context/NotificationContext';
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
    const normalizeDateOnly = (value: string) => {
      try {
        return new Date(value).toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    const startKey = effectiveStart || '';
    const endKey = effectiveEnd || '';
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
      showWarning({ title: t('common.warning') || 'Warning', message: (t('transactions.customerName') || 'Customer') + ' is required' });
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
          payload.sale_date = formData.transaction_date;
          payload.purchase_date = formData.transaction_date;
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
          showSuccess({ title: t('common.deleted') || 'Deleted', message: 'Transaction deleted.' });
        } catch (error: any) {
          console.error('Error deleting transaction:', error);
          const message = error.response?.data?.error || 'Failed to delete transaction';
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
      showWarning({ title: t('common.warning') || 'Warning', message: 'Please select transactions to delete' });
      return;
    }
    showConfirm({
      title: t('common.delete') || 'Delete',
      message: `Delete ${selectedTransactions.length} transaction(s)? This cannot be undone.`,
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
          showSuccess({ title: t('common.deleted') || 'Deleted', message: 'Transactions deleted.' });
        } catch (error: any) {
          console.error('Error deleting transactions:', error);
          const message = error.response?.data?.error || 'Failed to delete transactions';
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
              className="p-2 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 rounded-xl hover:shadow-lg hover:scale-110 transition-all duration-300 group"
            >
              <ArrowLeftIcon className="h-6 w-6 text-emerald-700 dark:text-emerald-400 group-hover:-translate-x-1 transition-transform" />
            </button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
              {t('transactions.title')}
            </h1>
          </div>
          <div className="flex gap-3">
            {selectedTransactions.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
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
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg scale-105'
                : 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 text-emerald-700 dark:text-emerald-300 hover:scale-105'
            }`}
          >
            {t('transactions.all')}
          </button>
          <button
            onClick={() => setFilter('sale')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              filter === 'sale'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-600 dark:to-cyan-600 text-white shadow-lg scale-105'
                : 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 text-blue-700 dark:text-blue-300 hover:scale-105'
            }`}
          >
            {t('transactions.sales')}
          </button>
          <button
            onClick={() => setFilter('purchase')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              filter === 'purchase'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-600 dark:to-pink-600 text-white shadow-lg scale-105'
                : 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300 hover:scale-105'
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
        <div className="bg-white/80 dark:bg-emerald-950/30 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm border border-slate-200/70 dark:border-emerald-800/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/70 dark:divide-emerald-800">
              <thead className="bg-slate-50/90 dark:bg-emerald-900/40">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      onChange={() => handleSelectAll()}
                      checked={
                        filteredTransactions.length > 0 &&
                        selectedTransactions.length === filteredTransactions.length
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('transactions.id')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('common.date')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('transactions.type')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('transactions.party')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('transactions.amount')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('transactions.payment')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 dark:text-emerald-100 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60 dark:bg-emerald-950/30 divide-y divide-slate-100 dark:divide-emerald-800/50">
                {filteredTransactions.map((transaction, index) => (
                  <tr
                    key={transaction.id}
                    className={`cursor-pointer transition-colors duration-150 ${
                      index % 2 === 0
                        ? 'bg-white/70 dark:bg-emerald-950/20'
                        : 'bg-slate-50/60 dark:bg-emerald-950/35'
                    } hover:bg-slate-100/70 dark:hover:bg-emerald-900/30`}
                    onClick={() => handleEditTransaction(transaction)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedTransactions.includes(transaction.id)}
                        onChange={() => handleSelectTransaction(transaction.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-emerald-100">
                      #{transaction.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-emerald-300">
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
                    <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-slate-900 dark:text-emerald-100">
                      {transaction.customer_name || transaction.supplier_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-emerald-100">
                      ৳{Math.floor(Number(transaction.total ?? 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-emerald-300 capitalize">
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
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('common.endDate')}</label>
                  <input
                    type="date"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={handleCancel}>
          <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-emerald-200/50 dark:border-emerald-700/30" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddTransaction();
            }
          }}>
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white">
                {editingTransaction ? t('transactions.editTransaction') : t('transactions.addTransaction')}
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Required Fields */}
              <div>
                <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                  {t('transactions.customerName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-400/70 dark:placeholder:text-emerald-300/40 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all shadow-sm"
                  placeholder={formData.type === 'Sale' ? t('transactions.customerPlaceholder') : t('transactions.supplierPlaceholder')}
                  required
                />
              </div>

              {/* Optional: Transaction Type surfaced early */}
              <div className="p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/50 dark:to-teal-900/50 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-300">{t('transactions.optional')}</div>
                  <div className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{t('transactions.transactionType')}</div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{t('transactions.chooseType')}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'Sale' }))}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all duration-200 shadow-sm ${
                      formData.type === 'Sale'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 ring-2 ring-emerald-200/60'
                        : 'bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-100 border-emerald-200 dark:border-emerald-700 hover:border-emerald-400 hover:shadow'
                    }`}
                  >
                    {t('transactions.sales')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'Purchase' }))}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all duration-200 shadow-sm ${
                      formData.type === 'Purchase'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400 ring-2 ring-blue-200/60'
                        : 'bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-100 border-emerald-200 dark:border-emerald-700 hover:border-blue-300 hover:shadow'
                    }`}
                  >
                    {t('transactions.purchases')}
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                  {t('transactions.paymentMethod')}
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all shadow-sm"
                >
                  <option value="due">{t('transactions.dueUnpaid')}</option>
                  <option value="cash">{t('transactions.cash')}</option>
                  <option value="card">{t('transactions.card')}</option>
                  <option value="bank_transfer">{t('transactions.bankTransfer')}</option>
                </select>
              </div>

              <div className="space-y-3 p-4 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/50 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-300">{t('transactions.items') || 'Items'}</div>
                    <div className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{t('transactions.itemsOptional') || 'Items (optional)'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({
                        ...prev,
                        lineItems: [...prev.lineItems, { product_name: '', quantity: 1, price: 0 }],
                      }))
                    }
                    className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/80 dark:bg-emerald-950 text-sm font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all shadow-sm"
                  >
                    + Add Item
                  </button>
                </div>

                {formData.lineItems.map((item, index) => (
                  <div key={index} className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/70 bg-white/80 dark:bg-emerald-950/50 space-y-3 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-1">Item</label>
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
                          className="w-full px-3 py-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-400/70 dark:placeholder:text-emerald-300/40 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                          placeholder="Item name"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-1">Qty</label>
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
                          className="w-full px-3 py-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-400/70 dark:placeholder:text-emerald-300/40 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                          placeholder="1"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-1">Unit {formData.type === 'Sale' ? 'Price' : 'Cost'}</label>
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
                          className="w-full px-3 py-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-400/70 dark:placeholder:text-emerald-300/40 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-1">Line Total</label>
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 border-2 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-right font-semibold">
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
                          className="p-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Subtotal and Adjustment */}
                <div className="space-y-2 pt-2 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    <span>Subtotal</span>
                    <span>
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
                    <div className="flex items-center justify-between text-sm font-medium text-orange-700 dark:text-orange-300">
                      <span>Discount</span>
                      <span>-৳{Number(formData.discount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t-2 border-emerald-300 dark:border-emerald-700">
                    <span className="text-xl font-bold text-emerald-900 dark:text-emerald-100">Total</span>
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

              {/* Additional Details Toggle */}
              <button
                type="button"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 rounded-xl hover:shadow-md transition-all duration-300 group"
              >
                <span className="font-semibold text-emerald-900 dark:text-emerald-100">Additional Details</span>
                <span className={`text-emerald-700 dark:text-emerald-300 transition-transform duration-300 ${
                  showAdditionalDetails ? 'rotate-180' : ''
                }`}>▼</span>
              </button>

              {/* Optional Fields - Hidden by Default */}
              {showAdditionalDetails && (
                <div className="space-y-4 mt-4 animate-in slide-in-from-top duration-300">
                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                      {t('common.date')}
                    </label>
                    <input
                      type="date"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                      {t('billGenerator.discount')} ({t('transactions.optional')})
                    </label>
                    <input
                      type="number"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value === '' ? '' : parseNumericInput(e.target.value) })}
                      placeholder="0"
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                      Notes / Description
                    </label>
                    <textarea
                      value={formData.itemsNote}
                      onChange={(e) => setFormData({ ...formData, itemsNote: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                      placeholder="Optional details about this transaction"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6 pt-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddTransaction}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
              >
                {editingTransaction ? t('common.save') : t('transactions.addTransaction')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeInDown {
          animation: fadeInDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-fadeInRight {
          animation: fadeInRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-in forwards;
        }
      `}</style>
    </div>
  );
};

export default Transactions;
