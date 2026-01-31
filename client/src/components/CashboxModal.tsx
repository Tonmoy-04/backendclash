import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, MinusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../context/TranslationContext';
import api from '../services/api';
import { parseNumericInput, toInputDateFormat, parseDisplayDateToAPI } from '../utils/numberConverter';
import DateInput from './DateInput';
import { useNotification } from '../context/NotificationContext';
import { buildCashboxSummary } from '../utils/notificationSummary';
import { formatBDT } from '../utils/currency';

interface CashboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentBalance: number;
  isInitialized: boolean;
}

const CashboxModal: React.FC<CashboxModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentBalance,
  isInitialized 
}) => {
  const { t } = useTranslation();
  const { showSuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toInputDateFormat(new Date()));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  // For initialization
  const [openingBalance, setOpeningBalance] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setAmount('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
      setOpeningBalance('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const balance = parseFloat(openingBalance);
      if (isNaN(balance) || balance < 0) {
        setError(t('cashbox.invalidAmount'));
        setLoading(false);
        return;
      }

      await api.post('/cashbox/init', { opening_balance: balance });
      onSuccess();
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || data?.details || t('cashbox.initError'));
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const amountValue = parseFloat(amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        setError(t('cashbox.invalidAmount'));
        setLoading(false);
        return;
      }

      if (activeTab === 'withdrawal' && amountValue > currentBalance) {
        setError(t('cashbox.insufficientBalance'));
        setLoading(false);
        return;
      }

      const convertedDate = parseDisplayDateToAPI(date);

      await api.post('/cashbox/transaction', {
        type: activeTab,
        amount: amountValue,
        date: convertedDate,
        note: note
      });

      // Show dynamic summary notification
      const actionType = activeTab === 'deposit' ? 'Deposit' : 'Withdraw';
      const summary = buildCashboxSummary(
        actionType,
        amountValue,
        note || undefined,
        formatBDT
      );
      showSuccess({ 
        title: t('common.success') || 'Success', 
        message: summary 
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || data?.details || t('cashbox.transactionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setLoading(true);

    try {
      await api.post('/cashbox/reset', { confirmReset: true });
      
      showSuccess({ 
        title: t('common.success') || 'Success', 
        message: t('cashbox.resetSuccess') 
      });

      setShowResetModal(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || data?.details || 'Failed to reset cashbox');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-emerald-200 dark:border-emerald-700">
            <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {!isInitialized ? t('cashbox.initialize') : t('cashbox.manageCashbox')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800 transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {!isInitialized ? (
              // Initialization Form
              <form onSubmit={handleInitialize} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                    {t('cashbox.openingBalance')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseNumericInput(e.target.value).toString())}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:outline-none transition-colors"
                    placeholder="0.00"
                    required
                  />
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-300">
                    {t('cashbox.initMessage')}
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:from-emerald-400 disabled:to-cyan-400 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105"
                >
                  {loading ? t('common.loading') : t('cashbox.initialize')}
                </button>
              </form>
            ) : (
              // Transaction Form
              <>
                {/* Tab Buttons */}
                <div className="flex gap-2 mb-6 p-1 bg-emerald-100 dark:bg-emerald-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                      activeTab === 'deposit'
                        ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg'
                        : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-700'
                    }`}
                  >
                    <PlusIcon className="h-5 w-5 inline mr-2" />
                    {t('cashbox.deposit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('withdrawal')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                      activeTab === 'withdrawal'
                        ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg'
                        : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-700'
                    }`}
                  >
                    <MinusIcon className="h-5 w-5 inline mr-2" />
                    {t('cashbox.withdrawal')}
                  </button>
                </div>

                {/* Current Balance Display */}
                <div className="mb-6 p-4 bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-800 dark:to-teal-800 rounded-xl">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">
                    {t('cashbox.currentBalance')}
                  </p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-50">
                    {formatBDT(currentBalance, { decimals: 0 })}
                  </p>
                </div>

                <form onSubmit={handleTransaction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                      {t('cashbox.amount')} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(parseNumericInput(e.target.value).toString())}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:outline-none transition-colors"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                      {t('common.date')}
                    </label>
                    <DateInput
                      value={date}
                      onChange={setDate}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                      {t('cashbox.note')}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:outline-none transition-colors resize-none"
                      placeholder={t('cashbox.notePlaceholder')}
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105 ${
                      activeTab === 'deposit'
                        ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700'
                        : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700'
                    } text-white disabled:opacity-50`}
                  >
                    {loading
                      ? t('common.loading')
                      : activeTab === 'deposit'
                      ? t('cashbox.addDeposit')
                      : t('cashbox.addWithdrawal')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    disabled={loading}
                    className="w-full py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold rounded-xl shadow-sm transition-all border border-red-200 dark:border-red-700"
                  >
                    {t('cashbox.resetCashbox')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={() => !loading && setShowResetModal(false)}
              ></div>

              {/* Modal */}
              <div className="relative bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl w-full max-w-md transform transition-all border-2 border-red-200 dark:border-red-700">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    <h2 className="text-xl font-bold text-red-700 dark:text-red-300">
                      {t('cashbox.resetCashbox')}
                    </h2>
                  </div>
                  <button
                    onClick={() => !loading && setShowResetModal(false)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
                    disabled={loading}
                  >
                    <XMarkIcon className="h-6 w-6 text-red-700 dark:text-red-300" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
                    <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
                      {t('cashbox.resetWarning')}
                    </p>
                  </div>

                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {t('cashbox.resetConfirm')}
                  </p>

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowResetModal(false)}
                      disabled={loading}
                      className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={loading}
                      className="flex-1 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 disabled:from-red-400 disabled:to-orange-400 text-white font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105"
                    >
                      {loading ? t('common.loading') : t('cashbox.resetCashbox')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashboxModal;
