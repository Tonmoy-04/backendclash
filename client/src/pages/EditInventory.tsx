import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { parseNumericInput } from '../utils/numberConverter';
import { useNotification } from '../context/NotificationContext';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  cost: number;
  quantity: number;
  min_stock: number;
  unit?: string;
}

const EditInventory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError, showWarning, showInfo, showConfirm } = useNotification();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'buy' | 'sale'>('buy');
  
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
    // Default to today's date; user can change or leave as-is
    date: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (id) {
          const response = await api.get(`/products/${id}`);
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
  }, [id]);

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
      showSuccess({ title: t('inventory.updated') || 'Updated', message: 'Product details updated successfully!' });
      navigate('/inventory');
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
      const message = 'Please enter a valid quantity';
      setError(message);
      showWarning({ title: t('common.warning') || 'Warning', message });
      return;
    }

    try {
      setError('');

      // Use selected date if provided; otherwise current datetime
      const transactionDate = stockFormData.date
        ? new Date(stockFormData.date).toISOString()
        : new Date().toISOString();

      if (activeTab === 'buy') {
        await api.post(`/products/${product.id}/movements`, {
          type: 'PURCHASE',
          quantity,
          price: totalPrice || null,
          reference_id: null,
          transaction_date: transactionDate,
        });
        showSuccess({ title: t('inventory.stockPurchased') || 'Stock purchased', message: 'Stock purchased successfully!' });
      } else if (activeTab === 'sale') {
        await api.post(`/products/${product.id}/movements`, {
          type: 'SELL',
          quantity,
          price: totalPrice || null,
          reference_id: null,
          transaction_date: transactionDate,
        });
        showSuccess({ title: t('inventory.stockSold') || 'Stock sold', message: 'Stock sold successfully!' });
      }

      setStockFormData({ quantity: '', totalPrice: '', date: new Date().toISOString().slice(0, 10) });
      navigate('/inventory');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update stock';
      setError(message);
      showError({ title: t('common.error') || 'Error', message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 dark:border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-lg text-emerald-700 dark:text-emerald-300 font-semibold">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl text-red-600 dark:text-red-400">Product not found</p>
          <button
            onClick={() => navigate('/inventory')}
            className="mt-4 px-4 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50"
          >
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950" onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        const form = (e.currentTarget as HTMLDivElement).querySelector('form');
        if (form) {
          const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (submitBtn) submitBtn.click();
        }
      }
    }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/inventory')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            {t('common.cancel')}
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
            Update: {product.name}
          </h1>
        </div>

        {/* Tab Navigation (Buy, Sell, then Details) */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-emerald-900 rounded-xl p-2 border border-emerald-200 dark:border-emerald-700 shadow-lg">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'buy'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-800'
            }`}
          >
            🛒 Buy Stock
          </button>
          <button
            onClick={() => setActiveTab('sale')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'sale'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-800'
            }`}
          >
            💰 Sell Stock
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'details'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-800'
            }`}
          >
            📝 Details
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
              {activeTab === 'details' && '📝 Edit Product Details'}
              {activeTab === 'buy' && '🛒 Buy Stock'}
              {activeTab === 'sale' && '💰 Sell Stock'}
            </h2>
          </div>

          <div className="p-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <form onSubmit={handleUpdateDetails} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Product Name</label>
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
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Description</label>
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
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Unit</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                      placeholder="e.g., kg, liter, piece"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Minimum Stock</label>
                    <input
                      type="number"
                      name="min_stock"
                      value={formData.min_stock}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Selling Price</label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Cost Price</label>
                    <input
                      type="number"
                      name="cost"
                      value={formData.cost}
                      onChange={handleFormChange}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                  <button
                    type="button"
                    onClick={() => navigate('/inventory')}
                    className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    Update Details
                  </button>
                </div>
              </form>
            )}

            {/* Buy Stock Tab */}
            {activeTab === 'buy' && (
              <form onSubmit={handleStockUpdate} className="space-y-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-700">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300"><strong>Product:</strong> {product.name}</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300"><strong>Current Stock:</strong> {product.quantity} {product.unit || ''}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Date (optional)</label>
                  <input
                    type="date"
                    name="date"
                    value={stockFormData.date}
                    onChange={handleStockFormChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Quantity to Purchase</label>
                  <input
                    type="number"
                    name="quantity"
                    value={stockFormData.quantity}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder="Enter quantity"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Total Price (optional)</label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={stockFormData.totalPrice}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder="Enter total price"
                  />
                </div>

                {stockFormData.quantity && stockFormData.totalPrice && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Unit Price:</strong> {Math.floor(Number(stockFormData.totalPrice) / Number(stockFormData.quantity))}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    Purchase Stock
                  </button>
                </div>
              </form>
            )}

            {/* Sale Stock Tab */}
            {activeTab === 'sale' && (
              <form onSubmit={handleStockUpdate} className="space-y-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-700">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300"><strong>Product:</strong> {product.name}</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300"><strong>Current Stock:</strong> {product.quantity} {product.unit || ''}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Date (optional)</label>
                  <input
                    type="date"
                    name="date"
                    value={stockFormData.date}
                    onChange={handleStockFormChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Quantity to Sell</label>
                  <input
                    type="number"
                    name="quantity"
                    value={stockFormData.quantity}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder="Enter quantity"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">Total Sale Price (optional)</label>
                  <input
                    type="number"
                    name="totalPrice"
                    value={stockFormData.totalPrice}
                    onChange={handleStockFormChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder="Enter total sale price"
                  />
                </div>

                {stockFormData.quantity && stockFormData.totalPrice && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>Unit Price:</strong> {Math.floor(Number(stockFormData.totalPrice) / Number(stockFormData.quantity))}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold"
                  >
                    Sell Stock
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
