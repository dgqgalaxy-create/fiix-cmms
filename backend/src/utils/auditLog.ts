import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

type AuditInput = {
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue | null;
};

/** Registra un evento de auditoría sin tumbar la operación principal si falla. */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: input.userId || null,
        user_name: input.userName || null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId || null,
        summary: input.summary.slice(0, 800),
        ...(input.meta != null ? { meta: input.meta } : {}),
      },
    });
  } catch (err) {
    console.error('AuditLog write failed:', err);
  }
}
