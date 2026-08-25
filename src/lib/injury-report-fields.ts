import { PDFDocument, PDFTextField } from "pdf-lib";

import type {
  personInjuryReports,
  persons,
  playerPosition,
  teamCategory,
  teamGender,
  teams,
} from "@/db/schema";
import type { ClubSettings } from "@/lib/club";
import { provinceFromPostalCode } from "@/lib/postal-code";

/**
 * Correspondencia entre los datos de un parte de lesión y las casillas del
 * impreso oficial de la Mutualidad de Previsión Social de Futbolistas Españoles
 * a Prima Fija (RFEF), más el relleno de la plantilla.
 *
 * Aquí no se sabe de dónde sale la plantilla: la recibe en bytes. De buscarla en
 * Storage se encarga `injury-report-pdf.ts`, y así esta mitad —que es la que
 * tiene toda la lógica— se puede ejercitar con un PDF de un fichero.
 *
 * La plantilla es el impreso escaneado con un AcroForm de 62 campos de texto
 * encima, subida por el club en Ajustes. Todos los
 * campos se llaman `TextN` sin ningún significado, así que la correspondencia
 * casilla ↔ campo es el mapa de más abajo. Se derivó dibujando el `/Rect` de
 * cada widget sobre el escaneo; si algún día cambia la plantilla hay que volver
 * a derivarlo, porque los nombres no dicen nada.
 *
 * Dos cosas del impreso explican la forma de este módulo:
 *
 * - Las casillas de opción NO son checkboxes: son campos de texto donde se
 *   escribe una `X`.
 * - La mitad de HISTORIA CLÍNICA (diagnóstico, lateralidad, baja, tratamiento,
 *   observaciones) no tiene ni un campo editable: ahí solo hay píxeles del
 *   escaneo. Sale en blanco a propósito, porque la rellena de su puño y letra
 *   el médico de la Mutualidad sobre el papel.
 */

type Report = typeof personInjuryReports.$inferSelect;
type PlayerPosition = (typeof playerPosition.enumValues)[number];
type TeamCategory = (typeof teamCategory.enumValues)[number];
type TeamGender = (typeof teamGender.enumValues)[number];

export type InjuryReportPdfInput = {
  report: Pick<
    Report,
    | "occurredOn"
    | "reportedOn"
    | "reportedPlace"
    | "place"
    | "placeOther"
    | "matchMinute"
    | "surface"
    | "collision"
    | "opponentTeam"
    | "relatedToPrevious"
    | "bootType"
    | "trainingSurface"
    | "weeklyTrainingMinutes"
  >;
  person: Pick<
    typeof persons.$inferSelect,
    | "firstName"
    | "lastName"
    | "nationalId"
    | "birthDate"
    | "address"
    | "city"
    | "postalCode"
    | "phone"
  >;
  /** Equipo del parte; `null` si el jugador no tenía ninguno al lesionarse. */
  team: Pick<typeof teams.$inferSelect, "name" | "category" | "gender"> | null;
  /** Puestos del jugador en ese equipo (`memberships.positions`). */
  positions: PlayerPosition[];
  club: Pick<
    ClubSettings,
    | "legalName"
    | "federationCode"
    | "federationDelegation"
    | "signatoryName"
    | "signatoryNationalId"
  > | null;
};

// --- Mapas de casilla de opción -> campo del AcroForm -----------------------

/** Fila "Licencia". Nadie va a PROFESIONAL (Text33): el club es aficionado. */
const LICENCE_FIELD: Record<TeamCategory, string> = {
  senior: "Text34", // AFICIONADO
  juvenil: "Text35",
  cadete: "Text36",
  infantil: "Text37",
  escuela: "Text38", // ALEVIN
};

/**
 * Fila "Puesto". El impreso viene del fútbol once y solo ofrece cuatro
 * demarcaciones, así que las de fútbol sala van a la equivalente.
 */
const POSITION_FIELD: Record<PlayerPosition, string> = {
  portero: "Text29", // PORTERO
  cierre: "Text30", // DEFENSA
  ala: "Text31", // MEDIO
  pivot: "Text32", // DELANTERO
};

const GENDER_FIELD: Record<TeamGender, string> = {
  masculino: "Text27",
  femenino: "Text28",
};

/** Fila "¿En qué superficie?" (la del día de la lesión). */
const SURFACE_FIELD = {
  natural: "Text58",
  artificial: "Text59",
  soil: "Text60",
  other: "Text61",
} as const;

/** Fila "Superficie de entrenamiento": mismas cuatro opciones, otras casillas. */
const TRAINING_SURFACE_FIELD = {
  natural: "Text40",
  artificial: "Text41",
  soil: "Text42",
  other: "Text44",
} as const;

/** Fila "Si fue en el partido, ¿en qué minuto?". Ojo: salta de Text53 a 55 y 57. */
const MINUTE_FIELD = {
  "0-15": "Text50",
  "16-30": "Text51",
  "31-45": "Text52",
  "46-60": "Text53",
  "61-75": "Text55",
  "76-90": "Text57",
} as const;

/** Fila "¿Dónde ocurrió la lesión?". `other` no marca casilla: escribe en Text49. */
const PLACE_FIELD = {
  match: "Text47", // PARTIDO
  training: "Text48", // ENTRENAMIENTO
} as const;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Las columnas `date` de Drizzle llegan como "YYYY-MM-DD". Se parten a mano y no
 * con `Date` porque `new Date("2026-08-25")` es medianoche UTC: en cualquier
 * zona al oeste el día impreso saldría uno menos.
 */
function isoParts(iso: string | null): { day: string; month: string; year: string } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? { year: m[1], month: m[2], day: m[3] } : null;
}

function formatDate(iso: string | null): string {
  const parts = isoParts(iso);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : "";
}

/** "X" si la opción está marcada; vacío si no, para dejar la casilla limpia. */
function mark(on: boolean): string {
  return on ? "X" : "";
}

/**
 * Parte el DNI/NIE en cuerpo y letra final, que el impreso pide en dos casillas
 * separadas por un guion. Si el valor no acaba en letra se deja esa casilla en
 * blanco antes que inventarla.
 */
function splitNationalId(raw: string | null): { body: string; letter: string } {
  const value = (raw ?? "").replace(/[\s.-]/g, "").toUpperCase();
  const m = /^(.*[0-9])([A-Z])$/.exec(value);
  return m ? { body: m[1], letter: m[2] } : { body: value, letter: "" };
}

/** Casilla -> texto a escribir. Lo que no aparezca aquí se queda vacío. */
function buildFieldValues(input: InjuryReportPdfInput): Record<string, string> {
  const { report, person, team, positions, club } = input;
  const dni = splitNationalId(person.nationalId);
  const reported = isoParts(report.reportedOn);

  const values: Record<string, string> = {
    // Cabecera: "Parte fechado en <localidad> a <día> de <mes> del <año>"
    Text1: report.reportedPlace ?? "",
    Text2: reported?.day ?? "",
    Text3: reported ? (MONTHS[Number(reported.month) - 1] ?? "") : "",
    Text4: reported?.year ?? "",
    Text5: club?.signatoryName ?? "",
    Text6: club?.signatoryNationalId ?? "",
    Text7: club?.federationDelegation ?? "",

    // Información personal
    Text10: dni.body,
    Text11: dni.letter,
    Text13: club?.federationCode ?? "",
    Text14: club?.legalName ?? "",
    Text15: formatDate(person.birthDate),
    Text16: person.lastName,
    Text17: person.firstName,
    Text18: person.address ?? "",
    Text19: person.city ?? "",
    Text20: provinceFromPostalCode(person.postalCode) ?? "",
    Text21: person.postalCode ?? "",
    Text22: person.phone ?? "",
    Text23: team?.name ?? "",
    Text25: "X", // Modalidad: el club es solo de fútbol sala
    Text45:
      report.weeklyTrainingMinutes != null ? String(report.weeklyTrainingMinutes) : "",

    // Parte de lesiones
    Text46: formatDate(report.occurredOn),
    Text49: report.place === "other" ? (report.placeOther ?? "") : "",
    Text62: mark(report.collision === true),
    Text63: mark(report.collision === false),
    Text65: report.opponentTeam ?? "",
    Text66: mark(report.relatedToPrevious === true),
    Text67: mark(report.relatedToPrevious === false),
    Text68: mark(report.bootType === "studs"),
    Text69: mark(report.bootType === "other"),
  };

  // Categoría y género del equipo son opcionales en el esquema, y se marcan por
  // separado: un equipo puede tener una y no la otra.
  if (team?.category) values[LICENCE_FIELD[team.category]] = "X";
  if (team?.gender) values[GENDER_FIELD[team.gender]] = "X";
  // El impreso admite un solo puesto y `memberships.positions` es un array (en
  // fútbol sala es normal jugar de ala y de pívot): se marca el primero, que es
  // una respuesta válida, en vez de marcar dos y que devuelvan el parte.
  const position = positions.find((p) => p in POSITION_FIELD);
  if (position) values[POSITION_FIELD[position]] = "X";

  if (report.place && report.place !== "other") values[PLACE_FIELD[report.place]] = "X";
  if (report.matchMinute) values[MINUTE_FIELD[report.matchMinute]] = "X";
  if (report.surface) values[SURFACE_FIELD[report.surface]] = "X";
  if (report.trainingSurface) values[TRAINING_SURFACE_FIELD[report.trainingSurface]] = "X";

  return values;
}

/**
 * Registra en la página los widgets de campo "huérfanos": sin entrada `/P` y
 * ausentes del array `/Annots` de la página.
 *
 * La plantilla vigente trae 7 de sus 69 campos así (probablemente un efecto
 * secundario de la herramienta con la que el club dibujó los campos sobre el
 * escaneo). `form.flatten()` de pdf-lib necesita saber en qué página vive
 * cada widget para estampar su apariencia, y si no lo encuentra ni por `/P`
 * ni recorriendo `/Annots`, lanza `Could not find page for PDFRef N R` y
 * revienta la generación del parte entero — visto en producción. Como el
 * impreso es a una sola página, el destino de cualquier huérfano no es
 * ambiguo; con más de una página no hay forma fiable de adivinarlo, así que
 * se deja tal cual (y `flatten()` seguirá fallando si aparece un huérfano
 * ahí, cosa que habrá que mirar campo a campo llegado el caso).
 */
function repairOrphanWidgets(doc: PDFDocument): void {
  const pages = doc.getPages();
  if (pages.length !== 1) return;
  const [page] = pages;
  const registered = new Set(
    page.node.Annots()?.asArray().map((ref) => ref.toString()) ?? [],
  );

  for (const field of doc.getForm().getFields()) {
    for (const widget of field.acroField.getWidgets()) {
      if (widget.P() !== undefined) continue;
      const ref = doc.context.getObjectRef(widget.dict);
      if (!ref || registered.has(ref.toString())) continue;
      widget.setP(page.ref);
      page.node.addAnnot(ref);
    }
  }
}

/**
 * Rellena la plantilla recibida y devuelve el PDF.
 *
 * Se aplana (`flatten`) por dos razones: el parte se firma y se sella en papel,
 * así que nadie debería poder reabrirlo y cambiar un dato después de imprimirlo;
 * y aplanado se ve igual en cualquier visor, sin depender de que regenere las
 * apariencias de los campos.
 */
export async function fillInjuryReportTemplate(
  template: ArrayBuffer,
  input: InjuryReportPdfInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.load(template);
  const form = doc.getForm();
  const values = buildFieldValues(input);

  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    // Vaciar siempre, no solo escribir lo nuestro: la plantilla que suba el club
    // puede venir de un parte ya rellenado (la primera traía datos de ejemplo
    // dentro), y esos valores se imprimirían en las casillas que este parte no
    // toca.
    field.setText(values[field.getName()] ?? "");
  }

  repairOrphanWidgets(doc);
  form.flatten();
  // Se copia a un Uint8Array respaldado por un ArrayBuffer: pdf-lib devuelve el
  // tipo genérico `Uint8Array<ArrayBufferLike>`, que no vale como cuerpo de una
  // `Response` (podría estar sobre memoria compartida). Copiar aquí ahorra un
  // casting en cada consumidor.
  return new Uint8Array(await doc.save());
}
