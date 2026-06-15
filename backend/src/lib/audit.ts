/**
 * Lightweight audit logging for Phase 1 slice 1.
 * Emits structured JSON to stdout. The full persisted `AuditLog` table arrives
 * with the audit-logging task later in Phase 1 (see docs/DEVELOPMENT_GUIDE.md §7).
 */
export function audit(
  action: string,
  entity: { type: string; id?: string },
  meta?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      level: 'audit',
      action,
      entityType: entity.type,
      entityId: entity.id,
      ...meta,
      at: new Date().toISOString(),
    }),
  );
}
