import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Cog6ToothIcon,
  ShieldCheckIcon,
  ServerIcon,
  GlobeAltIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

interface SettingsData {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  taxRate: number;
  lowStockThreshold: number;
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  emailNotifications: boolean;
  lowStockAlerts: boolean;
  invoicePrefix: string;
  invoiceNumberStart: number;
  language: 'en' | 'bn';
}

const Settings: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<SettingsData>({
    companyName: 'My Business',
    companyEmail: 'contact@mybusiness.com',
    companyPhone: '+91 1234567890',
    companyAddress: '',
    taxRate: 18,
    lowStockThreshold: 10,
    autoBackup: true,
    backupFrequency: 'daily',
    emailNotifications: true,
    lowStockAlerts: true,
    invoicePrefix: 'INV',
    invoiceNumberStart: 1000,
    language: language as 'en' | 'bn',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupLocation, setBackupLocation] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [defaultBackupLocation, setDefaultBackupLocation] = useState('');

  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
    }
  }, []);

  // Backup helpers and actions
  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      // Load current and default backup locations
      const [locRes, defaultRes, listRes] = await Promise.all([
        api.get('/backup/location'),
        api.get('/backup/location/default'),
        api.get('/backup/list')
      ]);
      setBackupLocation(locRes.data.backupDir || '');
      setDefaultBackupLocation(defaultRes.data.defaultBackupDir || '');
      setBackups(Array.isArray(listRes.data) ? listRes.data : []);
    } catch (error: any) {
      console.error('Failed to load backups', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await api.post('/backup/create');
      alert('Backup created');
      loadBackups();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create backup');
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!window.confirm(`Restore from backup ${fileName}? This will replace all current data.`)) {
      return;
    }
    try {
      await api.post('/backup/restore', { fileName });
      alert('Database restored successfully! Please refresh the page.');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to restore backup');
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    if (!window.confirm(`Delete backup ${fileName}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.post('/backup/delete', { fileName });
      alert('Backup deleted');
      loadBackups();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete backup');
    }
  };

  const handleDownloadBackup = (fileName: string) => {
    const base = (api.defaults?.baseURL as string) || 'http://localhost:5000/api';
    window.open(`${base}/backup/download/${encodeURIComponent(fileName)}`, '_blank');
  };

  const handleExportJSON = () => {
    const base = (api.defaults?.baseURL as string) || 'http://localhost:5000/api';
    window.open(`${base}/backup/export-json`, '_blank');
  };

  const handleUpdateBackupLocation = async () => {
    if (!backupLocation.trim()) {
      alert('Please enter a backup location');
      return;
    }

    setSavingLocation(true);
    try {
      await api.post('/backup/location', { backupDir: backupLocation.trim() });
      alert('Backup location updated');
      loadBackups();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update backup location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleResetBackupLocation = async () => {
    setSavingLocation(true);
    try {
      const res = await api.post('/backup/location/reset');
      setBackupLocation(res.data.backupDir || '');
      alert('Backup location reset to default');
      loadBackups();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reset backup location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.db')) {
      alert('Please select a valid .db backup file');
      return;
    }

    if (!window.confirm(`Import and restore from ${file.name}? This will replace all current data.`)) {
      event.target.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('backup', file);
      formData.append('autoRestore', 'true');
      const base = (api.defaults?.baseURL as string) || 'http://localhost:5000/api';
      const response = await fetch(`${base}/backup/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      alert('Backup imported and restored successfully! Please refresh the page.');
      window.location.reload();
    } catch (error: any) {
      alert(error.message || 'Failed to import backup');
    } finally {
      event.target.value = '';
    }
  };

  const handleChange = (field: keyof SettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage('');
    localStorage.setItem('appSettings', JSON.stringify(settings));
    if (settings.language !== language) {
      setLanguage(settings.language);
    }
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage(t('settings.savedSuccess'));
      setTimeout(() => setSaveMessage(''), 3000);
    }, 500);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/login');
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const tabs = [
    { id: 'general', nameKey: 'settings.general', icon: Cog6ToothIcon },
    { id: 'backup', nameKey: 'settings.backupSecurity', icon: ShieldCheckIcon },
    { id: 'help', nameKey: 'settings.help', icon: QuestionMarkCircleIcon },
  ];

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-emerald-50 via-cyan-50 to-emerald-50 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">{t('settings.title')}</h1>
        </div>

        <div className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/30">
          <div className="border-b border-emerald-200 dark:border-emerald-700 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/30 dark:to-teal-900/30">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                        : 'border-transparent text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {t(tab.nameKey)}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-8 bg-white/50 dark:bg-emerald-950/30">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mb-6">{t('settings.general')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
                      <GlobeAltIcon className="w-5 h-5 inline mr-2" />
                      {t('settings.language')}
                    </label>
                    <select
                      value={settings.language}
                      onChange={(e) => handleChange('language', e.target.value)}
                      className="w-full max-w-md px-4 py-2 border border-emerald-200 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                    >
                      <option value="en">{t('settings.english')}</option>
                      <option value="bn">{t('settings.bengali')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            

            

            {activeTab === 'help' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mb-6">{t('settings.help')}</h2>
                
                <div className="space-y-8">
                  {/* Getting Started */}
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700/30">
                    <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-3">🚀 Getting Started</h3>
                    <div className="space-y-2 text-sm text-emerald-800 dark:text-emerald-200">
                      <p><strong>1. Initial Setup:</strong> Configure your company details in the General tab and set your preferred language (English/Bengali).</p>
                      <p><strong>2. Data Backup:</strong> Enable automatic backups from the Backup tab to protect your data. Set backup frequency (daily/weekly/monthly).</p>
                      <p><strong>3. Start Using:</strong> Navigate to different sections from the sidebar to manage inventory, customers, suppliers, and transactions.</p>
                    </div>
                  </div>

                  {/* Core Features */}
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/30">
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3">📦 Core Features</h3>
                    <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                      <div>
                        <p className="font-semibold">Inventory Management</p>
                        <p>• Add/edit products with names, prices, and stock levels</p>
                        <p>• Track stock changes with purchase and sale transactions</p>
                        <p>• View real-time stock levels and low stock alerts</p>
                      </div>
                      <div>
                        <p className="font-semibold">Customer & Supplier Management</p>
                        <p>• Maintain detailed records of customers and suppliers</p>
                        <p>• Track balance for credit/debit transactions</p>
                        <p>• Generate and print customer/supplier statements</p>
                      </div>
                      <div>
                        <p className="font-semibold">Transactions</p>
                        <p>• Create sale and purchase transactions with multiple items</p>
                        <p>• Choose payment methods (cash/credit/bank)</p>
                        <p>• Automatically update inventory stock levels</p>
                      </div>
                      <div>
                        <p className="font-semibold">Bill Generator</p>
                        <p>• Generate PDF bills from existing transactions by ID</p>
                        <p>• Create temporary bills without saving to database</p>
                        <p>• Professional Bengali/English bill format</p>
                      </div>
                    </div>
                  </div>

                  {/* How to Use */}
                  <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700/30">
                    <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-3">💡 How to Use Key Features</h3>
                    <div className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
                      <div>
                        <p className="font-semibold">Creating a Sale Transaction:</p>
                        <p>1. Go to Transactions → Select "Sale"</p>
                        <p>2. Choose customer from dropdown or enter new name</p>
                        <p>3. Add items by clicking "+ Add Item"</p>
                        <p>4. Select product, enter quantity (price auto-fills)</p>
                        <p>5. Choose payment method and click "Save Transaction"</p>
                        <p>6. Generate bill from Bill Generator using transaction ID</p>
                      </div>
                      <div>
                        <p className="font-semibold">Managing Stock:</p>
                        <p>• Purchase: Creates transaction and increases stock</p>
                        <p>• Sale: Creates transaction and decreases stock</p>
                        <p>• View all stock movements in Inventory page</p>
                      </div>
                      <div>
                        <p className="font-semibold">Backup & Restore:</p>
                        <p>• Create Backup: Click "Create Backup Now" in Backup tab</p>
                        <p>• Restore: Select backup from list and click "Restore"</p>
                        <p>• Import: Use "Import Backup" to upload .db files</p>
                        <p>• Export: Download database as JSON for external backup</p>
                      </div>
                    </div>
                  </div>

                  {/* Tips & Best Practices */}
                  <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/30">
                    <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-3">⚡ Tips & Best Practices</h3>
                    <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                      <p>• <strong>Regular Backups:</strong> Enable automatic backups to prevent data loss</p>
                      <p>• <strong>Stock Tracking:</strong> Always use transactions (not manual edits) to maintain accurate stock history</p>
                      <p>• <strong>Customer Balance:</strong> Credit transactions increase balance (money owed to you), payment transactions decrease it</p>
                      <p>• <strong>Bill Generation:</strong> Use transaction-based bills for accurate records; use temporary bills for quick quotations</p>
                      <p>• <strong>Search:</strong> Use search bars in all pages to quickly find products, customers, or transactions</p>
                      <p>• <strong>Bulk Actions:</strong> Select multiple items using checkboxes for batch delete operations</p>
                    </div>
                  </div>

                  {/* Troubleshooting */}
                  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/30">
                    <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-3">🔧 Troubleshooting</h3>
                    <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                      <p>• <strong>Bengali text not showing:</strong> Make sure a Bengali font is installed on your system</p>
                      <p>• <strong>Bills not generating:</strong> Check if transaction ID exists and contains items</p>
                      <p>• <strong>Backup fails:</strong> Verify backup location path is valid and has write permissions</p>
                      <p>• <strong>Stock not updating:</strong> Ensure you're using the Transactions page, not manual inventory edits</p>
                      <p>• <strong>Cannot delete items:</strong> Items used in transactions cannot be deleted (to preserve data integrity)</p>
                    </div>
                  </div>

                  {/* Keyboard Shortcuts */}
                  <div className="p-6 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-700/30">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">⌨️ Keyboard Shortcuts</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-800 dark:text-gray-200">
                      <div><kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+S</kbd> Save changes</div>
                      <div><kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+F</kbd> Focus search</div>
                      <div><kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> Close modal/dialog</div>
                      <div><kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> Submit form</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent mb-6">{t('settings.backupSecurity')}</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700/30">
                    <div>
                      <h3 className="font-medium text-emerald-900 dark:text-emerald-100">{t('settings.automaticBackups')}</h3>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">{t('settings.automaticBackupsDesc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoBackup}
                        onChange={(e) => handleChange('autoBackup', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-emerald-200 dark:bg-emerald-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 dark:peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  {settings.autoBackup && (
                    <div>
                      <label className="block text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">{t('settings.backupFrequency')}</label>
                      <select
                        value={settings.backupFrequency}
                        onChange={(e) => handleChange('backupFrequency', e.target.value)}
                        className="w-full max-w-md px-4 py-2 border border-emerald-200 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                      >
                        <option value="daily">{t('settings.daily')}</option>
                        <option value="weekly">{t('settings.weekly')}</option>
                        <option value="monthly">{t('settings.monthly')}</option>
                      </select>
                    </div>
                  )}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg">
                    <div className="flex items-start">
                      <ServerIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-medium text-blue-900 dark:text-blue-100">{t('settings.databaseLocation')}</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{t('settings.databaseLocationDesc')}</p>
                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                          <input
                            type="text"
                            value={backupLocation}
                            onChange={(e) => setBackupLocation(e.target.value)}
                            placeholder="C:/path/to/backups"
                            className="w-full md:w-96 px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={handleUpdateBackupLocation}
                            disabled={savingLocation}
                            className="px-4 py-2 text-sm bg-blue-700 dark:bg-blue-600 text-white hover:bg-blue-800 dark:hover:bg-blue-700 font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {savingLocation ? 'Saving...' : 'Save Location'}
                          </button>
                          {defaultBackupLocation && (
                            <button
                              type="button"
                              onClick={handleResetBackupLocation}
                              disabled={savingLocation}
                              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Use Default ({defaultBackupLocation})
                            </button>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button 
                            onClick={handleCreateBackup}
                            className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 font-medium rounded-lg transition-colors"
                          >
                            Create Backup Now
                          </button>
                          <label className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 font-medium rounded-lg transition-colors cursor-pointer">
                            Import Backup
                            <input 
                              type="file" 
                              accept=".db" 
                              onChange={handleImportBackup}
                              className="hidden"
                            />
                          </label>
                          <button 
                            onClick={handleExportJSON}
                            className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            {t('settings.exportDatabase')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Backup List */}
                  <div className="space-y-3">
                    <h3 className="font-medium text-emerald-900 dark:text-emerald-100">Available Backups</h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Showing most recent 5 backups</p>
                    {loadingBackups ? (
                      <div className="text-center py-4 text-emerald-600 dark:text-emerald-400">Loading backups...</div>
                    ) : backups.length === 0 ? (
                      <div className="text-center py-4 text-emerald-600 dark:text-emerald-400">No backups available</div>
                    ) : (
                      <div className="space-y-2">
                        {backups.slice(0, 5).map((backup) => (
                          <div 
                            key={backup.fileName} 
                            className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700/30"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-emerald-900 dark:text-emerald-100">{backup.fileName}</p>
                              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                {new Date(backup.created || backup.timestamp).toLocaleString()} • {(backup.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDownloadBackup(backup.fileName)}
                                className="px-3 py-1.5 text-sm bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 font-medium rounded transition-colors"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => handleRestoreBackup(backup.fileName)}
                                className="px-3 py-1.5 text-sm bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-600 font-medium rounded transition-colors"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(backup.fileName)}
                                className="px-3 py-1.5 text-sm bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 font-medium rounded transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-emerald-200 dark:border-emerald-700 px-8 py-4 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                {saveMessage && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{saveMessage}</span>
                )}
              </div>
              <div className="flex flex-col gap-3 w-full sm:w-auto">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-600 dark:to-teal-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {isSaving ? t('settings.saving') : t('settings.saveSettings')}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-rose-600 dark:from-red-600 dark:to-rose-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-300"
                >
                  {t('settings.logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
