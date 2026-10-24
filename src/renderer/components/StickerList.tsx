import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NotebookPen, Plus } from 'lucide-react';
import { StickerListItem } from './StickerListItem';
import { SearchBar } from './SearchBar';
import { TagFilter } from './TagFilter';
import { Button } from './ui/Button';
import { getApi } from '../utils/api';
import type { Sticker } from '../../shared/types';

const StickerList: React.FC = () => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadStickers = useCallback(async () => {
    try {
      const allStickers = await getApi().sticker.getAll();
      setStickers(allStickers);
    } catch (error) {
      console.error('加载便签列表失败:', error);
    }
  }, []);

  useEffect(() => {
    loadStickers();

    // 事件驱动刷新：便签数据变化时通知列表
    const unsubscribe = getApi().sticker.onListChanged(() => {
      loadStickers();
    });

    return () => {
      unsubscribe();
    };
  }, [loadStickers]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    stickers.forEach((s) => s.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [stickers]);

  const filteredStickers = useMemo(() => {
    let result = stickers;
    if (selectedTag) {
      result = result.filter((s) => s.tags.includes(selectedTag));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const plainText = s.content.replace(/<[^>]*>/g, '').toLowerCase();
        return plainText.includes(query) || s.tags.some((t) => t.toLowerCase().includes(query));
      });
    }
    return result;
  }, [stickers, searchQuery, selectedTag]);

  const handleCreate = useCallback(async () => {
    try {
      await getApi().sticker.create();
      loadStickers();
    } catch (error) {
      console.error('新建便签失败:', error);
    }
  }, [loadStickers]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await getApi().sticker.delete(id);
        loadStickers();
      } catch (error) {
        console.error('删除便签失败:', error);
      }
    },
    [loadStickers]
  );

  const handleToggleVisible = useCallback(
    async (id: string) => {
      try {
        await getApi().sticker.toggleVisible(id);
        loadStickers();
      } catch (error) {
        console.error('切换可见状态失败:', error);
      }
    },
    [loadStickers]
  );

  const handleFocus = useCallback(
    async (id: string) => {
      try {
        const sticker = stickers.find((s) => s.id === id);
        if (sticker && !sticker.isVisible) {
          await getApi().sticker.toggleVisible(id);
        }
        loadStickers();
      } catch (error) {
        console.error('聚焦便签失败:', error);
      }
    },
    [stickers, loadStickers]
  );

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between border-b border-line/10 bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <NotebookPen size={18} className="text-ink-muted" />
          <h1 className="text-lg font-semibold text-ink">便签列表</h1>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-ink-subtle">
            {stickers.length}
          </span>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus size={14} /> 新建
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="border-b border-line/10 bg-surface px-3 py-2">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* 标签过滤 */}
      {allTags.length > 0 && (
        <div className="border-b border-line/10 bg-surface px-3 py-2">
          <TagFilter tags={allTags} selectedTag={selectedTag} onTagSelect={setSelectedTag} />
        </div>
      )}

      {/* 便签列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredStickers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-ink-subtle">
            <NotebookPen size={32} className="mb-3 opacity-60" />
            <p className="text-sm">
              {searchQuery || selectedTag ? '没有匹配的便签' : '还没有便签'}
            </p>
            <p className="mt-1 text-xs">
              {searchQuery || selectedTag ? '试试其他关键词' : '点击右上角新建开始吧'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredStickers.map((sticker) => (
              <StickerListItem
                key={sticker.id}
                sticker={sticker}
                onFocus={handleFocus}
                onDelete={handleDelete}
                onToggleVisible={handleToggleVisible}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerList;
