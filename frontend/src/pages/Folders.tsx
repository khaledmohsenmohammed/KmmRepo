import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { z } from 'zod';
import { getApiErrorMessage } from '../api/client';
import {
  createFolder,
  deleteFolder,
  listDeletedFolders,
  listFolderTree,
  moveFolder,
  renameFolder,
  restoreFolder,
  type DeletedFoldersResult,
  type FolderNode,
  type FolderTreeResult,
} from '../api/folders';

type FolderListResult = FolderTreeResult | DeletedFoldersResult;

type FilterKey = 'ACTIVE' | 'DELETED';
type Toast = { msg: string; severity: 'success' | 'error' };

const ExpandIcon = () => <Box component="span">▸</Box>;
const CollapseIcon = () => <Box component="span">▾</Box>;

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});
type NameForm = z.infer<typeof nameSchema>;

/** Flattens the active tree to `{ id, name, depth }`, optionally excluding a subtree. */
function flatten(nodes: FolderNode[], excludeId?: string, depth = 0): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const n of nodes) {
    if (n.id === excludeId) continue; // skip the folder (and its subtree) being moved
    out.push({ id: n.id, name: n.name, depth });
    out.push(...flatten(n.children, excludeId, depth + 1));
  }
  return out;
}

export default function Folders() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('ACTIVE');
  const [toast, setToast] = useState<Toast | null>(null);
  const [createUnder, setCreateUnder] = useState<{ parentId: string | null } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FolderNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<FolderNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FolderNode | null>(null);

  const onError = (err: unknown) => setToast({ msg: getApiErrorMessage(err), severity: 'error' });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['folders', projectId] });

  const { data, isLoading, isError, error } = useQuery<FolderListResult>({
    queryKey: ['folders', projectId, filter],
    queryFn: (): Promise<FolderListResult> =>
      filter === 'DELETED' ? listDeletedFolders(projectId!) : listFolderTree(projectId!),
    enabled: !!projectId,
  });

  const canManage = data?.canManage ?? false;
  const tree = data && 'tree' in data ? data.tree : [];
  const deleted = data && 'folders' in data ? data.folders : [];

  const remove = useMutation({
    mutationFn: (id: string) => deleteFolder(projectId!, id),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'Folder deleted', severity: 'success' });
    },
    onError,
  });
  const restore = useMutation({
    mutationFn: (id: string) => restoreFolder(projectId!, id),
    onSuccess: () => {
      invalidate();
      setToast({ msg: 'Folder restored', severity: 'success' });
    },
    onError,
  });
  const busy = remove.isPending || restore.isPending;

  function renderNode(node: FolderNode) {
    return (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
            <Typography component="span">📁 {node.name}</Typography>
            {canManage && (
              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                <Button size="small" onClick={() => setCreateUnder({ parentId: node.id })}>
                  Add
                </Button>
                <Button size="small" onClick={() => setRenameTarget(node)}>
                  Rename
                </Button>
                <Button size="small" onClick={() => setMoveTarget(node)}>
                  Move
                </Button>
                <Button size="small" color="error" onClick={() => setConfirmDelete(node)}>
                  Delete
                </Button>
              </Stack>
            )}
          </Stack>
        }
      >
        {node.children.map(renderNode)}
      </TreeItem>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Box>
          <Button size="small" component={RouterLink} to="/admin/projects" sx={{ mb: 0.5 }}>
            ← Projects
          </Button>
          <Typography variant="h5" fontWeight={700}>
            Folders
          </Typography>
        </Box>
        {canManage && filter === 'ACTIVE' && (
          <Button variant="contained" onClick={() => setCreateUnder({ parentId: null })}>
            New folder
          </Button>
        )}
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
            {getApiErrorMessage(error, 'Failed to load folders')}
          </Alert>
        ) : filter === 'ACTIVE' ? (
          tree.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No folders yet.{canManage ? ' Create one to get started.' : ''}
              </Typography>
            </Box>
          ) : (
            <SimpleTreeView slots={{ expandIcon: ExpandIcon, collapseIcon: CollapseIcon }} sx={{ p: 2 }}>
              {tree.map(renderNode)}
            </SimpleTreeView>
          )
        ) : deleted.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No deleted folders.</Typography>
          </Box>
        ) : (
          <Stack sx={{ p: 2 }} spacing={1}>
            {deleted.map((f) => (
              <Stack
                key={f.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 1 }}
              >
                <Typography component="span" color="text.secondary">
                  🗑 {f.name}
                </Typography>
                {canManage && (
                  <Button size="small" disabled={busy} onClick={() => restore.mutate(f.id)}>
                    Restore
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      {createUnder && (
        <NameDialog
          title={createUnder.parentId ? 'New subfolder' : 'New folder'}
          submitLabel="Create"
          onClose={() => setCreateUnder(null)}
          onSubmit={(name) => createFolder(projectId!, { name, parentId: createUnder.parentId })}
          onSaved={() => {
            invalidate();
            setCreateUnder(null);
            setToast({ msg: 'Folder created', severity: 'success' });
          }}
          onError={onError}
        />
      )}

      {renameTarget && (
        <NameDialog
          title="Rename folder"
          submitLabel="Save"
          defaultValue={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onSubmit={(name) => renameFolder(projectId!, renameTarget.id, name)}
          onSaved={() => {
            invalidate();
            setRenameTarget(null);
            setToast({ msg: 'Folder renamed', severity: 'success' });
          }}
          onError={onError}
        />
      )}

      {moveTarget && (
        <MoveDialog
          folder={moveTarget}
          options={flatten(tree, moveTarget.id)}
          onClose={() => setMoveTarget(null)}
          onSubmit={(parentId) => moveFolder(projectId!, moveTarget.id, parentId)}
          onSaved={() => {
            invalidate();
            setMoveTarget(null);
            setToast({ msg: 'Folder moved', severity: 'success' });
          }}
          onError={onError}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        {confirmDelete && (
          <>
            <DialogTitle>Delete folder</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Delete {confirmDelete.name}? Any subfolders are deleted too. They move to the
                Deleted tab and can be restored.
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

/** Shared create/rename dialog (single text field + zod validation). */
function NameDialog({
  title,
  submitLabel,
  defaultValue = '',
  onClose,
  onSubmit,
  onSaved,
  onError,
}: {
  title: string;
  submitLabel: string;
  defaultValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown>;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameForm>({ resolver: zodResolver(nameSchema), defaultValues: { name: defaultValue } });

  const mutation = useMutation({
    mutationFn: (values: NameForm) => onSubmit(values.name),
    onSuccess: onSaved,
    onError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** Move dialog: pick a new parent (or root) from the flattened tree. */
function MoveDialog({
  folder,
  options,
  onClose,
  onSubmit,
  onSaved,
  onError,
}: {
  folder: FolderNode;
  options: { id: string; name: string; depth: number }[];
  onClose: () => void;
  onSubmit: (parentId: string | null) => Promise<unknown>;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const [parentId, setParentId] = useState<string>(folder.parentId ?? '');

  const mutation = useMutation({
    mutationFn: () => onSubmit(parentId === '' ? null : parentId),
    onSuccess: onSaved,
    onError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Move {folder.name}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="dense">
          <InputLabel id="move-parent">New parent</InputLabel>
          <Select
            labelId="move-parent"
            label="New parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <MenuItem value="">(Root)</MenuItem>
            {options.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {' '.repeat(o.depth * 2)}
                {o.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
}
