import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
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

/**
 * Rol de acceso a la aplicación. OBSOLETO: sustituido por la tabla `roles` y
 * `users.roleId`. Se mantiene durante la fase expand para que las políticas RLS
 * de `storage.objects` (que hoy leen esta columna) sigan funcionando hasta que
 * se aplique `supabase/setup.sql` v2; se elimina en un PR posterior.
 */
export const userRole = pgEnum("user_role", [
  "admin", // gestión total del club
  "staff", // secretaría / tesorería
  "coach", // entrenador: su(s) equipo(s)
  "member", // jugador/socio: solo lectura de lo suyo
]);

/**
 * Estado de acceso de una cuenta.
 *
 * - `pending`: la cuenta existe en `auth.users` (auto-registro o alta por
 *   Google) pero nadie le ha dado acceso todavía. No puede entrar.
 * - `active`: acceso concedido.
 * - `disabled`: acceso revocado sin borrar la cuenta ni su historial.
 *
 * El default de la columna es `pending` a propósito: es la red que impide que
 * un alta que no venga de una invitación entre en la aplicación.
 */
export const userStatus = pgEnum("user_status", ["pending", "active", "disabled"]);

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

/**
 * Tipo de petición de cancha. Hoy solo "match" (partido); pensado para poder
 * añadir en el futuro otros eventos que también necesiten reservar pista
 * (torneos, eventos especiales) sin cambiar la forma de la tabla.
 */
export const courtEventKind = pgEnum("court_event_kind", ["match"]);

/** Día de fin de semana preferido para disputar un partido en casa. */
export const preferredDay = pgEnum("preferred_day", ["saturday", "sunday", "either"]);

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

/** Tipo de solicitud de inscripción: alta de equipo (jugador o cuerpo
 * técnico, el rol se decide al aprobar) o alta de socio. */
export const registrationKind = pgEnum("registration_kind", ["player", "member"]);

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
).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
    idFrontPath: text("id_front_path"), // DNI/NIE frontal (bucket person-documents)
    idBackPath: text("id_back_path"), // DNI/NIE trasera (bucket person-documents)
    medicalCertUntil: date("medical_cert_until"), // caducidad del reconocimiento médico
    iban: text("iban"), // cuenta para domiciliar cuotas; titularidad de esta misma persona
    sepaConsent: boolean("sepa_consent").notNull().default(false), // permiso de domiciliación de la cuota
    // Fecha de aceptación del consentimiento vigente; NULL si nunca se aceptó
    // o si se revocó (al revocar se pierde la fecha anterior a propósito).
    sepaConsentAt: timestamp("sepa_consent_at", { withTimezone: true }),
    // Persona cuyo iban/sepaConsent hay que usar para cobrar las cuotas de
    // este registro (normalmente el tutor principal de un menor). NULL =
    // esta misma persona es la titular de su domiciliación.
    payerPersonId: uuid("payer_person_id").references((): AnyPgColumn => persons.id, {
      onDelete: "set null",
    }),
    shirtSize: text("shirt_size"),
    pantsSize: text("pants_size"),
    shoeSize: text("shoe_size"),
    photoConsent: boolean("photo_consent").notNull().default(false), // permiso de imagen
    photoConsentAt: timestamp("photo_consent_at", { withTimezone: true }),
    termsConsent: boolean("terms_consent").notNull().default(false), // acepta condiciones de traslados y devolución de equipación
    termsConsentAt: timestamp("terms_consent_at", { withTimezone: true }),
    privacyConsent: boolean("privacy_consent").notNull().default(false), // acepta el tratamiento de datos (RGPD)
    privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("persons_email_idx").on(t.email),
    uniqueIndex("persons_national_id_idx").on(t.nationalId),
  ],
).enableRLS();

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
).enableRLS();

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
}).enableRLS();

/**
 * Reconocimiento médico realizado a una persona. `medical_cert_until` en
 * `persons` se deriva automáticamente del `expires_on` del reconocimiento más
 * reciente (por `occurred_on`) — ver `recomputeMedicalCertUntil` en
 * personas/actions.ts.
 */
export const personMedicalCheckups = pgTable("person_medical_checkups", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  occurredOn: date("occurred_on").notNull(),
  expiresOn: date("expires_on"),
  issuer: text("issuer"), // centro/médico
  filePath: text("file_path"), // ruta del objeto en Supabase Storage (bucket person-medical-checkups)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * Parte de lesión de un jugador/a: fecha, descripción y documento adjunto
 * opcional (el parte médico en sí).
 */
export const personInjuryReports = pgTable("person_injury_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => persons.id, { onDelete: "cascade" }),
  occurredOn: date("occurred_on").notNull(),
  description: text("description").notNull(),
  filePath: text("file_path"), // ruta del objeto en Supabase Storage (bucket person-injury-reports)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
).enableRLS();

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
).enableRLS();

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
).enableRLS();

// ---------------------------------------------------------------------------
// Usuarios de la aplicación (perfil ligado a Supabase Auth)
// ---------------------------------------------------------------------------

/**
 * Rol de acceso a la aplicación. Los cuatro de fábrica (`admin`, `staff`,
 * `coach`, `member`) se siembran con `isSystem = true`: no se pueden borrar y su
 * `key` y su nombre son inmutables (la UI los traduce por `key`), pero su matriz
 * de permisos sí se edita. El club puede crear los suyos propios.
 *
 * Los permisos NO viven aquí: el catálogo está en `src/lib/permissions.ts`. Un
 * permiso solo significa algo si hay un `requirePermission()` que lo comprueba,
 * así que la fuente de verdad es el código y la base de datos solo guarda qué
 * rol tiene cuál (`role_permissions`).
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Slug estable, usado por el bootstrap y por las traducciones de la UI. */
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    /** Rol que asigna el trigger de Supabase a las cuentas nuevas. Solo uno. */
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Índice único parcial: misma mecánica que `seasons.isCurrent`.
    uniqueIndex("roles_single_default_idx")
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
  ],
).enableRLS();

/**
 * Asignaciones rol → permiso. `permission` es `text` y no un enum a propósito:
 * el catálogo vive en `src/lib/permissions.ts`, así que añadir un permiso nuevo
 * es tocar un array de TypeScript y no una migración. Las claves que ya no
 * existan en el catálogo se descartan al leerlas (ver `getCurrentUser`).
 */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
).enableRLS();

/**
 * Perfil de aplicación. Su `id` es EXACTAMENTE el id de `auth.users` de Supabase
 * (no se genera aquí): lo crea un trigger `handle_new_user` al registrarse.
 * Ver `supabase/setup.sql`.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // = auth.users.id
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull().unique(),
    fullName: text("full_name"),
    /** OBSOLETO: sustituido por `roleId`. Ver el comentario de `userRole`. */
    role: userRole("role").notNull().default("member"),
    /**
     * Nullable a propósito: sin rol = sin ningún permiso (fail-closed). El
     * `restrict` hace que borrar un rol que alguien tiene asignado falle con
     * 23503 en vez de dejar cuentas desamparadas en silencio.
     */
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "restrict" }),
    status: userStatus("status").notNull().default("pending"),
    locale: userLocale("locale").notNull().default("eu"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitedBy: uuid("invited_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Una persona del club, como mucho una cuenta.
    uniqueIndex("users_person_idx")
      .on(t.personId)
      .where(sql`${t.personId} is not null`),
  ],
).enableRLS();

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
}).enableRLS();

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
).enableRLS();

/**
 * Petición de horario de cancha, para organizar cuándo se juega cada partido
 * (no lleva resultados ni asistencia, a diferencia de `events`: solo sirve
 * para acordar día/hora con quien organiza los horarios del polideportivo).
 * Se agrupa por fin de semana (`weekendOf`, cualquier fecha de ese fin de
 * semana) y no por fecha/hora exacta, porque esa es precisamente la parte que
 * está por decidir. `teamId` y `title` son nullable pensando en futuros
 * `kind` que no sean un partido de un único equipo (torneos, eventos
 * especiales que también necesiten la cancha).
 */
export const courtEvents = pgTable(
  "court_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: courtEventKind("kind").notNull().default("match"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    title: text("title"), // solo para kinds futuros distintos de "match"
    weekendOf: date("weekend_of").notNull(),
    opponent: text("opponent"), // rival, solo partidos
    isHome: boolean("is_home"), // true = casa, false = fuera; solo partidos
    preferredDay: preferredDay("preferred_day"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("court_events_weekend_idx").on(t.weekendOf),
    index("court_events_team_idx").on(t.teamId),
  ],
).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
}).enableRLS();

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
  // Interruptores globales: solo hay una temporada activa a la vez, así que el
  // formulario público de inscripción es un estado del club, no de cada
  // temporada. Cada inscripción enviada se cuelga de la temporada `isCurrent`
  // en ese momento (ver `getRegistrationAvailability`).
  // `playerRegistrationOpen` cubre el alta de equipo (jugador o cuerpo
  // técnico): el formulario es el mismo para ambos, el rol se decide al
  // aprobar, no al inscribirse.
  playerRegistrationOpen: boolean("player_registration_open").notNull().default(false),
  memberRegistrationOpen: boolean("member_registration_open").notNull().default(false),
  // Cuota anual de socio. Sin pantalla propia todavía en Ajustes del club
  // (valor por defecto 2000 = 20€); el campo ya existe para no tener que
  // volver a tocar el formulario público el día que se haga editable.
  memberAnnualFeeCents: integer("member_annual_fee_cents").notNull().default(2000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

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
).enableRLS();

/**
 * Contador de facturas por año, para numeración correlativa sin huecos
 * (2026/0001, 2026/0002...). Una fila por año; `lastNumber` es el último
 * número asignado. Se incrementa atómicamente al emitir una factura (UPSERT
 * con ON CONFLICT ... RETURNING).
 */
export const invoiceCounters = pgTable("invoice_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
}).enableRLS();

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
}).enableRLS();

// ---------------------------------------------------------------------------
// Inscripciones: formulario público de alta de equipo (jugador o cuerpo
// técnico, sin distinción en el intake) o de socio, pendiente de validación
// por un administrador antes de integrarse en `persons`.
// ---------------------------------------------------------------------------

/**
 * Solicitud de inscripción enviada por el propio interesado (o su tutor), sin
 * sesión. Es una zona de aterrizaje: nada de esto toca `persons` hasta que un
 * admin/staff la aprueba desde `/inscripciones`. Los campos marcados "solo
 * equipo" quedan `null` en las de socio.
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

  // Solo equipo (kind "player"):
  shirtSize: text("shirt_size"),
  pantsSize: text("pants_size"),
  shoeSize: text("shoe_size"),
  installmentsChosen: integer("installments_chosen"), // plazos elegidos; informativo, no genera cuotas
  sepaConsent: boolean("sepa_consent").notNull().default(false),
  sepaConsentAt: timestamp("sepa_consent_at", { withTimezone: true }),
  termsConsent: boolean("terms_consent").notNull().default(false), // acepta condiciones de traslados y devolución de equipación
  termsConsentAt: timestamp("terms_consent_at", { withTimezone: true }),

  photoConsent: boolean("photo_consent").notNull().default(false), // mismo nombre que persons.photoConsent (antes "imageConsent")
  photoConsentAt: timestamp("photo_consent_at", { withTimezone: true }),
  privacyConsent: boolean("privacy_consent").notNull().default(false), // acepta el tratamiento de datos (RGPD)
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }),

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
}).enableRLS();

/**
 * Tutor/a indicado en una solicitud de jugador menor. Puede haber varios; no
 * hay columna "principal" aquí, `sortOrder` conserva el orden de entrada del
 * formulario (el primero pasa a ser el tutor principal al aprobar).
 */
export const registrationGuardians = pgTable(
  "registration_guardians",
  {
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
  },
  (t) => [uniqueIndex("registration_guardians_sort_idx").on(t.registrationId, t.sortOrder)],
).enableRLS();

/**
 * Detalle de un envío del formulario público de inscripción que falló a
 * mitad de proceso (subida a Storage, insert en BD, etc.). Los logs de
 * Vercel de este plan solo retienen un par de minutos, así que sin esto el
 * mensaje genérico que ve quien se inscribe (`submissionFailed`) es lo único
 * que queda — no hay forma de diagnosticar un fallo real después de que
 * ocurra. Solo lectura manual (Supabase) por ahora, sin UI de revisión.
 */
export const registrationSubmissionErrors = pgTable("registration_submission_errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: registrationKind("kind").notNull(),
  email: text("email"),
  message: text("message").notNull(),
  detail: text("detail"), // stack trace si lo hay
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ---------------------------------------------------------------------------
// Relaciones (para consultas relacionales de Drizzle)
// ---------------------------------------------------------------------------

export const seasonsRelations = relations(seasons, ({ many }) => ({
  teams: many(teams),
  fees: many(fees),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(users),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
}));

/**
 * Permite resolver usuario + rol + permisos en UNA sola sentencia SQL desde
 * `getCurrentUser`, que se ejecuta en cada petición.
 */
export const usersRelations = relations(users, ({ one }) => ({
  // `accessRole` y no `role`: mientras siga existiendo la columna heredada
  // `users.role` (enum), una relación llamada igual haría que Drizzle mezclara
  // ambas en el tipo inferido. Al retirar la columna se puede renombrar.
  accessRole: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  person: one(persons, {
    fields: [users.personId],
    references: [persons.id],
  }),
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
  courtEvents: many(courtEvents),
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
  medicalCheckups: many(personMedicalCheckups),
  injuryReports: many(personInjuryReports),
  documents: many(personDocuments),
  noteEntries: many(personNotes),
  tags: many(personTags),
  /** Filas donde esta persona es la tutelada (sus propios tutores). */
  guardianRows: many(personGuardians, { relationName: "personGuardianRows" }),
  /** Filas donde esta persona es tutora de alguien más. */
  guardianOfRows: many(personGuardians, { relationName: "guardianPersonRows" }),
  /** Persona cuyo iban/sepaConsent se usa para cobrar las cuotas de esta persona. */
  payerPerson: one(persons, {
    fields: [persons.payerPersonId],
    references: [persons.id],
    relationName: "payerPerson",
  }),
  /** Personas que delegan su cobro en esta (sus tutelados). */
  payeeOf: many(persons, { relationName: "payerPerson" }),
  clubMember: one(clubMembers, {
    fields: [persons.id],
    references: [clubMembers.personId],
  }),
  /** Solicitudes donde el revisor confirmó que esta persona es la interesada
   * (`registrations.matchedPersonId`). Reverso de `registrationsRelations.matchedPerson`. */
  registrations: many(registrations),
  /** Solicitudes donde esta persona quedó emparejada como tutor/a de otra
   * (`registrationGuardians.matchedPersonId`). Reverso de
   * `registrationGuardiansRelations.matchedPerson`. */
  registrationGuardianRows: many(registrationGuardians),
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

export const personMedicalCheckupsRelations = relations(personMedicalCheckups, ({ one }) => ({
  person: one(persons, {
    fields: [personMedicalCheckups.personId],
    references: [persons.id],
  }),
}));

export const personInjuryReportsRelations = relations(personInjuryReports, ({ one }) => ({
  person: one(persons, {
    fields: [personInjuryReports.personId],
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

export const courtEventsRelations = relations(courtEvents, ({ one }) => ({
  team: one(teams, { fields: [courtEvents.teamId], references: [teams.id] }),
  createdBy: one(users, { fields: [courtEvents.createdByUserId], references: [users.id] }),
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
