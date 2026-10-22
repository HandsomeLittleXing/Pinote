import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StickerListItem } from './StickerListItem';
import { SearchBar } from './SearchBar';
import { TagFilter } from './TagFilter';
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
    <div className="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">便签列表</h1>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
            {stickers.length}
          </span>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-all shadow-sm hover:shadow"
        >
          <span className="text-base leading-none">+</span>
          新建
        </button>
      </div>

      {/* 搜索栏 */}
      <div className="px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* 标签过滤 */}
      {allTags.length > 0 && (
        <div className="px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <TagFilter tags={allTags} selectedTag={selectedTag} onTagSelect={setSelectedTag} />
        </div>
      )}

      {/* 便签列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredStickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <span className="text-4xl mb-3">📝</span>
            <p className="text-sm">
              {searchQuery || selectedTag ? '没有匹配的便签' : '还没有便签'}
            </p>
            <p className="text-xs mt-1">
              {searchQuery || selectedTag ? '试试其他关键词' : '点击右上角新建开始吧'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
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
