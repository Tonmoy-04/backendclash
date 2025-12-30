import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Product {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  min_stock: number;
  category_name?: string;
}

interface LowStockCardProps {
  products: Product[];
}

const LowStockCard: React.FC<LowStockCardProps> = ({ products }) => {
  return (
    <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl p-6 border border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Low Stock Alerts</h3>
        <ExclamationTriangleIcon className="h-6 w-6 text-orange-500 dark:text-orange-400" />
      </div>

      {products.length === 0 ? (
        <p className="text-emerald-600 dark:text-emerald-300 text-center py-4">No low stock items</p>
      ) : (
        <div className="space-y-3">
          {products.slice(0, 5).map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 rounded-lg border border-orange-200 dark:border-orange-700/50"
            >
              <div className="flex-1">
                <p className="font-medium text-emerald-900 dark:text-emerald-100">{product.name}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">SKU: {product.sku}</p>
                {product.category_name && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{product.category_name}</p>
                )}
              </div>
              
              <div className="text-right">
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {product.quantity}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Min: {product.min_stock}
                </p>
              </div>
            </div>
          ))}
          
          {products.length > 5 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center mt-2">
              +{products.length - 5} more items
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LowStockCard;
