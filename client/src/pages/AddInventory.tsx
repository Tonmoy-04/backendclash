import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { parseNumericInput } from '../utils/numberConverter';
import { useNotification } from '../context/NotificationContext';
import { buildInventorySummary } from '../utils/notificationSummary';
import { formatBDT } from '../utils/currency';
import '../styles/AddInventory.css';

const AddInventory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    min_stock: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Convert Bengali numerals to English for numeric fields
    const processedValue = (name === 'min_stock' && value) ? parseNumericInput(value).toString() : value;
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const name = formData.name.trim();
      if (!name) {
        setError('Product name is required');
        setLoading(false);
        return;
      }

      // Build payload - only name is required, send NULL for truly empty optional fields
      const minStockVal = formData.min_stock !== '' ? Number(formData.min_stock) : 0;
      const unitDesc = formData.unit.trim() ? `Unit: ${formData.unit.trim()}` : null;

      const payload: any = {
        name,
        description: unitDesc,
        price: 0,
        cost: 0,
        quantity: 0,
        min_stock: Number.isFinite(minStockVal) ? minStockVal : 0
      };

      await api.post('/products', payload);
      
      // Show dynamic summary notification
      const summary = buildInventorySummary(name, 'Add', formatBDT);
      showSuccess({ 
        title: t('common.success') || 'Success', 
        message: summary 
      });
      
      navigate('/inventory');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to add product';
      setError(message);
      showError({ title: t('common.error') || 'Error', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
            {t('inventory.addProduct')}
          </h1>
        </div>

        {/* Form Card */}
        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-2xl border border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">📦 {t('inventory.productInformation')}</h2>
          </div>

          {/* Form Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 dark:text-red-300 font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main Required Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                    {t('inventory.product')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                    placeholder={t('inventory.productNameRequired')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.unit')}</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                  >
                    <option value="">{t('inventory.selectUnit')}</option>
                    <option value="kg">{t('inventory.kg')}</option>
                    <option value="litre">{t('inventory.litre')}</option>
                    <option value="box">{t('inventory.box')}</option>
                    <option value="piece">{t('inventory.piece')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-2">{t('inventory.minimumStockOptional')}</label>
                <input
                  type="number"
                  name="min_stock"
                  value={formData.min_stock}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none transition-all"
                  placeholder={t('inventory.leaveEmptyPlaceholder')}
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                <button
                  type="button"
                  onClick={() => navigate('/inventory')}
                  className="px-6 py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 transition-all duration-300 font-semibold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddInventory;
