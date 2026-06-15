import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  deleteUser,
  listUsers,
  restoreUser,
  updateUserStatus,
  type AdminUser,
} from '../api/admin';
import { getApiErrorMessage } from '../api/client';

type FilterKey = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'DELETED';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DISABLED', label: 'Disabled' },
  { key: 'DELETED', label: 'Deleted' },
];

const statusColor: Record<AdminUser['status'], 'warning' | 'success' | 'default'> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  DISABLED: 'default',
};

interface PendingAction {
  user: AdminUser;
  kind: 'reject' | 'deactivate' | 'delete';
}

const CONFIRM_COPY: Record<PendingAction['kind'], { title: string; body: (n: string) => string; cta: string }> = {
  reject: {
    title: 'Reject registration',
    body: (n) => `Reject ${n}? Their account will be set to DISABLED and they cannot log in.`,
    cta: 'Reject',
  },
  deactivate: {
    title: 'Deactivate user',
    body: (n) => `Set ${n} to not active? They will be signed out and cannot log in until reactivated.`,
    cta: 'Deactivate',
  },
  delete: {
    title: 'Delete user',
    body: (n) => `Delete ${n}? They will be removed from active lists but can be restored from the Deleted tab.`,
    cta: 'Delete',
  },
};

export default function Admin() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('PENDING');
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const queryKey = useMemo(() => ['admin-users', filter], [filter]);

  const { data: users, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      filter === 'DELETED' ? listUsers({ deleted: true }) : listUsers({ status: filter }),
  });

  const onError = (err: unknown) =>
    setToast({ msg: getApiErrorMessage(err), severity: 'error' as const });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'DISABLED' }) =>
      updateUserStatus(id, status),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'User updated', severity: 'success' });
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'User deleted', severity: 'success' });
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreUser(id),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'User restored', severity: 'success' });
    },
    onError,
  });

  const busy = setStatus.isPending || remove.isPending || restore.isPending;

  function runConfirmed() {
    if (!confirm) return;
    const { user, kind } = confirm;
    if (kind === 'delete') remove.mutate(user.id);
    else setStatus.mutate({ id: user.id, status: 'DISABLED' });
    setConfirm(null);
  }

  function renderActions(u: AdminUser) {
    if (u.globalRole === 'SUPER_ADMIN') {
      return <Chip size="small" label="Protected" variant="outlined" />;
    }
    if (filter === 'DELETED') {
      return (
        <Button size="small" disabled={busy} onClick={() => restore.mutate(u.id)}>
          Restore
        </Button>
      );
    }
    return (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {u.status === 'PENDING' && (
          <>
            <Button size="small" variant="contained" disabled={busy}
              onClick={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
              Approve
            </Button>
            <Button size="small" color="error" disabled={busy}
              onClick={() => setConfirm({ user: u, kind: 'reject' })}>
              Reject
            </Button>
          </>
        )}
        {u.status === 'ACTIVE' && (
          <Button size="small" color="warning" disabled={busy}
            onClick={() => setConfirm({ user: u, kind: 'deactivate' })}>
            Set Not Active
          </Button>
        )}
        {u.status === 'DISABLED' && (
          <Button size="small" variant="contained" disabled={busy}
            onClick={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
            Activate
          </Button>
        )}
        <Button size="small" color="error" variant="outlined" disabled={busy}
          onClick={() => setConfirm({ user: u, kind: 'delete' })}>
          Delete
        </Button>
      </Stack>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        User management
      </Typography>

      <Paper sx={{ mt: 2 }}>
        <Tabs
          value={filter}
          onChange={(_e, v) => setFilter(v as FilterKey)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {FILTERS.map((f) => (
            <Tab key={f.key} value={f.key} label={f.label} />
          ))}
        </Tabs>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {getApiErrorMessage(error, 'Failed to load users')}
          </Alert>
        ) : !users || users.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No users in this view.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.globalRole}
                        color={u.globalRole === 'SUPER_ADMIN' ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={u.status} color={statusColor[u.status]} />
                    </TableCell>
                    <TableCell align="right">{renderActions(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        {confirm && (
          <>
            <DialogTitle>{CONFIRM_COPY[confirm.kind].title}</DialogTitle>
            <DialogContent>
              <DialogContentText>{CONFIRM_COPY[confirm.kind].body(confirm.user.name)}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirm(null)}>Cancel</Button>
              <Button color="error" variant="contained" onClick={runConfirmed}>
                {CONFIRM_COPY[confirm.kind].cta}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
