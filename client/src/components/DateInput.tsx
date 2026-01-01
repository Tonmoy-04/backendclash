import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { parseDisplayDateToAPI, formatAPIDateToDisplay } from '../utils/numberConverter';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className = 'w-full px-4 py-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 focus:border-emerald-500 focus:outline-none transition-colors',
  name = 'date'
}) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar]);

  // Initialize calendar date from value
  useEffect(() => {
    if (value) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          setCalendarDate(date);
        }
      }
    }
  }, [value]);

  const handleDateSelect = (day: number) => {
    const newDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    const formatted = `${String(day).padStart(2, '0')}/${String(newDate.getMonth() + 1).padStart(2, '0')}/${newDate.getFullYear()}`;
    onChange(formatted);
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(calendarDate);
    const firstDay = getFirstDayOfMonth(calendarDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="text-center text-gray-300"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = value && value.startsWith(String(day).padStart(2, '0'));
      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          className={`py-2 text-sm font-medium rounded transition-colors ${
            isSelected
              ? 'bg-emerald-600 text-white'
              : 'text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-700'
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-0">
        <input
          ref={inputRef}
          type="text"
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => setShowCalendar(true)}
          className={`${className} flex-1 rounded-r-none`}
        />
        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          className={`px-4 py-3 rounded-l-none border-2 border-l-0 border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-700 transition-colors ${
            showCalendar ? 'bg-emerald-100 dark:bg-emerald-700' : ''
          }`}
        >
          <CalendarIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
        </button>
      </div>

      {showCalendar && (
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-emerald-900 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl shadow-lg p-4 z-50 w-72">
          {/* Month/Year Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded transition-colors"
            >
              ←
            </button>
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded transition-colors"
            >
              →
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-bold text-emerald-600 dark:text-emerald-300">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendarDays()}
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const formatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
              onChange(formatted);
              setShowCalendar(false);
            }}
            className="w-full mt-4 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded transition-colors"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
};

export default DateInput;
