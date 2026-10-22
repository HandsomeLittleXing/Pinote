import React, { useCallback, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { ConfirmDialog } from './ConfirmDialog';
import { extractTitle } from '../utils/position';
import type { Sticker } from '../../shared/types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface StickerListItemProps {
  sticker: Sticker;
  onFocus: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
}

export const StickerListItem: React.FC<StickerListItemProps> = ({
  sticker,
  onFocus,
  onDelete,
  onToggleVisible,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const title = extractTitle(sticker.content);
  const timeAgo = dayjs(sticker.createdAt).fromNow();

  const handleDelete = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirm(false);
    onDelete(sticker.id);
  }, [sticker.id, onDelete]);

  return (
    <>
      <div
        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-all duration-200 group border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm"
        onClick={() => onFocus(sticker.id)}
      >
        {/* 颜色标识 */}
        <div
          className="w-10 h-10 rounded-lg flex-shrink-0 shadow-sm flex items-center justify-center text-sm"
          style={{ backgroundColor: sticker.color }}
        >
          {sticker.isPinned ? '📌' : title.charAt(0) || '📝'}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {title}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {sticker.tags.length > 0 && (
              <div className="flex gap-1">
                {sticker.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md"
                  >
                    {tag}
                  </span>
                ))}
                {sticker.tags.length > 3 && (
                  <span className="text-xs text-gray-400">+{sticker.tags.length - 3}</span>
                )}
              </div>
            )}
            {sticker.reminder && !sticker.reminderTriggered && (
              <span className="text-xs text-amber-500">⏰</span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            className="p-1.5 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(sticker.id);
            }}
            title={sticker.isVisible ? '隐藏' : '显示'}
          >
            {sticker.isVisible ? '👁' : '🙈'}
          </button>
          <button
            className="p-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            title="删除"
          >
            🗑
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="删除便签"
        message={`确定要删除「${title}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};
