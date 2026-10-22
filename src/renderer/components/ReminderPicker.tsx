import React, { useState, useCallback } from 'react';
import dayjs from 'dayjs';

interface ReminderPickerProps {
  reminder: string | null;
  onReminderSet: (reminder: string | null) => void;
}

/** 提醒时间选择器 */
export const ReminderPicker: React.FC<ReminderPickerProps> = ({ reminder, onReminderSet }) => {
  const [dateValue, setDateValue] = useState(
    reminder ? dayjs(reminder).format('YYYY-MM-DD') : ''
  );
  const [timeValue, setTimeValue] = useState(
    reminder ? dayjs(reminder).format('HH:mm') : '09:00'
  );

  const handleSetReminder = useCallback(() => {
    if (!dateValue) return;
    // 使用本地时间构造日期，避免时区偏移
    const [year, month, day] = dateValue.split('-').map(Number);
    const [hours, minutes] = timeValue.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(date.getTime())) return;
    onReminderSet(date.toISOString());
  }, [dateValue, timeValue, onReminderSet]);

  const handleClearReminder = useCallback(() => {
    setDateValue('');
    setTimeValue('09:00');
    onReminderSet(null);
  }, [onReminderSet]);

  // 快捷选项
  const quickOptions = [
    { label: '30分钟后', minutes: 30 },
    { label: '1小时后', minutes: 60 },
    { label: '明天此时', minutes: 60 * 24 },
  ];

  const handleQuick = useCallback(
    (minutes: number) => {
      const target = new Date(Date.now() + minutes * 60 * 1000);
      setDateValue(dayjs(target).format('YYYY-MM-DD'));
      setTimeValue(dayjs(target).format('HH:mm'));
      onReminderSet(target.toISOString());
    },
    [onReminderSet]
  );

  return (
    <div>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">提醒时间</div>

      {reminder && (
        <div className="mb-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
          ⏰ {dayjs(reminder).format('YYYY-MM-DD HH:mm')}
        </div>
      )}

      {/* 快捷选项 */}
      <div className="flex gap-1.5 mb-3">
        {quickOptions.map((opt) => (
          <button
            key={opt.minutes}
            onClick={() => handleQuick(opt.minutes)}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className="w-24 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSetReminder}
          disabled={!dateValue}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          设置提醒
        </button>
        {reminder && (
          <button
            onClick={handleClearReminder}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            清除
          </button>
        )}
      </div>
    </div>
  );
};
