import type { PaletteMode } from '@mui/material';
import { createTheme } from '@mui/material/styles';

/**
 * Builds the MUI theme for a given color mode. Components must use theme tokens
 * (no hardcoded colors) so light/dark works everywhere.
 */
export function buildTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#60a5fa' : '#2563eb' },
      secondary: { main: mode === 'dark' ? '#a78bfa' : '#7c3aed' },
      ...(mode === 'light'
        ? { background: { default: '#f5f6f8' } }
        : { background: { default: '#0f1115', paper: '#171a21' } }),
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'system-ui', 'sans-serif'].join(','),
    },
  });
}
