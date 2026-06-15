/**
 * OpenAPI 3.0 specification for the KmmRepo API.
 *
 * Defined as a typed object (rather than scanned from JSDoc globs) so it is
 * type-checked and behaves identically under `tsx` (dev) and compiled `dist`
 * (prod). Extend `paths` and `components.schemas` as new endpoints land.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'KmmRepo API',
    version: '0.1.0',
    description:
      'Self-hosted, role-based test repository management API.\n\n' +
      'Authentication uses a short-lived JWT **access token** (sent as ' +
      '`Authorization: Bearer <token>`) plus a rotating **refresh token** ' +
      'delivered in an httpOnly cookie. Registration creates a `PENDING` ' +
      'account; only `ACTIVE` users can log in.',
  },
  servers: [{ url: '/api/v1', description: 'Default base path' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, and session management' },
    { name: 'Admin', description: 'Super-admin user management (requires SUPER_ADMIN)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by POST /auth/login.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'BAD_REQUEST' },
              message: { type: 'string', example: 'Validation failed' },
              fields: {
                type: 'object',
                additionalProperties: { type: 'array', items: { type: 'string' } },
                example: { email: ['Enter a valid email'] },
              },
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cmqf42p670000100y3yhu0zf3' },
          name: { type: 'string', example: 'Super Admin' },
          email: { type: 'string', format: 'email', example: 'admin@kmmrepo.local' },
          status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'DISABLED'] },
          globalRole: { type: 'string', enum: ['SUPER_ADMIN', 'USER'] },
        },
        required: ['id', 'name', 'email', 'status', 'globalRole'],
      },
      RegisterRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100, example: 'Test Tester' },
          email: { type: 'string', format: 'email', example: 'tester@example.com' },
          password: { type: 'string', minLength: 8, maxLength: 128, example: 'Password123' },
        },
        required: ['name', 'email', 'password'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@kmmrepo.local' },
          password: { type: 'string', example: 'ChangeMe!123' },
        },
        required: ['email', 'password'],
      },
      RegisterResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Registration submitted. An administrator will approve your account.',
          },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
        required: ['message', 'user'],
      },
      SessionResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/AuthUser' },
          accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
        required: ['user', 'accessToken'],
      },
      AdminUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'DISABLED'] },
          globalRole: { type: 'string', enum: ['SUPER_ADMIN', 'USER'] },
          isDeleted: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'email', 'status', 'globalRole', 'isDeleted', 'createdAt'],
      },
      UsersListResponse: {
        type: 'object',
        properties: {
          users: { type: 'array', items: { $ref: '#/components/schemas/AdminUser' } },
        },
        required: ['users'],
      },
      AdminUserResponse: {
        type: 'object',
        properties: { user: { $ref: '#/components/schemas/AdminUser' } },
        required: ['user'],
      },
      UserStatusUpdate: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] } },
        required: ['status'],
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Auth'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'Service is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new account (created as PENDING)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Account created and awaiting approval',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/RegisterResponse' } },
            },
          },
          '400': {
            description: 'Validation failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '409': {
            description: 'Email already registered',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in (ACTIVE users only)',
        description:
          'On success, returns an access token in the body and sets a rotating ' +
          'refresh token in an httpOnly `refreshToken` cookie.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated',
            headers: {
              'Set-Cookie': {
                description: 'httpOnly refresh token cookie',
                schema: { type: 'string', example: 'refreshToken=...; HttpOnly; Path=/api/v1/auth' },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SessionResponse' } },
            },
          },
          '401': {
            description: 'Invalid email or password',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '403': {
            description: 'Account is PENDING or DISABLED',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh token and obtain a new access token',
        description: 'Requires the httpOnly `refreshToken` cookie. The presented token is rotated (invalidated) and a new pair is issued.',
        security: [],
        responses: {
          '200': {
            description: 'New access token issued',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SessionResponse' } },
            },
          },
          '401': {
            description: 'Missing, invalid, expired, or already-rotated refresh token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out (revoke the refresh token)',
        security: [],
        responses: {
          '200': {
            description: 'Logged out; refresh cookie cleared',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string', example: 'Logged out' } },
                },
              },
            },
          },
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users (super-admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['PENDING', 'ACTIVE', 'DISABLED'] },
            description: 'Filter by account status',
          },
          {
            name: 'deleted',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['true', 'false'] },
            description: 'When true, returns soft-deleted users instead of active ones',
          },
        ],
        responses: {
          '200': {
            description: 'List of users',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UsersListResponse' } } },
          },
          '401': { description: 'Unauthenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Not a super-admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/admin/users/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Approve / reject / activate / deactivate a user',
        description: 'Sets status to ACTIVE (approve/activate) or DISABLED (reject/deactivate). Disabling also revokes the user’s refresh tokens. SUPER_ADMIN targets are protected.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserStatusUpdate' } } },
        },
        responses: {
          '200': { description: 'Updated user', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminUserResponse' } } } },
          '400': { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '403': { description: 'Not a super-admin, or target is a protected super-admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Soft-delete a user',
        description: 'Marks the user as deleted (recoverable). SUPER_ADMIN targets are protected.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Soft-deleted user', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminUserResponse' } } } },
          '403': { description: 'Not a super-admin, or target is a protected super-admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/admin/users/{id}/restore': {
      post: {
        tags: ['Admin'],
        summary: 'Restore a soft-deleted user',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Restored user', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminUserResponse' } } } },
          '403': { description: 'Not a super-admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
} as const;
