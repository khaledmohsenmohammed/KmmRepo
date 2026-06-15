import { Box, Chip, Paper, Typography } from '@mui/material';
import { useAuth } from '../features/auth/AuthContext';

/**
 * Landing page after login. Rendered inside AppLayout (which provides the top
 * bar). Projects, folders, and the test repository will appear here as later
 * Phase 1 features land.
 */
export default function Dashboard() {
  const { user } = useAuth();

  return (
    <Paper sx={{ p: 4 }} elevation={2}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Welcome, {user?.name}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
        <Chip label={user?.globalRole} color="primary" size="small" />
        <Chip label={user?.status} color="success" size="small" variant="outlined" />
      </Box>
      <Typography color="text.secondary">
        You are signed in. {user?.globalRole === 'SUPER_ADMIN'
          ? 'Use the Admin link above to review and manage user accounts.'
          : 'Projects and the test repository will appear here as later features land.'}
      </Typography>
    </Paper>
  );
}
