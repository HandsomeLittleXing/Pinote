import React from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
} from 'react-native';
import { APP_FONT_FAMILY } from '../font';

/** 保留原生 Text API，同时为界面文字设置统一字体。 */
export const Text = React.forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => (
    <NativeText ref={ref} {...props} style={[{ fontFamily: APP_FONT_FAMILY }, style]} />
  )
);
Text.displayName = 'AppText';

/** 输入框不会继承外层文字样式，因此单独设置字体。 */
export const TextInput = React.forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(
  ({ style, ...props }, ref) => (
    <NativeTextInput ref={ref} {...props} style={[{ fontFamily: APP_FONT_FAMILY }, style]} />
  )
);
TextInput.displayName = 'AppTextInput';
