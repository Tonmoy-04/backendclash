import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../utils/numberConverter';
import { useTranslation } from '../context/TranslationContext';

interface Transaction {
  id: number;
  type: 'payment' | 'charge';
  amount: number;
  description?: string;
  created_at: string;
}

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  transactions: Transaction[];
  mode: 'customer' | 'supplier'; // 'customer' or 'supplier'
  onEditTransaction?: (transaction: Transaction) => void;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  transactions,
  mode,
  onEditTransaction
}) => {
  const { t, language } = useTranslation();

  if (!isOpen || !selectedDate) return null;

  // Filter transactions for the selected date
  const dayTransactions = transactions.filter(t => {
    const dateObj = new Date(t.created_at);
    const transactionDate = formatDate(dateObj);
    return transactionDate === selectedDate;
  });

  // Get localized labels based on language
  const getLabels = () => {
    if (language === 'bn') {
      return {
        header: 'লেনদেনের বিবরণ',
        type: 'ধরন',
        amount: 'পরিমাণ',
        description: 'বিবরণ',
        noDescription: 'বিবরণ প্রদান করা হয়নি',
        dailySummary: 'দৈনিক সারসংক্ষেপ',
        close: 'বন্ধ করুন',
        customerDeposit: 'জমা দেওয়া',
        customerWithdrawal: 'উত্তোলন',
        supplierReceive: 'গ্রহণ',
        supplierPayment: 'পেমেন্ট',
        totalDeposits: 'মোট জমা',
        totalWithdrawals: 'মোট উত্তোলন',
        totalReceived: 'মোট গ্রহণ',
        totalPayments: 'মোট পেমেন্ট',
        noTransactions: 'এই তারিখের জন্য কোনো লেনদেন পাওয়া যায়নি।'
      };
    } else {
      return {
        header: 'Transaction Details',
        type: 'Type',
        amount: 'Amount',
        description: 'Description',
        noDescription: 'No description provided',
        dailySummary: 'Daily Summary',
        close: 'Close',
        customerDeposit: 'Deposit',
        customerWithdrawal: 'Withdrawal',
        supplierReceive: 'Receive',
        supplierPayment: 'Payment',
        totalDeposits: 'Total Deposits',
        totalWithdrawals: 'Total Withdrawals',
        totalReceived: 'Total Received',
        totalPayments: 'Total Payments',
        noTransactions: 'No transactions found for this date.'
      };
    }
  };

  const labels = getLabels();

  // Determine transaction type label based on mode and type
  const getTypeLabel = (transactionType: string) => {
    if (mode === 'customer') {
      return transactionType === 'charge' ? labels.customerWithdrawal : labels.customerDeposit;
    } else {
      return transactionType === 'charge' ? labels.supplierPayment : labels.supplierReceive;
    }
  };

  // Calculate totals
  const totalDeposits = dayTransactions
    .filter(t => t.type === 'payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = dayTransactions
    .filter(t => t.type === 'charge')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-fadeInUp" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{labels.header}</h2>
            <p className="text-emerald-50 text-sm mt-1">{selectedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {dayTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-emerald-600 dark:text-emerald-400 text-lg">{labels.noTransactions}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dayTransactions.map((transaction, idx) => (
                <div
                  key={transaction.id || idx}
                  className={`p-4 border-l-4 rounded-lg ${
                    transaction.type === 'charge'
                      ? 'bg-red-50 dark:bg-red-900/20 border-l-red-500'
                      : 'bg-green-50 dark:bg-green-900/20 border-l-green-500'
                  } ${onEditTransaction ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                  onClick={() => onEditTransaction && onEditTransaction(transaction)}
                >
                  {/* Row with Type and Amount */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{labels.type}</p>
                      <p className={`text-lg font-bold ${
                        transaction.type === 'charge'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {getTypeLabel(transaction.type)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{labels.amount}</p>
                      <p className={`text-2xl font-bold ${
                        transaction.type === 'charge'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        ৳{transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="pt-3 border-t border-opacity-20 dark:border-opacity-10 border-gray-400">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">{labels.description}</p>
                    <p className="text-sm text-emerald-900 dark:text-emerald-100">
                      {transaction.description && transaction.description.trim()
                        ? transaction.description
                        : <span className="text-emerald-400 italic">{labels.noDescription}</span>
                      }
                    </p>
                  </div>
                </div>
              ))}

              {/* Summary if multiple transactions */}
              {dayTransactions.length > 1 && (
                <div className="mt-6 pt-6 border-t-2 border-emerald-200 dark:border-emerald-700">
                  <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-4">{labels.dailySummary}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                      <p className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase mb-1">
                        {mode === 'customer' ? labels.totalDeposits : labels.totalReceived}
                      </p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                        ৳{totalDeposits.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                      <p className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase mb-1">
                        {mode === 'customer' ? labels.totalWithdrawals : labels.totalPayments}
                      </p>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                        ৳{totalWithdrawals.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-950 border-t border-emerald-200 dark:border-emerald-800">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailsModal;
