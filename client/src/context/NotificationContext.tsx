import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from './TranslationContext';
import '../styles/Notification.css';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface NotificationOptions {
  type?: NotificationType;
  title: string;
  message: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  autoClose?: boolean;
}

interface NotificationItem extends NotificationOptions {
  id: string;
  type: NotificationType;
  autoClose: boolean;
}

interface NotificationContextValue {
  show: (options: NotificationOptions) => string;
  showSuccess: (options: Omit<NotificationOptions, 'type'>) => string;
  showError: (options: Omit<NotificationOptions, 'type'>) => string;
  showWarning: (options: Omit<NotificationOptions, 'type'>) => string;
  showInfo: (options: Omit<NotificationOptions, 'type'>) => string;
  showConfirm: (options: Omit<NotificationOptions, 'type' | 'autoClose'>) => string;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const DEFAULT_AUTO_CLOSE = 3200;

const NotificationPortal: React.FC<{ item: NotificationItem | null; onClose: (confirmed?: boolean) => void; }> = ({ item, onClose }) => {
  const { t } = useTranslation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!item) return;

    // Auto close for non-confirm types when enabled
    if (item.autoClose && item.type !== 'confirm') {
      timerRef.current = setTimeout(() => onClose(false), DEFAULT_AUTO_CLOSE);
    }

    const handleKey = (e: KeyboardEvent) => {
      if (!item) return;
      if (e.key === 'Escape') {
        onClose(false);
      }
      if (e.key === 'Enter' && item.type === 'confirm') {
        onClose(true);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('keydown', handleKey);
    };
  }, [item, onClose]);

  if (!item) return null;

  const isDark = document.documentElement.classList.contains('dark');

  const colorMap: Record<NotificationType, string> = {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f97316',
    info: '#0ea5e9',
    confirm: '#10b981'
  };

  const iconMap: Record<NotificationType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    confirm: '❔'
  };

  const tone = colorMap[item.type];
  const icon = iconMap[item.type];

  return createPortal(
    <div className="notify-overlay">
      <div className="notify-backdrop" onClick={() => onClose(false)} />
      <div className={`notify-card${isDark ? ' dark' : ''}`} style={{ borderColor: tone, boxShadow: `0 20px 60px ${tone}25` }}>
        <div className="notify-icon" style={{ background: tone }}>
          <span>{icon}</span>
        </div>
        <div className="notify-content">
          <h3>{item.title}</h3>
          <div className="notify-message" dangerouslySetInnerHTML={{ __html: item.message }} />
        </div>
        <div className="notify-actions">
          {item.type === 'confirm' ? (
            <>
              <button className="notify-btn ghost" onClick={() => onClose(false)}>{t('common.cancel')}</button>
              <button className="notify-btn solid" style={{ background: tone }} onClick={() => onClose(true)}>{t('common.confirm')}</button>
            </>
          ) : (
            <button className="notify-btn solid" style={{ background: tone }} onClick={() => onClose(false)}>{t('common.close')}</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const [active, setActive] = useState<NotificationItem | null>(null);

  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0]);
      setQueue(prev => prev.slice(1));
    }
  }, [queue, active]);

  const handleClose = useCallback((confirmed?: boolean) => {
    if (!active) return;
    if (confirmed) {
      active.onConfirm?.();
    } else {
      active.onCancel?.();
    }
    setActive(null);
  }, [active]);

  const show = useCallback((options: NotificationOptions) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const type = options.type || 'info';
    const item: NotificationItem = {
      ...options,
      id,
      type,
      autoClose: options.autoClose ?? (type !== 'confirm' && type !== 'warning' && type !== 'error'),
    };
    setQueue(prev => [...prev, item]);
    return id;
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    show,
    showSuccess: (opts) => show({ ...opts, type: 'success', autoClose: opts.autoClose ?? true }),
    showError: (opts) => show({ ...opts, type: 'error', autoClose: opts.autoClose ?? false }),
    showWarning: (opts) => show({ ...opts, type: 'warning', autoClose: opts.autoClose ?? false }),
    showInfo: (opts) => show({ ...opts, type: 'info', autoClose: opts.autoClose ?? true }),
    showConfirm: (opts) => show({ ...opts, type: 'confirm', autoClose: false }),
  }), [show]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationPortal item={active} onClose={handleClose} />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return ctx;
};
