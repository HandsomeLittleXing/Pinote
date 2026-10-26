import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ellipsis, NotebookPen, Plus, RefreshCw } from 'lucide-react-native';
import { STICKER_PALETTE } from '@shared/palette';
import { extractTitle, stripHtml } from '@shared/note';
import type { Sticker } from '@shared/types';
import { getActiveStickers, softDeleteSticker, upsertSticker } from '../storage/db';
import { syncNow, unpair } from '../api/syncClient';
import { ScreenBackground } from '../components/ScreenBackground';
import { GlassHeader } from '../components/GlassHeader';
import { GlassSurface } from '../components/GlassSurface';
import { SearchField } from '../components/SearchField';
import { FilterChips, type FilterOption } from '../components/FilterChips';
import { StickerCard } from '../components/StickerCard';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type SyncBadgeStatus } from '../components/StatusBadge';
import { useToast } from '../components/GlassToast';
import { useAppTheme } from '../theme';

interface Props {
  onOpenSticker: (id: string) => void;
  onUnpaired: () => void;
}

export default function StickerListScreen({ onOpenSticker, onUnpaired }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncBadgeStatus>('synced');

  const load = useCallback(async () => {
    try {
      setStickers(await getActiveStickers());
    } catch (error) {
      console.error('加载便签失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (notify: boolean) => {
      setSyncStatus('syncing');
      try {
        await syncNow();
        await load();
        setSyncStatus('synced');
        if (notify) {
          showToast({ message: '同步完成', variant: 'success' });
        }
      } catch (error) {
        setSyncStatus('error');
        if (notify) {
          showToast({
            message: error instanceof Error ? error.message : '同步失败',
            variant: 'error',
          });
        }
      }
    },
    [load, showToast]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      void runSync(false);
    }, [load, runSync])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync(true);
    } finally {
      setRefreshing(false);
    }
  }, [runSync]);

  const handleCreate = useCallback(async () => {
    const now = new Date().toISOString();
    const sticker: Sticker = {
      id: Crypto.randomUUID(),
      content: '',
      color: STICKER_PALETTE[0].color,
      tags: [],
      isPinned: false,
      isVisible: true,
      opacity: 1,
      reminder: null,
      reminderTriggered: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      windowState: { x: 0, y: 0, width: 240, height: 200 },
    };
    await upsertSticker(sticker);
    await load();
    onOpenSticker(sticker.id);
  }, [load, onOpenSticker]);

  const handleDelete = useCallback(
    (sticker: Sticker) => {
      Alert.alert(
        '删除便签',
        `确定要删除「${extractTitle(sticker.content)}」吗？其他设备同步后也会删除。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                await softDeleteSticker(sticker.id);
                await load();
                showToast({ message: '已删除', variant: 'success' });
                void runSync(false);
              } catch (error) {
                console.error('删除便签失败:', error);
                showToast({ message: '删除失败', variant: 'error' });
              }
            },
          },
        ]
      );
    },
    [load, runSync, showToast]
  );

  const handleUnpair = useCallback(() => {
    Alert.alert('解除配对', '解除后将停止与电脑同步，本机数据会保留。', [
      { text: '取消', style: 'cancel' },
      {
        text: '解除配对',
        style: 'destructive',
        onPress: async () => {
          await unpair();
          onUnpaired();
        },
      },
    ]);
  }, [onUnpaired]);

  const handleMore = useCallback(() => {
    Alert.alert('更多', '选择操作', [
      { text: '解除配对', style: 'destructive', onPress: handleUnpair },
      { text: '取消', style: 'cancel' },
    ]);
  }, [handleUnpair]);

  const tagOptions = useMemo(
    () => Array.from(new Set(stickers.flatMap((sticker) => sticker.tags))).sort(),
    [stickers]
  );

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      { key: 'all', label: '全部' },
      ...tagOptions.map((tag) => ({ key: `tag:${tag}`, label: tag })),
      { key: 'pinned', label: '置顶' },
      { key: 'reminder', label: '提醒' },
    ],
    [tagOptions]
  );

  const filtered = useMemo(() => {
    let result = stickers;

    if (filterKey.startsWith('tag:')) {
      const tag = filterKey.slice(4);
      result = result.filter((sticker) => sticker.tags.includes(tag));
    } else if (filterKey === 'pinned') {
      result = result.filter((sticker) => sticker.isPinned);
    } else if (filterKey === 'reminder') {
      result = result.filter(
        (sticker) => sticker.reminder && !sticker.reminderTriggered
      );
    }

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((sticker) => {
        const plain = stripHtml(sticker.content).toLowerCase();
        return (
          plain.includes(query) ||
          sticker.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      });
    }

    return result;
  }, [stickers, filterKey, search]);

  const hasFilter = filterKey !== 'all' || search.trim().length > 0;

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilterKey('all');
  }, []);

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <GlassHeader
          title="便签"
          subtitle={`${filtered.length} 条`}
          left={
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: theme.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <NotebookPen size={18} color={theme.colors.accent} />
            </View>
          }
          right={
            <>
              <StatusBadge status={syncStatus} />
              <Pressable
                onPress={() => void runSync(true)}
                disabled={syncStatus === 'syncing'}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {syncStatus === 'syncing' ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <RefreshCw size={18} color={theme.colors.textMuted} />
                )}
              </Pressable>
              <Pressable
                onPress={handleMore}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ellipsis size={19} color={theme.colors.textMuted} />
              </Pressable>
            </>
          }
        />

        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            gap: theme.spacing.sm + 2,
          }}
        >
          <SearchField value={search} onChangeText={setSearch} />
          <FilterChips
            options={filterOptions}
            value={filterKey}
            onChange={setFilterKey}
          />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StickerCard
                sticker={item}
                onPress={() => onOpenSticker(item.id)}
                onLongPress={() => handleDelete(item)}
              />
            )}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              paddingBottom: insets.bottom + 110,
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
                progressBackgroundColor={theme.colors.surface}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<NotebookPen size={24} color={theme.colors.textMuted} />}
                title={hasFilter ? '没有匹配的便签' : '还没有便签'}
                description={
                  hasFilter
                    ? '试试调整搜索关键词或筛选条件'
                    : '点击下方加号，随手记下第一张便签'
                }
                action={
                  <Pressable
                    onPress={hasFilter ? clearFilters : () => void handleCreate()}
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      borderRadius: theme.radius.md,
                      backgroundColor: hasFilter
                        ? theme.colors.surfaceGlass
                        : theme.colors.accent,
                      borderWidth: hasFilter ? 1 : 0,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: hasFilter ? theme.colors.textMuted : '#FFFFFF',
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {hasFilter ? '清除筛选' : '新建便签'}
                    </Text>
                  </Pressable>
                }
              />
            }
          />
        )}

        <Pressable
          onPress={() => void handleCreate()}
          style={{ position: 'absolute', right: 20, bottom: insets.bottom + 20 }}
        >
          <GlassSurface
            radius={999}
            style={{ width: 58, height: 58 }}
            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={24} color={theme.colors.accent} />
          </GlassSurface>
        </Pressable>
      </View>
    </ScreenBackground>
  );
}
