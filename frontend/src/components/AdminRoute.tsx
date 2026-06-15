import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

/** Like ProtectedRoute, but also requires the SUPER_ADMIN global role. */
export function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.globalRole !== 'SUPER_ADMIN') return <Navigate to="/" replace />;

  return <Outlet />;
}
