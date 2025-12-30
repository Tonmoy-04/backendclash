import React from 'react';
import ReactDOM from 'react-dom';
import { Bars3Icon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../context/TranslationContext';
import { useDarkMode } from '../context/DarkModeContext';
import adminImage from '../assets/edited-photo.png';

interface TopbarProps {
  onToggleSidebar?: () => void;
  userName?: string;
  userRole?: string;
}

const Topbar: React.FC<TopbarProps> = ({ 
  onToggleSidebar, 
  userName = 'Didar',
  userRole = 'Admin'
}) => {
  const { t, language, setLanguage } = useTranslation();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [showAdminInfo, setShowAdminInfo] = React.useState(false);

  // Bengali date formatting with BD timezone (GMT+6)
  const getBengaliDate = () => {
    // Create date in BD timezone (GMT+6)
    const now = new Date();
    const bdDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
    
    // Try to use Bengali locale if available
    if (language === 'bn') {
      const weekdays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'অগাস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
      return `${weekdays[bdDate.getDay()]}, ${bdDate.getDate()} ${months[bdDate.getMonth()]} ${bdDate.getFullYear()}`;
    }
    
    // English date
    return bdDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <header className="bg-gradient-to-r from-white via-emerald-50/30 to-cyan-50/30 dark:from-emerald-950 dark:via-teal-950/50 dark:to-emerald-950 shadow-lg border-b-2 border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl hover:bg-gradient-to-br hover:from-emerald-100 hover:to-cyan-100 dark:hover:from-emerald-900 dark:hover:to-teal-900 transition-all duration-300 hover:shadow-md hover:scale-105"
            aria-label={t('common.toggleSidebar')}
          >
            <Bars3Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
          </button>
          
          <div className="ml-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-700 via-cyan-600 to-emerald-700 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
              {t('topbar.welcomeBack')}
            </h2>
            <p className="text-sm text-emerald-600 dark:text-emerald-300/80 font-medium">
              {getBengaliDate()}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-emerald-900 dark:to-teal-900 hover:shadow-lg transition-all duration-300 hover:scale-110 group"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <SunIcon className="h-6 w-6 text-amber-500 group-hover:rotate-90 transition-transform duration-500" />
            ) : (
              <MoonIcon className="h-6 w-6 text-emerald-600 group-hover:-rotate-12 transition-transform duration-500" />
            )}
          </button>

          {/* Language Switcher */}
          <div className="flex items-center space-x-1 bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-900 dark:to-teal-900 rounded-xl p-1 shadow-md">
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-lg transition-all duration-300 font-semibold ${
                language === 'en' 
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg scale-105' 
                  : 'text-emerald-700 dark:text-emerald-200 hover:bg-white/50 dark:hover:bg-emerald-800/50 hover:scale-105'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('bn')}
              className={`px-4 py-2 rounded-lg transition-all duration-300 font-semibold ${
                language === 'bn' 
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg scale-105' 
                  : 'text-emerald-700 dark:text-emerald-200 hover:bg-white/50 dark:hover:bg-emerald-800/50 hover:scale-105'
              }`}
            >
              BN
            </button>
          </div>

          {/* User Profile */}
          <div className="relative">
            <div 
              onClick={() => setShowAdminInfo(!showAdminInfo)}
              className="flex items-center space-x-2 cursor-pointer hover:bg-gradient-to-br hover:from-emerald-100 hover:to-cyan-100 dark:hover:from-emerald-900 dark:hover:to-teal-900 rounded-xl p-2 transition-all duration-300 hover:shadow-md hover:scale-105"
            >
              <div className="relative">
                <img 
                  src={adminImage} 
                  alt="Admin" 
                  className="h-9 w-9 rounded-full object-cover border-2 border-emerald-400 dark:border-emerald-500"
                />
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-gradient-to-r from-emerald-400 to-cyan-400 dark:from-emerald-400 dark:to-teal-400 rounded-full border-2 border-white dark:border-emerald-950 shadow-lg animate-pulse"></div>
              </div>
              <div className="hidden md:block">
                <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{userName}</span>
                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">{userRole}</p>
              </div>
            </div>

            {/* Admin Info Modal - Rendered via Portal */}
            {showAdminInfo && ReactDOM.createPortal(
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/60 dark:bg-black/80"
                  onClick={() => setShowAdminInfo(false)}
                  style={{ 
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999998
                  }}
                ></div>
                
                {/* Modal - Centered on screen */}
                <div 
                  className="fixed w-[90%] max-w-md bg-white dark:bg-emerald-950 rounded-2xl shadow-2xl border-2 border-emerald-200 dark:border-emerald-700 overflow-hidden max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    position: 'fixed',
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)',
                    zIndex: 999999
                  }}
                >
                  {/* Header with gradient */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                    <div className="flex flex-col items-center text-center">
                      <img 
                        src={adminImage} 
                        alt="Admin" 
                        className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg mb-3"
                      />
                      <div>
                        <h3 className="text-xl font-bold">MD. Nurul Islam Didar</h3>
                        <p className="text-emerald-100 text-sm mt-1">Proprietor of M/S Didar Trading</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Phone</p>
                        <p className="text-sm text-emerald-900 dark:text-emerald-100">01783-356785</p>
                        <p className="text-sm text-emerald-900 dark:text-emerald-100">01921-993156</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Email</p>
                        <p className="text-sm text-emerald-900 dark:text-emerald-100">didheralam@gmail.com</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Address</p>
                        <p className="text-sm text-emerald-900 dark:text-emerald-100">78, Moulovibazar, Dhaka - 1211</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Facebook</p>
                        <a 
                          href="https://www.facebook.com/share/183xz2xLTE/" 
                          onClick={(e) => {
                            e.preventDefault();
                            const url = 'https://www.facebook.com/share/183xz2xLTE/';
                            if (window.electronAPI?.shell?.openExternal) {
                              window.electronAPI.shell.openExternal(url);
                            } else {
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Visit Facebook Page
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Close button */}
                  <div className="px-6 pb-6">
                    <button
                      onClick={() => setShowAdminInfo(false)}
                      className="w-full py-2 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;