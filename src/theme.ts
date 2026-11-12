import { TextStyle } from 'react-native';

/**
 * 全局设计令牌：全部屏幕的配色、圆角、间距、字型规格的唯一来源。
 * 新样式一律从这里取值，不再内联 hex。
 */
export const colors = {
  bg: '#0C110F',
  surface: '#151C18',
  surfaceAlt: '#1C2620',
  border: '#263129',
  borderSoft: '#1E2823',
  textPrimary: '#F2F5F0',
  textSecondary: '#9AA79E',
  textTertiary: '#6B7870',
  accent: '#A3E635',
  accentSoft: '#EEF7D5',
  accentInk: '#172009',
  accentDeep: '#607B12',
  accentMuted: '#263129',
  danger: '#EF4444',
  dangerSoft: '#FCA5A5',
  dangerMuted: '#3A1C1C',
  warning: '#FACC15',
  overlay: 'rgba(0, 0, 0, 0.45)',
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** 预设文本样式：字号/字重/行高/字距统一由这里定义，屏内只做颜色覆盖。 */
export const typography: Record<
  'display' | 'title' | 'heading' | 'bodyStrong' | 'body' | 'caption' | 'eyebrow',
  TextStyle
> = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -1.2, lineHeight: 46 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, lineHeight: 30 },
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },
};

/** 统一按压反馈：所有 Pressable 用同一档透明度。 */
export const pressedOpacity = 0.82;
