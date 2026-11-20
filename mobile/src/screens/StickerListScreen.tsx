import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotebookPen, Plus, RefreshCw, Settings2, Sparkles } from 'lucide-react-native';
import { STICKER_PALETTE } from '@shared/palette';
import { extractTitle, stripHtml } from '@shared/note';
import type { Sticker } from '@shared/types';
import { rankTags } from '@shared/tagFilters';
import { getActiveStickers, getDeletedStickers, getStickerById, restoreSticker, softDeleteSticker, upsertSticker } from '../storage/db';
import { reconcileReminders } from '../notifications/reminders';
import { StickerManageSheet } from '../components/StickerManageSheet';
import { syncNow } from '../api/syncClient';
import { semanticSearch } from '../api/aiClient';
import { ScreenBackground } from '../components/ScreenBackground';
import { GlassHeader } from '../components/GlassHeader';
import { GlassSurface } from '../components/GlassSurface';
import { SearchField } from '../components/SearchField';
import { FilterChips, type FilterOption } from '../components/FilterChips';
import { StickerCard } from '../components/StickerCard';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, type SyncBadgeStatus } from '../components/StatusBadge';
import { Mascot } from '../components/Mascot';
import { useToast } from '../components/GlassToast';
import { useAppTheme, useThemeController } from '../theme';

interface Props {
  onOpenSticker: (id: string) => void;
  onOpenSettings: () => void;
  paired: boolean;
}

export default function StickerListScreen({ onOpenSticker, onOpenSettings, paired }: Props) {
  const theme = useAppTheme();
  const { preferences, updatePreferences } = useThemeController();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { showToast } = useToast();

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [deleted, setDeleted] = useState<Sticker[]>([]);
  const [managed, setManaged] = useState<Sticker | null>(null);
  const [semanticIds, setSemanticIds] = useState<string[] | null>(null);
  const [semanticBusy, setSemanticBusy] = useState(false);
  const searchVersion = useRef(0);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncBadgeStatus>(paired ? 'synced' : 'offline');

  const load = useCallback(async () => {
    try {
      setStickers(await getActiveStickers());
      setDeleted(await getDeletedStickers());
    } catch (error) {
      console.error('加载便签失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (notify: boolean) => {
      if (!paired) {
        await load();
        setSyncStatus('offline');
        if (notify) showToast({ message: '本机便签已刷新', variant: 'success' });
        return;
      }
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
    [load, paired, showToast]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      void reconcileReminders().catch(console.error);
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
      ai: null,
      tasks: [],
    };
    await upsertSticker(sticker);
    await load();
    onOpenSticker(sticker.id);
  }, [load, onOpenSticker]);

  const handleDelete = useCallback(
    (sticker: Sticker) => {
      Alert.alert(
        '删除便签',
        `确定要删除「${extractTitle(sticker.content)}」吗？${paired ? '其他设备同步后也会删除。' : '本机可在最近删除中恢复。'}`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                await softDeleteSticker(sticker.id);
                setManaged(null);
                await reconcileReminders();
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
    [load, paired, runSync, showToast]
  );

  const handleMore = useCallback(() => {
    onOpenSettings();
  }, [onOpenSettings]);

  const performSemanticSearch = useCallback(async (version: number) => {
    if (version !== searchVersion.current) return;
    setSemanticBusy(true);
    try {
      const candidates = stickers.slice(0, 80).map((item) => ({
        id: item.id, text: stripHtml(item.content).slice(0, 300),
      }));
      const ids = await semanticSearch(search.trim(), candidates);
      if (version === searchVersion.current) {
        setFilterKey('all');
        setSemanticIds(ids);
      }
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : '语义搜索失败', variant: 'error' });
    } finally {
      setSemanticBusy(false);
    }
  }, [search, stickers, showToast]);

  const runSemanticSearch = useCallback(() => {
    if (!search.trim() || semanticBusy) return;
    if (!preferences.aiEnabled) {
      Alert.alert('语义搜索未开启', '请先在设置中开启 AI 整理。', [
        { text: '取消', style: 'cancel' }, { text: '去设置', onPress: onOpenSettings },
      ]);
      return;
    }
    if (preferences.aiConsentVersion < 3) {
      const version = searchVersion.current;
      Alert.alert('语义搜索与隐私',
        preferences.aiSource === 'device'
          ? '本次查找会从手机直接把最近最多 80 条便签各前 300 字发送给 DeepSeek，可能产生费用。只有点击查找时才发送。'
          : '本次查找会经同步服务器把最近最多 80 条便签各前 300 字发送给配置的 AI 服务。只有点击查找时才发送。', [
          { text: '取消', style: 'cancel' },
          { text: '同意并查找', onPress: () => {
             void updatePreferences({ aiConsentVersion: 3 }).then(() => performSemanticSearch(version));
          } },
        ]);
      return;
    }
    void performSemanticSearch(searchVersion.current);
  }, [search, semanticBusy, preferences.aiEnabled, preferences.aiConsentVersion, preferences.aiSource,
    onOpenSettings, updatePreferences, performSemanticSearch]);

  const handleRestore = useCallback((item: Sticker) => {
    Alert.alert('恢复便签', `恢复「${extractTitle(item.content)}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '恢复', onPress: async () => {
        try {
          await restoreSticker(item.id);
          await reconcileReminders();
          await load();
          void runSync(false);
          showToast({ message: '已恢复', variant: 'success' });
        } catch {
          showToast({ message: '恢复失败', variant: 'error' });
        }
      } },
    ]);
  }, [load, runSync, showToast]);

  const saveManaged = useCallback(async (partial: Partial<Sticker>) => {
    if (!managed) return;
    const current = await getStickerById(managed.id);
    if (!current || current.deletedAt) throw new Error('便签已被删除');
    await upsertSticker({ ...current, ...partial, updatedAt: new Date().toISOString() });
    await reconcileReminders().catch(() => {
      showToast({ message: '便签已保存，但通知安排失败', variant: 'error' });
    });
    await load();
    void runSync(false);
  }, [managed, load, runSync, showToast]);

  const tagOptions = useMemo(
    () => rankTags(stickers),
    [stickers]
  );

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      { key: 'all', label: '全部' },
      ...tagOptions.map((tag) => ({ key: `tag:${tag}`, label: tag })),
      { key: 'pinned', label: '置顶' },
      { key: 'reminder', label: '提醒' },
      { key: 'trash', label: '最近删除' },
    ],
    [tagOptions]
  );

  const filtered = useMemo(() => {
    let result = filterKey === 'trash' ? deleted : stickers;

    if (semanticIds !== null && filterKey !== 'trash') {
      const order = new Map(semanticIds.map((id, index) => [id, index]));
      return result.filter((item) => order.has(item.id))
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }

    if (filterKey.startsWith('tag:')) {
      const tag = filterKey.slice(4);
      result = result.filter((sticker) => sticker.tags.includes(tag));
    } else if (filterKey === 'pinned') {
      result = result.filter((sticker) => sticker.isPinned);
    } else if (filterKey === 'reminder') {
      result = result.filter(
        (sticker) => sticker.reminder && !sticker.reminderTriggered && Date.parse(sticker.reminder) > Date.now()
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

    return filterKey === 'trash' ? result : [...result].sort((a, b) =>
      Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [stickers, deleted, filterKey, search, semanticIds]);

  const hasFilter = filterKey !== 'all' || search.trim().length > 0;
  const showGlassComposition = theme.skin === 'glass' && !hasFilter && filtered.length > 0;
  const twoColumnComposition = showGlassComposition && width >= 340 && fontScale <= 1.15;
  const featuredSticker = showGlassComposition ? filtered[0] : null;
  const listData = featuredSticker ? filtered.slice(1) : filtered;

  const clearFilters = useCallback(() => {
    setSearch('');
    searchVersion.current += 1;
    setFilterKey('all');
    setSemanticIds(null);
  }, []);

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <GlassHeader
          title="便签"
          subtitle={filterKey === 'trash' ? `${filtered.length} 条已删除` : `${filtered.length} 条`}
          left={
            theme.effects.mascot && preferences.showMascot ? (
              <Mascot size={36} mood={syncStatus === 'syncing' ? 'thinking' : 'idle'} />
            ) : (
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <NotebookPen size={18} color={theme.colors.accent} />
              </View>
            )
          }
          right={
            <>
              <StatusBadge status={paired ? syncStatus : 'offline'} label={paired ? undefined : '仅本机'} />
              {paired && <Pressable
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
              </Pressable>}
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
                <Settings2 size={19} color={theme.colors.textMuted} />
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
          <SearchField value={search} onChangeText={(value) => {
            searchVersion.current += 1;
            setSearch(value);
            setSemanticIds(null);
          }} />
          {!!search.trim() && filterKey !== 'trash' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <Pressable onPress={runSemanticSearch} disabled={semanticBusy}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }}>
                {semanticBusy ? <ActivityIndicator size="small" color={theme.colors.accent} />
                  : <Sparkles size={14} color={theme.colors.accent} />}
                <Text style={{ color: theme.colors.accent, fontSize: 12 }}>
                  {semanticBusy ? '查找中...' : '语义查找'}</Text>
              </Pressable>
              {semanticIds !== null && <Pressable onPress={() => setSemanticIds(null)}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>返回关键词结果</Text>
              </Pressable>}
              {semanticIds !== null && <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {semanticIds.length} 条结果{stickers.length > 80 ? ' · 最近 80 条' : ''}
              </Text>}
            </View>
          )}
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
            key={showGlassComposition ? (twoColumnComposition ? 'glass-grid' : 'glass-single') : 'standard-list'}
            data={listData}
            numColumns={twoColumnComposition ? 2 : 1}
            columnWrapperStyle={twoColumnComposition ? { justifyContent: 'space-between' } : undefined}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={showGlassComposition ? {
                width: twoColumnComposition ? '48%' : '100%',
                marginBottom: 16,
                transform: twoColumnComposition && index % 2 === 1 ? [{ translateY: 12 }] : undefined,
              } : undefined}>
                <StickerCard
                  sticker={item}
                  variant={showGlassComposition ? 'compact' : 'standard'}
                  onPress={() => filterKey === 'trash' ? handleRestore(item) : onOpenSticker(item.id)}
                  onLongPress={() => filterKey === 'trash' ? handleRestore(item) : setManaged(item)}
                />
              </View>
            )}
            ListHeaderComponent={featuredSticker ? (
              <View style={{ marginBottom: 16 }}>
                <StickerCard
                  sticker={featuredSticker}
                  variant="featured"
                  onPress={() => onOpenSticker(featuredSticker.id)}
                  onLongPress={() => setManaged(featuredSticker)}
                />
              </View>
            ) : undefined}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              paddingBottom: insets.bottom + 110,
            }}
            ItemSeparatorComponent={showGlassComposition ? undefined : () => <View style={{ height: 10 }} />}
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
            ListEmptyComponent={filtered.length === 0 ?
              <EmptyState
                icon={
                  theme.effects.mascot && preferences.showMascot ? (
                    <Mascot size={64} mood="sleepy" />
                  ) : (
                    <NotebookPen size={24} color={theme.colors.textMuted} />
                  )
                }
                title={filterKey === 'trash' ? '最近没有删除的便签' : hasFilter ? '没有匹配的便签' : '还没有便签'}
                description={
                  filterKey === 'trash' ? '删除的便签可在这里恢复' : hasFilter
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
                        color: hasFilter ? theme.colors.textMuted : theme.colors.onAccent,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {hasFilter ? '清除筛选' : '新建便签'}
                    </Text>
                  </Pressable>
                }
              /> : undefined
            }
          />
        )}

        <StickerManageSheet sticker={managed} onClose={() => setManaged(null)}
          onSave={saveManaged} onDelete={() => { if (managed) { setManaged(null); handleDelete(managed); } }} />
        {filterKey !== 'trash' && <Pressable
          onPress={() => void handleCreate()}
          style={{ position: 'absolute', right: 20, bottom: insets.bottom + 20 }}
        >
          <GlassSurface
            radius={999}
            blur={theme.skin !== 'glass'}
            style={{
              width: 58,
              height: 58,
              backgroundColor: theme.skin === 'glass' ? theme.colors.accent : undefined,
            }}
            contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={24} color={theme.skin === 'glass' ? theme.colors.onAccent : theme.colors.accent} />
          </GlassSurface>
        </Pressable>}
      </View>
    </ScreenBackground>
  );
}
