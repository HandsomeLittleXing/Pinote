import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import { SemanticAnnotations } from './annotations';

/** 自定义字号扩展 */
const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontSize: null }).run();
        },
    } as any;
  },
});

/** 自定义字体颜色扩展 */
const FontColor = Extension.create({
  name: 'fontColor',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.color || null,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.color) return {};
              return { style: `color: ${attributes.color}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontColor:
        (color: string) =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { color }).run();
        },
      unsetFontColor:
        () =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { color: null }).run();
        },
    } as any;
  },
});

/** 字号选项 */
export const FONT_SIZES = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
];

/** 字体颜色选项 */
export const FONT_COLORS = [
  { label: '默认', value: '' },
  { label: '红', value: '#e53935' },
  { label: '橙', value: '#fb8c00' },
  { label: '黄', value: '#fdd835' },
  { label: '绿', value: '#43a047' },
  { label: '蓝', value: '#1e88e5' },
  { label: '紫', value: '#8e24aa' },
  { label: '灰', value: '#757575' },
  { label: '黑', value: '#212121' },
];

/** 获取 Tiptap 扩展列表 */
export function getExtensions() {
  return [
    StarterKit.configure({
      history: {
        depth: 100,
      },
    }),
    TextStyle,
    FontSize,
    FontColor,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    SemanticAnnotations,
  ];
}
