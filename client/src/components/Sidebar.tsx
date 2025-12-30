import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import {
  HomeIcon,
  CubeIcon,
  ArrowPathRoundedSquareIcon,
  UsersIcon,
  TruckIcon,
  Cog6ToothIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import logo from '../assets/edited-photo.png';

interface SidebarProps {
  isOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true }) => {
  const location = useLocation();
  const { t, language } = useTranslation();

  const menuItems = [
    { nameKey: 'nav.dashboard', path: '/', icon: HomeIcon },
    { nameKey: 'nav.inventory', path: '/inventory', icon: CubeIcon },
    { nameKey: 'nav.transactions', path: '/transactions', icon: ArrowPathRoundedSquareIcon },
    { nameKey: 'nav.billGenerator', path: '/bill-generator', icon: DocumentTextIcon },
    { nameKey: 'nav.customers', path: '/customers', icon: UsersIcon },
    { nameKey: 'nav.suppliers', path: '/suppliers', icon: TruckIcon },
    { nameKey: 'nav.settings', path: '/settings', icon: Cog6ToothIcon }
  ];

  return (
    <aside
      className={`bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-900 dark:from-emerald-950 dark:via-teal-950 dark:to-emerald-950 text-white shadow-2xl ${
        isOpen ? 'w-64' : 'w-20'
      } min-h-screen relative overflow-hidden`}
      style={{
        transition: 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'width',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
    >
      {/* Decorative gradient overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 dark:from-emerald-500/10 dark:to-teal-500/10 pointer-events-none"
        style={{
          transition: 'opacity 0.4s ease',
          opacity: isOpen ? 1 : 0.5
        }}
      ></div>
      
      <div className="relative z-10">
        <div className="p-4 border-b border-emerald-700/30 dark:border-emerald-800/30 bg-emerald-900/50 dark:bg-emerald-950/50">
          <div className="relative h-10 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <img
                src={logo}
                alt="M/S Didar Trading logo"
                className="h-8 w-8 rounded-full border border-emerald-200/40 bg-white/90 object-contain shadow-lg"
                style={{
                  transition: isOpen
                    ? 'opacity 0.3s ease-in-out 0.12s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s'
                    : 'opacity 0.2s ease-in, transform 0.2s ease-in',
                  opacity: isOpen ? 1 : 0,
                  visibility: isOpen ? 'visible' : 'hidden',
                  transform: isOpen ? 'translateX(0)' : 'translateX(-12px) translateY(-6px) scale(0.9)',
                  pointerEvents: isOpen ? 'auto' : 'none'
                }}
              />
              <h1 
                className={`font-bold bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-100 dark:to-teal-100 bg-clip-text text-transparent drop-shadow-lg ${language === 'bn' ? 'text-lg' : 'text-xl'}`}
                style={{
                  transition: isOpen 
                    ? 'opacity 0.3s ease-in-out 0.15s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s'
                    : 'opacity 0.2s ease-in, transform 0.2s ease-in',
                  opacity: isOpen ? 1 : 0,
                  visibility: isOpen ? 'visible' : 'hidden',
                  transform: isOpen ? 'translateX(0)' : 'translateX(-10px) translateY(-8px)',
                  pointerEvents: isOpen ? 'auto' : 'none'
                }}
              >
                {language === 'bn' ? 'মেসার্স দিদার ট্রেডিং' : 'M/S Didar Trading'}
              </h1>
            </div>
            <img 
              src={logo}
              alt="M/S Didar Trading logo"
              className="h-8 w-8 rounded-full border border-emerald-200/50 bg-white/90 object-contain shadow-lg absolute"
              style={{
                transition: isOpen 
                  ? 'opacity 0.3s ease-in-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'opacity 0.15s ease-out, transform 0.15s ease-out',
                opacity: isOpen ? 0 : 1,
                visibility: isOpen ? 'hidden' : 'visible',
                transform: isOpen ? 'scale(0.7) translateY(8px)' : 'scale(1) translateY(0)',
                pointerEvents: isOpen ? 'none' : 'auto'
              }}
            />
          </div>
        </div>

        <nav className="mt-6 space-y-1 px-2 pb-24">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-xl group relative overflow-hidden ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-600 dark:to-teal-600 text-white shadow-lg shadow-emerald-500/50 dark:shadow-emerald-500/50' 
                    : 'text-emerald-100 dark:text-emerald-200 hover:bg-emerald-800/50 dark:hover:bg-emerald-900/50 hover:shadow-md'
                }`}
                style={{
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s ease, box-shadow 0.3s ease',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: isActive ? 'scale(1.03)' : 'scale(1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = isActive ? 'scale(1.03)' : 'scale(1)';
                }}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
                )}
                <Icon className={`h-6 w-6 relative z-10 flex-shrink-0 ${
                  isActive ? 'text-white drop-shadow-lg' : 'text-emerald-200 dark:text-emerald-300'
                }`} 
                style={{
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  backfaceVisibility: 'hidden'
                }}
                />
                <span 
                  className="ml-4 font-medium relative z-10 truncate whitespace-nowrap"
                  style={{
                    transition: 'opacity 0.35s ease-in-out 0.15s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
                    transitionDelay: `${index * 0.02}s`,
                    opacity: isOpen ? 1 : 0,
                    transform: isOpen ? 'translateX(0)' : 'translateX(-15px)',
                    display: 'inline-block'
                  }}
                >
                  {t(item.nameKey)}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Decorative element */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-emerald-900/80 to-transparent dark:from-emerald-950/80">
          <div className="border-t border-emerald-700/30 dark:border-emerald-800/30 pt-4">
            <div className="relative h-5 flex items-center justify-center overflow-hidden">
              <p 
                className={`text-emerald-200/80 dark:text-emerald-300/70 text-center font-medium absolute ${language === 'bn' ? 'text-[0.7rem]' : 'text-xs'}`}
                style={{
                  transition: isOpen 
                    ? 'opacity 0.35s ease-in-out 0.2s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s'
                    : 'opacity 0.15s ease-out, transform 0.15s ease-out, visibility 0.15s ease-out',
                  opacity: isOpen ? 1 : 0,
                  visibility: isOpen ? 'visible' : 'hidden',
                  transform: isOpen ? 'translateY(0)' : 'translateY(12px)',
                  pointerEvents: isOpen ? 'auto' : 'none'
                }}
              >
                {language === 'bn' ? 'মেসার্স দিদার ট্রেডিং' : 'M/S Didar Trading'}
              </p>
              <div 
                className="text-emerald-300 dark:text-emerald-400 filter drop-shadow-lg absolute"
                style={{
                  transition: isOpen 
                    ? 'opacity 0.35s ease-in-out, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'opacity 0.2s ease-in, transform 0.2s ease-in',
                  opacity: isOpen ? 0 : 1,
                  visibility: isOpen ? 'hidden' : 'visible',
                  transform: isOpen ? 'scale(0.7) rotate(-10deg)' : 'scale(1) rotate(0deg)',
                  pointerEvents: isOpen ? 'none' : 'auto'
                }}
              >
                📊
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;