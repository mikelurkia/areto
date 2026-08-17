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

/** Tipo de solicitud de inscripción: jugador o entrenador. */
export const registrationKind = pgEnum("registration_kind", ["player", "coach"]);

/** Estado de una solicitud de inscripción en el flujo de validación. */
export const registrationStatus = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected",
]);

/** Estado de la condición de socio de una persona. */
export const clubMemberStatus = pgEnum("club_member_status", ["active", "cancelled"]);

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
    address: text("address"),
    city: text("city"),
    photoFilename: text("photo_filename"), // nombre de archivo original (referencia, sin subir)
    photoPath: text("photo_path"), // ruta del objeto en Supabase Storage (bucket person-photos)
    medicalCertUntil: date("medical_cert_until"), // caducidad del reconocimiento médico
    iban: text("iban"), // cuenta para domiciliar cuotas
    sepaConsent: boolean("sepa_consent").notNull().default(false), // permiso de domiciliación de la cuota
    shirtSize: text("shirt_size"),
    pantsSize: text("pants_size"),
    shoeSize: text("shoe_size"),
    photoConsent: boolean("photo_consent").notNull().default(false), // permiso de imagen
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("persons_email_idx").on(t.email)],
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

/**
 * Tutor/a legal de una persona (para menores). Relación N:M en vez de un campo
 * escalar en `persons`: un menor puede tener varios tutores. `isPrimary` marca
 * cuál se muestra cuando una pantalla solo tiene espacio para uno (carné,
 * resumen de ficha); si hay varios tutores y ninguno marcado, se usa el primero.
 */
export const personGuardians = pgTable(
  "person_guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("person_guardians_pair_idx").on(t.personId, t.guardianId)],
);

/**
 * Condición de socio de una persona. Concepto aparte de jugar/entrenar (una
 * persona no se hace socia por tener una `membership`): es alta explícita,
 * con su propio número correlativo y ciclo de vida (alta/baja), para más
 * adelante soportar remesas SEPA propias. Una persona tiene como mucho una
 * fila (se cancela en vez de borrarse, para conservar el histórico).
 */
export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    status: clubMemberStatus("status").notNull().default("active"),
    memberNumber: integer("member_number"), // nº de socio correlativo (para el carné)
    joinedAt: date("joined_at").notNull(),
    cancelledAt: date("cancelled_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("club_members_person_idx").on(t.personId),
    uniqueIndex("club_members_member_number_idx").on(t.memberNumber),
  ],
);

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
    /**
     * Capitanía (brazalete). Es una característica del equipo, no de la
     * persona: se designa desde la ficha del equipo, que garantiza un único
     * capitán (ver `updateTeamCaptain` en equipos/[teamId]/actions.ts).
     */
    isCaptain: boolean("is_captain").notNull().default(false),
    position: text("position"), // cargo libre: delegado, 2º entrenador, fisio, subcapitán...
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
  federationCode: text("federation_code").default("2022"), // código de club en la federación
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Credenciales del club en las aplicaciones (intranets) de las federaciones.
 * Hoy existen la federación gipuzkoana y la vasca, pero se modela como tabla
 * (una fila por federación) para poder añadir más sin tocar el esquema. La
 * contraseña se guarda en claro a propósito: el club necesita el valor
 * recuperable para iniciar sesión en los portales externos. Por ahora es de
 * solo lectura desde la UI.
 */
export const federationAccounts = pgTable(
  "federation_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // nombre de la federación (p. ej. "Gipuzkoana")
    url: text("url").notNull(), // URL de la intranet/aplicación
    username: text("username"),
    password: text("password"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("federation_accounts_name_idx").on(table.name)],
);

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
// Inscripciones: formulario público de alta de jugador/entrenador, pendiente
// de validación por un administrador antes de integrarse en `persons`.
// ---------------------------------------------------------------------------

/**
 * Solicitud de inscripción enviada por el propio interesado (o su tutor), sin
 * sesión. Es una zona de aterrizaje: nada de esto toca `persons` hasta que un
 * admin/staff la aprueba desde `/inscripciones`. Los campos marcados "solo
 * jugador" quedan `null` en las de entrenador.
 */
export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: registrationKind("kind").notNull(),
  status: registrationStatus("status").notNull().default("pending"),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "restrict" }),

  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: date("birth_date"),
  nationalId: text("national_id"),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  iban: text("iban"),

  // Solo jugador:
  shirtSize: text("shirt_size"),
  pantsSize: text("pants_size"),
  shoeSize: text("shoe_size"),
  installmentsChosen: integer("installments_chosen"), // plazos elegidos; informativo, no genera cuotas
  sepaConsent: boolean("sepa_consent").notNull().default(false),

  imageConsent: boolean("image_consent").notNull().default(false),

  photoPath: text("photo_path"), // bucket registration-documents
  idFrontPath: text("id_front_path"),
  idBackPath: text("id_back_path"),

  /** Ficha de `persons` que el revisor confirma como la misma persona (si existía). */
  matchedPersonId: uuid("matched_person_id").references(() => persons.id, {
    onDelete: "set null",
  }),

  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tutor/a indicado en una solicitud de jugador menor. Puede haber varios; no
 * hay columna "principal" aquí, `sortOrder` conserva el orden de entrada del
 * formulario (el primero pasa a ser el tutor principal al aprobar).
 */
export const registrationGuardians = pgTable("registration_guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: date("birth_date"),
  nationalId: text("national_id"),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  matchedPersonId: uuid("matched_person_id").references(() => persons.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Relaciones (para consultas relacionales de Drizzle)
// ---------------------------------------------------------------------------

export const seasonsRelations = relations(seasons, ({ many }) => ({
  teams: many(teams),
  fees: many(fees),
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
  /** Filas donde esta persona es la tutelada (sus propios tutores). */
  guardianRows: many(personGuardians, { relationName: "personGuardianRows" }),
  /** Filas donde esta persona es tutora de alguien más. */
  guardianOfRows: many(personGuardians, { relationName: "guardianPersonRows" }),
  clubMember: one(clubMembers, {
    fields: [persons.id],
    references: [clubMembers.personId],
  }),
}));

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  person: one(persons, { fields: [clubMembers.personId], references: [persons.id] }),
}));

export const personGuardiansRelations = relations(personGuardians, ({ one }) => ({
  person: one(persons, {
    fields: [personGuardians.personId],
    references: [persons.id],
    relationName: "personGuardianRows",
  }),
  guardian: one(persons, {
    fields: [personGuardians.guardianId],
    references: [persons.id],
    relationName: "guardianPersonRows",
  }),
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

export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  season: one(seasons, { fields: [registrations.seasonId], references: [seasons.id] }),
  matchedPerson: one(persons, {
    fields: [registrations.matchedPersonId],
    references: [persons.id],
  }),
  reviewer: one(users, { fields: [registrations.reviewedBy], references: [users.id] }),
  guardians: many(registrationGuardians),
}));

export const registrationGuardiansRelations = relations(registrationGuardians, ({ one }) => ({
  registration: one(registrations, {
    fields: [registrationGuardians.registrationId],
    references: [registrations.id],
  }),
  matchedPerson: one(persons, {
    fields: [registrationGuardians.matchedPersonId],
    references: [persons.id],
  }),
}));
