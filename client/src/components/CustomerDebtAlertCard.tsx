import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { formatNumberIndian } from '../utils/currency';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  balance: number;
}

interface CustomerDebtAlertCardProps {
  customers: Customer[];
  threshold?: number;
}

const CustomerDebtAlertCard: React.FC<CustomerDebtAlertCardProps> = ({ customers, threshold = 1000000 }) => {
  return (
    <div className="bg-gradient-to-br from-white to-orange-50/40 dark:from-amber-900 dark:to-orange-900/30 rounded-2xl shadow-xl p-6 border border-orange-200/60 dark:border-orange-700/40 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          High Customer Debt ({customers.length})
        </h3>
        <ExclamationTriangleIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
      </div>

      {customers.length === 0 ? (
        <p className="text-amber-700 dark:text-amber-200 text-center py-4">
          No customers owe over ৳{formatNumberIndian(threshold, 0)}
        </p>
      ) : (
        <div className="space-y-3">
          {customers.slice(0, 5).map((customer) => (
            <div
              key={customer.id}
              className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-100 to-amber-50 dark:from-orange-900/50 dark:to-amber-900/30 rounded-lg border border-orange-200 dark:border-orange-700/60"
            >
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-100">{customer.name}</p>
                {customer.phone && (
                  <p className="text-sm text-amber-800 dark:text-amber-200">{customer.phone}</p>
                )}
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  ৳{formatNumberIndian(Math.abs(customer.balance || 0), 0)}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Owes</p>
              </div>
            </div>
          ))}

          {customers.length > 5 && (
            <p className="text-sm text-amber-700 dark:text-amber-300 text-center mt-2">
              +{customers.length - 5} more customers over ৳{formatNumberIndian(threshold, 0)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDebtAlertCard;