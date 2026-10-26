import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, NotebookPen, Plus, SearchX } from 'lucide-react';
import { StickerListItem } from './StickerListItem';
import { SearchBar } from './SearchBar';
import { FilterBar, type StickerFilter } from './FilterBar';
import { WindowChrome } from './WindowChrome';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { useTheme } from '../hooks/useTheme';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from './ui/DropdownMenu';
import { getApi } from '../utils/api';
import { extractTitle } from '../utils/position';
import { getChecklistProgress, stripHtml } from '../utils/note';
import type { Sticker } from '../../shared/types';

type SortMode = 'updated' | 'created' | 'pinned';

const sortLabels: Record<SortMode, string> = {
  updated: '最近更新',
  created: '最近创建',
  pinned: '置顶优先',
};

const SkeletonCard: React.FC = () => (
  <div className="rounded-xl border border-line/10 bg-surface p-3.5">
    <Skeleton className="mb-3 h-4 w-1/2" />
    <Skeleton className="mb-2 h-3 w-full" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);

const StickerList: React.FC = () => {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<StickerFilter>({ type: 'all' });
  const [sort, setSort] = useState<SortMode>('updated');
  const { isDark } = useTheme();
  const { toast } = useToast();

  const loadStickers = useCallback(async () => {
    try {
      const allStickers = await getApi().sticker.getAll();
      setStickers(allStickers);
    } catch (error) {
      console.error('加载便签列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStickers();
    const unsubscribe = getApi().sticker.onListChanged(() => {
      loadStickers();
    });
    return () => unsubscribe();
  }, [loadStickers]);

  // Ctrl/Cmd+K 聚焦搜索
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('sticker-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    stickers.forEach((sticker) => sticker.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [stickers]);

  const visibleStickers = useMemo(() => {
    let result = stickers;

    switch (filter.type) {
      case 'tag':
        result = result.filter((sticker) => sticker.tags.includes(filter.tag));
        break;
      case 'pinned':
        result = result.filter((sticker) => sticker.isPinned);
        break;
      case 'task':
        result = result.filter((sticker) => getChecklistProgress(sticker.content).total > 0);
        break;
      case 'reminder':
        result = result.filter((sticker) => !!sticker.reminder && !sticker.reminderTriggered);
        break;
      default:
        break;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((sticker) => {
        const plainText = stripHtml(sticker.content).toLowerCase();
        return (
          plainText.includes(query) ||
          sticker.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      });
    }

    return [...result].sort((a, b) => {
      if (sort === 'pinned' && a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (sort === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [stickers, filter, searchQuery, sort]);

  const handleCreate = useCallback(async () => {
    try {
      await getApi().sticker.create();
      await loadStickers();
    } catch (error) {
      console.error('新建便签失败:', error);
      toast({ title: '新建便签失败', variant: 'error' });
    }
  }, [loadStickers, toast]);

  const handleFocus = useCallback(
    async (id: string) => {
      try {
        await getApi().sticker.focus(id);
        await loadStickers();
      } catch (error) {
        console.error('聚焦便签失败:', error);
      }
    },
    [loadStickers]
  );

  const handleDelete = useCallback(
    async (sticker: Sticker) => {
      const title = extractTitle(sticker.content);
      try {
        await getApi().sticker.delete(sticker.id);
        await loadStickers();
        toast({
          title: `已删除「${title}」`,
          variant: 'info',
          action: {
            label: '撤销',
            onClick: async () => {
              try {
                await getApi().sticker.restore(sticker.id);
                await loadStickers();
                toast({ title: '已恢复便签', variant: 'success', duration: 1800 });
              } catch (error) {
                console.error('恢复便签失败:', error);
                toast({ title: '恢复失败', variant: 'error' });
              }
            },
          },
        });
      } catch (error) {
        console.error('删除便签失败:', error);
        toast({ title: '删除便签失败', variant: 'error' });
      }
    },
    [loadStickers, toast]
  );

  const handleToggleVisible = useCallback(
    async (id: string) => {
      try {
        await getApi().sticker.toggleVisible(id);
        await loadStickers();
      } catch (error) {
        console.error('切换可见状态失败:', error);
        toast({ title: '切换显示状态失败', variant: 'error' });
      }
    },
    [loadStickers, toast]
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      try {
        await getApi().sticker.togglePin(id);
        await loadStickers();
      } catch (error) {
        console.error('切换置顶失败:', error);
        toast({ title: '切换置顶失败', variant: 'error' });
      }
    },
    [loadStickers, toast]
  );

  const handleCopy = useCallback(
    async (sticker: Sticker) => {
      const text = stripHtml(sticker.content);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
        }
        toast({ title: '已复制内容', variant: 'success', duration: 1800 });
      } catch (error) {
        console.error('复制便签内容失败:', error);
        toast({ title: '复制失败', variant: 'error' });
      }
    },
    [toast]
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilter({ type: 'all' });
  }, []);

  const hasFilters = searchQuery.trim().length > 0 || filter.type !== 'all';

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      <WindowChrome
        icon={<NotebookPen size={17} />}
        title="便签列表"
        subtitle={`${visibleStickers.length} 条`}
        actions={
          <Button size="sm" onClick={handleCreate}>
            <Plus size={14} /> 新建
          </Button>
        }
      />

      <div className="flex items-center gap-2 border-b border-line/10 bg-surface px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="shrink-0">
              <ArrowUpDown size={14} /> {sortLabels[sort]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => setSort(value as SortMode)}
            >
              {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                <DropdownMenuRadioItem key={mode} value={mode}>
                  {sortLabels[mode]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border-b border-line/10 bg-surface px-4 py-2">
        <FilterBar tags={allTags} filter={filter} onChange={setFilter} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <SkeletonCard key={item} />
            ))}
          </div>
        ) : visibleStickers.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<SearchX size={22} />}
              title="没有匹配的便签"
              description="试试调整关键词，或清除标签/置顶/待办筛选"
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  清除筛选
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<NotebookPen size={22} />}
              title="还没有便签"
              description="点击新建，随手记下第一张便签"
              action={
                <Button size="sm" onClick={handleCreate}>
                  <Plus size={14} /> 新建便签
                </Button>
              }
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
            {visibleStickers.map((sticker) => (
              <StickerListItem
                key={sticker.id}
                sticker={sticker}
                isDark={isDark}
                query={searchQuery}
                onFocus={handleFocus}
                onDelete={handleDelete}
                onToggleVisible={handleToggleVisible}
                onTogglePin={handleTogglePin}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerList;
