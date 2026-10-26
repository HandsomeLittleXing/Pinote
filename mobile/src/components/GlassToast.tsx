import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { GlassSurface } from './GlassSurface';
import { useAppTheme } from '../theme';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

interface ToastItem extends ToastOptions {
  id: number;
}

/** 玻璃 Toast：底部居中，自动消失 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((options: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...options, id: ++idRef.current });
    timer.current = setTimeout(() => setToast(null), options.duration ?? 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const variant = toast?.variant ?? 'info';
  const Icon =
    variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertCircle : Info;
  const color =
    variant === 'success'
      ? theme.colors.success
      : variant === 'error'
        ? theme.colors.danger
        : theme.colors.accent;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 24,
            alignItems: 'center',
            zIndex: 999,
          }}
        >
          <GlassSurface
            blur={false}
            radius={theme.radius.lg}
            contentStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Icon size={16} color={color} />
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.typography.body,
                fontWeight: '500',
              }}
            >
              {toast.message}
            </Text>
          </GlassSurface>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
