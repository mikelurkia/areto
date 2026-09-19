import type { AbstractIntlMessages } from "next-intl";

/**
 * Subconjunto de `messages` para un `NextIntlClientProvider` anidado: evita
 * mandar el fichero de mensajes completo (~140 KB) a rutas públicas que solo
 * usan un puñado de namespaces (ver auditoría de rendimiento, hallazgo C1).
 */
export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: string[],
): AbstractIntlMessages {
  return Object.fromEntries(
    namespaces
      .filter((namespace) => namespace in messages)
      .map((namespace) => [namespace, messages[namespace]]),
  );
}
