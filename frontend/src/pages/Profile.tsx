import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getApiErrorMessage } from '../api/client';
import { updateProfile, type UpdateProfilePayload } from '../api/profile';
import { useAuth } from '../features/auth/AuthContext';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  avatarName: z.string().trim().max(100, 'Avatar name is too long'),
  avatarDescription: z.string().trim().max(500, 'Avatar description is too long'),
});
type ProfileForm = z.infer<typeof profileSchema>;

// Downscale + compress a picked image to a data URL before sending it to the API.
const MAX_DIMENSION = 256;

function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the image'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  // Newly picked image (data URL) waiting to be saved; null means "no change".
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      avatarName: user?.avatarName ?? '',
      avatarDescription: user?.avatarDescription ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (updated) => {
      updateUser(updated);
      setPendingAvatar(null);
      setToast({ msg: 'Profile saved', severity: 'success' });
    },
    onError: (err) => setFormError(getApiErrorMessage(err, 'Unable to save profile')),
  });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please choose an image file');
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setPendingAvatar(dataUrl);
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not load that image');
    }
  }

  const previewSrc = pendingAvatar ?? user?.avatarUrl ?? undefined;

  return (
    <Paper sx={{ p: 4, maxWidth: 640, mx: 'auto' }} elevation={2}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        My Profile
      </Typography>

      {/* Role is assigned by an administrator — shown here read-only. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Typography color="text.secondary">Role:</Typography>
        <Chip
          label={user?.globalRole}
          color={user?.globalRole === 'SUPER_ADMIN' ? 'primary' : 'default'}
          size="small"
        />
        <Chip label={user?.status} color="success" size="small" variant="outlined" />
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box
        component="form"
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          const payload: UpdateProfilePayload = { ...values };
          if (pendingAvatar) payload.avatar = pendingAvatar;
          mutation.mutate(payload);
        })}
        noValidate
      >
        <Stack spacing={3}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar src={previewSrc} sx={{ width: 96, height: 96 }}>
              {user?.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
                Upload image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onPickFile}
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                PNG, JPG, GIF or WEBP. Resized automatically.
              </Typography>
            </Box>
          </Box>

          <TextField
            label="Name"
            fullWidth
            error={!!errors.name}
            helperText={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label="Avatar name"
            fullWidth
            error={!!errors.avatarName}
            helperText={errors.avatarName?.message ?? 'A short label for your image'}
            {...register('avatarName')}
          />
          <TextField
            label="Avatar description"
            fullWidth
            multiline
            minRows={2}
            error={!!errors.avatarDescription}
            helperText={errors.avatarDescription?.message ?? 'Describe your image (optional)'}
            {...register('avatarDescription')}
          />

          {user?.avatarRef && (
            <Typography variant="caption" color="text.secondary">
              Avatar ref: {user.avatarRef}
            </Typography>
          )}

          <Box>
            <Button type="submit" variant="contained" size="large" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </Box>
        </Stack>
      </Box>

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
    </Paper>
  );
}
