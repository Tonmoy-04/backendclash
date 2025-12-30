import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  bgColor?: string;
  onClick?: () => void;
  clickable?: boolean;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  change,
  changeType = 'neutral',
  bgColor = 'bg-blue-500',
  onClick,
  clickable = false,
  subtitle
}) => {
  return (
    <div 
      className={`bg-gradient-to-br from-white to-emerald-50/30 dark:from-emerald-900 dark:to-teal-900/30 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 border border-emerald-200/50 dark:border-emerald-700/30 backdrop-blur-sm ${clickable ? 'cursor-pointer hover:scale-105 transform' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{value}</p>
            {subtitle && subtitle.length > 0 && <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{subtitle}</span>}
          </div>
          {change && (
            <p className={`text-sm mt-2 ${changeType === 'increase' ? 'text-green-600 dark:text-green-400' : changeType === 'decrease' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {change}
            </p>
          )}
        </div>
        
        <div className={`${bgColor} rounded-full p-4 text-white shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
