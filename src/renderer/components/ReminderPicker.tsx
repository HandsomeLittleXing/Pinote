import React, { useState, useCallback, useEffect } from 'react';
import { Bell } from 'lucide-react';
import dayjs from 'dayjs';
import { Button } from './ui/Button';

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

  // 远程同步更新提醒后，同步面板里的日期与时间
  useEffect(() => {
    setDateValue(reminder ? dayjs(reminder).format('YYYY-MM-DD') : '');
    setTimeValue(reminder ? dayjs(reminder).format('HH:mm') : '09:00');
  }, [reminder]);

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
      <div className="mb-2 text-xs font-medium text-ink-muted">提醒时间</div>

      {reminder && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-xs text-accent">
          <Bell size={12} />
          {dayjs(reminder).format('YYYY-MM-DD HH:mm')}
        </div>
      )}

      {/* 快捷选项 */}
      <div className="mb-3 flex gap-1.5">
        {quickOptions.map((opt) => (
          <button
            key={opt.minutes}
            type="button"
            onClick={() => handleQuick(opt.minutes)}
            className="rounded-md bg-muted px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-muted/70"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="min-w-[110px] flex-1 rounded-md border border-line/10 bg-surface px-2 py-1.5 text-xs text-ink focus:border-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className="w-24 rounded-md border border-line/10 bg-surface px-2 py-1.5 text-xs text-ink focus:border-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={handleSetReminder} disabled={!dateValue}>
          设置提醒
        </Button>
        {reminder && (
          <Button size="sm" variant="secondary" onClick={handleClearReminder}>
            清除
          </Button>
        )}
      </div>
    </div>
  );
};
