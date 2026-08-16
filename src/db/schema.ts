import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/**
 * Esquema núcleo de Areto.
 *
 * Aplicación de club único, para fútbol sala. Sin capa de multi-club ni de
 * catálogo de deportes: lo que hoy es específico de fútbol sala (equipos,
 * categorías) vive directamente en el núcleo, sin costuras para generalizar.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Rol de una persona dentro de un equipo concreto. */
export const membershipRole = pgEnum("membership_role", [
  "player",
  "coach",
  "staff",
]);

/** Categoría de un equipo (edad/nivel), de menor a mayor. */
export const teamCategory = pgEnum("team_category", [
  "escuela",
  "infantil",
  "cadete",
  "juvenil",
  "senior",
]);

export const teamGender = pgEnum("team_gender", ["masculino", "femenino"]);

/**
 * Puesto de un jugador en la pista. Un jugador puede tener varios a la vez
 * (p.ej. cierre y pívot), de ahí que viva en `memberships.positions` como
 * array y no como un enum simple.
 */
export const playerPosition = pgEnum("player_position", [
  "cierre",
  "ala",
  "pivot",
  "portero",
]);

/** Rol de acceso a la aplicación (para auth, fase posterior). */
export const userRole = pgEnum("user_role", [
  "admin", // gestión total del club
  "staff", // secretaría / tesorería
  "coach", // entrenador: su(s) equipo(s)
  "member", // jugador/socio: solo lectura de lo suyo
]);

/** Idioma de interfaz preferido del usuario (debe coincidir con src/i18n/routing.ts). */
export const userLocale = pgEnum("user_locale", ["eu", "es"]);

export const eventType = pgEnum("event_type", ["training", "match"]);

export const attendanceStatus = pgEnum("attendance_status", [
  "called", // convocado
  "confirmed", // confirma asistencia
  "declined", // no disponible
  "attended", // asistió
  "absent", // no asistió
]);

export const feePeriod = pgEnum("fee_period", [
  "monthly",
  "season",
  "oneoff",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "paid",
  "overdue",
  "waived", // exento
]);

/** Nivel de un acuerdo de patrocinio. */
export const sponsorshipTier = pgEnum("sponsorship_tier", [
  "principal",
  "colaborador",
  "publicidad",
]);

/** Estado de negociación de un acuerdo de patrocinio. */
export const sponsorshipAgreementStatus = pgEnum("sponsorship_agreement_status", [
  "negotiating", // en negociación
  "confirmed", // confirmado / cerrado
  "lost", // perdido / no cuaja
]);

/**
 * Tipo de trámite de arranque de temporada (gestión federativa). Los primeros
 * cuatro son los pasos estándar que se generan desde plantilla; `otro` permite
 * añadir trámites libres. `inscripcion_liga`/`inscripcion_copa` llevan pago +
 * justificante; `alta_jugadores_plataforma` es un paraguas que agrega el estado
 * de inscripción por jugador (`memberships.federationRegistered`).
 */
export const seasonTaskKind = pgEnum("season_task_kind", [
  "inscripcion_liga", // documentación + pago inscripción liga doméstica
  "inscripcion_copa", // documentación + pago inscripción copa
  "alta_equipo_plataforma", // dar de alta el equipo en la plataforma federativa
  "alta_jugadores_plataforma", // inscribir jugadores en la plataforma
  "otro", // trámite libre
]);

/** Estado de un trámite de temporada. */
export const seasonTaskStatus = pgEnum("season_task_status", [
  "pending", // pendiente
  "in_progress", // en curso
  "done", // completado
]);

// ---------------------------------------------------------------------------
// Temporadas
// ---------------------------------------------------------------------------

/**
 * Cada temporada es el ancla de la gestión anual del club: equipos, jugadores
 * (vía memberships) y economía cuelgan de una temporada concreta. `isCurrent`
 * marca la temporada activa (una sola en todo momento, ver índice parcial).
 */
export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // "2025/26"
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seasons_name_idx").on(t.name),
    uniqueIndex("seasons_current_idx").on(t.isCurrent).where(sql`${t.isCurrent}`),
  ],
);

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "restrict" }),
  name: text("name").notNull(), // "Senior A", "Cadete"...
  category: teamCategory("category"),
  gender: teamGender("gender"),
  /**
   * Rango de año de nacimiento admitido en el equipo esta temporada (p.ej.
   * "nacidos entre 2010 y 2011"). Lo define el club al inscribir el equipo,
   * cambia cada temporada y no lo deducimos nosotros de la categoría: sirve
   * solo para avisar de incoherencias, no bloquea la inscripción.
   */
  minBirthYear: integer("min_birth_year"),
  maxBirthYear: integer("max_birth_year"),
  /** Grupo/liga del equipo en la competición federada (p.ej. "1ª División Grupo B"). */
  federationGroup: text("federation_group"),
  /** Código/identificador del equipo en la federación, para actas y trámites. */
  federationCode: text("federation_code"),
  /**
   * Equipo del que proviene esta fila al "renovar" la plantilla a otra
   * temporada (ver `renewTeam` en equipos/actions.ts). Null si el equipo se
   * creó directamente. Un equipo sigue sin ser una entidad persistente entre
   * temporadas (cada temporada es una fila distinta); este campo solo permite
   * reconstruir la cadena de renovación y copiar la plantilla sin retecleo.
   */
  previousTeamId: uuid("previous_team_id").references((): AnyPgColumn => teams.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Documento genérico de un equipo (convocatoria, normativa interna,
 * autorización de desplazamiento...). Calcado de `personDocuments`: el
 * archivo es obligatorio, sin fechas ni emisor.
 */
export const teamDocuments = pgTable("team_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  filePath: text("file_path").notNull(), // ruta del objeto en Supabase Storage (bucket team-documents)
  fileName: text("file_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Bitácora de seguimiento de un equipo (incidencias, decisiones, avisos de
 * la directiva...). Log de solo alta/baja, calcado de `personNotes`.
 */
export const teamNotes = pgTable("team_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Trámites de temporada (gestión federativa de arranque)
// ---------------------------------------------------------------------------

/**
 * Trámite administrativo del arranque de una temporada: inscripción en liga y
 * copa (con su pago y justificante bancario), alta de equipos y jugadores en la
 * plataforma federativa, y trámites libres. Cuelga de una temporada y, si
 * aplica, de un equipo concreto (`teamId` nulo = trámite de club).
 *
 * Los importes se guardan en céntimos. El pago a la federación se modela INLINE
 * aquí (`amountCents`/`paidOn`/`proofPath`), no en el económico de ingresos
 * (cuotas/patrocinios): es un gasto saliente y no hay ledger de gastos todavía.
 * `proofPath`/`docPath` son objetos del bucket `season-task-proofs`.
 *
 * La checklist estándar se instancia con `generateSeasonTasks` desde una
 * plantilla (ver `src/lib/season-tasks.ts`), igual que las anualidades de
 * patrocinio se generan con `generateAnnualities`.
 */
export const seasonTasks = pgTable("season_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  /** Equipo al que aplica el trámite; null = trámite de club (no ligado a un equipo). */
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  kind: seasonTaskKind("kind").notNull().default("otro"),
  title: text("title").notNull(), // rellenado desde plantilla, editable
  status: seasonTaskStatus("status").notNull().default("pending"),
  dueDate: date("due_date"), // fecha límite federativa (asoma en el dashboard)
  amountCents: integer("amount_cents"), // solo trámites con pago (inscripciones)
  paidOn: date("paid_on"), // fecha real del pago a la federación
  proofPath: text("proof_path"), // justificante bancario (bucket season-task-proofs)
  docPath: text("doc_path"), // documentación enviada (bucket season-task-proofs)
  assignee: text("assignee"), // quién lo lleva (texto libre)
  notes: text("notes"),
  /** Orden de presentación dentro de la temporada (la plantilla lo asigna). */
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Personas (jugadores, entrenadores, socios, tutores...)
// ---------------------------------------------------------------------------

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthDate: date("birth_date"),
    nationalId: text("national_id"), // DNI/NIE
    isMember: boolean("is_member").notNull().default(true), // socio
    memberNumber: integer("member_number"), // nº de socio correlativo (para el carné)
    address: text("address"),
    city: text("city"),
    photoFilename: text("photo_filename"), // nombre de archivo original (referencia, sin subir)
    photoPath: text("photo_path"), // ruta del objeto en Supabase Storage (bucket person-photos)
    medicalCertUntil: date("medical_cert_until"), // caducidad del reconocimiento médico
    iban: text("iban"), // cuenta para domiciliar cuotas
    /** Tutor/a legal, para menores. Referencia a otra fila de `persons`. */
    guardianId: uuid("guardian_id").references((): AnyPgColumn => persons.id, {
      onDelete: "set null",
    }),
    shirtSize: text("shirt_size"),
    pantsSize: text("pants_size"),
    shoeSize: text("shoe_size"),
    formSigned: boolean("form_signed").notNull().default(false), // ficha firmada
    photoConsent: boolean("photo_consent").notNull().default(false), // permiso de imagen
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("persons_email_idx").on(t.email),
    uniqueIndex("persons_member_number_idx").on(t.memberNumber),
  ],
);

/**
 * Etiqueta libre de segmentación ("veterano", "beca"...), en minúsculas para
 * que la lista de etiquetas existentes (usada como sugerencias) no se
 * duplique por diferencias de mayúsculas. Sin catálogo separado: la lista de
 * sugerencias se deriva con un DISTINCT sobre esta misma tabla.
 */
export const personTags = pgTable(
  "person_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("person_tags_person_tag_idx").on(t.personId, t.tag)],
);

/**
 * Titulación/certificación de una persona (entrenador, árbitro, primeros
 * auxilios...). Texto libre: el club no necesita un catálogo cerrado de
 * tipos de título, son demasiado heterogéneos.
 */
export const personQualifications = pgTable("person_qualifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  issuer: text("issuer"), // entidad emisora
  issuedOn: date("issued_on"),
  expiresOn: date("expires_on"),
  filePath: text("file_path"), // ruta del objeto en Supabase Storage (bucket person-qualifications)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Documento genérico de una persona (DNI escaneado, ficha firmada, autorización
 * de imagen...). A diferencia de `person_qualifications`, no lleva fechas ni
 * emisor: es solo un archivo con una etiqueta libre. El archivo es obligatorio
 * (un documento sin archivo no tiene sentido).
 */
export const personDocuments = pgTable("person_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // "DNI", "Ficha firmada", "Autorización imagen"...
  filePath: text("file_path").notNull(), // ruta del objeto en Supabase Storage (bucket person-documents)
  fileName: text("file_name"), // nombre de archivo original (referencia)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Bitácora de seguimiento de una persona: entradas fechadas de secretaría
 * ("llamó el 12/03 para..."), independiente del campo `notes` (observación
 * general de la ficha). Es un log de solo alta/baja, no se editan entradas.
 */
export const personNotes = pgTable("person_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorName: text("author_name"), // nombre/email de quien la escribió, en el momento de escribirla
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Vínculo persona ↔ equipo con su rol (una persona puede estar en varios equipos). */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("player"),
    jerseyNumber: integer("jersey_number"),
    /** Puesto(s) en la pista (solo aplica a jugadores; puede haber varios). */
    positions: playerPosition("positions").array().notNull().default([]),
    isCaptain: boolean("is_captain").notNull().default(false), // capitán (brazalete)
    position: text("position"), // cargo libre: delegado, 2º entrenador, fisio, subcapitán...
    kitShirtIssued: boolean("kit_shirt_issued").notNull().default(false),
    kitPantsIssued: boolean("kit_pants_issued").notNull().default(false),
    kitBibIssued: boolean("kit_bib_issued").notNull().default(false),
    /** Jugador dado de alta en la plataforma federativa esta temporada (trámite `alta_jugadores_plataforma`). */
    federationRegistered: boolean("federation_registered").notNull().default(false),
    active: boolean("active").notNull().default(true),
    joinedAt: date("joined_at"),
  },
  (t) => [uniqueIndex("memberships_person_team_idx").on(t.personId, t.teamId)],
);

// ---------------------------------------------------------------------------
// Usuarios de la aplicación (perfil ligado a Supabase Auth)
// ---------------------------------------------------------------------------

/**
 * Perfil de aplicación. Su `id` es EXACTAMENTE el id de `auth.users` de Supabase
 * (no se genera aquí): lo crea un trigger `handle_new_user` al registrarse.
 * Ver `supabase/setup.sql`. `role` arranca en "member"; un admin lo asciende
 * a mano cuando corresponda.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = auth.users.id
  personId: uuid("person_id").references(() => persons.id, {
    onDelete: "set null",
  }),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: userRole("role").notNull().default("member"),
  locale: userLocale("locale").notNull().default("eu"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Calendario: eventos (entrenamientos / partidos) y asistencia
// ---------------------------------------------------------------------------

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  type: eventType("type").notNull(),
  title: text("title"),
  location: text("location"),
  opponent: text("opponent"), // solo partidos
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendances = pgTable(
  "attendances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull().default("called"),
  },
  (t) => [uniqueIndex("attendances_event_person_idx").on(t.eventId, t.personId)],
);

// ---------------------------------------------------------------------------
// Económico: cuotas y pagos
// ---------------------------------------------------------------------------

export const fees = pgTable("fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "restrict" }),
  name: text("name").notNull(), // "Cuota temporada 2025/26"
  amountCents: integer("amount_cents").notNull(), // dinero en céntimos, nunca float
  currency: text("currency").notNull().default("EUR"),
  period: feePeriod("period").notNull().default("season"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  feeId: uuid("fee_id")
    .notNull()
    .references(() => fees.id, { onDelete: "restrict" }),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  method: text("method"), // "cash", "transfer", "stripe"...
  stripePaymentId: text("stripe_payment_id"), // integración futura
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Patrocinador: identidad durable (empresa o particular). No es
 * necesariamente una `persona` del club; `contactPersonId` es opcional,
 * solo si el contacto es alguien ya registrado como persona. Lo que cambia
 * año a año (nivel, importe, fechas, contrato) vive en `sponsorshipTerms`,
 * no aquí.
 */
export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactPersonId: uuid("contact_person_id").references(() => persons.id, {
    onDelete: "set null",
  }),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  websiteUrl: text("website_url"), // enlace del logo en el portal público
  logoPath: text("logo_path"),
  /** Datos fiscales, para emitir factura del patrocinio/publicidad. */
  fiscalName: text("fiscal_name"), // razón social
  taxId: text("tax_id"), // CIF/NIF
  fiscalAddress: text("fiscal_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Acuerdo de patrocinio: el contrato con un patrocinador para una o varias
 * temporadas (los principales pueden ser plurianuales, p.ej. 4 años). Guarda
 * lo que es común a todo el acuerdo (nivel, contrapartidas, contrato, estado)
 * y el **importe TOTAL pactado** para todo el acuerdo (`totalAmountCents`).
 * `generateAnnualities` reparte ese total entre las temporadas; lo que se
 * factura y se cobra cada una vive en `sponsorPayments` (una anualidad por
 * temporada, con su propio importe editable por si el reparto no es exacto).
 *
 * Nota: la columna sigue llamándose `amount_cents` por compatibilidad, pero su
 * significado es el importe TOTAL del acuerdo (no el anual).
 */
export const sponsorshipTerms = pgTable("sponsorship_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorId: uuid("sponsor_id")
    .notNull()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  tier: sponsorshipTier("tier"),
  agreementStatus: sponsorshipAgreementStatus("agreement_status")
    .notNull()
    .default("confirmed"),
  totalAmountCents: integer("amount_cents"), // importe TOTAL pactado para todo el acuerdo
  startsOn: date("starts_on"), // inicio de la vigencia del acuerdo
  endsOn: date("ends_on"), // fin de la vigencia (null = en curso / indefinido)
  benefits: text("benefits"), // contrapartidas: qué recibe el patrocinador a cambio
  contractPath: text("contract_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Anualidad de un acuerdo: una fila por temporada del acuerdo (`year` = año de
 * inicio de la temporada, p.ej. 2026 → 2026/27). Lleva el importe de esa
 * temporada (por defecto el anual del acuerdo, editable si escala), su factura
 * (una por temporada, como se factura en el club) y su cobro. Un acuerdo de 4
 * años genera 4 anualidades. Reutiliza el enum de estado de los pagos de cuotas.
 */
export const sponsorPayments = pgTable("sponsor_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  termId: uuid("term_id")
    .notNull()
    .references(() => sponsorshipTerms.id, { onDelete: "cascade" }),
  year: integer("year"), // año de inicio de la temporada de esta anualidad
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  dueDate: date("due_date"), // fecha prevista de cobro
  paidOn: date("paid_on"), // fecha real de cobro (cuando status = "paid")
  method: text("method"), // "cash", "transfer"...
  invoiceNumber: text("invoice_number"), // nº de factura emitida por este cobro
  invoicedOn: date("invoiced_on"), // fecha de emisión de la factura
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Bitácora de seguimiento de un patrocinador (llamadas, reuniones,
 * "renueva el año que viene"). Log de solo alta/baja, calcado de
 * `person_notes`.
 */
export const sponsorNotes = pgTable("sponsor_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorId: uuid("sponsor_id")
    .notNull()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Contacto adicional de un patrocinador (además del contacto principal que
 * vive inline en `sponsors`): comercial, gerencia, administración... Cada
 * empresa suele tener más de un interlocutor.
 */
export const sponsorContacts = pgTable("sponsor_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorId: uuid("sponsor_id")
    .notNull()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"), // cargo / relación
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Documento genérico de un patrocinador (dossier, ficha fiscal, autorización
 * de logo...). Calcado de `teamDocuments`/`personDocuments`; distinto del
 * contrato del acuerdo (`sponsorshipTerms.contractPath`, ligado a un acuerdo
 * concreto, no al patrocinador).
 */
export const sponsorDocuments = pgTable("sponsor_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorId: uuid("sponsor_id")
    .notNull()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  filePath: text("file_path").notNull(), // ruta del objeto en Supabase Storage (bucket sponsor-documents)
  fileName: text("file_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Datos del club como emisor de facturas (razón social, CIF, dirección,
 * IBAN...). Tabla singleton: una sola fila para todo el club. No se referencia
 * por id desde ningún sitio; se lee siempre la primera (y única) fila.
 */
export const clubSettings = pgTable("club_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name"), // razón social del club
  taxId: text("tax_id"), // CIF/NIF
  address: text("address"), // dirección fiscal
  email: text("email"),
  phone: text("phone"),
  iban: text("iban"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Contador de facturas por año, para numeración correlativa sin huecos
 * (2026/0001, 2026/0002...). Una fila por año; `lastNumber` es el último
 * número asignado. Se incrementa atómicamente al emitir una factura (UPSERT
 * con ON CONFLICT ... RETURNING).
 */
export const invoiceCounters = pgTable("invoice_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Comunicación / portal público: avisos
// ---------------------------------------------------------------------------

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relaciones (para consultas relacionales de Drizzle)
// ---------------------------------------------------------------------------

export const seasonsRelations = relations(seasons, ({ many }) => ({
  teams: many(teams),
  fees: many(fees),
  tasks: many(seasonTasks),
}));

export const seasonTasksRelations = relations(seasonTasks, ({ one }) => ({
  season: one(seasons, { fields: [seasonTasks.seasonId], references: [seasons.id] }),
  team: one(teams, { fields: [seasonTasks.teamId], references: [teams.id] }),
}));

export const sponsorsRelations = relations(sponsors, ({ one, many }) => ({
  contactPerson: one(persons, {
    fields: [sponsors.contactPersonId],
    references: [persons.id],
  }),
  terms: many(sponsorshipTerms),
  noteEntries: many(sponsorNotes),
  contacts: many(sponsorContacts),
  documents: many(sponsorDocuments),
}));

export const sponsorDocumentsRelations = relations(sponsorDocuments, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [sponsorDocuments.sponsorId],
    references: [sponsors.id],
  }),
}));

export const sponsorNotesRelations = relations(sponsorNotes, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [sponsorNotes.sponsorId],
    references: [sponsors.id],
  }),
}));

export const sponsorContactsRelations = relations(sponsorContacts, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [sponsorContacts.sponsorId],
    references: [sponsors.id],
  }),
}));

export const sponsorshipTermsRelations = relations(sponsorshipTerms, ({ one, many }) => ({
  sponsor: one(sponsors, {
    fields: [sponsorshipTerms.sponsorId],
    references: [sponsors.id],
  }),
  payments: many(sponsorPayments),
}));

export const sponsorPaymentsRelations = relations(sponsorPayments, ({ one }) => ({
  term: one(sponsorshipTerms, {
    fields: [sponsorPayments.termId],
    references: [sponsorshipTerms.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  season: one(seasons, { fields: [teams.seasonId], references: [seasons.id] }),
  previousTeam: one(teams, {
    fields: [teams.previousTeamId],
    references: [teams.id],
    relationName: "teamRenewal",
  }),
  renewedAsTeams: many(teams, { relationName: "teamRenewal" }),
  memberships: many(memberships),
  events: many(events),
  tasks: many(seasonTasks),
  documents: many(teamDocuments),
  noteEntries: many(teamNotes),
}));

export const teamDocumentsRelations = relations(teamDocuments, ({ one }) => ({
  team: one(teams, { fields: [teamDocuments.teamId], references: [teams.id] }),
}));

export const teamNotesRelations = relations(teamNotes, ({ one }) => ({
  team: one(teams, { fields: [teamNotes.teamId], references: [teams.id] }),
}));

export const personsRelations = relations(persons, ({ many, one }) => ({
  memberships: many(memberships),
  payments: many(payments),
  qualifications: many(personQualifications),
  documents: many(personDocuments),
  noteEntries: many(personNotes),
  tags: many(personTags),
  guardian: one(persons, {
    fields: [persons.guardianId],
    references: [persons.id],
    relationName: "guardianOf",
  }),
  dependents: many(persons, { relationName: "guardianOf" }),
}));

export const personTagsRelations = relations(personTags, ({ one }) => ({
  person: one(persons, { fields: [personTags.personId], references: [persons.id] }),
}));

export const personQualificationsRelations = relations(personQualifications, ({ one }) => ({
  person: one(persons, {
    fields: [personQualifications.personId],
    references: [persons.id],
  }),
}));

export const personDocumentsRelations = relations(personDocuments, ({ one }) => ({
  person: one(persons, { fields: [personDocuments.personId], references: [persons.id] }),
}));

export const personNotesRelations = relations(personNotes, ({ one }) => ({
  person: one(persons, { fields: [personNotes.personId], references: [persons.id] }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  person: one(persons, {
    fields: [memberships.personId],
    references: [persons.id],
  }),
  team: one(teams, { fields: [memberships.teamId], references: [teams.id] }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  team: one(teams, { fields: [events.teamId], references: [teams.id] }),
  attendances: many(attendances),
}));

export const feesRelations = relations(fees, ({ one, many }) => ({
  season: one(seasons, { fields: [fees.seasonId], references: [seasons.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  fee: one(fees, { fields: [payments.feeId], references: [fees.id] }),
  person: one(persons, {
    fields: [payments.personId],
    references: [persons.id],
  }),
}));
