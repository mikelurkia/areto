"use client";

import { useEffect, useState } from "react";

/**
 * Emails de la selección para el envío masivo con copia oculta (BCC). Se
 * piden al servidor porque la selección sobrevive al cambio de página, así
 * que puede incluir filas que ya no están cargadas en el listado.
 */
export function useBulkEmailHref(
  selectedIds: Set<string>,
  fetchEmails: (ids: string[]) => Promise<string[]>,
) {
  const [fetchedEmails, setFetchedEmails] = useState<string[]>([]);
  useEffect(() => {
    if (selectedIds.size === 0) return;
    let cancelled = false;
    fetchEmails([...selectedIds]).then((emails) => {
      if (!cancelled) setFetchedEmails(emails);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIds, fetchEmails]);
  // Sin selección la lista se vacía por derivación, no con un `setState` en el
  // cuerpo del efecto (renders en cascada, y lo prohíbe el lint).
  const bulkEmails = selectedIds.size === 0 ? [] : fetchedEmails;
  const bulkEmailHref = `mailto:?bcc=${encodeURIComponent(bulkEmails.join(","))}`;

  return { bulkEmails, bulkEmailHref };
}
