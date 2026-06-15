import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

/** Shared shell for authenticated pages: top bar + routed content. */
export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.globalRole === 'SUPER_ADMIN';

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, fontWeight: 700, color: 'inherit', textDecoration: 'none' }}
          >
            KmmRepo
          </Typography>
          {isAdmin && (
            <Button
              color="inherit"
              component={RouterLink}
              to="/admin"
              sx={{ fontWeight: location.pathname === '/admin' ? 700 : 400 }}
            >
              Admin
            </Button>
          )}
          <Button color="inherit" onClick={() => void logout()}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
