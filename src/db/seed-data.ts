import { createHash } from "node:crypto";

/**
 * Catálogos inventados y generadores deterministas para `seed-demo.ts`.
 *
 * NADA de lo que hay aquí sale de la base de datos del club: los nombres, los
 * DNI, los IBAN, las empresas y las direcciones son inventados. De producción
 * solo se ha copiado la *forma* de los datos (cuántas personas por equipo, qué
 * niveles de patrocinio, en qué rango se mueven los importes), nunca el
 * contenido.
 *
 * Todo es determinista a propósito — ni un `Math.random`. El seed se corre
 * muchas veces sobre la misma base compartida (`areto-dev`), así que la misma
 * clave tiene que dar siempre la misma fila.
 */

// ---------------------------------------------------------------------------
// Identificadores
// ---------------------------------------------------------------------------

/**
 * Namespace fijo del seed (un UUID cualquiera, generado una vez y congelado
 * aquí). Cambiarlo hace que todas las filas pasen a tener ids nuevos, así que
 * el `--reset` de un seed viejo ya no las reconocería: no se toca.
 */
const SEED_NAMESPACE = "5f3a91c4-7d28-4e6b-9a10-2c8bd4e7f036";

const NAMESPACE_BYTES = Buffer.from(SEED_NAMESPACE.replace(/-/g, ""), "hex");

/**
 * UUID v5 (SHA-1) del namespace del seed más una clave estable
 * (`"person:jugador-12"`). Que el id salga del contenido y no del azar es lo
 * que permite reinsertar con `onConflictDoUpdate` sin duplicar, y borrar
 * exactamente las filas del seed sin tocar ninguna otra.
 */
export function seedId(key: string): string {
  const digest = createHash("sha1")
    .update(NAMESPACE_BYTES)
    .update(key, "utf8")
    .digest();

  digest[6] = (digest[6] & 0x0f) | 0x50; // versión 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = digest.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

// ---------------------------------------------------------------------------
// Documentos y cuentas (inventados, pero bien formados)
// ---------------------------------------------------------------------------

const CHECK_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/**
 * DNI inventado con la letra de control correcta: `isValidNationalId`
 * (`src/lib/national-id.ts`) comprueba el dígito de control, así que un número
 * al azar saldría marcado como errata en la ficha. El paso 7919 es primo y
 * reparte los números por todo el rango sin repetir.
 */
export function nationalId(n: number): string {
  const digits = 10_000_000 + ((n * 7919) % 80_000_000);
  return `${digits}${CHECK_LETTERS[digits % 23]}`;
}

/**
 * Códigos de entidad reconocidos por `src/lib/bank.ts`, para que la ficha
 * muestre también el nombre del banco y no solo el número de cuenta.
 */
const BANK_ENTITY_CODES = ["3035", "2095", "2100", "0182", "1465"];

/** Dígitos de control ISO 7064 MOD 97-10 de un IBAN español. */
function ibanCheckDigits(bban: string): string {
  const rearranged = `${bban}ES00`;
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const remainder = Number(BigInt(numeric) % BigInt(97));
  return String(98 - remainder).padStart(2, "0");
}

/**
 * IBAN español inventado que supera el control de `isValidIban`
 * (`src/lib/iban.ts`), que es lo que exige el formulario de domiciliación.
 * La oficina es siempre `0001` y la cuenta empieza por `99`: cuentas que no
 * se emiten, para que el número no pueda coincidir con el de nadie.
 */
export function iban(n: number): string {
  const entity = BANK_ENTITY_CODES[n % BANK_ENTITY_CODES.length];
  const account = String(99_00_000_000 + ((n * 5077) % 99_999_999)).padStart(10, "0");
  const bban = `${entity}0001${String(n % 100).padStart(2, "0")}${account}`;
  return `ES${ibanCheckDigits(bban)}${bban}`;
}

/** Móvil inventado, en el formato agrupado que teclea la secretaría. */
export function phone(n: number): string {
  const digits = String(600_000_000 + ((n * 3121) % 99_999_999));
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/** Quita acentos y deja un texto apto para la parte local de un email. */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Reparte emails sobre el TLD reservado `.test`, que por definición no resuelve
 * — así ni un envío accidental desde la app llega a un buzón real.
 * `persons_email_idx` es único, así que el segundo "ane.zabaleta" se numera.
 */
export function makeEmailAllocator(): (firstName: string, lastName: string) => string {
  const taken = new Set<string>();
  return (firstName, lastName) => {
    const base = `${slug(firstName)}.${slug(lastName.split(" ")[0])}`;
    let candidate = base;
    let suffix = 2;
    while (taken.has(candidate)) candidate = `${base}${suffix++}`;
    taken.add(candidate);
    return `${candidate}@example.test`;
  };
}

// ---------------------------------------------------------------------------
// Nombres (inventados: los pools se combinan por índice, no copian a nadie)
// ---------------------------------------------------------------------------

const MALE_GIVEN_NAMES = [
  "Unai", "Iker", "Aitor", "Julen", "Markel", "Xabier", "Eneko", "Beñat",
  "Ander", "Oier", "Jokin", "Asier", "Gorka", "Ibai", "Peru", "Danel",
  "Aimar", "Haritz", "Egoitz", "Iñigo",
];

const FEMALE_GIVEN_NAMES = [
  "Ane", "Nerea", "Maddi", "Irati", "Leire", "Uxue", "June", "Nahia",
  "Enara", "Amaia", "Garazi", "Oihana", "Lide", "Malen", "Izaro", "Ainhoa",
  "Miren", "Olatz", "Nagore", "Saioa",
];

const SURNAMES = [
  "Agirre", "Zabaleta", "Etxeberria", "Urbieta", "Larrañaga", "Goikoetxea",
  "Bidaurreta", "Elorza", "Arregi", "Mendizabal", "Otaegi", "Lasa",
  "Iturbe", "Zubizarreta", "Odriozola", "Aranburu", "Garmendia", "Uribarren",
  "Bereziartua", "Altuna", "Egaña", "Loiola", "Zumeta", "Barrena",
  "Kortabarria", "Untzueta", "Igartua", "Murgiondo", "Olabarria", "Txurruka",
];

export type SeedGender = "male" | "female";

/**
 * Nombre y dos apellidos a partir de un índice.
 *
 * Los tres índices avanzan con periodos distintos y primos entre sí (20 nombres,
 * 30 primeros apellidos, 29 segundos) para que la terna no se repita hasta la
 * persona 1.740: con pasos sobre el mismo módulo, el nombre completo volvía a
 * salir cada 60 fichas y `/personas/duplicados` se llenaba de falsos positivos.
 */
export function personName(n: number, gender: SeedGender): {
  firstName: string;
  lastName: string;
} {
  const given = gender === "male" ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES;
  const first = (n * 7) % SURNAMES.length;
  let second = (n * 13 + 5) % (SURNAMES.length - 1);
  if (second === first) second = (second + 1) % SURNAMES.length;
  return {
    firstName: given[n % given.length],
    lastName: `${SURNAMES[first]} ${SURNAMES[second]}`,
  };
}

// ---------------------------------------------------------------------------
// Domicilios
// ---------------------------------------------------------------------------

const STREETS = [
  "Kale Zaharra", "Kale Barria", "Olakua", "San Lorentzo", "Errekalde",
  "Bidebarrieta", "Torre Auzoa", "Zubillaga", "Garibai", "Atzeko Kalea",
];

/** Reparto de municipios calcado del de producción: casi todo el club es local. */
const CITIES = ["Oñati", "Oñati", "Oñati", "Oñati", "Eskoriatza", "Arrasate"];

export function address(n: number): string {
  return `${STREETS[(n * 3) % STREETS.length]} ${1 + (n % 40)}, ${1 + (n % 4)}. ezk.`;
}

export function city(n: number): string {
  return CITIES[n % CITIES.length];
}

/** CP del municipio que le toca a `city(n)`: los tres del reparto tienen uno
 * solo, igual que en produccion. */
const POSTAL_CODES: Record<string, string> = {
  "Oñati": "20560",
  Eskoriatza: "20540",
  Arrasate: "20500",
};

export function postalCode(n: number): string {
  return POSTAL_CODES[city(n)];
}

// ---------------------------------------------------------------------------
// Patrocinadores y rivales (comercios y clubes inventados)
// ---------------------------------------------------------------------------

export type SeedSponsor = {
  key: string;
  name: string;
  fiscalName: string;
  activity: string;
};

export const SPONSOR_BUSINESSES: readonly SeedSponsor[] = [
  { key: "harategia", name: "Harategia Bidaurreta", fiscalName: "Bidaurreta Harategia, S.L.", activity: "Carnicería" },
  { key: "okindegia", name: "Okindegi Zubieta", fiscalName: "Zubieta Okindegia, S.L.", activity: "Panadería" },
  { key: "kixkur", name: "Taberna Kixkur", fiscalName: "Kixkur Ostalaritza, S.L.", activity: "Hostelería" },
  { key: "olalde", name: "Elektrizitatea Olalde", fiscalName: "Instalaciones Olalde, S.L.", activity: "Instalaciones eléctricas" },
  { key: "iturralde", name: "Garaje Iturralde", fiscalName: "Talleres Iturralde, S.L.", activity: "Taller mecánico" },
  { key: "mendiola", name: "Aseguruak Mendiola", fiscalName: "Correduría Mendiola, S.L.", activity: "Seguros" },
  { key: "oinkari", name: "Kirol Denda Oinkari", fiscalName: "Oinkari Kirolak, S.L.", activity: "Tienda de deporte" },
  { key: "larrea", name: "Optika Larrea", fiscalName: "Óptica Larrea, S.L.", activity: "Óptica" },
  { key: "xarma", name: "Ileapaindegia Xarma", fiscalName: "Xarma Estetika, S.L.", activity: "Peluquería" },
  { key: "errotari", name: "Errotari Altzariak", fiscalName: "Errotari Muebles, S.L.", activity: "Muebles" },
  { key: "beitia", name: "Igeltserotza Beitia", fiscalName: "Construcciones Beitia, S.L.", activity: "Albañilería" },
  { key: "zeharbide", name: "Informatika Zeharbide", fiscalName: "Zeharbide Sistemas, S.L.", activity: "Informática" },
  { key: "loretoki", name: "Loradenda Lore Toki", fiscalName: "Lore Toki, S.L.", activity: "Floristería" },
  { key: "plazaberri", name: "Kafetegia Plaza Berri", fiscalName: "Plaza Berri Kafetegia, S.L.", activity: "Cafetería" },
];

/** CIF inventado. Nada en la app valida su carácter de control. */
export function taxId(n: number): string {
  return `B${String(20_000_000 + ((n * 4441) % 79_999_999)).padStart(8, "0")}`;
}

/** Clubes rivales inventados, de pueblos de la comarca. */
export const OPPONENTS = [
  "Arrasate Futsal", "Bergarako KE", "Eskoriatza FS", "Antzuola Areto",
  "Elgoibar Futsal", "Zumarraga FS", "Legazpi Areto", "Azkoitia FS",
  "Beasain Futsal", "Ordizia Areto", "Tolosa FS", "Urretxu Futsal",
  "Deba FS", "Soraluze Areto", "Oiartzun Futsal",
];

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** Fecha en el `YYYY-MM-DD` que guardan las columnas `date` de Postgres. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` a `days` días de `base` (negativo hacia atrás). */
export function shiftDays(base: Date, days: number): string {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return isoDate(result);
}
