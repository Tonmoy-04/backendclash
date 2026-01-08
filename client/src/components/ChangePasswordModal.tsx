import React, { useState } from 'react';
import { useTranslation } from '../context/TranslationContext';
import authService from '../services/auth.service';
import { EyeIcon, EyeSlashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError
}) => {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!oldPassword.trim()) {
      newErrors.oldPassword = t('auth.oldPasswordRequired');
    }
    if (!newPassword.trim()) {
      newErrors.newPassword = t('auth.newPasswordRequired');
    }
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t('auth.confirmPasswordRequired');
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authService.changePassword(oldPassword, newPassword);
      onSuccess(t('auth.changePasswordSuccess'));
      // Reset form
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setErrors({});
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || t('auth.passwordChangeError');
      if (errorMessage.includes('incorrect') || errorMessage.includes('Invalid')) {
        setErrors({ oldPassword: t('auth.currentPasswordIncorrect') });
      } else {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-emerald-900 rounded-2xl shadow-2xl w-full max-w-md border border-emerald-200 dark:border-emerald-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-emerald-100 dark:border-emerald-700">
          <h2 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
            {t('auth.changePassword')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Old Password */}
          <div>
            <label className="block text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
              {t('auth.oldPassword')}
            </label>
            <div className="relative">
              <input
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  if (errors.oldPassword) {
                    const newErrors = { ...errors };
                    delete newErrors.oldPassword;
                    setErrors(newErrors);
                  }
                }}
                className={`w-full px-4 py-2 pr-12 border rounded-lg bg-white dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.oldPassword
                    ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                    : 'border-emerald-200 dark:border-emerald-700 focus:ring-emerald-500'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                aria-label={showOldPassword ? 'Hide password' : 'Show password'}
              >
                {showOldPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.oldPassword && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.oldPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
              {t('auth.newPassword')}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) {
                    const newErrors = { ...errors };
                    delete newErrors.newPassword;
                    setErrors(newErrors);
                  }
                }}
                className={`w-full px-4 py-2 pr-12 border rounded-lg bg-white dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.newPassword
                    ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                    : 'border-emerald-200 dark:border-emerald-700 focus:ring-emerald-500'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-emerald-900 dark:text-emerald-100 mb-2">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    const newErrors = { ...errors };
                    delete newErrors.confirmPassword;
                    setErrors(newErrors);
                  }
                }}
                className={`w-full px-4 py-2 pr-12 border rounded-lg bg-white dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.confirmPassword
                    ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                    : 'border-emerald-200 dark:border-emerald-700 focus:ring-emerald-500'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-800 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100 font-medium"
            >
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
