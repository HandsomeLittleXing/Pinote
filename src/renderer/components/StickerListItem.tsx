import React, { useCallback, useState } from 'react';
import { Bell, Eye, EyeOff, Pin, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './ui/IconButton';
import { extractTitle } from '../utils/position';
import { getTextColor } from '../utils/colors';
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
        className="group flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-line/10 hover:bg-surface hover:shadow-glass"
        onClick={() => onFocus(sticker.id)}
      >
        {/* 颜色标识 */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg shadow-sm"
          style={{
            backgroundColor: sticker.color,
            color: getTextColor(sticker.color, false),
          }}
        >
          {sticker.isPinned ? <Pin size={14} /> : title.charAt(0)}
        </div>

        {/* 内容 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-ink">{title}</span>
            <span className="flex-shrink-0 text-xs tabular-nums text-ink-subtle">{timeAgo}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {sticker.tags.length > 0 && (
              <div className="flex gap-1">
                {sticker.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
                  >
                    {tag}
                  </span>
                ))}
                {sticker.tags.length > 3 && (
                  <span className="text-xs text-ink-subtle">+{sticker.tags.length - 3}</span>
                )}
              </div>
            )}
            {sticker.reminder && !sticker.reminderTriggered && (
              <Bell size={12} className="text-warning" />
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            size="sm"
            label={sticker.isVisible ? '隐藏便签' : '显示便签'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisible(sticker.id);
            }}
          >
            {sticker.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </IconButton>
          <IconButton
            size="sm"
            label="删除便签"
            danger
            onClick={(event) => {
              event.stopPropagation();
              handleDelete();
            }}
          >
            <Trash2 size={14} />
          </IconButton>
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
