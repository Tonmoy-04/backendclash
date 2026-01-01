import React, { useMemo } from 'react';
import { ArrowUpIcon, ArrowDownIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../context/TranslationContext';
import { formatDate as formatDateDMY } from '../utils/numberConverter';

interface Transaction {
  id: number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note: string;
  balance_after: number;
  created_at: string;
}

interface CashboxTransactionsProps {
  transactions: Transaction[];
  loading?: boolean;
}

interface DailyGrouped {
  date: string;
  formattedDate: string;
  totalDeposits: number;
  totalWithdrawals: number;
  netChange: number;
  transactionCount: number;
  lastBalance: number;
  transactions: Transaction[];
}

const CashboxTransactions: React.FC<CashboxTransactionsProps> = ({ 
  transactions, 
  loading = false 
}) => {
  const { t, language } = useTranslation();
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());

  const formatDate = (dateString: string) => {
    return formatDateDMY(new Date(dateString));
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const groupedByDate = useMemo(() => {
    const groups: { [key: string]: DailyGrouped } = {};

    transactions.forEach((txn) => {
      const dateKey = new Date(txn.date).toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          formattedDate: formatDate(txn.date),
          totalDeposits: 0,
          totalWithdrawals: 0,
          netChange: 0,
          transactionCount: 0,
          lastBalance: txn.balance_after,
          transactions: []
        };
      }

      groups[dateKey].transactions.push(txn);
      groups[dateKey].transactionCount++;
      
      if (txn.type === 'deposit') {
        groups[dateKey].totalDeposits += txn.amount;
      } else {
        groups[dateKey].totalWithdrawals += txn.amount;
      }

      groups[dateKey].netChange = groups[dateKey].totalDeposits - groups[dateKey].totalWithdrawals;
      groups[dateKey].lastBalance = txn.balance_after;
    });

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const toggleExpand = (dateKey: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedDates(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-emerald-900 rounded-2xl shadow-xl p-6 border border-emerald-200 dark:border-emerald-700">
        <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-4">
          {t('cashbox.transactionHistory')}
        </h3>
        <div className="flex items-center justify-center py-12">
          <div className="text-emerald-600 dark:text-emerald-300">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-emerald-900 rounded-2xl shadow-xl p-6 border border-emerald-200 dark:border-emerald-700">
        <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-4">
          {t('cashbox.transactionHistory')}
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-emerald-600 dark:text-emerald-300">
          <p className="text-lg font-medium">{t('cashbox.noTransactions')}</p>
          <p className="text-sm mt-2">{t('cashbox.startByAdding')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-emerald-900 rounded-2xl shadow-xl p-6 border border-emerald-200 dark:border-emerald-700">
      <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mb-4">
        {t('cashbox.transactionHistory')}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-emerald-200 dark:border-emerald-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100 w-24">
                {t('common.date')}
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {t('cashbox.deposit')}
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {t('cashbox.withdrawal')}
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Net Change
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {t('cashbox.balanceAfter')}
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-emerald-900 dark:text-emerald-100 w-16">
                Items
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedByDate.map((group) => (
              <React.Fragment key={group.date}>
                {/* Main Date Row */}
                <tr
                  onClick={() => toggleExpand(group.date)}
                  className="border-b border-emerald-100 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-800/50 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      {group.formattedDate}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-semibold">
                      <ArrowUpIcon className="h-4 w-4 mr-1" />
                      ৳{Math.floor(group.totalDeposits)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-semibold">
                      <ArrowDownIcon className="h-4 w-4 mr-1" />
                      ৳{Math.floor(group.totalWithdrawals)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold ${
                      group.netChange >= 0
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    }`}>
                      {group.netChange >= 0 ? '+' : ''}৳{Math.floor(group.netChange)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      ৳{Math.floor(group.lastBalance)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {group.transactionCount}
                      </span>
                      {expandedDates.has(group.date) ? (
                        <ChevronUpIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded Detail Rows */}
                {expandedDates.has(group.date) && group.transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-emerald-50 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-800/20 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
                  >
                    <td className="py-2 px-4">
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatTime(transaction.date)}
                      </div>
                    </td>
                    <td colSpan={2} className="py-2 px-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        transaction.type === 'deposit'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <>
                            <ArrowUpIcon className="h-3 w-3 mr-1" />
                            {t('cashbox.deposit')}
                          </>
                        ) : (
                          <>
                            <ArrowDownIcon className="h-3 w-3 mr-1" />
                            {t('cashbox.withdrawal')}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className={`font-semibold text-xs ${
                        transaction.type === 'deposit'
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}>
                        {transaction.type === 'deposit' ? '+' : '-'}৳{Math.floor(transaction.amount)}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <span className="text-xs text-emerald-600 dark:text-emerald-300">
                        ৳{Math.floor(transaction.balance_after)}
                      </span>
                    </td>
                    <td colSpan={1} className="py-2 px-4">
                      <span className="text-xs text-emerald-700 dark:text-emerald-300 block truncate">
                        {transaction.note || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashboxTransactions;
