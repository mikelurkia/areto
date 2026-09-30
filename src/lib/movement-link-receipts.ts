import "server-only";

import { paymentReceiptBucket, type Ledger } from "@/lib/economia";
import { extensionFromMimeType, removeFile, uploadFile } from "@/lib/supabase/storage";

/**
 * Justificante de pago de un enlace (`movementLinks`): compartido por las
 * tres formas de conciliar (factura recibida, emitida y remesa).
 *
 * Vive fuera de los ficheros `"use server"` a propósito: allí cada export es
 * un endpoint que cualquiera puede invocar, y estos helpers no comprueban
 * permisos (lo hacen las acciones que los llaman) y escriben en Storage con la
 * clave de servicio.
 */
export async function uploadLinkReceiptFile(ledger: Ledger, linkId: string, file: File) {
  const path = `${linkId}/receipt.${extensionFromMimeType(file.type)}`;
  await uploadFile(paymentReceiptBucket(ledger), path, file);
  return { path, name: file.name };
}

export async function removeLinkReceiptFileObject(ledger: Ledger, path: string) {
  await removeFile(paymentReceiptBucket(ledger), path);
}
