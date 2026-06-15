import { AppBar, Box, Button, Chip, Container, Paper, Toolbar, Typography } from '@mui/material';
import { useAuth } from '../features/auth/AuthContext';

/**
 * Placeholder app shell shown after login. The full responsive shell with the
 * folder tree and dark/light toggle arrives in later Phase 1 tasks.
 */
export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            KmmRepo
          </Typography>
          <Button color="inherit" onClick={() => void logout()}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 6 }}>
        <Paper sx={{ p: 4 }} elevation={2}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Welcome, {user?.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
            <Chip label={user?.globalRole} color="primary" size="small" />
            <Chip label={user?.status} color="success" size="small" variant="outlined" />
          </Box>
          <Typography color="text.secondary">
            You are signed in. Projects, folders, and the test repository will appear here as
            later Phase 1 features land.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
