// Design System Constants

// Icon sizes
export const ICON_SIZES = {
  xs: 'h-3 w-3',    // 12px - for small indicators, badges
  sm: 'h-4 w-4',    // 16px - for buttons, form elements
  md: 'h-5 w-5',    // 20px - default size, navigation
  lg: 'h-6 w-6',    // 24px - section headers, prominent actions
  xl: 'h-8 w-8',    // 32px - page headers, large features
  '2xl': 'h-10 w-10', // 40px - hero elements
} as const;

// Avatar sizes
export const AVATAR_SIZES = {
  xs: 'h-6 w-6',    // 24px
  sm: 'h-8 w-8',    // 32px
  md: 'h-10 w-10',  // 40px
  lg: 'h-12 w-12',  // 48px
  xl: 'h-16 w-16',  // 64px
  '2xl': 'h-20 w-20', // 80px
} as const;

// Border radius scale
export const BORDER_RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-sm',    // 2px
  md: 'rounded-md',    // 6px
  lg: 'rounded-lg',    // 8px
  xl: 'rounded-xl',    // 12px
  '2xl': 'rounded-2xl', // 16px
  '3xl': 'rounded-3xl', // 24px
  full: 'rounded-full',
} as const;

// Shadow scale
export const SHADOWS = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
} as const;

// Animation durations
export const ANIMATION_DURATION = {
  fast: 'duration-150',
  normal: 'duration-200',
  slow: 'duration-300',
  slower: 'duration-500',
} as const;

// Z-index scale
export const Z_INDEX = {
  dropdown: 'z-10',
  sticky: 'z-20',
  modal: 'z-30',
  popover: 'z-40',
  tooltip: 'z-50',
  toast: 'z-60',
} as const;

export type IconSize = keyof typeof ICON_SIZES;
export type AvatarSize = keyof typeof AVATAR_SIZES;
export type BorderRadius = keyof typeof BORDER_RADIUS;
export type Shadow = keyof typeof SHADOWS;
export type AnimationDuration = keyof typeof ANIMATION_DURATION;
export type ZIndex = keyof typeof Z_INDEX;