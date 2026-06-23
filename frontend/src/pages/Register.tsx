import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { z } from 'zod';
import { registerRequest } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { AuthShell } from './Login';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});
type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: () => setSubmitted(true),
    onError: (err) => setFormError(getApiErrorMessage(err, 'Unable to register')),
  });

  if (submitted) {
    return (
      <AuthShell title="Registration submitted">
        <Alert severity="success">
          Your account has been created and is awaiting administrator approval. You will be able to
          sign in once an admin activates it.
        </Alert>
        <Typography variant="body2" textAlign="center" mt={3}>
          <Link component={RouterLink} to="/login">
            Back to sign in
          </Link>
        </Typography>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <Box
        component="form"
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
        noValidate
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Full name"
            fullWidth
            autoComplete="name"
            error={!!errors.name}
            helperText={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            autoComplete="email"
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            autoComplete="new-password"
            error={!!errors.password}
            helperText={errors.password?.message ?? 'At least 8 characters'}
            {...register('password')}
          />
          <Button type="submit" variant="contained" size="large" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting…' : 'Register'}
          </Button>
          <Typography variant="body2" textAlign="center">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Sign in
            </Link>
          </Typography>
        </Stack>
      </Box>
    </AuthShell>
  );
}
