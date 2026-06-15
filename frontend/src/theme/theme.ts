import { createTheme } from '@mui/material/styles';

/**
 * Base MUI theme. The persisted dark/light toggle is a later Phase 1 task;
 * for now we expose a single light theme built from tokens (no hardcoded colors
 * elsewhere — components reference the theme).
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb' },
    secondary: { main: '#7c3aed' },
    background: { default: '#f5f6f8' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'Roboto', 'system-ui', 'sans-serif'].join(','),
  },
});
