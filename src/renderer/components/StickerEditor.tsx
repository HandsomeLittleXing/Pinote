import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import {
  ALargeSmall,
  Bell,
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Eye,
  GripVertical,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Palette,
  Pin,
  PinOff,
  Redo2,
  Sparkles,
  Tag,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { getExtensions, FONT_COLORS, FONT_SIZES } from '../extensions';
import { useSticker } from '../hooks/useSticker';
import { useAutoSave } from '../hooks/useAutoSave';
import { useTheme } from '../hooks/useTheme';
import { getBackgroundColor, getTextColor, withAlpha, clampOpacity } from '../utils/colors';
import { resolveGlassCardColor } from '../../shared/palette';
import { getStickerDoodleForId, STICKER_DOODLES } from '../../shared/stickerDoodles';
import { getApi } from '../utils/api';
import { useToast } from './ui/Toast';
import { AiResultPanel } from './AiResultPanel';
import { AiRewritePanel } from './AiRewritePanel';
import { renderRewriteHtml } from '../../shared/aiRewrite';
import type { AIRewriteResponse, AIAnnotation } from '../../shared/types';
import {
  computeContentHash,
  getLocalTimeZone,
  isAIUsable,
  noteToPlainText,
  adoptAiTags,
} from '../../shared/ai';
import { ColorPicker } from './ColorPicker';
import { TransparencySlider } from './TransparencySlider';
import { TagInput } from './TagInput';
import { ReminderPicker } from './ReminderPicker';
import { IconButton } from './ui/IconButton';
import { Tooltip } from './ui/Tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/DropdownMenu';
import { Popover, PopoverAnchor, PopoverContent } from './ui/Popover';
import type { StickerColor } from '../../shared/types';
import '../styles/sticker.css';

interface StickerEditorProps {
  stickerId: string;
}

type ActivePanel =
  | 'color'
  | 'opacity'
  | 'tags'
  | 'reminder'
  | 'fontColor'
  | 'fontSize'
  | 'ai'
  | null;

const StickerEditor: React.FC<StickerEditorProps> = ({ stickerId }) => {
  const {
    sticker,
    loading,
    updateContent,
    updateColor,
    togglePin,
    updateOpacity,
    updateTags,
    setReminder,
    hideWindow,
    reload,
  } = useSticker(stickerId);

  const { isDark, skin, aiEnabled } = useTheme();
  const { toast } = useToast();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [content, setContent] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const pendingPanelRef = useRef<ActivePanel>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [rewrite, setRewrite] = useState<{ sourceText: string; result: AIRewriteResponse } | null>(null);
  const [rewriteUndo, setRewriteUndo] = useState<{ before: string; afterHash: string; ai: AIAnnotation | null } | null>(null);

  const handleSave = useCallback(
    async (id: string, html: string) => {
      await updateContent(html);
    },
    [updateContent]
  );

  // 初始化 Tiptap 编辑器
  useEffect(() => {
    const e = new Editor({
      extensions: getExtensions(),
      content: '',
      editorProps: {
        attributes: {
          class: 'tiptap',
        },
      },
      onUpdate: ({ editor: ed }) => {
        setContent(ed.getHTML());
      },
    });

    setEditor(e);
    return () => e.destroy();
  }, []);

  // 加载便签内容
  useEffect(() => {
    if (sticker && editor && !editor.isDestroyed) {
      const currentContent = editor.getHTML();
      if (sticker.content && currentContent !== sticker.content) {
        editor.commands.setContent(sticker.content);
        setContent(sticker.content);
      }
    }
  }, [sticker?.id, sticker?.content, editor]);

  // 同步或其他窗口更新本条便签时刷新；正在输入时不打断
  useEffect(() => {
    return getApi().sticker.onChanged((id) => {
      if (id !== stickerId || editor?.isFocused) return;
      reload();
    });
  }, [stickerId, editor, reload]);

  // 主进程通知收起状态（含原生菜单触发的展开）
  useEffect(() => {
    return getApi().window.onCollapsedChanged((value) => {
      setCollapsed(value);
    });
  }, []);

  useAutoSave(stickerId, content, handleSave);

  // AI 结果通过 Tiptap 装饰显示；只影响视图，不写回正文
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const plainText = noteToPlainText(content);
    const fresh = isAIUsable(sticker?.ai ?? null, plainText) ? sticker?.ai : null;
    editor.commands.setAnnotations(fresh?.spans ?? []);
  }, [content, editor, sticker?.ai]);

  const runAI = useCallback(
    async (force: boolean) => {
      if (!aiEnabled) {
        toast({
          title: 'AI 整理未开启',
          description: '请在设置 → 同步 → AI 整理中开启',
          variant: 'error',
        });
        return;
      }
      if (!editor || editor.isDestroyed || aiBusy) return;

      setAiBusy(true);
      try {
        const html = editor.getHTML();
        await updateContent(html);
        const plainText = noteToPlainText(html);
        if (!plainText) {
          toast({ title: '便签还是空的', variant: 'info' });
          return;
        }
        const contentHash = computeContentHash(plainText);
        const result = await getApi().ai.annotate({
          plainText,
          contentHash,
          timezone: getLocalTimeZone(),
          force,
        });

        const latestPlain = noteToPlainText(editor.getHTML());
        if (computeContentHash(latestPlain) !== result.annotation.contentHash) {
          toast({ title: '内容已变化，请重新整理', variant: 'error' });
          return;
        }

        await getApi().sticker.update(stickerId, { ai: result.annotation });
        await reload();
        setActivePanel('ai');
        toast({
          title: result.cached ? '已使用缓存结果' : 'AI 整理完成',
          variant: 'success',
        });
        void getApi().sync.syncNow().catch(() => {});
      } catch (error) {
        const message = error instanceof Error ? error.message : '请稍后重试';
        toast({
          title: 'AI 整理失败',
          description: message.replace(/^Error invoking remote method '[^']+': Error: /, ''),
          variant: 'error',
        });
      } finally {
        setAiBusy(false);
      }
    },
    [aiBusy, aiEnabled, editor, reload, stickerId, toast, updateContent]
  );

  const handleAdoptTag = useCallback(
    async (tag: string) => {
      if (!sticker) return;
      const tags = adoptAiTags(sticker.tags, [tag]);
      if (tags.length !== sticker.tags.length) await updateTags(tags);
    },
    [sticker, updateTags]
  );

  const handleAdoptAllTags = useCallback(async () => {
    if (!sticker?.ai) return;
    const merged = adoptAiTags(sticker.tags, sticker.ai.tags);
    if (merged.length === sticker.tags.length) return;
    await updateTags(merged);
  }, [sticker, updateTags]);

  const runRewrite = useCallback(async () => {
    if (!aiEnabled) { toast({ title: '请先在设置中开启 AI 整理', variant: 'error' }); return; }
    if (!editor || editor.isDestroyed || aiBusy) return;
    const html = editor.getHTML();
    if (/<(?:img|iframe|video|audio|object|embed)\b/i.test(html)) {
      toast({ title: '含媒体的便签暂不支持替换', variant: 'error' }); return;
    }
    const plainText = noteToPlainText(html);
    if (!plainText) { toast({ title: '便签还是空的', variant: 'info' }); return; }
    setAiBusy(true);
    try {
      await updateContent(html);
      const result = await getApi().ai.rewrite({ plainText, contentHash: computeContentHash(plainText) });
      if (computeContentHash(noteToPlainText(editor.getHTML())) !== result.sourceHash) {
        toast({ title: '内容已变化，请重新整理', variant: 'error' }); return;
      }
      setRewrite({ sourceText: plainText, result });
    } catch (error) {
      toast({ title: 'AI 整理失败', description: error instanceof Error ? error.message : '请稍后重试', variant: 'error' });
    } finally { setAiBusy(false); }
  }, [aiEnabled, aiBusy, editor, toast, updateContent]);

  const applyRewrite = useCallback(async (selectedIds: string[]) => {
    if (!editor || !rewrite) return;
    const before = editor.getHTML();
    if (computeContentHash(noteToPlainText(before)) !== rewrite.result.sourceHash ||
        /<(?:img|iframe|video|audio|object|embed)\b/i.test(before)) {
      setRewrite(null);
      toast({ title: '内容已变化，请重新生成', variant: 'error' }); return;
    }
    const html = renderRewriteHtml(rewrite.result, selectedIds);
    try {
      await getApi().sticker.update(stickerId, { content: html, ai: null });
      editor.commands.setContent(html);
      setContent(html);
      setRewriteUndo({ before, afterHash: computeContentHash(noteToPlainText(html)), ai: sticker?.ai ?? null });
      setRewrite(null);
      await reload();
      void getApi().sync.syncNow().catch(() => {});
    } catch (error) {
      toast({ title: '应用整理失败', description: error instanceof Error ? error.message : '请重试', variant: 'error' });
    }
  }, [editor, rewrite, reload, sticker?.ai, stickerId, toast]);

  const undoRewrite = useCallback(async () => {
    if (!editor || !rewriteUndo) return;
    if (computeContentHash(noteToPlainText(editor.getHTML())) !== rewriteUndo.afterHash) {
      setRewriteUndo(null);
      toast({ title: '内容已变化，无法撤销本次整理', variant: 'error' }); return;
    }
    try {
      await getApi().sticker.update(stickerId, { content: rewriteUndo.before, ai: rewriteUndo.ai });
      editor.commands.setContent(rewriteUndo.before);
      setContent(rewriteUndo.before);
      setRewriteUndo(null);
      await reload();
      void getApi().sync.syncNow().catch(() => {});
    } catch (error) {
      toast({ title: '撤销失败', description: error instanceof Error ? error.message : '请重试', variant: 'error' });
    }
  }, [editor, reload, rewriteUndo, stickerId, toast]);

  const handleSetReminder = useCallback(
    async (iso: string) => {
      await setReminder(iso);
      toast({ title: '提醒已设置', variant: 'success' });
    },
    [setReminder, toast]
  );

  const handleColorChange = useCallback(
    (color: StickerColor) => {
      updateColor(color);
      setActivePanel(null);
    },
    [updateColor]
  );

  const handleOpacityChange = useCallback(
    (value: number) => {
      updateOpacity(value);
    },
    [updateOpacity]
  );

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      updateTags(tags);
    },
    [updateTags]
  );

  const handleReminderSet = useCallback(
    (reminder: string | null) => {
      setReminder(reminder);
      if (reminder === null) setActivePanel(null);
    },
    [setReminder]
  );

  const applyFontColor = useCallback(
    (value: string) => {
      if (!editor) return;
      if (value) {
        (editor.chain().focus() as any).setFontColor(value).run();
      } else {
        (editor.chain().focus() as any).unsetFontColor().run();
      }
      setActivePanel(null);
    },
    [editor]
  );

  const applyFontSize = useCallback(
    (value: string | null) => {
      if (!editor) return;
      if (value) {
        (editor.chain().focus() as any).setFontSize(value).run();
      } else {
        (editor.chain().focus() as any).unsetFontSize().run();
      }
      setActivePanel(null);
    },
    [editor]
  );

  // 等菜单完成关闭后再打开浮层，避免 Radix 的焦点恢复将其立即关闭。
  const openPanel = useCallback((panel: Exclude<ActivePanel, null>) => {
    pendingPanelRef.current = panel;
  }, []);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    setActivePanel(null);
    getApi()
      .window.setCollapsed(next)
      .catch((error) => {
        console.error('切换便签收起状态失败:', error);
        setCollapsed(!next);
      });
  }, [collapsed]);

  const openCollapsedMenu = useCallback(() => {
    getApi()
      .window.showCollapsedMenu()
      .catch((error) => {
        console.error('打开收起菜单失败:', error);
      });
  }, []);

  const handleToolbarDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) return;
      toggleCollapsed();
    },
    [toggleCollapsed]
  );

  if (loading || !sticker) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-xs text-ink-subtle">加载中...</span>
        </div>
      </div>
    );
  }

  const glass = skin === 'glass' ? resolveGlassCardColor(sticker.color, isDark) : null;
  const doodle = glass ? STICKER_DOODLES[getStickerDoodleForId(sticker.id)] : null;
  const bgColor = glass?.surface ?? getBackgroundColor(sticker.color, isDark);
  const txtColor = glass?.ink ?? getTextColor(sticker.color, isDark);
  const bgAlpha = clampOpacity(sticker.opacity);
  const currentFontSize = editor?.getAttributes('textStyle').fontSize as string | undefined;
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div
      className={`sticker-window no-select ${collapsed ? 'collapsed' : ''}`}
      style={{ backgroundColor: withAlpha(bgColor, bgAlpha), color: txtColor, '--note-tint': glass?.tint, '--note-opacity': bgAlpha } as React.CSSProperties}
    >
      {rewrite && <AiRewritePanel sourceText={rewrite.sourceText} result={rewrite.result}
        onApply={(selected) => void applyRewrite(selected)} onClose={() => setRewrite(null)} />}
      {/* 统一工具栏：常驻收起/更多/关闭，窄窗口下不溢出 */}
      <div
        className="unified-toolbar titlebar-drag"
        onDoubleClick={handleToolbarDoubleClick}
      >
        <div className="toolbar-grip" aria-hidden="true">
          <GripVertical size={13} />
        </div>

        {!collapsed && (
          <div className="toolbar-optional items-center gap-0.5" style={noDrag}>
            <Tooltip label="加粗">
              <IconButton
                size="sm"
                label="加粗"
                active={editor?.isActive('bold')}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="斜体">
              <IconButton
                size="sm"
                label="斜体"
                active={editor?.isActive('italic')}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="待办">
              <IconButton
                size="sm"
                label="待办"
                active={editor?.isActive('taskList')}
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
              >
                <ListChecks size={14} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        {!collapsed && (
          <Tooltip label="AI 整理">
            <IconButton
              size="sm"
              label="AI 整理"
              active={activePanel === 'ai'}
              onClick={() => {
                if (activePanel === 'ai') {
                  setActivePanel(null);
                } else if (sticker.ai) {
                  setActivePanel('ai');
                } else {
                  void runAI(false);
                }
              }}
            >
              {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            </IconButton>
          </Tooltip>
        )}

        <div className="min-w-2 flex-1" />

        <div className="flex items-center gap-0.5" style={noDrag}>
          {!collapsed && (
            <Popover
              open={activePanel !== null}
              onOpenChange={(open) => {
                if (!open) setActivePanel(null);
              }}
            >
              <PopoverAnchor asChild>
                <span className="inline-block h-6 w-0" aria-hidden="true" />
              </PopoverAnchor>
              <PopoverContent align="end">
                {activePanel === 'ai' && (
                  <AiResultPanel
                    annotation={sticker.ai}
                    currentTags={sticker.tags}
                    hasReminder={!!sticker.reminder}
                    busy={aiBusy}
                    onAdoptTag={(tag) => void handleAdoptTag(tag)}
                    onAdoptAllTags={() => void handleAdoptAllTags()}
                    onSetReminder={(iso) => void handleSetReminder(iso)}
                    onRerun={() => void runAI(true)}
                  />
                )}
                {activePanel === 'color' && (
                  <ColorPicker
                    currentColor={sticker.color}
                    onColorChange={handleColorChange}
                    isDark={isDark}
                    skin={skin}
                  />
                )}
                {activePanel === 'opacity' && (
                  <TransparencySlider opacity={sticker.opacity} onChange={handleOpacityChange} />
                )}
                {activePanel === 'tags' && (
                  <TagInput tags={sticker.tags} onTagsChange={handleTagsChange} />
                )}
                {activePanel === 'reminder' && (
                  <ReminderPicker reminder={sticker.reminder} onReminderSet={handleReminderSet} />
                )}
                {activePanel === 'fontColor' && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-ink-muted">字体颜色</div>
                    <div className="flex flex-wrap gap-2">
                      {FONT_COLORS.map((color) => (
                        <button
                          key={color.label}
                          type="button"
                          title={color.label}
                          aria-label={color.label}
                          onClick={() => applyFontColor(color.value)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-line/20 shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                          style={{ backgroundColor: color.value || 'transparent' }}
                        >
                          {!color.value && <span className="text-[10px] text-ink-muted">A</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activePanel === 'fontSize' && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-ink-muted">字号</div>
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))' }}
                    >
                      {FONT_SIZES.map((size) => (
                        <button
                          key={size.value}
                          type="button"
                          onClick={() => applyFontSize(size.value)}
                          className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                            currentFontSize === size.value
                              ? 'bg-accent/10 text-accent'
                              : 'bg-muted text-ink-muted hover:bg-muted/70'
                          }`}
                        >
                          {size.label}px
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => applyFontSize(null)}
                        className="rounded-md bg-muted px-2 py-1.5 text-xs text-ink-muted transition-colors hover:bg-muted/70"
                      >
                        默认
                      </button>
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          {!collapsed && (
            <Tooltip label="换色">
              <IconButton
                size="sm"
                label="换色"
                active={activePanel === 'color'}
                onClick={() => setActivePanel(activePanel === 'color' ? null : 'color')}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm dark:border-white/20"
                  style={{ backgroundColor: glass?.tint ?? bgColor }}
                />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip label={collapsed ? '展开便签' : '收起便签'}>
            <IconButton
              size="sm"
              label={collapsed ? '展开便签' : '收起便签'}
              onClick={toggleCollapsed}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </IconButton>
          </Tooltip>

          {collapsed ? (
            <Tooltip label="更多操作">
              <IconButton size="sm" label="更多操作" onClick={openCollapsedMenu}>
                <Ellipsis size={15} />
              </IconButton>
            </Tooltip>
          ) : (
            <DropdownMenu>
              <Tooltip label="更多操作">
                <DropdownMenuTrigger asChild>
                  <IconButton size="sm" label="更多操作">
                    <Ellipsis size={15} />
                  </IconButton>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="max-h-[calc(100vh-40px)] overflow-y-auto"
                onCloseAutoFocus={(event) => {
                  const panel = pendingPanelRef.current;
                  if (!panel) return;
                  event.preventDefault();
                  pendingPanelRef.current = null;
                  setActivePanel(panel);
                }}
              >
                <DropdownMenuLabel>外观</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => openPanel('color')}>
                  <Palette size={14} /> 换色
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openPanel('fontColor')}>
                  <Type size={14} /> 字体颜色
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!editor} onSelect={() => openPanel('fontSize')}>
                  <ALargeSmall size={14} /> 字号
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>格式</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!editor}
                  onSelect={() => {
                    editor?.chain().focus().toggleBold().run();
                  }}
                >
                  <Bold size={14} /> 加粗
                  {editor?.isActive('bold') && <Check size={14} className="ml-auto text-accent" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor}
                  onSelect={() => {
                    editor?.chain().focus().toggleItalic().run();
                  }}
                >
                  <Italic size={14} /> 斜体
                  {editor?.isActive('italic') && (
                    <Check size={14} className="ml-auto text-accent" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor}
                  onSelect={() => {
                    editor?.chain().focus().toggleBulletList().run();
                  }}
                >
                  <List size={14} /> 无序列表
                  {editor?.isActive('bulletList') && (
                    <Check size={14} className="ml-auto text-accent" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor}
                  onSelect={() => {
                    editor?.chain().focus().toggleOrderedList().run();
                  }}
                >
                  <ListOrdered size={14} /> 有序列表
                  {editor?.isActive('orderedList') && (
                    <Check size={14} className="ml-auto text-accent" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor}
                  onSelect={() => {
                    editor?.chain().focus().toggleTaskList().run();
                  }}
                >
                  <ListChecks size={14} /> 待办清单
                  {editor?.isActive('taskList') && (
                    <Check size={14} className="ml-auto text-accent" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!editor || !editor.can().undo()}
                  onSelect={() => {
                    editor?.chain().focus().undo().run();
                  }}
                >
                  <Undo2 size={14} /> 撤销
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!editor || !editor.can().redo()}
                  onSelect={() => {
                    editor?.chain().focus().redo().run();
                  }}
                >
                  <Redo2 size={14} /> 重做
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>智能</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={aiBusy}
                  onSelect={() => {
                    if (sticker.ai) {
                      openPanel('ai');
                    } else {
                      void runAI(false);
                    }
                  }}
                >
                  <Sparkles size={14} /> AI 整理
                  {aiBusy && <Loader2 size={13} className="ml-auto animate-spin" />}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={aiBusy} onSelect={() => void runRewrite()}>
                  <Sparkles size={14} /> AI 整理并补充
                </DropdownMenuItem>
                {rewriteUndo && <DropdownMenuItem onSelect={() => void undoRewrite()}>
                  <Undo2 size={14} /> 撤销本次整理
                </DropdownMenuItem>}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>便签</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => openPanel('tags')}>
                  <Tag size={14} /> 标签
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openPanel('reminder')}>
                  <Bell size={14} /> {sticker.reminder ? '修改提醒' : '提醒'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={togglePin}>
                  {sticker.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                  {sticker.isPinned ? '取消置顶' : '置顶'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openPanel('opacity')}>
                  <Eye size={14} /> 背景不透明度
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={toggleCollapsed}>
                  <ChevronUp size={14} /> 收起便签
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={hideWindow}>
                  <X size={14} /> 隐藏便签
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip label="隐藏便签">
            <IconButton
              size="sm"
              label="隐藏便签"
              onClick={hideWindow}
              className="hover:bg-[#e81123] hover:text-white"
            >
              <X size={15} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* 编辑器区域 */}
      {!collapsed && (
        <div className="sticker-editor flex-1 overflow-y-auto">
          {doodle && <svg className="sticker-editor-doodle" viewBox={doodle.viewBox}
            aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="3.8"
            strokeLinecap="round" strokeLinejoin="round">
            {doodle.paths.map((path, index) => <path key={index} d={path} />)}
          </svg>}
          {editor && <EditorContent editor={editor} />}
        </div>
      )}

      {/* 右下角缩放提示（不阻挡原生缩放） */}
      {!collapsed && <div className="sticker-resize-handle" aria-hidden="true" />}
    </div>
  );
};

export default StickerEditor;
