import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { parseNumericInput, formatDate, parseDisplayDateToAPI, formatAPIDateToDisplay } from '../utils/numberConverter';
import { useNotification } from '../context/NotificationContext';
import DateInput from '../components/DateInput';
import { buildInventorySummary, buildStockMovementSummary } from '../utils/notificationSummary';
import { formatBDT } from '../utils/currency';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  cost: number;
  quantity: number;
  min_stock: number;
  unit?: string;
  selling_rate?: number;
  purchase_rate?: number;
}

interface EditInventoryProps {
  productId?: number | string;
  embedded?: boolean;
  onClose?: () => void;
}

const EditInventory: React.FC<EditInventoryProps> = ({ productId, embedded = false, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const effectiveId = productId ?? routeId;
  const { showSuccess, showError, showWarning, showInfo, showConfirm } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'buy' | 'sale'>('sale');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    cost: '',
    min_stock: '',
    unit: ''
  });

  const [stockFormData, setStockFormData] = useState({
    quantity: '',
    totalPrice: '',
    // Default to today's date in dd/mm/yyyy format
    date: formatDate(new Date())
  });

  const goBack = () => {
    if (embedded && onClose) {
      onClose();
    } else {
      navigate('/inventory');
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (effectiveId) {
          const response = await api.get(`/products/${effectiveId}`);
          setProduct(response.data);
          setFormData({
            name: response.data.name || '',
            description: response.data.description || '',
            price: response.data.price ? String(response.data.price) : '',
            cost: response.data.cost ? String(response.data.cost) : '',
            min_stock: response.data.min_stock ? String(response.data.min_stock) : '',
            unit: response.data.unit || ''
          });
        }
      } catch (err: any) {
          const message = err.response?.data?.error || 'Failed to load product';
          setError(message);
          showError({ title: t('common.error') || 'Error', message });
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [effectiveId]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Convert Bengali numerals to English for numeric fields
    const numericFields = ['price', 'cost', 'min_stock'];
    const processedValue = (numericFields.includes(name) && value) ? parseNumericInput(value).toString() : value;
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleStockFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Convert Bengali numerals to English for numeric fields
    const processedValue = (value && (name === 'quantity' || name === 'totalPrice')) ? parseNumericInput(value).toString() : value;
    setStockFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    try {
      setError('');
      const updatePayload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price !== '' ? Number(formData.price) : null,
        cost: formData.cost !== '' ? Number(formData.cost) : null,
        min_stock: formData.min_stock !== '' ? Number(formData.min_stock) : null,
        unit: formData.unit.trim() || null
      };

      await api.put(`/products/${product.id}`, updatePayload);
      
      // Show dynamic summary notification
      const summary = buildInventorySummary(formData.name.trim(), 'Update', formatBDT);
      showSuccess({ title: t('common.updated') || 'Updated', message: summary });

      window.dispatchEvent(new Event('inventory-data-changed'));
      goBack();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update product';
      setError(message);
      showError({ title: t('common.error') || 'Error', message });
    }
  };

  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const quantity = Number(stockFormData.quantity);
    const totalPrice = stockFormData.totalPrice === '' ? 0 : Number(stockFormData.totalPrice);
    const unitPrice = quantity > 0 && totalPrice > 0 ? totalPrice / quantity : null;

    if (!quantity || quantity <= 0) {
      const message = t('inventory.validQuantityRequired') || 'Please enter a valid quantity.';
      setError(message);
      showWarning({ title: t('common.warning') || 'Warning', message });
      return;
    }

    try {
      setError('');

      // Convert dd/mm/yyyy to ISO datetime with current time
      let apiDate = new Date().toISOString(); // default to now
      
      if (stockFormData.date) {
        const parts = stockFormData.date.split('/');
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
          apiDate = dateObj.toISOString();
        }
      }

      if (activeTab === 'buy') {
        await api.post(`/products/${product.id}/movements`, {
          type: 'PURCHASE',
          quantity,
          price: totalPrice || null,
          reference_id: null,
          transaction_date: apiDate,
        });
        
        // Show dynamic summary notification
        const summary = buildStockMovementSummary(
          product.name,
          'Purchase',
          quantity,
          totalPrice > 0 ? totalPrice : undefined,
          formatBDT
        );
        showSuccess({ title: t('inventory.stockPurchased') || 'Stock purchased', message: summary });
      } else if (activeTab === 'sale') {
        await api.post(`/products/${product.id}/movements`, {
          type: 'SELL',
          quantity,
          price: totalPrice || null,
          reference_id: null,
          transaction_date: apiDate,
        });
        
        // Show dynamic summary notification
        const summary = buildStockMovementSummary(
          product.name,
          'Sale',
          quantity,
          totalPrice > 0 ? totalPrice : undefined,
          formatBDT
        );
        showSuccess({ title: t('inventory.stockSold') || 'Stock sold', message: summary });
      }

      // Dispatch event to refresh dashboard
      window.dispatchEvent(new Event('inventory-data-changed'));

      setStockFormData({ quantity: '', totalPrice: '', date: formatDate(new Date()) });
      goBack();
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update stock';
      setError(message);
      showError({ title: t('common.error') || 'Error', message });
    }
  };

  if (loading) {
    return (
      <div className={`${embedded ? 'p-6' : 'min-h-screen'} flex items-center justify-center ${embedded ? '' : 'bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 dark:border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-lg text-emerald-700 dark:text-emerald-300 font-semibold">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`${embedded ? 'p-4' : 'min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950'}`}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl text-red-600 dark:text-red-400">{t('inventory.productNotFound')}</p>
          <button
            onClick={goBack}
            className="mt-4 px-4 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
          >
            {t('inventory.backToInventory')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? 'p-0' : 'min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950'}`} onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        const form = (e.currentTarget as HTMLDivElement).querySelector('form');
        if (form) {
          const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (submitBtn) submitBtn.click();
        }
      }
    }}>
      <div className={`${embedded ? 'max-w-full mx-auto max-h-[80vh] overflow-y-auto p-4' : 'max-w-4xl mx-auto'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            {t('common.cancel')}
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
            {t('inventory.product')}: {product.name}
          </h1>
        </div>

        {/* Tab Navigation (Sell, Buy, then Details) */}
        <div className="flex gap-2 mb-6 bg-emerald-50/80 dark:bg-emerald-900/70 rounded-2xl p-2 border border-emerald-200/70 dark:border-emerald-800 shadow-lg shadow-emerald-100/70 dark:shadow-emerald-900/50">
          <button
            onClick={() => setActiveTab('sale')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 border ${
              activeTab === 'sale'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-xl shadow-emerald-400/40'
                : 'bg-white/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md'
            }`}
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <span className="text-lg">💰</span>
              <span>{t('inventory.sellStock')}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 border ${
              activeTab === 'buy'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-xl shadow-emerald-400/40'
                : 'bg-white/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md'
            }`}
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <span className="text-lg">🛒</span>
              <span>{t('inventory.buyStock')}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 border ${
              activeTab === 'details'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-xl shadow-emerald-400/40'
                : 'bg-white/70 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md'
            }`}
          >
            <span className="inline-flex items-center gap-2 justify-center">
              <span className="text-lg">📝</span>
              <span>{t('inventory.details')}</span>
            </span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-700 dark:text-red-300 font-semibold">{error}</p>
          </div>
        )}

        {/* Content Card */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-2xl border border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">
              {activeTab === 'details' && `📝 ${t('inventory.editProductDetails')}`}
              {activeTab === 'sale' && `💰 ${t('inventory.sellStock')}`}
              {activeTab === 'buy' && `🛒 ${t('inventory.buyStock')}`}
            </h2>
          </div>

          <div className="p-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <form onSubmit={handleUpdateDetails} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.productName')}</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.description')}</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.unit')}</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                      placeholder={t('inventory.unitPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.minimumStock')}</label>
                    <input
                      type="number"
                      name="min_stock"
                      value={formData.min_stock}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    {t('inventory.updateDetails')}
                  </button>
                </div>
              </form>
            )}

            {/* Buy Stock Tab */}
            {activeTab === 'buy' && (
              <form onSubmit={handleStockUpdate} className="space-y-6">
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-900/40 dark:to-teal-900/30 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">{t('inventory.product')}</p>
                      <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{product.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('inventory.currentStock')}</p>
                        <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">{product.quantity} {product.unit || ''}</p>
                      </div>
                    </div>
                    {typeof product.purchase_rate === 'number' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💰</span>
                        <div>
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('inventory.costPrice')}</p>
                          <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">{formatBDT(product.purchase_rate, { decimals: 3 })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.dateOptional')}</label>
                  <DateInput
                    value={stockFormData.date}
                    onChange={(value) => setStockFormData({ ...stockFormData, date: value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.quantityToPurchase')}</label>
                  <input
                    type="number"
                    name="quantity"
                    value={stockFormData.quantity}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder={t('inventory.enterQuantity')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.totalPriceOptional')}</label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={stockFormData.totalPrice}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder={t('inventory.enterTotalPrice')}
                  />
                </div>

                {stockFormData.quantity && stockFormData.totalPrice && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>{t('inventory.unitPrice')}:</strong> {Math.floor(Number(stockFormData.totalPrice) / Number(stockFormData.quantity))}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                  >
                    {t('inventory.back')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    {t('inventory.purchaseStock')}
                  </button>
                </div>
              </form>
            )}

            {/* Sale Stock Tab */}
            {activeTab === 'sale' && (
              <form onSubmit={handleStockUpdate} className="space-y-6">
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-900/40 dark:to-teal-900/30 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">{t('inventory.product')}</p>
                      <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{product.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('inventory.currentStock')}</p>
                        <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">{product.quantity} {product.unit || ''}</p>
                      </div>
                    </div>
                    {typeof product.selling_rate === 'number' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💵</span>
                        <div>
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('inventory.sellingPrice')}</p>
                          <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">{formatBDT(product.selling_rate, { decimals: 3 })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.dateOptional')}</label>
                  <DateInput
                    value={stockFormData.date}
                    onChange={(value) => setStockFormData({ ...stockFormData, date: value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.quantityToSell')}</label>
                  <input
                    type="number"
                    name="quantity"
                    value={stockFormData.quantity}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder={t('inventory.enterQuantity')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.totalSalePriceOptional')}</label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={stockFormData.totalPrice}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder={t('inventory.enterTotalSalePrice')}
                  />
                </div>

                {stockFormData.quantity && stockFormData.totalPrice && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>{t('inventory.unitPrice')}:</strong> {Math.floor(Number(stockFormData.totalPrice) / Number(stockFormData.quantity))}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                  >
                    {t('inventory.back')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    {t('inventory.sellStockButton')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditInventory;
