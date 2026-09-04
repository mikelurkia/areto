import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction = (typeof auditLog.$inferInsert)["action"];

export type AuditEntityType =
  | "person_medical_checkup"
  | "person_injury_report"
  | "person_banking"
  | "user"
  | "user_role"
  | "role_permissions"
  | "registration"
  | "sepa_mandate"
  | "sepa_charge"
  | "sepa_remittance"
  | "financial_account"
  | "account_movement"
  | "movement_import_batch"
  | "supplier"
  | "received_invoice"
  | "issued_invoice"
  | "sponsor_payment"
  | "movement_link";

type RecordAuditEventInput = {
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Deja constancia de una acción sensible (médico, bancario, usuarios/roles,
 * inscripciones). Un simple insert — sin esto repetido en cada Server Action,
 * y sin que un fallo aquí tumbe la acción que audita (se traga el error: la
 * mutación ya se hizo, perder la fila de auditoría no debe deshacerla).
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("[audit-log] no se pudo registrar el evento", input, error);
  }
}
