import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  Link as MuiLink,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
  type FolderNode,
} from '../api/folders';

const ROOT = '__root__';
type Toast = { msg: string; severity: 'success' | 'error' };
type ContextMenu = { folder: FolderNode; x: number; y: number } | null;

const ExpandIcon = () => <Box component="span">▸</Box>;
const CollapseIcon = () => <Box component="span">▾</Box>;

const nameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
});
type NameForm = z.infer<typeof nameSchema>;

interface TreeIndex {
  byId: Map<string, FolderNode>;
  parentOf: Map<string, string | null>;
}

function indexTree(tree: FolderNode[]): TreeIndex {
  const byId = new Map<string, FolderNode>();
  const parentOf = new Map<string, string | null>();
  const walk = (nodes: FolderNode[], parent: string | null) => {
    for (const n of nodes) {
      byId.set(n.id, n);
      parentOf.set(n.id, parent);
      walk(n.children, n.id);
    }
  };
  walk(tree, null);
  return { byId, parentOf };
}

/** Flattens the tree to `{ id, name, depth }`, optionally excluding a subtree. */
function flatten(nodes: FolderNode[], excludeId?: string, depth = 0): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    out.push({ id: n.id, name: n.name, depth });
    out.push(...flatten(n.children, excludeId, depth + 1));
  }
  return out;
}

export default function Folders() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'REPO' | 'DELETED'>('REPO');
  const [selectedId, setSelectedId] = useState<string>(ROOT);
  const [expanded, setExpanded] = useState<string[]>([ROOT]);
  const [menu, setMenu] = useState<ContextMenu>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const [createUnder, setCreateUnder] = useState<{ parentId: string | null } | null>(null);
  const [renameTarget, setRenameTarget] = useState<FolderNode | null>(null);
  const [moveTarget, setMoveTarget] = useState<FolderNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FolderNode | null>(null);

  const onError = (err: unknown) => setToast({ msg: getApiErrorMessage(err), severity: 'error' });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['folders', projectId] });

  const { data: active, isLoading, isError, error } = useQuery({
    queryKey: ['folders', projectId, 'tree'],
    queryFn: () => listFolderTree(projectId!),
    enabled: !!projectId,
  });
  const { data: deletedData } = useQuery({
    queryKey: ['folders', projectId, 'deleted'],
    queryFn: () => listDeletedFolders(projectId!),
    enabled: !!projectId && view === 'DELETED',
  });

  const tree = active?.tree ?? [];
  const canManage = active?.canManage ?? false;
  const { byId, parentOf } = useMemo(() => indexTree(tree), [tree]);

  // The selected folder (null when the virtual repository root is selected).
  const selectedFolder = selectedId === ROOT ? null : byId.get(selectedId) ?? null;

  // Breadcrumb path from the repository root to the selected folder.
  const path = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    let cur: string | null = selectedFolder?.id ?? null;
    while (cur) {
      const node = byId.get(cur);
      if (!node) break;
      out.unshift({ id: node.id, name: node.name });
      cur = parentOf.get(cur) ?? null;
    }
    return out;
  }, [selectedFolder, byId, parentOf]);

  // Contents of the selected node (children of a folder, or the roots for the repository).
  const contents = selectedId === ROOT ? tree : selectedFolder?.children ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => deleteFolder(projectId!, id),
    onSuccess: () => {
      invalidate();
      if (selectedFolder && confirmDelete?.id === selectedId) setSelectedId(ROOT);
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
          <Box
            onContextMenu={(e) => {
              if (!canManage) return;
              e.preventDefault();
              e.stopPropagation();
              setMenu({ folder: node, x: e.clientX, y: e.clientY });
            }}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, pr: 1 }}
          >
            <Typography component="span" noWrap>
              📁 {node.name}
            </Typography>
            {node.children.length > 0 && (
              <Chip size="small" label={node.children.length} variant="outlined" sx={{ ml: 1, height: 20 }} />
            )}
          </Box>
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
            Test Repository
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_e, v) => v && setView(v)}
        >
          <ToggleButton value="REPO">Repository</ToggleButton>
          <ToggleButton value="DELETED">Deleted</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">{getApiErrorMessage(error, 'Failed to load folders')}</Alert>
      ) : view === 'DELETED' ? (
        <DeletedPanel
          folders={deletedData?.folders ?? []}
          canManage={canManage}
          busy={busy}
          onRestore={(id) => restore.mutate(id)}
        />
      ) : (
        <Paper variant="outlined" sx={{ display: 'flex', minHeight: 420, overflow: 'hidden' }}>
          {/* Left: folder tree */}
          <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
            <Toolbar
              canManage={canManage}
              selectedFolder={selectedFolder}
              onNew={() => setCreateUnder({ parentId: selectedFolder?.id ?? null })}
              onRename={() => selectedFolder && setRenameTarget(selectedFolder)}
              onMove={() => selectedFolder && setMoveTarget(selectedFolder)}
              onDelete={() => selectedFolder && setConfirmDelete(selectedFolder)}
            />
            <Divider />
            <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              <SimpleTreeView
                slots={{ expandIcon: ExpandIcon, collapseIcon: CollapseIcon }}
                selectedItems={selectedId}
                onSelectedItemsChange={(_e, id) => id && setSelectedId(id)}
                expandedItems={expanded}
                onExpandedItemsChange={(_e, ids) => setExpanded(ids)}
              >
                <TreeItem
                  itemId={ROOT}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, pr: 1 }}>
                      <Typography component="span" fontWeight={600} noWrap>
                        📦 Test Repository
                      </Typography>
                      {tree.length > 0 && (
                        <Chip size="small" label={tree.length} variant="outlined" sx={{ ml: 1, height: 20 }} />
                      )}
                    </Box>
                  }
                >
                  {tree.map(renderNode)}
                </TreeItem>
              </SimpleTreeView>
            </Box>
          </Box>

          {/* Right: selected-folder contents */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Breadcrumbs aria-label="folder path">
                <MuiLink
                  component="button"
                  underline="hover"
                  color="inherit"
                  onClick={() => setSelectedId(ROOT)}
                >
                  Test Repository
                </MuiLink>
                {path.map((p, i) => (
                  <MuiLink
                    key={p.id}
                    component="button"
                    underline="hover"
                    color={i === path.length - 1 ? 'text.primary' : 'inherit'}
                    onClick={() => setSelectedId(p.id)}
                  >
                    {p.name}
                  </MuiLink>
                ))}
              </Breadcrumbs>
            </Box>

            {contents.length === 0 ? (
              <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No subfolders here.
                  {canManage ? ' Use “New folder” to add one.' : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Test cases will appear here in Phase 3.
                </Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Subfolders</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contents.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedId(c.id);
                        setExpanded((e) => (e.includes(c.id) ? e : [...e, c.id]));
                      }}
                    >
                      <TableCell>📁 {c.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>Folder</TableCell>
                      <TableCell align="right">{c.children.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </Paper>
      )}

      {/* Right-click context menu */}
      <Menu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      >
        <MenuItem
          onClick={() => {
            setCreateUnder({ parentId: menu!.folder.id });
            setMenu(null);
          }}
        >
          Add subfolder
        </MenuItem>
        <MenuItem
          onClick={() => {
            setRenameTarget(menu!.folder);
            setMenu(null);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMoveTarget(menu!.folder);
            setMenu(null);
          }}
        >
          Move
        </MenuItem>
        <Divider />
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setConfirmDelete(menu!.folder);
            setMenu(null);
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      {createUnder && (
        <NameDialog
          title={createUnder.parentId ? 'New subfolder' : 'New folder'}
          submitLabel="Create"
          onClose={() => setCreateUnder(null)}
          onSubmit={(name) => createFolder(projectId!, { name, parentId: createUnder.parentId })}
          onSaved={() => {
            invalidate();
            if (createUnder.parentId) {
              setExpanded((e) => (e.includes(createUnder.parentId!) ? e : [...e, createUnder.parentId!]));
            }
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
                Deleted view and can be restored.
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

function Toolbar({
  canManage,
  selectedFolder,
  onNew,
  onRename,
  onMove,
  onDelete,
}: {
  canManage: boolean;
  selectedFolder: FolderNode | null;
  onNew: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  if (!canManage) {
    return (
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Read-only access
        </Typography>
      </Box>
    );
  }
  const hasSelection = !!selectedFolder;
  return (
    <Stack direction="row" spacing={0.5} sx={{ p: 1 }} flexWrap="wrap">
      <Button size="small" variant="contained" onClick={onNew}>
        {hasSelection ? '+ Subfolder' : '+ Folder'}
      </Button>
      <Button size="small" disabled={!hasSelection} onClick={onRename}>
        Rename
      </Button>
      <Button size="small" disabled={!hasSelection} onClick={onMove}>
        Move
      </Button>
      <Button size="small" color="error" disabled={!hasSelection} onClick={onDelete}>
        Delete
      </Button>
    </Stack>
  );
}

function DeletedPanel({
  folders,
  canManage,
  busy,
  onRestore,
}: {
  folders: { id: string; name: string }[];
  canManage: boolean;
  busy: boolean;
  onRestore: (id: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {folders.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No deleted folders.</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {folders.map((f) => (
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
                <Button size="small" disabled={busy} onClick={() => onRestore(f.id)}>
                  Restore
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
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
            <MenuItem value="">(Repository root)</MenuItem>
            {options.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {'  '.repeat(o.depth)}
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
