import "server-only";

import { cache } from "react";
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { clubPaymentMethods } from "@/db/schema";

/** Lo que se pinta de una tarjeta. Sin `numberEncrypted`: la lista es un
 * componente cliente y el ciphertext no tiene por qué viajar al navegador. */
export type ClubPaymentMethodRow = {
  id: string;
  label: string;
  holderName: string | null;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  notes: string | null;
};

/**
 * Tarjetas del club para la pestaña "Pagos".
 *
 * `cache()` de React y NO `"use cache"`: el dato lo pide una sola vista, es de
 * escritura rarísima pero lectura restringida por permiso, y una caché
 * compartida entre peticiones es justo lo que no interesa aquí. El cómputo es
 * una query de tres filas.
 *
 * El `columns` excluye `numberEncrypted` a propósito: así el ciphertext ni
 * siquiera entra en el módulo de la página. Quien lo necesita es la acción de
 * revelado, que lo lee con su propia query por `id`.
 */
export const getClubPaymentMethods = cache(async function getClubPaymentMethods(): Promise<
  ClubPaymentMethodRow[]
> {
  return db.query.clubPaymentMethods.findMany({
    columns: {
      id: true,
      label: true,
      holderName: true,
      last4: true,
      expiryMonth: true,
      expiryYear: true,
      notes: true,
    },
    orderBy: [asc(clubPaymentMethods.label)],
  });
});
