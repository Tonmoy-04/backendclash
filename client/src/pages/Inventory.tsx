import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import '../styles/Inventory.css';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  cost: number;
  quantity: number;
  min_stock: number;
}

interface ProductMovement {
  id: number;
  item_id: number;
  type: 'PURCHASE' | 'SELL';
  quantity: number;
  price?: number | null;
  transaction_date: string;
  reference_id?: number;
  stock_after?: number | null;
  created_at?: string;
}

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [movementsAll, setMovementsAll] = useState<ProductMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  useEffect(() => {
    // Check if we're coming from dashboard with low stock filter
    const state = location.state as any;
    if (state?.filterLowStock) {
      setFilterLowStock(true);
    }
  }, [location.state]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLowStock = !filterLowStock || product.quantity <= product.min_stock;
      return matchesSearch && matchesLowStock;
    }
  );

  const handleDelete = async (product: Product) => {
    if (!window.confirm(t('common.deleteConfirm') || 'Delete this product?')) return;
    try {
      await api.delete(`/products/${product.id}`);
      await fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(error.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleSelectProduct = (id: number) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select products to delete');
      return;
    }
    if (!window.confirm(`Delete ${selectedProducts.length} product(s)?`)) return;
    try {
      await Promise.all(selectedProducts.map(id => api.delete(`/products/${id}`)));
      setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id)));
      setSelectedProducts([]);
    } catch (error: any) {
      console.error('Error deleting products:', error);
      alert(error.response?.data?.error || 'Failed to delete products');
    }
  };

  const handleViewHistory = async (product: Product) => {
    setMovementProduct(product);
    setShowHistoryModal(true);
    setLoadingMovements(true);
    setMovementError('');

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
      const url = `/products/${product.id}/movements${queryString ? '?' + queryString : ''}`;
      const response = await api.get(url);
      const serverMovements = response.data?.movements || [];
      // Cache full list for instant Clear
      if (!startDate && !endDate) {
        setMovementsAll(serverMovements);
      }

      // Client-side date filtering to ensure UI matches filter
      let filtered = serverMovements;
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
        filtered = serverMovements.filter((m: any) => {
          const rawDate = m.transaction_date || m.created_at;
          const dateKey = normalizeDateOnly(rawDate);
          if (!dateKey) return false;
          return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
        });
      }

      setMovements(filtered);
    } catch (error: any) {
      console.error('Error loading product movements:', error);
      setMovementError(error.response?.data?.error || 'Failed to load history');
    } finally {
      setLoadingMovements(false);
    }
  };

  const applyMovementFilter = () => {
    if (!startDate && !endDate) {
      setMovements(movementsAll);
      return;
    }
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
    const filtered = movementsAll.filter((m: any) => {
      const rawDate = m.transaction_date || m.created_at;
      const dateKey = normalizeDateOnly(rawDate);
      if (!dateKey) return false;
      return (!startKey || dateKey >= startKey) && (!endKey || dateKey <= endKey);
    });
    setMovements(filtered);
  };

  const getStockStatus = (quantity: number, minStock: number) => {
    if (quantity === 0) return { 
      text: t('inventory.outOfStock'), 
      color: 'bg-red-100 text-red-800',
      badgeClass: 'status-badge bg-red-100 text-red-800 hover:bg-red-200'
    };
    if (quantity <= minStock) return { 
      text: t('inventory.lowStock'), 
      color: 'bg-orange-100 text-orange-800',
      badgeClass: 'status-badge bg-orange-100 text-orange-800 hover:bg-orange-200'
    };
    return { 
      text: t('inventory.inStock'), 
      color: 'bg-green-100 text-green-800',
      badgeClass: 'status-badge bg-green-100 text-green-800 hover:bg-green-200'
    };
  };

  const formatMoney = (n?: number | null) => {
    if (n === null || n === undefined) return '';
    const num = Number(n);
    if (!Number.isFinite(num)) return '';
    return `৳${Math.floor(num)}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8 animate-fadeInDown" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
            {t('nav.inventory')}
          </h1>
          <div className="flex gap-3 items-center">
            {selectedProducts.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 dark:from-red-600 dark:to-pink-600 text-white font-semibold px-4 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 animate-fadeInRight"
                style={{ animationDelay: '0.15s' }}
              >
                <TrashIcon className="h-5 w-5" />
                {t('common.delete')} ({selectedProducts.length})
              </button>
            )}
            <button 
              onClick={() => navigate('/inventory/add')} 
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 animate-fadeInRight" 
              style={{ animationDelay: '0.2s' }}
            >
              <PlusIcon className="h-5 w-5" />
              {t('inventory.addProduct')}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <input
            type="text"
            placeholder={t('inventory.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-emerald-200 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
          />
        </div>

        {/* Filter Status */}
        {filterLowStock && (
          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center justify-between animate-fadeInUp" style={{ animationDelay: '0.35s' }}>
            <p className="text-orange-800 dark:text-orange-200 font-medium">
              {t('inventory.lowStockFilter')}
            </p>
            <button
              onClick={() => setFilterLowStock(false)}
              className="text-orange-600 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-100 font-semibold text-sm"
            >
              {t('inventory.clearFilter')}
            </button>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/30 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
        {filteredProducts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-6xl mb-4 opacity-50">📦</div>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.noProducts')}</p>
            <p className="text-emerald-600 dark:text-emerald-300">
              {t('inventory.noProductsSubtitle')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-emerald-200 dark:divide-emerald-800">
            <thead className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">{t('inventory.product')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">{t('inventory.stock')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">{t('inventory.status')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white/50 dark:bg-emerald-950/30 divide-y divide-emerald-100 dark:divide-emerald-800/50">
              {filteredProducts.map((product, index) => {
                const status = getStockStatus(product.quantity, product.min_stock);
                return (
                  <tr key={product.id} className="cursor-pointer hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-300 animate-fadeIn" style={{ animationDelay: `${0.5 + index * 0.05}s` }} onClick={() => navigate(`/inventory/edit/${product.id}`)}>
                    <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        className="text-base font-bold text-emerald-900 dark:text-emerald-100 hover:text-emerald-600 dark:hover:text-emerald-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewHistory(product);
                        }}
                      >
                        {product.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="stock-indicator">
                        <span className="font-medium">{product.quantity}</span>
                        <div className="stock-progress">
                          <div 
                            className="stock-progress-fill" 
                            style={{ 
                              width: `${Math.min((product.quantity / (product.min_stock * 3)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.badgeClass}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button 
                          className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600 text-white rounded-lg hover:shadow-lg hover:scale-110 transition-all duration-300" 
                          title={t('inventory.editProduct')} 
                          onClick={() => navigate(`/inventory/edit/${product.id}`)}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button className="p-2 bg-gradient-to-r from-red-500 to-pink-500 dark:from-red-600 dark:to-pink-600 text-white rounded-lg hover:shadow-lg hover:scale-110 transition-all duration-300" title={t('inventory.deleteProduct')} onClick={() => handleDelete(product)}>
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>          </div>        )}
      </div>
      </div>
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-gradient-to-br from-white to-emerald-50/40 dark:from-emerald-900 dark:to-teal-900/40 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-emerald-200/50 dark:border-emerald-700/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-100 dark:border-emerald-800 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 rounded-t-2xl">
              <div>
                <div className="text-xs font-semibold text-white/80 uppercase">{t('inventory.inventoryHistory')}</div>
                <div className="text-2xl font-bold text-white">{movementProduct?.name || 'Product'}</div>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setMovementProduct(null);
                  setMovements([]);
                  setStartDate('');
                  setEndDate('');
                  setShowDateFilter(false);
                }}
                className="text-white text-xl font-bold hover:scale-110 transition-transform"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Filter Action Bar inside history modal */}
              <div className="flex items-center justify-end mb-3">
                <button
                  onClick={() => setShowDateFilter(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <span className="text-xl">📅</span>
                  {t('common.filter') || 'Filter'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/70 dark:bg-emerald-950/40">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 uppercase">{t('inventory.currentStock')}</div>
                  <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{movementProduct?.quantity ?? 0}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">{t('inventory.onHand')}</div>
                </div>
              </div>

              {movementError && (
                <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700">
                  {movementError}
                </div>
              )}

              {loadingMovements ? (
                <div className="flex justify-center py-12 text-emerald-700 dark:text-emerald-200 font-semibold">{t('inventory.loadingHistory')}</div>
              ) : movements.length === 0 ? (
                <div className="text-center py-12 text-emerald-700 dark:text-emerald-200 font-semibold">{t('inventory.noActivity')}</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-emerald-100 dark:border-emerald-800 bg-white/70 dark:bg-emerald-950/40">
                  <table className="min-w-full divide-y divide-emerald-100 dark:divide-emerald-800">
                    <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50 dark:divide-emerald-800">
                      {movements.map((m) => {
                        const dateValue = m.transaction_date || m.created_at || new Date().toISOString();
                        const qtyDisplay = m.type === 'PURCHASE' ? `+${m.quantity}` : `-${m.quantity}`;
                        return (
                          <tr key={m.id} className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" onClick={() => navigate(`/inventory/edit/${movementProduct?.id}`, { state: { editMovement: m } })}>
                            <td className="px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                              {new Date(dateValue).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                              {m.type}
                            </td>
                            <td className={`px-4 py-3 text-sm font-semibold ${m.type === 'PURCHASE' ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                              {qtyDisplay}
                            </td>
                            <td className="px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                              {formatMoney(m.price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
                    onClick={() => { setStartDate(''); setEndDate(''); setMovements(movementsAll); setShowDateFilter(false); }}
                    className="px-6 py-2 bg-gray-500 dark:bg-gray-600 text-white font-semibold rounded-xl shadow hover:shadow-md"
                  >
                    {t('common.clear')}
                  </button>
                )}
                <button
                  onClick={() => { applyMovementFilter(); setShowDateFilter(false); }}
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
  );
};

export default Inventory;