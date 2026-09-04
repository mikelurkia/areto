import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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
  "installments",
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

/** Estado de seguimiento de una petición de funcionalidad. */
export const featureRequestStatus = pgEnum("feature_request_status", [
  "pending",
  "in_review",
  "done",
  "discarded",
]);

/**
 * Circunstancia en la que se produjo una lesión, tal y como la pregunta el
 * parte oficial de la Mutualidad ("¿Dónde ocurrió la lesión?"). `other` obliga
 * a rellenar `placeOther`, que es la casilla "Otros (especificar)" del impreso.
 */
export const injuryPlace = pgEnum("injury_place", ["match", "training", "other"]);

/**
 * Tramo del partido en el que se produjo la lesión. El impreso no pide el
 * minuto exacto sino una de estas seis casillas, así que se guarda igual: un
 * `integer` obligaría a decidir el tramo al imprimir y perdería el caso de
 * quien solo recuerda "en la primera parte".
 */
export const matchMinute = pgEnum("match_minute", [
  "0-15",
  "16-30",
  "31-45",
  "46-60",
  "61-75",
  "76-90",
]);

/**
 * Superficie de juego. Sirve tanto para la de entrenamiento habitual como para
 * la del día de la lesión, que en el impreso son dos preguntas con las mismas
 * cuatro casillas.
 */
export const pitchSurface = pgEnum("pitch_surface", [
  "natural",
  "artificial",
  "soil",
  "other",
]);

/** Tipo de bota: el impreso solo distingue multitaco de césped artificial y "otros". */
export const bootType = pgEnum("boot_type", ["studs", "other"]);

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

export const teams = pgTable(
  "teams",
  {
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
     * Cuota que el club cobra a cada jugador de este equipo esta temporada.
     * Es un dato de configuración: no genera cobros por sí solo — el módulo
     * económico (`fees`/`payments`, todavía sin construir) lo leerá de aquí.
     * En céntimos, nunca float, como el resto del dinero del proyecto.
     * Null = cuota sin definir todavía.
     */
    playerFeeCents: integer("player_fee_cents"),
    playerFeePeriod: feePeriod("player_fee_period").notNull().default("season"),
    /** Matices del importe ("incluye equipación", "descuento hermanos"). Interno. */
    playerFeeNotes: text("player_fee_notes"),
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
  },
  (t) => [
    index("teams_season_idx").on(t.seasonId),
  ],
).enableRLS();

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
    postalCode: text("postal_code"),
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
    index("persons_name_idx").on(t.lastName, t.firstName),
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
export const personQualifications = pgTable(
  "person_qualifications",
  {
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
  },
  (t) => [
    index("person_qualifications_person_idx").on(t.personId),
  ],
).enableRLS();

/**
 * Reconocimiento médico realizado a una persona. `medical_cert_until` en
 * `persons` se deriva automáticamente del `expires_on` del reconocimiento más
 * reciente (por `occurred_on`) — ver `recomputeMedicalCertUntil` en
 * personas/actions.ts.
 */
export const personMedicalCheckups = pgTable(
  "person_medical_checkups",
  {
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
  },
  (t) => [
    index("person_medical_checkups_person_idx").on(t.personId),
  ],
).enableRLS();

/**
 * Parte de lesión de un jugador/a.
 *
 * `occurredOn` se fija solo al crear el parte (hoy, no se pide en el
 * formulario) y `notes` es la única nota libre del registro interno. El resto
 * de columnas son las casillas del parte oficial de la Mutualidad de
 * Previsión Social de Futbolistas (RFEF), que se rellena e imprime desde aquí
 * (ver `src/lib/injury-report-pdf.ts`): se guardan para poder regenerar el
 * impreso y corregir una errata sin volver a teclearlo todo.
 *
 * Todas ellas son opcionales a propósito. Un parte se abre el día de la lesión
 * con lo que se sabe y se completa después, y los partes anteriores a esta
 * funcionalidad no tienen estos datos.
 *
 * La HISTORIA CLÍNICA del impreso (diagnóstico, lateralidad, baja,
 * tratamiento) NO está aquí: la plantilla oficial no tiene campos editables en
 * esa mitad porque la rellena a mano el médico de la Mutualidad sobre el papel.
 *
 * `filePath` es el parte relleno (generado desde la plantilla, o uno propio
 * subido a mano): el fichero del registro es el propio parte.
 */
export const personInjuryReports = pgTable(
  "person_injury_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    filePath: text("file_path"), // ruta del objeto en Supabase Storage (bucket person-injury-reports)
    notes: text("notes"),
    // Equipo con el que jugaba al lesionarse. De él salen tres casillas del
    // impreso (categoría de licencia, sexo y modalidad), así que se fija en el
    // parte en vez de deducirlo al imprimir: un jugador puede cambiar de equipo,
    // y el parte debe seguir diciendo lo que era verdad el día de la lesión.
    // `set null` y no `cascade`: borrar un equipo no puede borrar partes médicos.
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    reportedOn: date("reported_on"), // "Parte fechado en ... a __ de __ del __"
    reportedPlace: text("reported_place"), // la localidad de esa misma línea
    place: injuryPlace("place"),
    placeOther: text("place_other"),
    matchMinute: matchMinute("match_minute"),
    surface: pitchSurface("surface"),
    collision: boolean("collision"),
    opponentTeam: text("opponent_team"),
    relatedToPrevious: boolean("related_to_previous"),
    bootType: bootType("boot_type"),
    trainingSurface: pitchSurface("training_surface"),
    weeklyTrainingMinutes: integer("weekly_training_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("person_injury_reports_person_idx").on(t.personId),
  ],
).enableRLS();

/**
 * Documento genérico de una persona (DNI escaneado, ficha firmada, autorización
 * de imagen...). A diferencia de `person_qualifications`, no lleva fechas ni
 * emisor: es solo un archivo con una etiqueta libre. El archivo es obligatorio
 * (un documento sin archivo no tiene sentido).
 */
export const personDocuments = pgTable(
  "person_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // "DNI", "Ficha firmada", "Autorización imagen"...
    filePath: text("file_path").notNull(), // ruta del objeto en Supabase Storage (bucket person-documents)
    fileName: text("file_name"), // nombre de archivo original (referencia)
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("person_documents_person_idx").on(t.personId),
  ],
).enableRLS();

/**
 * Bitácora de seguimiento de una persona: entradas fechadas de secretaría
 * ("llamó el 12/03 para..."), independiente del campo `notes` (observación
 * general de la ficha). Es un log de solo alta/baja, no se editan entradas.
 */
export const personNotes = pgTable(
  "person_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorName: text("author_name"), // nombre/email de quien la escribió, en el momento de escribirla
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("person_notes_person_idx").on(t.personId),
  ],
).enableRLS();

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
  (t) => [
    uniqueIndex("person_guardians_pair_idx").on(t.personId, t.guardianId),
    index("person_guardians_guardian_idx").on(t.guardianId),
  ],
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
    federationCardPath: text("federation_card_path"), // ficha federativa (bucket membership-documents)
    /** Nº de plazos (1 o 2) elegido para la cuota; solo aplica si el equipo está en playerFeePeriod="installments". */
    installmentsCount: integer("installments_count"),
  },
  (t) => [
    uniqueIndex("memberships_person_team_idx").on(t.personId, t.teamId),
    index("memberships_team_idx").on(t.teamId),
    /**
     * Un solo capitán por equipo, forzado en la base de datos. Hasta ahora la
     * única garantía era `updateTeamCaptain`, y `data-integrity.ts` tenía que
     * salir a contar los equipos que se hubieran saltado ese camino.
     */
    uniqueIndex("memberships_single_captain_idx")
      .on(t.teamId)
      .where(sql`${t.isCaptain}`),
  ],
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

/**
 * Roles de acceso de cada cuenta. Los permisos efectivos son la UNIÓN de los de
 * todos sus roles: alguien que juega y además entrena necesita lo de ambos.
 *
 * Esta tabla es la fuente de verdad; `users.role_id` sigue existiendo en fase
 * *expand* solo porque `public.user_has_permission` de `supabase/setup.sql` la
 * lee, y ese fichero se aplica a mano y no por migración. Todas las escrituras
 * pasan por `setUserRoles()` (`src/lib/user-roles.ts`), que mantiene las dos.
 *
 * `user_id` cae en cascada (borrar una cuenta se lleva sus asignaciones) y
 * `role_id` es `restrict`, que es la garantía que tenía `users.role_id`: borrar
 * un rol asignado falla con 23503 en vez de dejar cuentas sin permisos en
 * silencio. Ojo: eso obliga a limpiar esta tabla ANTES de borrar un rol.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // La PK impide duplicados por construcción: "quitar X, añadir Y" se
    // resuelve con un `on conflict do nothing` y ya está.
    primaryKey({ columns: [t.userId, t.roleId] }),
    // El índice de la PK solo sirve con prefijo `user_id`. "Quién tiene el rol
    // X" (contador de la tabla de roles, `deleteRole`, la guarda del último
    // administrador) y la comprobación del FK `restrict` van por `role_id`.
    index("user_roles_role_idx").on(t.roleId),
  ],
).enableRLS();

/**
 * Petición de horario de cancha, para organizar cuándo se juega cada partido
 * (no lleva resultados ni asistencia, no hay entidad de convocatoria: solo
 * sirve para acordar día/hora con quien organiza los horarios del polideportivo).
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
export const sponsorshipTerms = pgTable(
  "sponsorship_terms",
  {
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
  },
  (t) => [
    index("sponsorship_terms_sponsor_idx").on(t.sponsorId),
  ],
).enableRLS();

/**
 * Anualidad de un acuerdo: una fila por temporada del acuerdo (`year` = año de
 * inicio de la temporada, p.ej. 2026 → 2026/27). Lleva el importe de esa
 * temporada (por defecto el anual del acuerdo, editable si escala), su factura
 * (una por temporada, como se factura en el club) y su cobro. Un acuerdo de 4
 * años genera 4 anualidades. Reutiliza el enum de estado de los pagos de cuotas.
 */
export const sponsorPayments = pgTable(
  "sponsor_payments",
  {
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
    // Registro fiscal de esta anualidad, desde la fase 5 del módulo económico:
    // el número y la fecha de emisión viven en `issued_invoices`, no aquí.
    issuedInvoiceId: uuid("issued_invoice_id").references((): AnyPgColumn => issuedInvoices.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sponsor_payments_term_idx").on(t.termId),
    index("sponsor_payments_status_year_idx").on(t.status, t.year),
  ],
).enableRLS();

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
  federationCode: text("federation_code").default("2022"), // código de club en la federación (Nº Club en los impresos federativos)
  // Datos que pide la cabecera del parte de lesión de la Mutualidad. Viven aquí
  // y no en cada parte porque son constantes del club: la delegación no cambia,
  // y el directivo que firma los partes es el mismo todo el año.
  federationDelegation: text("federation_delegation"), // Delegación Territorial (p. ej. "GIPUZKOA")
  signatoryName: text("signatory_name"), // nombre y apellidos del directivo que firma
  signatoryNationalId: text("signatory_national_id"), // su DNI
  // Interruptores globales: solo hay una temporada activa a la vez, así que el
  // formulario público de inscripción es un estado del club, no de cada
  // temporada. Cada inscripción enviada se cuelga de la temporada `isCurrent`
  // en ese momento (ver `getRegistrationAvailability`).
  // `playerRegistrationOpen` cubre el alta de equipo (jugador o cuerpo
  // técnico): el formulario es el mismo para ambos, el rol se decide al
  // aprobar, no al inscribirse.
  playerRegistrationOpen: boolean("player_registration_open").notNull().default(false),
  memberRegistrationOpen: boolean("member_registration_open").notNull().default(false),
  // Cuota anual de socio (valor por defecto 2000 = 20€). Editable en la
  // pestaña "Inscripciones" de /club, junto a los dos interruptores de arriba.
  memberAnnualFeeCents: integer("member_annual_fee_cents").notNull().default(2000),
  // Identificador de Acreedor SEPA (ICS/AT-02, p.ej. "ES23000B12345678"): lo
  // exige el `CdtrSchmeId` de cualquier remesa de domiciliación. Sin él, la
  // generación de remesas SEPA queda bloqueada (ver `cuotas`).
  sepaCreditorId: text("sepa_creditor_id"),
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
// Módulo económico: cimientos (ver docs/plan-modulo-economico.md)
// ---------------------------------------------------------------------------

/**
 * Ámbito contable de una fila económica. `official` es el libro que sale del
 * banco y va a la asamblea; `internal` es la contabilidad de gestión (caja de
 * efectivo, lotería, rifas). Ningún total agrega los dos: el filtro lo pone
 * `visibleLedgers()` en el `where` de toda query del módulo.
 */
export const ledger = pgEnum("ledger", ["official", "internal"]);

/** Una categoría económica es de ingreso o de gasto, nunca de las dos. */
export const economicCategoryKind = pgEnum("economic_category_kind", ["income", "expense"]);

/** Cuenta bancaria o caja de efectivo. */
export const financialAccountKind = pgEnum("financial_account_kind", ["bank", "cash"]);

/**
 * Catálogo de categorías económicas, EDITABLE por el club — la única excepción
 * deliberada a la costumbre del proyecto de modelar los catálogos como
 * `pgEnum`. Un presupuesto con categorías fijas no es usable: la junta añade
 * "subvención de la diputación" y no puede esperar a un despliegue.
 *
 * Es la dimensión compartida por las cuatro piezas del módulo (presupuesto,
 * movimientos, facturas recibidas y emitidas), y por eso NO lleva `ledger`:
 * "material deportivo" significa lo mismo en los dos libros.
 *
 * No se borran, se retiran con `isActive`: borrarlas rompería el histórico.
 */
export const economicCategories = pgTable(
  "economic_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: economicCategoryKind("kind").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("economic_categories_kind_name_idx").on(t.kind, t.name)],
).enableRLS();

/**
 * Cuenta donde vive el dinero: la del banco, la de eventos, la caja de
 * efectivo. "Movimientos bancarios" presupone al menos una, y el saldo solo
 * significa algo por cuenta — de ahí que el saldo inicial viva aquí.
 *
 * `ledger` va en la cuenta y lo heredan sus movimientos: la caja de efectivo
 * suele ser justamente la del libro interno.
 */
export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: financialAccountKind("kind").notNull().default("bank"),
    ledger: ledger("ledger").notNull().default("official"),
    iban: text("iban"), // null en las cuentas de efectivo
    openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
    openingBalanceOn: date("opening_balance_on"), // fecha a la que se refiere el saldo inicial
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("financial_accounts_name_idx").on(t.name)],
).enableRLS();

/**
 * De dónde salió el apunte: `manual` desde el formulario, `import` desde un
 * lote de `movement_import_batches`.
 */
export const movementSource = pgEnum("movement_source", ["import", "manual"]);

export const movementImportFormat = pgEnum("movement_import_format", ["n43", "csv"]);

/**
 * Un fichero subido en `/economia/movimientos/importar`: agrupa los apuntes
 * que trajo para poder verlos juntos, no para deshacer la importación (no hay
 * cascada de borrado hacia `accountMovements`, ver más abajo).
 */
export const movementImportBatches = pgTable("movement_import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => financialAccounts.id, { onDelete: "restrict" }),
  fileName: text("file_name").notNull(),
  format: movementImportFormat("format").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  importedByUserId: uuid("imported_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  rowCount: integer("row_count").notNull(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
}).enableRLS();

/**
 * Un apunte de una cuenta: la línea del extracto bancario, o el movimiento de
 * la caja de efectivo.
 *
 * `amountCents` va CON SIGNO —negativo el cargo, positivo el abono—, que es
 * como llega del banco y lo que permite que el saldo sea una suma y no un
 * `case`. `balanceCents` es el saldo que el propio extracto declara tras el
 * apunte: es del banco, no se calcula, y sirve para cuadrar la importación.
 *
 * `ledger` se copia de la cuenta al crear el apunte en vez de leerse por
 * `join`: es la columna que filtra toda query del módulo, y un `join` la
 * dejaría fuera del índice. Cambiar una cuenta de libro es un caso de esquina
 * que arrastra sus apuntes (lo hace `updateAccount`).
 *
 * `seasonId` se guarda explícito —resuelto con `seasonYearOf` y editable
 * después—, nunca derivado de `seasons.startsOn`/`endsOn`, que son nullable y
 * el seed base las deja vacías (ver decisión 4 del plan).
 */
export const accountMovements = pgTable(
  "account_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    ledger: ledger("ledger").notNull(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    bookedOn: date("booked_on").notNull(), // fecha de operación
    valueOn: date("value_on"), // fecha valor, si el extracto la trae
    amountCents: integer("amount_cents").notNull(), // con signo: - cargo, + abono
    concept: text("concept").notNull(),
    counterparty: text("counterparty"), // ordenante o beneficiario, tal cual lo da el banco
    balanceCents: integer("balance_cents"), // saldo declarado por el extracto tras el apunte
    categoryId: uuid("category_id").references(() => economicCategories.id, {
      onDelete: "set null",
    }),
    source: movementSource("source").notNull().default("manual"),
    // Huella de deduplicación: solo la rellena el importador (ver
    // decisión 5 del plan). Nula en los apuntes manuales — Postgres no choca
    // dos nulos contra el índice único, así que no se interponen entre sí.
    fingerprint: text("fingerprint"),
    importBatchId: uuid("import_batch_id").references(() => movementImportBatches.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("account_movements_account_booked_idx").on(t.accountId, t.bookedOn),
    uniqueIndex("account_movements_account_fingerprint_idx").on(t.accountId, t.fingerprint),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Módulo económico: facturas recibidas (ver docs/plan-modulo-economico.md, fase 4)
// ---------------------------------------------------------------------------

/** Estado de cobro de una factura recibida. */
export const receivedInvoiceStatus = pgEnum("received_invoice_status", [
  "pending",
  "paid",
  "disputed",
]);

/**
 * Estado de una factura emitida. No hay `deleted`: una factura emitida no se
 * borra nunca —dejaría un hueco permanente en la numeración—, se anula
 * (`cancelled`) o se rectifica (`rectified`, con la rectificativa apuntando a
 * ella por `rectifiesInvoiceId`). Ver decisión 7 del plan.
 */
export const issuedInvoiceStatus = pgEnum("issued_invoice_status", [
  "issued",
  "rectified",
  "cancelled",
]);

/**
 * De dónde sale la factura: `manual` desde el formulario, `extracted`
 * reservado para un futuro agente de lectura automática de PDF (decisión 10
 * del plan) — hoy ningún flujo escribe `extracted`.
 */
export const invoiceSource = pgEnum("invoice_source", ["manual", "extracted"]);

/**
 * Proveedor: quien emite las facturas recibidas. `taxId` único cuando se
 * conoce, pero nullable: no bloquea el alta de un proveedor sin CIF a mano.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    taxId: text("tax_id"), // CIF/NIF
    iban: text("iban"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    defaultCategoryId: uuid("default_category_id").references(() => economicCategories.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("suppliers_tax_id_idx").on(t.taxId).where(sql`${t.taxId} is not null`)],
).enableRLS();

/**
 * Factura recibida: el gasto devengado, con independencia de si ya ha salido
 * del banco (eso lo dice `movement_links`). El desglose fiscal se guarda
 * explícito —no derivado— porque las facturas reales no siempre cuadran al
 * céntimo y la fila refleja el papel (decisión 8 del plan).
 *
 * `invoiceNumber` es el número que le puso el PROVEEDOR, no uno propio del
 * club, por eso el único es compuesto con `supplierId`: dos proveedores
 * pueden compartir numeración por coincidencia.
 */
export const receivedInvoices = pgTable(
  "received_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    ledger: ledger("ledger").notNull().default("official"),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    issuedOn: date("issued_on").notNull(),
    dueDate: date("due_date"),
    categoryId: uuid("category_id").references(() => economicCategories.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    baseCents: integer("base_cents").notNull(),
    vatCents: integer("vat_cents").notNull().default(0),
    withholdingCents: integer("withholding_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    status: receivedInvoiceStatus("status").notNull().default("pending"),
    source: invoiceSource("source").notNull().default("manual"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("received_invoices_supplier_number_idx").on(t.supplierId, t.invoiceNumber),
    index("received_invoices_season_idx").on(t.seasonId),
  ],
).enableRLS();

/**
 * Factura emitida: el registro fiscal ÚNICO del club. Un club no puede tener
 * dos libros de facturas emitidas compartiendo numeración, así que aquí entran
 * también las de patrocinio (decisión 7 del plan); `sponsor_payments` enlaza
 * aquí por `issuedInvoiceId` y ya no guarda copia del número ni de la fecha.
 *
 * `number` lo pone el club —lo reserva `nextInvoiceNumber` sobre
 * `invoice_counters`—, de ahí el único global, al revés que en las recibidas.
 *
 * El destinatario se guarda DESNORMALIZADO: una factura congela los datos
 * fiscales del cliente el día que se emite. Renombrar el patrocinador no puede
 * reescribir facturas pasadas, que es lo que pasaba leyéndolos en vivo.
 * `sponsorId`/`personId` son referencias de navegación, opcionales y sin XOR:
 * una factura puede no corresponder a ninguno de los dos.
 */
export const issuedInvoices = pgTable(
  "issued_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    ledger: ledger("ledger").notNull().default("official"),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    issuedOn: date("issued_on").notNull(),
    dueDate: date("due_date"),
    customerName: text("customer_name").notNull(),
    customerTaxId: text("customer_tax_id"),
    customerAddress: text("customer_address"),
    sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => economicCategories.id, {
      onDelete: "set null",
    }),
    concept: text("concept"),
    baseCents: integer("base_cents").notNull(),
    vatCents: integer("vat_cents").notNull().default(0),
    withholdingCents: integer("withholding_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    status: issuedInvoiceStatus("status").notNull().default("issued"),
    rectifiesInvoiceId: uuid("rectifies_invoice_id").references(
      (): AnyPgColumn => issuedInvoices.id,
      { onDelete: "set null" },
    ),
    source: invoiceSource("source").notNull().default("manual"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("issued_invoices_number_idx").on(t.number),
    index("issued_invoices_season_idx").on(t.seasonId),
    index("issued_invoices_sponsor_idx").on(t.sponsorId),
  ],
).enableRLS();

/**
 * Conciliación N:M entre un apunte bancario y lo que lo justifica: una
 * transferencia paga varias facturas, una factura se paga a plazos, y una
 * remesa SEPA entra en el extracto como un único apunte agregado. Se enlaza
 * contra exactamente uno de los cuatro tipos de documento (`check` XOR); el
 * estado de conciliación (pendiente/parcial/conciliado) es DERIVADO —suma de
 * enlaces frente al importe de cada lado— nunca almacenado, para no
 * desincronizarse al borrar un enlace (decisión 5 del plan).
 */
export const movementLinks = pgTable(
  "movement_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    movementId: uuid("movement_id")
      .notNull()
      .references(() => accountMovements.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    receivedInvoiceId: uuid("received_invoice_id").references(() => receivedInvoices.id, {
      onDelete: "cascade",
    }),
    issuedInvoiceId: uuid("issued_invoice_id").references(() => issuedInvoices.id, {
      onDelete: "cascade",
    }),
    sepaRemittanceId: uuid("sepa_remittance_id").references(() => sepaRemittances.id, {
      onDelete: "cascade",
    }),
    sponsorPaymentId: uuid("sponsor_payment_id").references(() => sponsorPayments.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movement_links_movement_idx").on(t.movementId),
    index("movement_links_received_invoice_idx").on(t.receivedInvoiceId),
    index("movement_links_issued_invoice_idx").on(t.issuedInvoiceId),
    check(
      "movement_links_target_xor",
      sql`(
        (case when ${t.receivedInvoiceId} is not null then 1 else 0 end) +
        (case when ${t.issuedInvoiceId} is not null then 1 else 0 end) +
        (case when ${t.sepaRemittanceId} is not null then 1 else 0 end) +
        (case when ${t.sponsorPaymentId} is not null then 1 else 0 end)
      ) = 1`,
    ),
  ],
).enableRLS();

/** Un presupuesto se trabaja en borrador y se congela al aprobarlo en asamblea. */
export const budgetStatus = pgEnum("budget_status", ["draft", "approved"]);

/**
 * Presupuesto de una temporada en un libro. Uno por `(seasonId, ledger)`: el
 * presupuesto de gestión y el aprobado en asamblea son documentos distintos y
 * no se suman nunca.
 *
 * `approved` congela las líneas: dejan de editarse hasta que alguien con
 * `manage` del libro lo reabre, y las dos transiciones quedan en `audit_log`.
 */
export const seasonBudgets = pgTable(
  "season_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    ledger: ledger("ledger").notNull().default("official"),
    status: budgetStatus("status").notNull().default("draft"),
    approvedOn: date("approved_on"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("season_budgets_season_ledger_idx").on(t.seasonId, t.ledger)],
).enableRLS();

/**
 * Importe previsto para una categoría dentro de un presupuesto. Una línea por
 * categoría como mucho; sin línea significa "no presupuestado", que es distinto
 * de cero solo a efectos de lectura de la tabla.
 *
 * `categoryId` va a `restrict` y no a `set null` como en los apuntes: una
 * categoría presupuestada no puede desaparecer del presupuesto en silencio, y
 * la convención del módulo es retirarlas con `isActive`, no borrarlas.
 */
export const budgetLines = pgTable(
  "budget_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => seasonBudgets.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => economicCategories.id, { onDelete: "restrict" }),
    plannedCents: integer("planned_cents").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budget_lines_budget_category_idx").on(t.budgetId, t.categoryId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Auditoría: acciones sensibles (médico, bancario, usuarios/roles, inscripciones)
// ---------------------------------------------------------------------------

export const auditAction = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "approve",
  "reject",
]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: auditAction("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
).enableRLS();

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
export const registrations = pgTable(
  "registrations",
  {
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
    postalCode: text("postal_code"),
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
  },
  (t) => [
    index("registrations_kind_status_idx").on(t.kind, t.status),
    index("registrations_season_idx").on(t.seasonId),
    index("registrations_created_at_idx").on(t.createdAt),
  ],
).enableRLS();

/** Sugerencia de operativa enviada por un usuario ya registrado en la app. */
export const featureRequests = pgTable("feature_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: featureRequestStatus("status").notNull().default("pending"),
  requestedByUserId: uuid("requested_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    postalCode: text("postal_code"),
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
// Remesas SEPA: domiciliación de cuotas de jugador y de socio. Primera
// aproximación al apartado económico, deliberadamente sin balances ni
// presupuestos (ver plan `sepa-remesas`). Un cargo (`sepaCharges`) es el
// hecho contable — sobrevive a su remesa; una remesa (`sepaRemittances`) es
// el lote presentado al banco, que genera el XML pain.008.001.02.
// ---------------------------------------------------------------------------

export const sepaChargeStatus = pgEnum("sepa_charge_status", [
  "pending",
  "collected",
  "returned",
]);
export const sepaMandateStatus = pgEnum("sepa_mandate_status", ["active", "revoked"]);
export const sepaSequenceType = pgEnum("sepa_sequence_type", ["FRST", "RCUR"]);
export const sepaRemittanceKind = pgEnum("sepa_remittance_kind", ["player", "member"]);

/**
 * Contador de RUM (Referencia Única de Mandato), fila única incrementada
 * atómicamente (mismo patrón UPSERT que `invoiceCounters`). No lleva año: a
 * diferencia de la numeración de facturas, el RUM es un identificador SEPA
 * que no debe reutilizarse ni reiniciarse nunca.
 */
export const sepaMandateCounter = pgTable("sepa_mandate_counter", {
  id: integer("id").primaryKey().default(1),
  lastNumber: integer("last_number").notNull().default(0),
}).enableRLS();

/**
 * Mandato de domiciliación SEPA, una fila por persona PAGADORA (no por
 * jugador/socio: un tutor que paga por dos hijos reutiliza un único
 * mandato en ambos cargos). El RUM no se deriva nunca de datos mutables
 * (nombre, IBAN) — debe sobrevivir a cambios de esos datos.
 */
export const sepaMandates = pgTable(
  "sepa_mandates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payerPersonId: uuid("payer_person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" }),
    rum: text("rum").notNull(),
    signedOn: date("signed_on").notNull(),
    status: sepaMandateStatus("status").notNull().default("active"),
    revokedOn: date("revoked_on"),
    ibanSnapshot: text("iban_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sepa_mandates_rum_idx").on(t.rum),
    uniqueIndex("sepa_mandates_active_payer_idx")
      .on(t.payerPersonId)
      .where(sql`${t.status} = 'active'`),
  ],
).enableRLS();

/**
 * Un lote presentado al banco: un XML pain.008 = una fila aquí. `teamId` solo
 * se rellena en remesas `kind="player"` de un equipo concreto; las de socios
 * lo dejan null. `periodKey` agrupa qué cargos entraron: `"season"` para
 * cuotas no mensuales, `"YYYY-MM"` para una remesa mensual.
 */
export const sepaRemittances = pgTable(
  "sepa_remittances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: sepaRemittanceKind("kind").notNull(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    periodKey: text("period_key").notNull(),
    messageId: text("message_id").notNull(),
    collectionDate: date("collection_date").notNull(),
    // Importe total CONGELADO al generar la remesa, y fecha real de abono. Sin
    // esto no hay nada a lo que enlazar el apunte agregado que mete el banco:
    // el total no se puede recalcular sumando cargos porque una devolución le
    // anula el `remittanceId` al cargo (decisión 6 del plan).
    totalCents: integer("total_cents").notNull().default(0),
    settledOn: date("settled_on"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    generatedByUserId: uuid("generated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [uniqueIndex("sepa_remittances_message_id_idx").on(t.messageId)],
).enableRLS();

/**
 * Un cargo = una persona cobrada en un periodo. Tabla única para jugador y
 * socio (no dos tablas separadas): comparten estado, mandato, importe,
 * remesa y auditoría, y así una futura vista mixta no necesita UNION.
 * Exactamente uno de `membershipId`/`clubMemberId` debe estar informado
 * (según `kind`) — impuesto por el `check` de abajo y reforzado en las
 * acciones de generación.
 */
export const sepaCharges = pgTable(
  "sepa_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // `set null`: el cargo es el hecho contable, sobrevive si se borra el lote.
    remittanceId: uuid("remittance_id").references(() => sepaRemittances.id, {
      onDelete: "set null",
    }),
    kind: sepaRemittanceKind("kind").notNull(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "restrict",
    }),
    clubMemberId: uuid("club_member_id").references(() => clubMembers.id, {
      onDelete: "restrict",
    }),
    payerPersonId: uuid("payer_person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" }),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => sepaMandates.id, { onDelete: "restrict" }),
    periodKey: text("period_key").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: sepaChargeStatus("status").notNull().default("pending"),
    sequenceType: sepaSequenceType("sequence_type").notNull(),
    collectedOn: date("collected_on"),
    returnedOn: date("returned_on"),
    returnReason: text("return_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sepa_charges_membership_period_idx")
      .on(t.membershipId, t.seasonId, t.periodKey)
      .where(sql`${t.membershipId} is not null`),
    uniqueIndex("sepa_charges_club_member_period_idx")
      .on(t.clubMemberId, t.seasonId, t.periodKey)
      .where(sql`${t.clubMemberId} is not null`),
    index("sepa_charges_remittance_idx").on(t.remittanceId),
    index("sepa_charges_payer_idx").on(t.payerPersonId),
    // `resolveMandates` pregunta por aquí qué mandatos ya han cobrado algo.
    index("sepa_charges_mandate_idx").on(t.mandateId),
    check(
      "sepa_charges_membership_xor_club_member",
      sql`(${t.membershipId} is not null) <> (${t.clubMemberId} is not null)`,
    ),
  ],
).enableRLS();

/**
 * Historial de devoluciones de un cargo. `sepaCharges` reutiliza la misma
 * fila al devolverse (el índice único por periodo impide crear una fila
 * nueva) y anula su `remittanceId` para poder volver a entrar en otra
 * remesa — sin esta tabla se perdería qué remesa originó cada devolución.
 */
export const sepaChargeReturns = pgTable(
  "sepa_charge_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chargeId: uuid("charge_id")
      .notNull()
      .references(() => sepaCharges.id, { onDelete: "cascade" }),
    // `set null`: la fila de devolución sobrevive si se borra la remesa.
    remittanceId: uuid("remittance_id").references(() => sepaRemittances.id, {
      onDelete: "set null",
    }),
    returnedOn: date("returned_on").notNull(),
    returnReason: text("return_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sepa_charge_returns_charge_idx").on(t.chargeId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Relaciones (para consultas relacionales de Drizzle)
// ---------------------------------------------------------------------------

export const seasonsRelations = relations(seasons, ({ many }) => ({
  teams: many(teams),
  fees: many(fees),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  /** DEUDA EXPAND: vía `users.role_id`. La buena es `userAssignments`. */
  users: many(users),
  userAssignments: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

/**
 * Permite resolver usuario + rol + permisos en UNA sola sentencia SQL desde
 * `getCurrentUser`, que se ejecuta en cada petición.
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  /** Roles de acceso. Los permisos efectivos son la unión de todos ellos. */
  roleAssignments: many(userRoles),
  // `accessRole` y no `role`: mientras siga existiendo la columna heredada
  // `users.role` (enum), una relación llamada igual haría que Drizzle mezclara
  // ambas en el tipo inferido. Al retirar la columna se puede renombrar.
  //
  // DEUDA EXPAND: apunta a `users.role_id`, que ya solo existe para las RLS
  // viejas de Storage. Los lectores nuevos usan `roleAssignments`.
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
  issuedInvoice: one(issuedInvoices, {
    fields: [sponsorPayments.issuedInvoiceId],
    references: [issuedInvoices.id],
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
  team: one(teams, { fields: [personInjuryReports.teamId], references: [teams.id] }),
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

export const courtEventsRelations = relations(courtEvents, ({ one }) => ({
  team: one(teams, { fields: [courtEvents.teamId], references: [teams.id] }),
  createdBy: one(users, { fields: [courtEvents.createdByUserId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorUserId], references: [users.id] }),
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

export const sepaMandatesRelations = relations(sepaMandates, ({ one, many }) => ({
  payer: one(persons, { fields: [sepaMandates.payerPersonId], references: [persons.id] }),
  charges: many(sepaCharges),
}));

export const sepaRemittancesRelations = relations(sepaRemittances, ({ one, many }) => ({
  season: one(seasons, { fields: [sepaRemittances.seasonId], references: [seasons.id] }),
  team: one(teams, { fields: [sepaRemittances.teamId], references: [teams.id] }),
  generatedBy: one(users, {
    fields: [sepaRemittances.generatedByUserId],
    references: [users.id],
  }),
  charges: many(sepaCharges),
  links: many(movementLinks),
}));

export const sepaChargesRelations = relations(sepaCharges, ({ one, many }) => ({
  remittance: one(sepaRemittances, {
    fields: [sepaCharges.remittanceId],
    references: [sepaRemittances.id],
  }),
  season: one(seasons, { fields: [sepaCharges.seasonId], references: [seasons.id] }),
  membership: one(memberships, {
    fields: [sepaCharges.membershipId],
    references: [memberships.id],
  }),
  clubMember: one(clubMembers, {
    fields: [sepaCharges.clubMemberId],
    references: [clubMembers.id],
  }),
  payer: one(persons, { fields: [sepaCharges.payerPersonId], references: [persons.id] }),
  mandate: one(sepaMandates, { fields: [sepaCharges.mandateId], references: [sepaMandates.id] }),
  returns: many(sepaChargeReturns),
}));

export const sepaChargeReturnsRelations = relations(sepaChargeReturns, ({ one }) => ({
  charge: one(sepaCharges, { fields: [sepaChargeReturns.chargeId], references: [sepaCharges.id] }),
  remittance: one(sepaRemittances, {
    fields: [sepaChargeReturns.remittanceId],
    references: [sepaRemittances.id],
  }),
}));

export const financialAccountsRelations = relations(financialAccounts, ({ many }) => ({
  movements: many(accountMovements),
  importBatches: many(movementImportBatches),
}));

export const accountMovementsRelations = relations(accountMovements, ({ one }) => ({
  account: one(financialAccounts, {
    fields: [accountMovements.accountId],
    references: [financialAccounts.id],
  }),
  season: one(seasons, { fields: [accountMovements.seasonId], references: [seasons.id] }),
  category: one(economicCategories, {
    fields: [accountMovements.categoryId],
    references: [economicCategories.id],
  }),
  importBatch: one(movementImportBatches, {
    fields: [accountMovements.importBatchId],
    references: [movementImportBatches.id],
  }),
}));

export const movementImportBatchesRelations = relations(
  movementImportBatches,
  ({ one, many }) => ({
    account: one(financialAccounts, {
      fields: [movementImportBatches.accountId],
      references: [financialAccounts.id],
    }),
    importedBy: one(users, {
      fields: [movementImportBatches.importedByUserId],
      references: [users.id],
    }),
    movements: many(accountMovements),
  }),
);

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  defaultCategory: one(economicCategories, {
    fields: [suppliers.defaultCategoryId],
    references: [economicCategories.id],
  }),
  invoices: many(receivedInvoices),
}));

export const receivedInvoicesRelations = relations(receivedInvoices, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [receivedInvoices.supplierId],
    references: [suppliers.id],
  }),
  season: one(seasons, { fields: [receivedInvoices.seasonId], references: [seasons.id] }),
  team: one(teams, { fields: [receivedInvoices.teamId], references: [teams.id] }),
  category: one(economicCategories, {
    fields: [receivedInvoices.categoryId],
    references: [economicCategories.id],
  }),
  links: many(movementLinks),
}));

export const issuedInvoicesRelations = relations(issuedInvoices, ({ one, many }) => ({
  season: one(seasons, { fields: [issuedInvoices.seasonId], references: [seasons.id] }),
  category: one(economicCategories, {
    fields: [issuedInvoices.categoryId],
    references: [economicCategories.id],
  }),
  sponsor: one(sponsors, { fields: [issuedInvoices.sponsorId], references: [sponsors.id] }),
  person: one(persons, { fields: [issuedInvoices.personId], references: [persons.id] }),
  rectifies: one(issuedInvoices, {
    fields: [issuedInvoices.rectifiesInvoiceId],
    references: [issuedInvoices.id],
    relationName: "rectification",
  }),
  rectifiedBy: many(issuedInvoices, { relationName: "rectification" }),
  links: many(movementLinks),
}));

export const movementLinksRelations = relations(movementLinks, ({ one }) => ({
  movement: one(accountMovements, {
    fields: [movementLinks.movementId],
    references: [accountMovements.id],
  }),
  receivedInvoice: one(receivedInvoices, {
    fields: [movementLinks.receivedInvoiceId],
    references: [receivedInvoices.id],
  }),
  issuedInvoice: one(issuedInvoices, {
    fields: [movementLinks.issuedInvoiceId],
    references: [issuedInvoices.id],
  }),
  sepaRemittance: one(sepaRemittances, {
    fields: [movementLinks.sepaRemittanceId],
    references: [sepaRemittances.id],
  }),
  sponsorPayment: one(sponsorPayments, {
    fields: [movementLinks.sponsorPaymentId],
    references: [sponsorPayments.id],
  }),
}));

export const seasonBudgetsRelations = relations(seasonBudgets, ({ one, many }) => ({
  season: one(seasons, {
    fields: [seasonBudgets.seasonId],
    references: [seasons.id],
  }),
  lines: many(budgetLines),
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(seasonBudgets, {
    fields: [budgetLines.budgetId],
    references: [seasonBudgets.id],
  }),
  category: one(economicCategories, {
    fields: [budgetLines.categoryId],
    references: [economicCategories.id],
  }),
}));
