import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import { getExtensions, FONT_COLORS } from '../extensions';
import { useSticker } from '../hooks/useSticker';
import { useAutoSave } from '../hooks/useAutoSave';
import { useTheme } from '../hooks/useTheme';
import { getBackgroundColor, getTextColor } from '../utils/colors';
import { ColorPicker } from './ColorPicker';
import { TransparencySlider } from './TransparencySlider';
import { TagInput } from './TagInput';
import { ReminderPicker } from './ReminderPicker';
import type { StickerColor } from '../../shared/types';
import '../styles/sticker.css';

interface StickerEditorProps {
  stickerId: string;
}

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
  } = useSticker(stickerId);

  const { isDark } = useTheme();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [content, setContent] = useState('');
  const contentRef = useRef<string>('');
  const [activePanel, setActivePanel] = useState<'color' | 'opacity' | 'tags' | 'reminder' | null>(null);
  const [showFontColor, setShowFontColor] = useState(false);

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
        const html = ed.getHTML();
        contentRef.current = html;
        setContent(html);
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
        contentRef.current = sticker.content;
        setContent(sticker.content);
      }
    }
  }, [sticker?.id, sticker?.content, editor]);

  useAutoSave(stickerId, content, handleSave);

  const handleColorChange = useCallback(
    (color: StickerColor) => {
      updateColor(color);
      setActivePanel(null);
    },
    [updateColor]
  );

  const handleOpacityChange = useCallback(
    (_event: Event, value: number | number[]) => {
      updateOpacity(value as number);
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

  const togglePanel = useCallback((panel: 'color' | 'opacity' | 'tags' | 'reminder') => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setShowFontColor(false);
  }, []);

  if (loading || !sticker) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">加载中...</span>
        </div>
      </div>
    );
  }

  const bgColor = getBackgroundColor(sticker.color, isDark);
  const txtColor = getTextColor(sticker.color, isDark);

  return (
    <div
      className="sticker-window no-select"
      style={{ backgroundColor: bgColor, color: txtColor }}
    >
      {/* 统一工具栏 */}
      <div className="unified-toolbar titlebar-drag">
        {/* 左侧：富文本编辑工具 */}
        {editor && (
          <div className="flex items-center gap-0.5 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="加粗"
            >
              <strong>B</strong>
            </button>
            <button
              className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="斜体"
            >
              <em>I</em>
            </button>
            <span className="toolbar-sep" />
            <button
              className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="无序列表"
            >
              ☰
            </button>
            <button
              className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="有序列表"
            >
              1.
            </button>
            <button
              className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              title="待办"
            >
              ☑
            </button>
            <span className="toolbar-sep" />
            <button
              className="toolbar-btn"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="撤销"
            >
              ↩
            </button>
            <button
              className="toolbar-btn"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="重做"
            >
              ↪
            </button>
            <span className="toolbar-sep" />
            <div className="relative">
              <button
                className={`toolbar-btn ${showFontColor ? 'active' : ''}`}
                onClick={() => {
                  setShowFontColor(!showFontColor);
                  setActivePanel(null);
                }}
                title="字体颜色"
                style={{ fontSize: '15px' }}
              >
                <span style={{ borderBottom: '2px solid #e53935', paddingBottom: '1px' }}>A</span>
              </button>
              {showFontColor && (
                <div className="absolute top-full left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl p-2 flex flex-wrap gap-1.5 w-[130px]">
                  {FONT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-600 hover:scale-125 transition-transform flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: c.value || '#333' }}
                      title={c.label}
                      onClick={() => {
                        if (c.value) {
                          (editor.chain().focus() as any).setFontColor(c.value).run();
                        } else {
                          (editor.chain().focus() as any).unsetFontColor().run();
                        }
                        setShowFontColor(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 中间拖拽区域 */}
        <div className="flex-1 min-w-4" />

        {/* 右侧：窗口操作工具 */}
        <div className="flex items-center gap-0.5 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            className={`toolbar-btn ${activePanel === 'color' ? 'active' : ''}`}
            onClick={() => togglePanel('color')}
            title="换色"
          >
            🎨
          </button>
          <button
            className={`toolbar-btn ${activePanel === 'tags' ? 'active' : ''}`}
            onClick={() => togglePanel('tags')}
            title="标签"
          >
            🏷
          </button>
          <button
            className={`toolbar-btn ${activePanel === 'reminder' ? 'active' : ''}`}
            onClick={() => togglePanel('reminder')}
            title="提醒"
          >
            ⏰
          </button>
          <button
            className={`toolbar-btn ${sticker.isPinned ? 'pin-active' : ''}`}
            onClick={togglePin}
            title={sticker.isPinned ? '取消置顶' : '置顶'}
          >
            📌
          </button>
          <button
            className={`toolbar-btn ${activePanel === 'opacity' ? 'active' : ''}`}
            onClick={() => togglePanel('opacity')}
            title="透明度"
          >
            👁
          </button>
          <button className="toolbar-btn close-btn" onClick={hideWindow} title="隐藏">
            ✕
          </button>
        </div>
      </div>

      {/* 展开面板 */}
      {activePanel === 'color' && (
        <div className="panel-popover">
          <ColorPicker currentColor={sticker.color} onColorChange={handleColorChange} isDark={isDark} />
        </div>
      )}
      {activePanel === 'opacity' && (
        <div className="panel-popover w-48">
          <TransparencySlider opacity={sticker.opacity} onChange={handleOpacityChange} />
        </div>
      )}
      {activePanel === 'tags' && (
        <div className="panel-popover w-56">
          <TagInput tags={sticker.tags} onTagsChange={handleTagsChange} />
        </div>
      )}
      {activePanel === 'reminder' && (
        <div className="panel-popover w-64">
          <ReminderPicker reminder={sticker.reminder} onReminderSet={handleReminderSet} />
        </div>
      )}

      {/* 编辑器区域 */}
      <div className="sticker-editor flex-1 overflow-y-auto">
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  );
};

export default StickerEditor;
