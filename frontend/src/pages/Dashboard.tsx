import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client';
import { listMyProjects } from '../api/projects';
import { useAuth } from '../features/auth/AuthContext';

const roleLabel = (r: string) =>
  r.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');

/**
 * Landing page after login. Lists the projects the user can access, each linking
 * into its folder tree (Phase 1 gate: a user sees their project's folder tree).
 */
export default function Dashboard() {
  const { user } = useAuth();

  const { data: projects, isLoading, isError, error } = useQuery({
    queryKey: ['my-projects'],
    queryFn: listMyProjects,
  });

  return (
    <Box>
      <Paper sx={{ p: 4 }} elevation={2}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Welcome, {user?.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
          <Chip label={user?.globalRole} color="primary" size="small" />
          <Chip label={user?.status} color="success" size="small" variant="outlined" />
        </Box>
        <Typography color="text.secondary">
          You are signed in.{' '}
          {user?.globalRole === 'SUPER_ADMIN'
            ? 'Use the Admin and Projects links above to manage accounts and projects.'
            : 'Your assigned projects are listed below.'}
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }} elevation={2}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Your projects
        </Typography>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Alert severity="error">{getApiErrorMessage(error, 'Failed to load projects')}</Alert>
        ) : !projects || projects.length === 0 ? (
          <Typography color="text.secondary">
            {user?.globalRole === 'SUPER_ADMIN'
              ? 'No projects yet. Create one from the Projects page.'
              : 'You have not been assigned to any projects yet.'}
          </Typography>
        ) : (
          <List>
            {projects.map((p) => (
              <ListItem
                key={p.id}
                divider
                secondaryAction={
                  <Button
                    size="small"
                    variant="outlined"
                    component={RouterLink}
                    to={`/projects/${p.id}/folders`}
                  >
                    Open folders
                  </Button>
                }
              >
                <ListItemText
                  primary={p.name}
                  secondary={p.myRole ? roleLabel(p.myRole) : 'Super-admin'}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
