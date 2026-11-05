import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { resolveAnnotationSpans } from '../../shared/ai';
import type { AnnotationSpan } from '../../shared/types';

interface AnnotationPluginState {
  spans: AnnotationSpan[];
  decorations: DecorationSet;
}

export const annotationPluginKey = new PluginKey<AnnotationPluginState>('frostnoteAnnotations');

function buildDecorations(doc: PMNode, spans: AnnotationSpan[]): DecorationSet {
  if (spans.length === 0) return DecorationSet.empty;
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    // 在每个文本节点内按精确子串解析：加粗/字号把一句话拆开时，跨节点的标注会自然不显示
    const resolved = resolveAnnotationSpans(node.text, spans);
    for (const item of resolved) {
      decorations.push(
        Decoration.inline(pos + item.from, pos + item.to, {
          class: `anno anno-${item.kind}${item.importance >= 3 ? ' anno--strong' : ''}`,
          'data-kind': item.kind,
          'data-importance': String(item.importance),
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * 语义标注装饰：只影响视图，不写入 getHTML()，不进入撤销历史。
 */
export const SemanticAnnotations = Extension.create({
  name: 'semanticAnnotations',

  addCommands() {
    return {
      setAnnotations:
        (spans: AnnotationSpan[]) =>
        ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
          if (dispatch) {
            const tr = state.tr.setMeta(annotationPluginKey, { spans });
            tr.setMeta('addToHistory', false);
            dispatch(tr);
          }
          return true;
        },
      clearAnnotations:
        () =>
        ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
          if (dispatch) {
            const tr = state.tr.setMeta(annotationPluginKey, { spans: [] });
            tr.setMeta('addToHistory', false);
            dispatch(tr);
          }
          return true;
        },
    } as any;
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<AnnotationPluginState>({
        key: annotationPluginKey,
        state: {
          init: () => ({ spans: [], decorations: DecorationSet.empty }),
          apply(tr, value, _oldState, newState) {
            const meta = tr.getMeta(annotationPluginKey) as
              | { spans: AnnotationSpan[] }
              | undefined;
            if (meta && Array.isArray(meta.spans)) {
              return {
                spans: meta.spans,
                decorations: buildDecorations(newState.doc, meta.spans),
              };
            }
            if (tr.docChanged) {
              // 编辑后按当前文本重新解析：改掉的片段自动消失
              return {
                spans: value.spans,
                decorations: buildDecorations(newState.doc, value.spans),
              };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            return annotationPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    semanticAnnotations: {
      /** 设置当前文档的语义标注（仅视图层） */
      setAnnotations: (spans: AnnotationSpan[]) => ReturnType;
      clearAnnotations: () => ReturnType;
    };
  }
}
