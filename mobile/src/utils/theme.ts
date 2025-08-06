import { DefaultTheme } from 'react-native-paper';
import { COLORS } from '../../../shared/utils/constants';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.PRIMARY,
    accent: COLORS.SECONDARY,
    surface: COLORS.SURFACE,
    background: COLORS.BACKGROUND,
    text: COLORS.TEXT_PRIMARY,
    placeholder: COLORS.TEXT_SECONDARY,
    error: COLORS.ERROR,
    success: COLORS.SUCCESS,
    warning: COLORS.WARNING,
    info: COLORS.INFO,
  },
  roundness: 8,
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
  },
};