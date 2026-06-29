import { zodResolver } from '@hookform/resolvers/zod';
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
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
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
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { listUsers } from '../api/admin';
import { getApiErrorMessage } from '../api/client';
import {
  addMember,
  createProject,
  deleteProject,
  listMembers,
  listProjects,
  PROJECT_ROLES,
  removeMember,
  restoreProject,
  updateProject,
  type Project,
  type ProjectRole,
} from '../api/projects';

type FilterKey = 'ACTIVE' | 'DELETED';
type Toast = { msg: string; severity: 'success' | 'error' };

const roleLabel = (r: ProjectRole) =>
  r.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');

const projectSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().trim().max(500, 'Description is too long'),
});
type ProjectForm = z.infer<typeof projectSchema>;

export default function Projects() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('ACTIVE');
  const [toast, setToast] = useState<Toast | null>(null);
  const [formOpen, setFormOpen] = useState<{ mode: 'create' | 'edit'; project?: Project } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [membersFor, setMembersFor] = useState<Project | null>(null);

  const onError = (err: unknown) => setToast({ msg: getApiErrorMessage(err), severity: 'error' });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin-projects'] });

  const { data: projects, isLoading, isError, error } = useQuery({
    queryKey: ['admin-projects', filter],
    queryFn: () => listProjects(filter === 'DELETED' ? { deleted: true } : {}),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'Project deleted', severity: 'success' });
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreProject(id),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'Project restored', severity: 'success' });
    },
    onError,
  });

  const busy = remove.isPending || restore.isPending;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          Project configuration
        </Typography>
        <Button variant="contained" onClick={() => setFormOpen({ mode: 'create' })}>
          New project
        </Button>
      </Stack>

      <Paper sx={{ mt: 2 }}>
        <Tabs
          value={filter}
          onChange={(_e, v) => setFilter(v as FilterKey)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="ACTIVE" label="Active" />
          <Tab value="DELETED" label="Deleted" />
        </Tabs>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {getApiErrorMessage(error, 'Failed to load projects')}
          </Alert>
        ) : !projects || projects.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No projects in this view.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Members</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{p.description || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.memberCount} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {filter === 'DELETED' ? (
                        <Button size="small" disabled={busy} onClick={() => restore.mutate(p.id)}>
                          Restore
                        </Button>
                      ) : (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            component={RouterLink}
                            to={`/projects/${p.id}/folders`}
                          >
                            Folders
                          </Button>
                          <Button size="small" onClick={() => setMembersFor(p)}>
                            Members
                          </Button>
                          <Button size="small" onClick={() => setFormOpen({ mode: 'edit', project: p })}>
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busy}
                            onClick={() => setConfirmDelete(p)}
                          >
                            Delete
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {formOpen && (
        <ProjectFormDialog
          mode={formOpen.mode}
          project={formOpen.project}
          onClose={() => setFormOpen(null)}
          onSaved={(msg) => {
            invalidate();
            setFormOpen(null);
            setToast({ msg, severity: 'success' });
          }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        {confirmDelete && (
          <>
            <DialogTitle>Delete project</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Delete {confirmDelete.name}? It moves to the Deleted tab and can be restored.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => {
                  remove.mutate(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                Delete
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {membersFor && (
        <MembersDialog
          project={membersFor}
          onClose={() => setMembersFor(null)}
          onToast={setToast}
          onChanged={invalidate}
        />
      )}

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

function ProjectFormDialog({
  mode,
  project,
  onClose,
  onSaved,
  onError,
}: {
  mode: 'create' | 'edit';
  project?: Project;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (err: unknown) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: project?.name ?? '', description: project?.description ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ProjectForm) =>
      mode === 'create'
        ? createProject(values)
        : updateProject(project!.id, values),
    onSuccess: () => onSaved(mode === 'create' ? 'Project created' : 'Project updated'),
    onError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <DialogTitle>{mode === 'create' ? 'New project' : 'Edit project'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              autoFocus
              error={!!errors.name}
              helperText={errors.name?.message}
              {...register('name')}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              error={!!errors.description}
              helperText={errors.description?.message ?? 'Optional'}
              {...register('description')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function MembersDialog({
  project,
  onClose,
  onToast,
  onChanged,
}: {
  project: Project;
  onClose: () => void;
  onToast: (t: Toast) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('PROJECT_LEAD');

  const membersKey = ['project-members', project.id];
  const onError = (err: unknown) => onToast({ msg: getApiErrorMessage(err), severity: 'error' });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: membersKey });
    onChanged(); // refresh member counts in the table
  };

  const { data: members, isLoading } = useQuery({
    queryKey: membersKey,
    queryFn: () => listMembers(project.id),
  });

  const { data: activeUsers } = useQuery({
    queryKey: ['admin-users', 'ACTIVE'],
    queryFn: () => listUsers({ status: 'ACTIVE' }),
  });

  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.userId)), [members]);
  const assignable = useMemo(
    () => (activeUsers ?? []).filter((u) => !memberIds.has(u.id)),
    [activeUsers, memberIds],
  );

  const add = useMutation({
    mutationFn: () => addMember(project.id, { userId, role }),
    onSuccess: () => {
      refresh();
      setUserId('');
      onToast({ msg: 'User assigned', severity: 'success' });
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (uid: string) => removeMember(project.id, uid),
    onSuccess: () => {
      refresh();
      onToast({ msg: 'Member removed', severity: 'success' });
    },
    onError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Members — {project.name}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : !members || members.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No members yet. Assign a user below.
          </Typography>
        ) : (
          <List dense>
            {members.map((m) => (
              <ListItem
                key={m.membershipId}
                secondaryAction={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={roleLabel(m.role)} color="primary" variant="outlined" />
                    <IconButton
                      edge="end"
                      aria-label={`remove ${m.name}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(m.userId)}
                    >
                      ✕
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText primary={m.name} secondary={m.email} />
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Assign a user
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <FormControl fullWidth size="small">
              <InputLabel id="assign-user-label">User</InputLabel>
              <Select
                labelId="assign-user-label"
                label="User"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                {assignable.length === 0 ? (
                  <MenuItem disabled value="">
                    No assignable active users
                  </MenuItem>
                ) : (
                  assignable.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="assign-role-label">Role</InputLabel>
              <Select
                labelId="assign-role-label"
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as ProjectRole)}
              >
                {PROJECT_ROLES.map((r) => (
                  <MenuItem key={r} value={r}>
                    {roleLabel(r)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disabled={!userId || add.isPending}
              onClick={() => add.mutate()}
              sx={{ whiteSpace: 'nowrap', mt: { xs: 0, sm: 0.25 } }}
            >
              Assign
            </Button>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
