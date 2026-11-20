import React, { useMemo } from 'react';
import {
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Text } from './AppText';
import { splitAnnotatedText } from '@shared/ai';
import type { AnnotationSpan } from '@shared/types';
import { useAppTheme } from '../theme';

interface AnnotatedTextProps {
  text: string;
  spans: AnnotationSpan[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  annotationInk?: string;
}

/** 非破坏性语义标注文本：正文仍是普通 Text，只有命中的片段带样式 */
export function AnnotatedText({ text, spans, style, numberOfLines, annotationInk }: AnnotatedTextProps) {
  const theme = useAppTheme();
  const segments = useMemo(() => splitAnnotatedText(text, spans), [text, spans]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => {
        if (!segment.annotation) {
          return <Text key={index}>{segment.text}</Text>;
        }
        const { kind, importance } = segment.annotation;
        const annotation = theme.annotations[kind];
        return (
          <Text
            key={index}
            style={{
              color: annotationInk ?? annotation.color,
              backgroundColor: annotationInk
                ? (theme.dark ? '#FFFFFF24' : '#FFFFFF66')
                : annotation.background,
              fontWeight: kind === 'person' || kind === 'important' || importance >= 3 ? '700' : '600',
              textDecorationLine: annotation.underline === 'none' ? 'none' : 'underline',
              textDecorationColor: annotationInk ?? annotation.color,
              ...(annotation.underline !== 'none'
                ? { textDecorationStyle: annotation.underline }
                : {}),
            }}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
