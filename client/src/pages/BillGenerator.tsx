import React, { useState } from 'react';
import api from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { parseNumericInput } from '../utils/numberConverter';

const BillGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [type, setType] = useState<'sale' | 'purchase'>('sale');
  const [id, setId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  // Transport/labour/discount fields removed from the transaction generator UI

  // Temporary bill state
  const [party, setParty] = useState<string>('');
  const [payment, setPayment] = useState<string>('cash');
  const [tempAddress, setTempAddress] = useState<string>('');
  const [tempDescription, setTempDescription] = useState<string>('');
  const [tempTransportFee, setTempTransportFee] = useState<string>('');
  const [tempLabourFee, setTempLabourFee] = useState<string>('');
  const [tempItems, setTempItems] = useState<Array<{ product_name: string; quantity: number; price: number }>>([
    { product_name: '', quantity: 1, price: 0 },
    { product_name: '', quantity: 1, price: 0 }
  ]);
  const [tempLoading, setTempLoading] = useState(false);
  const [tempMessage, setTempMessage] = useState('');
  const [tempFilePath, setTempFilePath] = useState('');
  // Removed PDF preview state; no embedded preview pane

  const handleIdChange = (newId: string) => {
    setId(newId);
  };

  const handleGenerate = async () => {
    setMessage('');
    setFilePath('');
    const trimmed = id.trim();
    if (!trimmed) {
      setMessage(t('billGenerator.enterIdError'));
      return;
    }
    setLoading(true);
    try {
      const endpoint = type === 'sale' ? `/sales/${trimmed}/generate-bill` : `/purchases/${trimmed}/generate-bill`;
      const res = await api.post(endpoint, {});
      setMessage(t('billGenerator.success'));
      setFilePath(res.data?.path || '');
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Error';
      setMessage(`${t('billGenerator.error')}: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const addTempItem = () => {
    setTempItems((prev) => [...prev, { product_name: '', quantity: 1, price: 0 }]);
  };

  const removeTempItem = (idx: number) => {
    setTempItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTempItem = (idx: number, field: 'product_name' | 'quantity' | 'price', value: string | number) => {
    setTempItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: field === 'product_name' ? String(value) : Number(value) } : it)));
  };

  const handleGenerateTemporary = async () => {
    setTempMessage('');
    setTempFilePath('');
    // Filter out empty items - only keep items with product_name or price
    const filteredItems = tempItems.filter(it => it.product_name.trim() || Number(it.price) > 0);
    
    // Validation: must have at least one item with data
    if (filteredItems.length === 0) {
      setTempMessage('Please add at least one item');
      return;
    }
    const prepared = filteredItems.map((it) => ({
      product_name: it.product_name || 'Item',
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
    }));
    setTempLoading(true);
    try {
      const res = await api.post('/bill/temporary', {
        party: party || 'N/A',
        payment_method: payment || 'N/A',
        items: prepared,
        transport_fee: Number(tempTransportFee) || 0,
        labour_fee: Number(tempLabourFee) || 0,
        address: tempAddress || '',
        description: tempDescription || '',
      });
      setTempMessage('Temporary bill generated successfully');
      setTempFilePath(res.data?.path || '');
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Error';
      setTempMessage(`Error: ${errMsg}`);
    } finally {
      setTempLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950 px-6 py-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white/80 dark:bg-emerald-900/30 backdrop-blur-sm rounded-3xl shadow-2xl border border-emerald-200/50 dark:border-emerald-700/50 p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
                {t('billGenerator.title')}
              </h1>
              <p className="text-emerald-700 dark:text-emerald-300 mt-2 text-lg">
                {t('billGenerator.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two generators side by side: Transaction and Temporary */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left - Generate from Transaction */}
        <div className="bg-white/90 dark:bg-emerald-900/40 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-emerald-200/50 dark:border-emerald-700/50 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                {t('billGenerator.generateFromTransaction')}
              </h2>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">{t('billGenerator.createBillFromSaved')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                  {t('billGenerator.typeLabel')}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'sale' | 'purchase')}
                  className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                >
                  <option value="sale">{t('common.sales')}</option>
                  <option value="purchase">{t('transactions.purchases')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                  {t('billGenerator.idLabel')}
                </label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => handleIdChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder={t('billGenerator.idPlaceholder')}
                  className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              <div>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {loading ? t('settings.saving') : t('billGenerator.generate')}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className={`mt-6 p-4 rounded-xl border-2 ${message.includes('Error') || message.includes('error') ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200' : 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'} shadow-lg`}>
              <div className="flex items-start gap-3">
                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${message.includes('Error') || message.includes('error') ? 'text-red-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {message.includes('Error') || message.includes('error') ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <span className="font-medium">{message}</span>
              </div>
            </div>
          )}

          {filePath && (
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 border-2 border-emerald-200 dark:border-emerald-700 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('billGenerator.filePath')}
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 break-words text-xs font-mono shadow-inner">
                {filePath}
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 pt-6 border-t-2 border-emerald-200 dark:border-emerald-800">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('billGenerator.quickGuide')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-emerald-700 dark:text-emerald-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">1</span>
                <span>{t('billGenerator.guideStep1')}</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-emerald-700 dark:text-emerald-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">2</span>
                <span>{t('billGenerator.guideStep2')}</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-emerald-700 dark:text-emerald-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">3</span>
                <span>{t('billGenerator.guideStep3')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right - Temporary Bill Generator */}
        <div className="bg-white/90 dark:bg-emerald-900/40 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-emerald-200/50 dark:border-emerald-700/50 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/50 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                {t('billGenerator.quickTemporaryBill')}
              </h2>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">{t('billGenerator.generateWithoutSaving')}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t('billGenerator.party')}
              </label>
              <input
                type="text"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                placeholder="Customer/Supplier name"
                className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {t('billGenerator.paymentMethod')}
              </label>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
                <option value="due">Due</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Address (Optional)
              </label>
              <input
                type="text"
                value={tempAddress}
                onChange={(e) => setTempAddress(e.target.value)}
                placeholder="Enter address..."
                className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Description (Optional)
              </label>
              <textarea
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                placeholder="Brief description for bill footer..."
                rows={2}
                className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="mt-6 border-2 border-emerald-200 dark:border-emerald-700 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 shadow-lg">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 p-4 bg-gradient-to-r from-emerald-600 to-teal-600 border-b-2 border-emerald-700 items-center">
              <div className="col-span-5 text-sm font-bold text-white">{t('billGenerator.itemName')}</div>
              <div className="col-span-2 text-sm font-bold text-white text-center">{t('billGenerator.quantity')}</div>
              <div className="col-span-3 text-sm font-bold text-white text-center">{t('billGenerator.rate')}</div>
              <div className="col-span-2 text-sm font-bold text-white text-center">{t('billGenerator.action')}</div>
            </div>

            {/* Items Container - Scrollable */}
            <div className="max-h-64 overflow-y-auto space-y-0">
              {tempItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 p-4 border-b border-emerald-200 dark:border-emerald-700/50 items-center hover:bg-emerald-100/50 dark:hover:bg-emerald-800/30 transition-colors">
                  <input
                    type="text"
                    value={it.product_name}
                    onChange={(e) => updateTempItem(idx, 'product_name', e.target.value)}
                    placeholder={t('billGenerator.enterItemName')}
                    className="col-span-5 rounded-lg border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={it.quantity === 0 ? '' : it.quantity}
                    onChange={(e) => updateTempItem(idx, 'quantity', e.target.value === '' ? 0 : parseNumericInput(e.target.value))}
                    placeholder={t('billGenerator.quantity')}
                    className="col-span-2 rounded-lg border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.price === 0 ? '' : it.price}
                    onChange={(e) => updateTempItem(idx, 'price', e.target.value === '' ? 0 : parseNumericInput(e.target.value))}
                    placeholder={t('billGenerator.rate')}
                    className="col-span-3 rounded-lg border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                  />
                  {idx > 0 ? (
                    <button
                      type="button"
                      onClick={() => removeTempItem(idx)}
                      className="col-span-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700 text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                      ✕
                    </button>
                  ) : (
                    <div className="col-span-2 text-xs text-emerald-600 dark:text-emerald-400 text-center font-semibold bg-emerald-100 dark:bg-emerald-900/50 rounded-lg py-2.5">{t('billGenerator.required')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={addTempItem}
            className="mt-4 w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('billGenerator.addItem')}
          </button>

          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                {t('billGenerator.transportFeeOptional')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tempTransportFee}
                onChange={(e) => setTempTransportFee(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                {t('billGenerator.labourFeeOptional')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tempLabourFee}
                onChange={(e) => setTempLabourFee(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
              />
            </div>

          </div>

          <button
            onClick={handleGenerateTemporary}
            disabled={tempLoading}
            className="w-full mt-6 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {tempLoading ? t('settings.saving') : t('billGenerator.generateTemporaryBill')}
          </button>

          {tempMessage && (
            <div className={`mt-4 p-4 rounded-xl border-2 ${tempMessage.includes('Error') || tempMessage.includes('error') ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200' : 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'} shadow-lg`}>
              <div className="flex items-start gap-3">
                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tempMessage.includes('Error') || tempMessage.includes('error') ? 'text-red-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {tempMessage.includes('Error') || tempMessage.includes('error') ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <span className="font-medium text-sm">{tempMessage}</span>
              </div>
            </div>
          )}

          {tempFilePath && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 border-2 border-emerald-200 dark:border-emerald-700 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generated file path
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 break-words text-xs font-mono shadow-inner">
                {tempFilePath}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillGenerator;
