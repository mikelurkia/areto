import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { cacheLife } from "next/cache";

import { routing } from "./routing";

/**
 * Mensajes de un idioma. Cacheados con `use cache` porque son un fichero
 * estático: sin esto, cargarlos es un `await` sin cachear en el layout raíz y
 * con Cache Components bloquea el armazón estático de todas las rutas.
 */
async function loadMessages(locale: string) {
  "use cache";
  cacheLife("max");
  return (await import(`../../messages/${locale}.json`)).default;
}

/**
 * `requestLocale` sale de `setRequestLocale` si alguien ya lo ha fijado y, si no,
 * de la cabecera que pone el proxy. Ese fallback es la trampa: `generateMetadata`
 * se ejecuta *antes* de que el layout raíz llame a `setRequestLocale`, así que un
 * `getTranslations("...")` a secas ahí acaba leyendo cabeceras. Con Cache
 * Components eso contamina la configuración cacheada de toda la petición y Next
 * marca la ruta entera como bloqueante (`blocking-route`), señalando al
 * `NextIntlClientProvider` del layout raíz.
 *
 * Por eso todo `generateMetadata` recibe `params` y pasa el idioma explícito:
 * `getTranslations({ locale, namespace: "..." })`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
